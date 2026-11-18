\set ON_ERROR_STOP on

-- SDD-0633 · contrato de la 0542 (EXECUTE de is_platform_admin() para authenticated).
--
-- Arma la función con el cuerpo de la 0058 y el ACL que el DG midió en
-- producción ({postgres=X, service_role=X}: el revoke de la 0211 y ninguna
-- devolución ejecutada), la tabla feature_flags con la policy LITERAL de la 0355,
-- y aplica la 0542 REAL dos veces.
--
-- Lo que defiende:
--   (0) antes de la 0542, authenticated no puede ejecutarla (el bug medido);
--   (a) authenticated la ejecuta y obtiene false si no está en platform_admins;
--   (b) un platform admin sintético obtiene true;
--   (c) el UPDATE de feature_flags pasa para el platform admin y no para un
--       admin del tenant;
--   (d) anon no la ejecuta, y PUBLIC no tiene EXECUTE;
--   (e) la 0542 es idempotente.
--
-- CONTROL ROJO: sin el grant de la 0542 cae su postflight («authenticated sigue
-- sin EXECUTE»), y sin el postflight cae «(a)».
-- Termina siempre en ROLLBACK. Solo ids y textos sintéticos.
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table auth.users (id uuid primary key);

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null references auth.users(id),
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);
grant select on public.user_tenants to authenticated;

-- Copia de 0453.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

-- Forma de la 0058, con su cuerpo literal.
create table public.platform_admins (user_id uuid primary key references auth.users(id));
alter table public.platform_admins enable row level security;
create function public.is_platform_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;
-- El ACL medido en producción el 2026-11-15: {postgres=X/postgres, service_role=X/postgres}.
revoke all on function public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.is_platform_admin() to service_role;

-- feature_flags con la forma de la 0042 y la policy de UPDATE LITERAL de la 0355.
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  key text not null,
  enabled boolean not null,
  updated_by uuid,
  unique (tenant_id, key)
);
alter table public.feature_flags enable row level security;
create policy "feature_flags_tenant_select"
  on public.feature_flags for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));
create policy feature_flags_platform_admin_update
  on public.feature_flags
  for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.is_platform_admin())
  )
  with check (tenant_id = (select public.get_user_tenant_id()));
grant select, update on public.feature_flags to authenticated;

-- ── Fixture ─────────────────────────────────────────────────────────────
-- T1 = 1…1. a1 admin de T1 (no es superadmin) · a2 admin de T1 y superadmin ·
-- k1 comercial de T1 (no es superadmin).
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');
insert into auth.users values
  ('a0000000-0000-0000-0000-0000000000a1'),
  ('a0000000-0000-0000-0000-0000000000a2'),
  ('a0000000-0000-0000-0000-0000000000b1');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('a0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'commercial');
insert into public.platform_admins values ('a0000000-0000-0000-0000-0000000000a2');
insert into public.feature_flags (tenant_id, key, enabled) values
  ('11111111-1111-1111-1111-111111111111', 'chatwoot_portal', false);

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0542: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

create function pg_temp.u(p_user text) returns uuid language sql immutable as $$
  select ('a0000000-0000-0000-0000-0000000000' || p_user)::uuid;
$$;

/** El resultado de is_platform_admin() para un rol y una persona, o el error. */
create function pg_temp.es_super(p_rol text, p_user text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.u(p_user)::text, ''), true);
  execute format('set local role %I', p_rol);
  begin
    select public.is_platform_admin()::text into v;
  exception when others then
    v := 'ERROR: ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

/** Filas que una persona logra actualizar en feature_flags, o el error. */
create function pg_temp.enciende(p_user text) returns text language plpgsql as $$
declare v int; v_msg text;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.u(p_user)::text, true);
  set local role authenticated;
  begin
    update public.feature_flags set enabled = true, updated_by = pg_temp.u(p_user)
    where key = 'chatwoot_portal';
    get diagnostics v = row_count;
    v_msg := v::text;
  exception when others then
    v_msg := 'ERROR: ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v_msg;
end;
$$;

create function pg_temp.flag() returns boolean language sql as $$
  select enabled from public.feature_flags where key = 'chatwoot_portal';
$$;

-- (0) Antes de la 0542: el bug medido. authenticated no la ejecuta, y por eso
-- la policy de feature_flags revienta incluso para el superadmin.
select pg_temp.assert_true(pg_temp.es_super('authenticated', 'a2') ~ 'permission denied',
  '(0) antes de la 0542, authenticated no puede ejecutar is_platform_admin()');
select pg_temp.assert_true(pg_temp.enciende('a2') ~ 'permission denied',
  '(0) antes de la 0542, el UPDATE del superadmin cae por la policy');

\ir ../migrations/0542_is_platform_admin_execute_authenticated.sql

-- (a) authenticated la ejecuta; quien no está en platform_admins obtiene false.
select pg_temp.assert_true(pg_temp.es_super('authenticated', 'a1') = 'false',
  '(a) un admin del tenant que no es superadmin obtiene false');
select pg_temp.assert_true(pg_temp.es_super('authenticated', 'b1') = 'false',
  '(a) un comercial obtiene false');

-- (b) el platform admin sintético obtiene true.
select pg_temp.assert_true(pg_temp.es_super('authenticated', 'a2') = 'true',
  '(b) el superadmin obtiene true');

-- (c) el UPDATE de feature_flags: el admin del tenant no lo logra (0 filas, en
-- silencio por la RLS) y el superadmin sí.
select pg_temp.assert_true(pg_temp.enciende('a1') = '0',
  '(c) el admin del tenant no logra encender el flag');
select pg_temp.assert_true(pg_temp.flag() = false, '(c) el flag sigue apagado tras el intento del admin');
select pg_temp.assert_true(pg_temp.enciende('a2') = '1',
  '(c) el superadmin enciende el flag');
select pg_temp.assert_true(pg_temp.flag() = true, '(c) el flag quedó encendido');

-- (d) anon no la ejecuta, y PUBLIC no tiene EXECUTE.
select pg_temp.assert_true(pg_temp.es_super('anon', 'a2') ~ 'permission denied',
  '(d) anon no puede ejecutar is_platform_admin()');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.is_platform_admin()', 'EXECUTE'),
  '(d) has_function_privilege de anon es false');
select pg_temp.assert_true(not exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.is_platform_admin()'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  '(d) PUBLIC no tiene EXECUTE');
select pg_temp.assert_true(has_function_privilege('service_role', 'public.is_platform_admin()', 'EXECUTE'),
  '(d) service_role conserva EXECUTE');

-- (e) idempotente: aplicarla otra vez no cambia nada y no falla.
\ir ../migrations/0542_is_platform_admin_execute_authenticated.sql
select pg_temp.assert_true(pg_temp.es_super('authenticated', 'a2') = 'true'
    and pg_temp.es_super('authenticated', 'a1') = 'false'
    and pg_temp.es_super('anon', 'a2') ~ 'permission denied',
  '(e) la segunda aplicación deja el mismo resultado');

select 'TEST 0542: ' || nextval('pg_temp.assertion_count') - 1 || ' aserciones OK' as resultado;

rollback;
