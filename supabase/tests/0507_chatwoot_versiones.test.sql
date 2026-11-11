\set ON_ERROR_STOP on

-- SDD-0588 · contrato de 0507 (chatwoot_version_checks + chatwoot_update_requests).
--
-- Monta lo mínimo que 0507 da por sentado: auth.uid() leyendo el JWT, tenants,
-- user_tenants, get_user_tenant_id() (copia de 0453) e is_tenant_admin() (copia
-- de 0386). Después aplica la 0507 REAL y escribe como la Server Action (rol
-- authenticated con el JWT de cada usuario) y como el cron (service_role).
--
-- CONTROL ROJO: sin 0507 cae en la primera aserción (la tabla no existe).
--
-- Termina siempre en ROLLBACK. Solo ids y versiones sintéticas.
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_version_checks') is not null then
    raise exception 'Fixture 0507 rechazada: el objeto real ya existe';
  end if;
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

create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
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

-- Copia de 0386.
create function public.is_tenant_admin() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.role = 'admin'
      and ut.disabled_at is null
  ), false);
$fn$;
grant execute on function public.is_tenant_admin() to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001', 'dtd'),
  ('10000000-0000-0000-0000-000000000002', 'otro');
insert into auth.users values
  ('20000000-0000-0000-0000-000000000001'),  -- admin de T1
  ('20000000-0000-0000-0000-000000000002'),  -- admin de T2
  ('20000000-0000-0000-0000-000000000003');  -- commercial de T1
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'commercial', null);

\ir ../migrations/0507_chatwoot_versiones.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0507: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Ejecuta con un rol (y el JWT del usuario si es authenticated).
create function pg_temp.como(p_rol text, p_user uuid, p_sql text) returns integer language plpgsql as $$
declare v_rows integer;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  execute format('set local role %I', p_rol);
  execute p_sql;
  get diagnostics v_rows = row_count;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v_rows;
exception when others then
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  raise;
end;
$$;

-- ¿Falla la sentencia? Devuelve el SQLSTATE o null si pasó.
create function pg_temp.falla(p_rol text, p_user uuid, p_sql text) returns text language plpgsql as $$
begin
  perform pg_temp.como(p_rol, p_user, p_sql);
  return null;
exception when others then
  return sqlstate;
end;
$$;

-- Cuántas filas de una tabla ve el usuario.
create function pg_temp.ve(p_user uuid, p_tabla text) returns integer language plpgsql as $$
declare v integer;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  execute format('select count(*) from public.%I', p_tabla) into v;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

-- 1. Revisiones: solo service_role escribe; solo el admin del tenant lee.
do $checks$
declare
  t1 constant uuid := '10000000-0000-0000-0000-000000000001';
  t2 constant uuid := '10000000-0000-0000-0000-000000000002';
  admin1 constant uuid := '20000000-0000-0000-0000-000000000001';
  admin2 constant uuid := '20000000-0000-0000-0000-000000000002';
  comercial constant uuid := '20000000-0000-0000-0000-000000000003';
begin
  perform pg_temp.assert_true(to_regclass('public.chatwoot_version_checks') is not null,
    'existe chatwoot_version_checks');
  perform pg_temp.assert_true(pg_temp.como('service_role', null, format(
    $q$insert into public.chatwoot_version_checks (tenant_id, status, installed_version, latest_version, releases)
       values (%L, 'hay_nueva', '4.19.1', '4.20.0', '[{"version":"4.20.0"}]'), (%L, 'al_dia', '4.20.0', '4.20.0', '[]')$q$,
    t1, t2)) = 2, 'el cron (service_role) guarda revisiones');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1, format(
    $q$insert into public.chatwoot_version_checks (tenant_id, status) values (%L, 'al_dia')$q$, t1)) = '42501',
    'ni el admin escribe revisiones: solo el vigilante');
  perform pg_temp.assert_true(pg_temp.ve(admin1, 'chatwoot_version_checks') = 1,
    'el admin de T1 ve solo la revisión de T1');
  perform pg_temp.assert_true(pg_temp.ve(comercial, 'chatwoot_version_checks') = 0,
    'quien no es admin no ve las revisiones');
  perform pg_temp.assert_true(pg_temp.ve(admin2, 'chatwoot_version_checks') = 1,
    'el admin de T2 ve solo la suya');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1,
    $q$update public.chatwoot_version_checks set status = 'al_dia'$q$) = '42501',
    'nadie edita una revisión desde Studio');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1,
    'delete from public.chatwoot_version_checks') = '42501',
    'nadie borra una revisión desde Studio');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, format(
    $q$insert into public.chatwoot_version_checks (tenant_id, status, installed_version) values (%L, 'al_dia', '4.19')$q$, t1)) = '23514',
    'una versión sin el formato X.Y.Z no entra');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, format(
    $q$insert into public.chatwoot_version_checks (tenant_id, status) values (%L, 'error')$q$, t1)) = '23514',
    'un error sin código no entra');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, format(
    $q$insert into public.chatwoot_version_checks (tenant_id, status, error_code) values (%L, 'al_dia', 'releases_formato')$q$, t1)) = '23514',
    'un código de error sin estado error no entra');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, format(
    $q$insert into public.chatwoot_version_checks (tenant_id, status, installed_version) values (%L, 'hay_nueva', '4.19.1')$q$, t1)) = '23514',
    'hay_nueva exige instalada y disponible');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, format(
    $q$insert into public.chatwoot_version_checks (tenant_id, status, releases) values (%L, 'al_dia', '{}')$q$, t1)) = '23514',
    'releases tiene que ser una lista');
end;
$checks$;

-- 2. Pedidos: el admin pide, una vez por versión; nadie edita ni borra.
do $pedidos$
declare
  t1 constant uuid := '10000000-0000-0000-0000-000000000001';
  t2 constant uuid := '10000000-0000-0000-0000-000000000002';
  admin1 constant uuid := '20000000-0000-0000-0000-000000000001';
  admin2 constant uuid := '20000000-0000-0000-0000-000000000002';
  comercial constant uuid := '20000000-0000-0000-0000-000000000003';
  chk1 bigint;
  chk2 bigint;
begin
  select id into chk1 from public.chatwoot_version_checks where tenant_id = t1;
  select id into chk2 from public.chatwoot_version_checks where tenant_id = t2;
  perform pg_temp.assert_true(pg_temp.falla('authenticated', comercial, format(
    $q$insert into public.chatwoot_update_requests (tenant_id, from_version, to_version, requested_by)
       values (%L, '4.19.1', '4.20.0', %L)$q$, t1, comercial)) = '42501',
    'quien no es admin no pide actualizaciones');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1, format(
    $q$insert into public.chatwoot_update_requests (tenant_id, from_version, to_version, requested_by)
       values (%L, '4.19.1', '4.20.0', %L)$q$, t2, admin1)) = '42501',
    'el admin no pide en otro tenant');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1, format(
    $q$insert into public.chatwoot_update_requests (tenant_id, from_version, to_version, requested_by)
       values (%L, '4.19.1', '4.20.0', %L)$q$, t1, admin2)) = '42501',
    'requested_by tiene que ser quien pide');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1, format(
    $q$insert into public.chatwoot_update_requests (tenant_id, from_version, to_version, check_id, requested_by)
       values (%L, '4.19.1', '4.20.0', %s, %L)$q$, t1, chk2, admin1)) = '42501',
    'el pedido no se amarra a la revisión de otro tenant');
  perform pg_temp.assert_true(pg_temp.como('authenticated', admin1, format(
    $q$insert into public.chatwoot_update_requests (tenant_id, from_version, to_version, check_id, requested_by)
       values (%L, '4.19.1', '4.20.0', %s, %L)$q$, t1, chk1, admin1)) = 1,
    'el admin de T1 pide la 4.20.0');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1, format(
    $q$insert into public.chatwoot_update_requests (tenant_id, from_version, to_version, requested_by)
       values (%L, '4.19.1', '4.20.0', %L)$q$, t1, admin1)) = '23505',
    'la misma versión no se pide dos veces en el tenant');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1, format(
    $q$insert into public.chatwoot_update_requests (tenant_id, from_version, to_version, requested_by)
       values (%L, '4.20.0', '4.20.0', %L)$q$, t1, admin1)) = '23514',
    'no se pide la versión que ya está');
  perform pg_temp.assert_true(pg_temp.ve(admin1, 'chatwoot_update_requests') = 1,
    'el admin de T1 ve su pedido');
  perform pg_temp.assert_true(pg_temp.ve(comercial, 'chatwoot_update_requests') = 0,
    'quien no es admin no ve los pedidos');
  perform pg_temp.assert_true(pg_temp.ve(admin2, 'chatwoot_update_requests') = 0,
    'el admin de T2 no ve los pedidos de T1');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1,
    $q$update public.chatwoot_update_requests set to_version = '4.21.0'$q$) = '42501',
    'nadie edita un pedido');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1,
    'delete from public.chatwoot_update_requests') = '42501',
    'nadie borra un pedido');
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    'select count(*) from public.chatwoot_update_requests') = '42501',
    'anon no lee los pedidos');
end;
$pedidos$;

select 'TEST 0507 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;

rollback;
