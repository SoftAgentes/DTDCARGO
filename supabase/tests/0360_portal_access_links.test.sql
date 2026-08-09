\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0360 (SDD-0253). Fixtures ficticios y rollback:
-- no toca prod.
--
-- El código de `/entrar/<code>` es una LLAVE AL PORTADOR: quien lo tenga entra
-- como el cliente. Lo que este contrato defiende, probado con MUTACIÓN real (no
-- mirando el catálogo):
--   1. `anon` no puede LEER la tabla — si pudiera, cualquiera se llevaría todas
--      las llaves vivas con un GET a PostgREST
--   2. `anon` no puede EJECUTAR ninguno de los dos RPC
--   3. `authenticated` no puede INSERTAR directo (bypass del RPC → llave para un
--      cliente de otro tenant)
--   4. el RPC emite bien para un cliente del PROPIO tenant
--   5. el RPC RECHAZA un cliente de OTRO tenant — el hueco que de verdad importa
--   6. el RPC rechaza un cliente borrado (soft delete)
--   7. `code` es único: dos llaves iguales serían dos clientes con la misma puerta
--   8. un asesor sólo VE los enlaces de su tenant (RLS de select)
--   9. revocar es idempotente y NO cruza tenants

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

-- La migración califica `extensions.gen_random_uuid()` (convención del repo: el
-- search_path de las funciones no incluye el schema de extensiones). En el
-- Postgres desechable ese schema no viene hecho.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema auth;
create table auth.users (id uuid primary key, email text unique);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);

create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);
grant select on public.user_tenants to authenticated;

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create table public.clients (
  id         uuid primary key,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  email      text,
  deleted_at timestamptz
);

-- ── Fixture: DOS tenants, porque el hueco que importa es el cruce ───────────
insert into public.tenants values
  ('11111111-1111-1111-1111-111111111111'),   -- DTD
  ('22222222-2222-2222-2222-222222222222');   -- ajeno
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001','sam@ejemplo.test'),
  ('a0000000-0000-0000-0000-000000000002','ajeno@ejemplo.test');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','admin'),
  ('a0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','admin');
insert into public.clients (id, tenant_id, email, deleted_at) values
  ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','cliente@ejemplo.test', null),
  ('c0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','ajeno@ejemplo.test', null),
  ('c0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','borrado@ejemplo.test', now());

\ir ../migrations/0360_portal_access_links.sql

-- ── 1 y 2. anon no lee ni ejecuta ──────────────────────────────────────────
do $t1$
declare ok boolean;
begin
  set local role anon;

  ok := false;
  begin
    perform 1 from public.portal_access_links limit 1;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: anon puede leer las llaves de acceso'; end if;

  ok := false;
  begin
    perform public.portal_create_access_link(
      'c0000000-0000-0000-0000-000000000001','ANONCODE12', 72);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: anon puede emitir un acceso'; end if;

  ok := false;
  begin
    perform public.portal_revoke_access_link('00000000-0000-0000-0000-000000000000');
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: anon puede revocar accesos'; end if;

  reset role;
end;
$t1$;

-- ── 3. authenticated NO inserta directo (el RPC es el único camino) ────────
do $t3$
declare ok boolean;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);

  ok := false;
  begin
    insert into public.portal_access_links (tenant_id, client_id, code, expires_at)
    values ('11111111-1111-1111-1111-111111111111',
            'c0000000-0000-0000-0000-000000000001','BYPASS1234', now() + interval '1 day');
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: authenticated insertó una llave saltándose el RPC'; end if;

  reset role;
end;
$t3$;

-- ── 4, 5 y 6. el RPC emite para el propio tenant y rechaza el resto ────────
do $t4$
declare ok boolean; v_id uuid; v_exp timestamptz; v_tenant uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);

  -- 4. propio tenant: emite
  select link_id, expires_at into v_id, v_exp
    from public.portal_create_access_link(
      'c0000000-0000-0000-0000-000000000001','PROPIO1234', 72);
  if v_id is null then raise exception 'El RPC no emitió para un cliente del propio tenant'; end if;
  if v_exp <= now() then raise exception 'El acceso nació vencido'; end if;

  select tenant_id into v_tenant from public.portal_access_links where id = v_id;
  if v_tenant <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'La llave quedó atada al tenant equivocado';
  end if;

  -- 5. cliente de OTRO tenant: rechaza
  ok := false;
  begin
    perform public.portal_create_access_link(
      'c0000000-0000-0000-0000-000000000002','AJENO12345', 72);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: se emitió una llave para un cliente de OTRO tenant'; end if;

  -- 6. cliente borrado: rechaza
  ok := false;
  begin
    perform public.portal_create_access_link(
      'c0000000-0000-0000-0000-000000000003','BORRADO123', 72);
  exception when others then ok := true;
  end;
  if not ok then raise exception 'HUECO: se emitió una llave para un cliente borrado'; end if;

  reset role;
end;
$t4$;

-- ── 7. el código es único ──────────────────────────────────────────────────
do $t7$
declare ok boolean;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);

  ok := false;
  begin
    perform public.portal_create_access_link(
      'c0000000-0000-0000-0000-000000000001','PROPIO1234', 72);
  exception when unique_violation then ok := true;
  end;
  if not ok then raise exception 'HUECO: dos llaves con el mismo código'; end if;

  reset role;
end;
$t7$;

-- ── 8. RLS de lectura: cada quien ve lo suyo ───────────────────────────────
do $t8$
declare n int;
begin
  set local role authenticated;

  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  select count(*) into n from public.portal_access_links;
  if n <> 1 then raise exception 'El dueño del tenant debería ver 1 enlace, ve %', n; end if;

  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  select count(*) into n from public.portal_access_links;
  if n <> 0 then raise exception 'HUECO: un tenant ajeno ve % enlaces de otro', n; end if;

  reset role;
end;
$t8$;

-- ── 9. revocar: idempotente y sin cruzar tenants ───────────────────────────
do $t9$
declare v_id uuid; v_rev timestamptz; v_rev2 timestamptz;
begin
  select id into v_id from public.portal_access_links where code = 'PROPIO1234';

  set local role authenticated;

  -- el ajeno intenta revocar: no debe pasar nada
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  perform public.portal_revoke_access_link(v_id);
  reset role;
  select revoked_at into v_rev from public.portal_access_links where id = v_id;
  if v_rev is not null then raise exception 'HUECO: un tenant ajeno revocó una llave que no es suya'; end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  perform public.portal_revoke_access_link(v_id);
  reset role;
  select revoked_at into v_rev from public.portal_access_links where id = v_id;
  if v_rev is null then raise exception 'El dueño no pudo revocar su propia llave'; end if;

  -- idempotente: revocar de nuevo no mueve la marca original
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  perform public.portal_revoke_access_link(v_id);
  reset role;
  select revoked_at into v_rev2 from public.portal_access_links where id = v_id;
  if v_rev2 <> v_rev then raise exception 'Revocar dos veces movió la fecha original'; end if;
end;
$t9$;

rollback;
