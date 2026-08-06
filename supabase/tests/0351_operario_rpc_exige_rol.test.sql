\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0351. Fixtures ficticios y rollback: no toca prod.
--
-- Lo que defiende, que es exactamente lo que puede romperse en silencio:
--   1. operations y admin siguen gestionando operarios (si esto se rompe, el
--      módulo queda muerto y nadie se entera hasta que haga falta un PIN),
--   2. marketing/support/accounting/commercial NO pueden resetear un PIN — el
--      hallazgo; y el hash viejo queda intacto,
--   3. el candado corre ANTES de "Operario no encontrado": sin oráculo para
--      adivinar ids ajenos,
--   4. un usuario DESACTIVADO no pasa (current_studio_role filtra disabled_at),
--   5. el candado de tenant que ya existía sigue vivo — el rol no lo reemplaza.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);

create table public.operario_pins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  warehouse_id uuid,
  display_name text not null,
  display_name_cn text,
  pin_hash text not null,
  role text not null default 'operario',
  active boolean not null default true
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1;
$$;

create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select ut.role from public.user_tenants ut
   where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1;
$$;

create function public.assert_tenant_match(p_tenant_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_caller_tenant uuid := public.get_user_tenant_id();
begin
  if p_tenant_id is null then
    raise exception 'Tenant ID required' using errcode = '42501';
  end if;
  if v_caller_tenant is null then
    raise exception 'Authenticated tenant required for this operation' using errcode = '42501';
  end if;
  if p_tenant_id <> v_caller_tenant then
    raise exception 'Tenant mismatch: caller does not belong to tenant %', p_tenant_id
      using errcode = '42501';
  end if;
end;
$$;

create function public.validate_operario_pin_format(p_pin text) returns void
language plpgsql immutable set search_path = public as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN inválido' using errcode = 'P0010';
  end if;
end;
$$;

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Tenant A (f1) con un usuario por rol · Tenant B (f2) con un operations ajeno.
insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 'admin',      null),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1', 'operations', null),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f1', 'marketing',  null),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000f1', 'support',    null),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000f1', 'operations', now()),
  ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000f2', 'operations', null);

insert into public.operario_pins (id, tenant_id, warehouse_id, display_name, pin_hash)
values ('00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-0000000000f1',
        '00000000-0000-0000-0000-0000000000d1',
        'Wei', extensions.crypt('1111', extensions.gen_salt('bf')));

\ir ../migrations/0351_operario_rpc_exige_rol.sql

-- ── 1. operations y admin siguen trabajando ─────────────────────────────────
do $t1$
declare v_id uuid; v_hash_antes text; v_hash_despues text;
begin
  select pin_hash into v_hash_antes from public.operario_pins
   where id = '00000000-0000-0000-0000-0000000000c1';

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  perform public.admin_reset_operario_pin('00000000-0000-0000-0000-0000000000c1', '2222');

  select pin_hash into v_hash_despues from public.operario_pins
   where id = '00000000-0000-0000-0000-0000000000c1';
  if v_hash_despues = v_hash_antes then
    raise exception 'REGRESIÓN: operations no pudo resetear el PIN';
  end if;

  -- admin crea uno nuevo
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  v_id := public.admin_create_operario(
    '00000000-0000-0000-0000-0000000000f1',
    '00000000-0000-0000-0000-0000000000d1',
    'Li', null, '3333', 'operario');
  if v_id is null then raise exception 'REGRESIÓN: admin no pudo crear operario'; end if;

  perform public.admin_update_operario(v_id, 'Li Wei', null, 'supervisor',
                                       '00000000-0000-0000-0000-0000000000d1');
  perform public.admin_set_operario_active(v_id, false);
end;
$t1$;

-- ── 2. Los roles sin permiso rebotan, y el PIN no se mueve ──────────────────
do $t2$
declare
  v_hash_antes text; v_hash_despues text;
  v_rol text; v_uid uuid; v_rebotó boolean;
begin
  select pin_hash into v_hash_antes from public.operario_pins
   where id = '00000000-0000-0000-0000-0000000000c1';

  foreach v_uid in array array[
    '00000000-0000-0000-0000-0000000000b3'::uuid,  -- marketing
    '00000000-0000-0000-0000-0000000000b4'::uuid   -- support
  ] loop
    select role into v_rol from public.user_tenants where user_id = v_uid;
    v_rebotó := false;
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    begin
      perform public.admin_reset_operario_pin('00000000-0000-0000-0000-0000000000c1', '9999');
    exception when insufficient_privilege then
      v_rebotó := true;
    end;
    if not v_rebotó then
      raise exception 'REGRESIÓN: el rol % reseteó el PIN de un operario', v_rol;
    end if;
  end loop;

  select pin_hash into v_hash_despues from public.operario_pins
   where id = '00000000-0000-0000-0000-0000000000c1';
  if v_hash_despues is distinct from v_hash_antes then
    raise exception 'El PIN cambió pese a que la llamada rebotó';
  end if;
end;
$t2$;

-- ── 3. Sin oráculo: el rol se chequea antes de mirar si el operario existe ──
do $t3$
declare v_estado text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);
  begin
    -- id que no existe: si el candado corriera después, contestaría P0014 y
    -- serviría para sondear qué ids existen.
    perform public.admin_reset_operario_pin('00000000-0000-0000-0000-0000000000cc', '9999');
    v_estado := 'no lanzó';
  exception
    when insufficient_privilege then v_estado := 'ok';
    when others then v_estado := 'filtró: ' || sqlstate;
  end;
  if v_estado <> 'ok' then
    raise exception 'El candado de rol no corre primero (%)', v_estado;
  end if;
end;
$t3$;

-- ── 4. Un usuario desactivado no pasa ───────────────────────────────────────
do $t4$
declare v_rebotó boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', true);
  begin
    perform public.admin_reset_operario_pin('00000000-0000-0000-0000-0000000000c1', '9999');
  exception when insufficient_privilege then
    v_rebotó := true;
  end;
  if not v_rebotó then
    raise exception 'Un operations DESACTIVADO gestionó operarios';
  end if;
end;
$t4$;

-- ── 5. El candado de tenant sigue vivo (el rol no lo reemplazó) ─────────────
do $t5$
declare v_msg text := '';
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b6', true);
  begin
    -- operations, pero de OTRO tenant.
    perform public.admin_reset_operario_pin('00000000-0000-0000-0000-0000000000c1', '9999');
  exception when insufficient_privilege then
    v_msg := sqlerrm;
  end;
  if v_msg not like 'Tenant mismatch%' then
    raise exception 'El candado de tenant se perdió (mensaje: %)', v_msg;
  end if;
end;
$t5$;

rollback;
