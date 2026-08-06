\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0352. Fixtures ficticios y rollback: no toca prod.
--
-- Lo que defiende, que es exactamente lo que puede romperse en silencio:
--   1. el invitado legítimo acepta y queda con SU rol y SU oficina (el camino
--      feliz del onboarding sigue vivo — si esto se rompe, nadie entra nunca),
--   2. otra sesión con EL MISMO token rebota con 42501 — el hallazgo,
--   3. el rebote ocurre ANTES de escribir: ni membresía, ni invitación marcada
--      como aceptada (si no, el intruso quema la invitación del legítimo),
--   4. la comparación es case-insensitive y tolera espacios: un correo guardado
--      como "Nuevo@DTD.test " no puede dejar afuera a su dueño,
--   5. siguen vivos los candados viejos (auto-aceptación, ya aceptada).

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table auth.users (id uuid primary key, email text);

create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  email text not null,
  role text not null,
  region text,
  token text not null unique,
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null
);

create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  region text,
  invited_by uuid,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);

create table public.user_profiles (
  user_id uuid primary key,
  first_name text,
  last_name text,
  updated_at timestamptz not null default now()
);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- T = tenant · I = admin que invita · OK = el invitado · MALO = sesión ajena
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@dtd.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'nuevo@dtd.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'ajeno@dtd.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'mayus@dtd.test');

insert into public.user_invitations (tenant_id, email, role, region, token, invited_by, expires_at)
values
  ('00000000-0000-0000-0000-0000000000f1', 'nuevo@dtd.test', 'accounting', 've',
   'TOK-LEGITIMO', '00000000-0000-0000-0000-0000000000a1', now() + interval '7 days'),
  ('00000000-0000-0000-0000-0000000000f1', '  MAYUS@DTD.test  ', 'commercial', 'cn',
   'TOK-MAYUSCULAS', '00000000-0000-0000-0000-0000000000a1', now() + interval '7 days');

\ir ../migrations/0352_invitacion_nominal.sql

-- ── 2 + 3. Una sesión ajena con el token NO se lleva el rol ──────────────────
do $t1$
declare
  v_rebotó boolean := false;
  n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
  begin
    perform public.studio_accept_invitation('TOK-LEGITIMO', 'Ajeno', 'Intruso');
  exception when insufficient_privilege then
    v_rebotó := true;
  end;

  if not v_rebotó then
    raise exception 'REGRESIÓN: una sesión ajena aceptó una invitación que no era suya';
  end if;

  -- No basta con que lance: no debe haber escrito nada.
  select count(*) into n from public.user_tenants
   where user_id = '00000000-0000-0000-0000-0000000000a3';
  if n <> 0 then raise exception 'El intruso quedó con membresía (% filas)', n; end if;

  select count(*) into n from public.user_invitations
   where token = 'TOK-LEGITIMO' and accepted_at is not null;
  if n <> 0 then
    raise exception 'El intruso quemó la invitación del legítimo (quedó aceptada)';
  end if;
end;
$t1$;

-- ── 1. El invitado legítimo sí entra, con su rol y su oficina ───────────────
do $t2$
declare v_role text; v_region text; v_accepted timestamptz;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
  perform public.studio_accept_invitation('TOK-LEGITIMO', 'Nuevo', 'Empleado');

  select role, region into v_role, v_region
    from public.user_tenants
   where user_id = '00000000-0000-0000-0000-0000000000a2';

  if v_role is null then
    raise exception 'REGRESIÓN: el invitado legítimo no quedó con membresía';
  end if;
  if v_role <> 'accounting' then raise exception 'Rol equivocado: %', v_role; end if;
  -- El fix 0203 (propagar region) no se puede perder por el camino.
  if v_region is distinct from 've' then raise exception 'Region no propagada: %', v_region; end if;

  select accepted_at into v_accepted from public.user_invitations where token = 'TOK-LEGITIMO';
  if v_accepted is null then raise exception 'La invitación no quedó marcada como aceptada'; end if;
end;
$t2$;

-- ── 4. Mayúsculas y espacios no dejan afuera a su dueño ─────────────────────
do $t3$
declare v_role text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', true);
  perform public.studio_accept_invitation('TOK-MAYUSCULAS', null, null);

  select role into v_role from public.user_tenants
   where user_id = '00000000-0000-0000-0000-0000000000a4';
  if v_role is distinct from 'commercial' then
    raise exception 'Un correo con mayúsculas/espacios dejó afuera a su dueño (rol=%)', v_role;
  end if;
end;
$t3$;

-- ── 5. Los candados viejos siguen vivos ─────────────────────────────────────
do $t4$
declare v_rebotó boolean := false;
begin
  -- ya aceptada
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
  begin
    perform public.studio_accept_invitation('TOK-LEGITIMO', null, null);
  exception when unique_violation then
    v_rebotó := true;
  end;
  if not v_rebotó then raise exception 'Una invitación ya aceptada se aceptó de nuevo'; end if;

  -- auto-aceptación: el admin que invitó no puede aceptar su propia invitación
  v_rebotó := false;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  insert into public.user_invitations (tenant_id, email, role, region, token, invited_by, expires_at)
  values ('00000000-0000-0000-0000-0000000000f1', 'admin@dtd.test', 'admin', 've',
          'TOK-PROPIA', '00000000-0000-0000-0000-0000000000a1', now() + interval '7 days');
  begin
    perform public.studio_accept_invitation('TOK-PROPIA', null, null);
  exception when insufficient_privilege then
    v_rebotó := true;
  end;
  if not v_rebotó then raise exception 'El invitador aceptó su propia invitación'; end if;
end;
$t4$;

rollback;
