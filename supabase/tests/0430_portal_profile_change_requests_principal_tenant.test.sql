\set ON_ERROR_STOP on
-- SDD-0382: contrato sintético para perfil y solicitudes de cambio del Portal.
-- RED causal: -v apply_fix=false. GREEN: aplica la migración real 0430.
\if :{?apply_fix}
\else
\set apply_fix true
\endif

begin;

do $fixture_guard$
begin
  if to_regnamespace('auth') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0430 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;

grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (
  user_id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select tenant_id from public.user_tenants
  where user_id = (select auth.uid()) and disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.shipments (
  id uuid primary key, tenant_id uuid, client_markbox text, deleted_at timestamptz
);
alter table public.shipments enable row level security;

-- Esquema y policies históricas reales mínimas del producto.
\ir ../migrations/0006_clients.sql
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0220_client_change_requests.sql
\ir ../migrations/0221_client_change_request_source.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql

grant select on public.clients, public.client_change_requests to service_role;

create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0430-synthetic-' || label)::uuid
$$;
create temporary sequence assertion_count;
grant usage on sequence assertion_count to authenticated, service_role;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0430: %', label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

insert into public.tenants values
  (pg_temp.fixture_id('tenant-A'), 'synthetic-A'),
  (pg_temp.fixture_id('tenant-B'), 'synthetic-B');
insert into auth.users (id)
select pg_temp.fixture_id(actor) from unnest(array[
  'portal-A', 'portal-B', 'incoherent', 'retired', 'revoked', 'invited',
  'unbound', 'team-A', 'team-B', 'team-disabled', 'hybrid-same',
  'hybrid-cross', 'hybrid-revoked', 'hybrid-disabled'
]) actor;
insert into public.user_tenants values
  (pg_temp.fixture_id('team-A'), pg_temp.fixture_id('tenant-A'), null),
  (pg_temp.fixture_id('team-B'), pg_temp.fixture_id('tenant-B'), null),
  (pg_temp.fixture_id('team-disabled'), pg_temp.fixture_id('tenant-A'), now()),
  (pg_temp.fixture_id('hybrid-same'), pg_temp.fixture_id('tenant-A'), null),
  (pg_temp.fixture_id('hybrid-cross'), pg_temp.fixture_id('tenant-A'), null),
  (pg_temp.fixture_id('hybrid-revoked'), pg_temp.fixture_id('tenant-A'), null),
  (pg_temp.fixture_id('hybrid-disabled'), pg_temp.fixture_id('tenant-A'), now());

insert into public.clients (id, tenant_id, markbox, name)
select pg_temp.fixture_id(client), pg_temp.fixture_id(tenant), markbox, client
from (values
  ('client-A', 'tenant-A', 'A'), ('client-B', 'tenant-B', 'B'),
  ('client-other', 'tenant-A', 'OTHER'), ('client-revoked', 'tenant-A', 'REVOKED'),
  ('client-invited', 'tenant-A', 'INVITED'), ('client-retired', 'tenant-A', 'RETIRED'),
  ('client-hybrid-same', 'tenant-A', 'HSAME'),
  ('client-hybrid-cross', 'tenant-B', 'HCROSS'),
  ('client-hybrid-revoked', 'tenant-A', 'HREVOKED'),
  ('client-hybrid-disabled', 'tenant-B', 'HDISABLED')
) fixture(client, tenant, markbox);

insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(actor), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client),
  actor || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'),
  ('portal-B', 'tenant-B', 'client-B', 'active'),
  -- Las FK reales son independientes y admiten esta relación incoherente.
  ('incoherent', 'tenant-A', 'client-B', 'active'),
  ('retired', 'tenant-A', 'client-retired', 'active'),
  ('revoked', 'tenant-A', 'client-revoked', 'revoked'),
  ('invited', 'tenant-A', 'client-invited', 'invited'),
  ('hybrid-same', 'tenant-A', 'client-hybrid-same', 'active'),
  ('hybrid-cross', 'tenant-B', 'client-hybrid-cross', 'active'),
  ('hybrid-revoked', 'tenant-A', 'client-hybrid-revoked', 'revoked'),
  ('hybrid-disabled', 'tenant-B', 'client-hybrid-disabled', 'active')
) fixture(actor, tenant, client, status);

-- Una solicitud source=client por ficha; A cubre además estados resueltos.
insert into public.client_change_requests (id, tenant_id, client_id, proposed_name)
select pg_temp.fixture_id('request-' || name), tenant_id, id, 'request-' || name
from public.clients;
insert into public.client_change_requests (
  id, tenant_id, client_id, proposed_name, status, source
) values
  (pg_temp.fixture_id('request-A-approved'), pg_temp.fixture_id('tenant-A'),
    pg_temp.fixture_id('client-A'), 'request-A-approved', 'approved', 'client'),
  (pg_temp.fixture_id('request-A-rejected'), pg_temp.fixture_id('tenant-A'),
    pg_temp.fixture_id('client-A'), 'request-A-rejected', 'rejected', 'client'),
  -- tenant_id no coincide con el tenant real del client_id.
  (pg_temp.fixture_id('request-tenant-mismatch'), pg_temp.fixture_id('tenant-B'),
    pg_temp.fixture_id('client-A'), 'request-tenant-mismatch', 'approved', 'client');
insert into public.client_change_requests (
  id, tenant_id, client_id, proposed_name, status, source, review_note
) values (
  pg_temp.fixture_id('request-admin-A'), pg_temp.fixture_id('tenant-A'),
  pg_temp.fixture_id('client-A'), 'request-admin-A', 'approved', 'admin',
  'synthetic-internal-review-note'
);
update public.clients set deleted_at = now()
where id = pg_temp.fixture_id('client-retired');

-- La vulnerabilidad histórica se reproduce antes de cualquier arreglo, incluso
-- durante GREEN. Esto prueba causalidad en lugar de confiar en la expresión SQL.
savepoint legacy_probe;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('incoherent')::text, true);
select pg_temp.assert_true(
  (select array_agg(name order by name) from public.clients) = array['client-B'],
  'RED baseline: vínculo tenant-A a client-B lee el perfil B');
select pg_temp.assert_true(
  (select array_agg(proposed_name order by proposed_name) from public.client_change_requests) = array['request-client-B'],
  'RED baseline: vínculo incoherente lee solicitudes de B');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('retired')::text, true);
select pg_temp.assert_true((select count(*) from public.clients) = 0 and
  (select array_agg(proposed_name) from public.client_change_requests) = array['request-client-retired'],
  'RED baseline: perfil retirado se oculta pero su solicitud sigue visible');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_true((select count(*) from public.client_change_requests
  where proposed_name in ('request-tenant-mismatch', 'request-admin-A')) = 2,
  'RED baseline: Portal lee tenant incoherente y traza source=admin propia');
reset role;
rollback to legacy_probe;
release legacy_probe;

create function pg_temp.catalog_snapshot() returns jsonb language sql stable as $catalog$
select jsonb_build_object(
  'tables', (select jsonb_agg(jsonb_build_array(c.oid, c.relname, c.relowner,
    c.relacl, c.relrowsecurity, c.relforcerowsecurity) order by c.oid)
    from pg_class c where c.relnamespace in ('public'::regnamespace, 'auth'::regnamespace)),
  'columns', (select jsonb_agg(to_jsonb(a) order by a.attrelid, a.attnum)
    from pg_attribute a join pg_class c on c.oid = a.attrelid
    where c.relnamespace in ('public'::regnamespace, 'auth'::regnamespace) and a.attnum > 0),
  'constraints', (select jsonb_agg(to_jsonb(c) order by c.oid) from pg_constraint c
    where c.connamespace in ('public'::regnamespace, 'auth'::regnamespace)),
  'indexes', (select jsonb_agg(to_jsonb(i) order by i.indexrelid) from pg_index i
    join pg_class c on c.oid = i.indrelid where c.relnamespace = 'public'::regnamespace),
  'triggers', (select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t
    join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace),
  'policies', (select jsonb_agg(
    case when p.tablename in ('clients', 'client_change_requests') and
      p.policyname in ('clients portal self read', 'client_change_requests self or tenant read')
      then to_jsonb(p) - 'qual' - 'with_check' else to_jsonb(p) end
    order by p.tablename, p.policyname) from pg_policies p where p.schemaname = 'public'),
  'functions', (select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'auth'::regnamespace)),
  'schemas', (select jsonb_agg(jsonb_build_array(oid, nspowner, nspacl) order by oid)
    from pg_namespace where nspname in ('public', 'auth', 'extensions'))
);
$catalog$;
create function pg_temp.row_snapshot() returns jsonb language sql stable as $rows$
select jsonb_build_object(
  'clients', (select jsonb_agg(to_jsonb(c) order by id) from public.clients c),
  'requests', (select jsonb_agg(to_jsonb(r) order by id) from public.client_change_requests r),
  'bindings', (select jsonb_agg(to_jsonb(cu) order by id) from public.client_users cu),
  'tenants', (select jsonb_agg(to_jsonb(t) order by id) from public.tenants t),
  'staff', (select jsonb_agg(to_jsonb(ut) order by user_id) from public.user_tenants ut),
  'users', (select jsonb_agg(to_jsonb(u) order by id) from auth.users u),
  'shipments', (select jsonb_agg(to_jsonb(s) order by id) from public.shipments s)
);
$rows$;
create temporary table before_state as
select pg_temp.catalog_snapshot() catalog, pg_temp.row_snapshot() rows;

\if :apply_fix
\ir ../migrations/0430_portal_profile_change_requests_principal_tenant.sql
create temporary table policies_after_first as
select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname) value
from pg_policies p;
\ir ../migrations/0430_portal_profile_change_requests_principal_tenant.sql
select pg_temp.assert_true((select value from policies_after_first) =
  (select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname) from pg_policies p),
  'Reejecución idempotente conserva exactamente todas las policies');

do $drift$
declare
  drift text; failed boolean; message text; after_drift jsonb;
  original jsonb := pg_temp.catalog_snapshot();
  original_rows jsonb := pg_temp.row_snapshot();
  migration text := pg_read_file('/sb/migrations/0430_portal_profile_change_requests_principal_tenant.sql');
begin
  foreach drift in array array[
    'create policy fixture_0430_extra on public.clients for select to authenticated using(true)',
    'drop policy "clients portal self read" on public.clients',
    'alter policy "clients portal self read" on public.clients to anon',
    'drop policy "clients portal self read" on public.clients; create policy "clients portal self read" on public.clients as restrictive for select to authenticated using(true)',
    'drop policy "client_change_requests self or tenant read" on public.client_change_requests',
    'alter policy "client_change_requests self or tenant read" on public.client_change_requests to anon',
    'drop policy "client_change_requests self or tenant read" on public.client_change_requests; create policy "client_change_requests self or tenant read" on public.client_change_requests for update to authenticated using(true)',
    'alter table public.clients disable row level security',
    'alter table public.client_change_requests disable row level security',
    'alter table public.client_users disable row level security',
    'alter function public.get_portal_client_id() rename to fixture_0430_missing_helper'
  ] loop
    failed := false;
    begin
      execute drift;
      after_drift := pg_temp.catalog_snapshot();
      begin execute migration;
      exception when others then
        get stacked diagnostics message = message_text;
        if sqlstate <> 'P0001' or message not like '0430%' then
          raise exception 'TEST 0430: drift no falló en preflight: % / %', sqlstate, message;
        end if;
        failed := true;
      end;
      if not failed or after_drift <> pg_temp.catalog_snapshot()
        or original_rows <> pg_temp.row_snapshot() then
        raise exception 'TEST 0430: preflight aceptó drift o dejó cambios parciales: %', drift;
      end if;
      raise exception using errcode = 'PT430', message = 'rollback drift sintético';
    exception when sqlstate 'PT430' then null;
    end;
    perform pg_temp.assert_true(failed and original = pg_temp.catalog_snapshot(),
      'Preflight rechaza y revierte: ' || drift);
  end loop;
end;
$drift$;
\endif

select pg_temp.assert_true((select catalog from before_state) = pg_temp.catalog_snapshot(),
  'Sólo cambian expresiones de las dos policies Portal; inventario y ACL se preservan');
select pg_temp.assert_true((select rows from before_state) = pg_temp.row_snapshot(),
  'Migración no modifica ninguna fila histórica ni de soporte');

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
-- Primera aserción causal que falla en RED.
select pg_temp.assert_true(
  (select array_agg(name order by name) from public.clients) = array['client-A'],
  'Portal A conserva únicamente su perfil activo y tenant coherente');
select pg_temp.assert_true(
  (select array_agg(proposed_name order by proposed_name) from public.client_change_requests) =
    array['request-A-approved', 'request-A-rejected', 'request-client-A'],
  'Portal A conserva sus solicitudes source=client en todos sus estados');
select pg_temp.assert_true((select count(*) from public.client_change_requests
  where source = 'admin' or proposed_name = 'request-tenant-mismatch') = 0,
  'Rama Portal no lee traza admin ni solicitud con tenant incoherente');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
select pg_temp.assert_true(
  (select array_agg(name) from public.clients) = array['client-B'] and
  (select array_agg(proposed_name) from public.client_change_requests) = array['request-client-B'],
  'Portal B conserva perfil y solicitud propios sin cruce recíproco');

do $invalid_principals$
declare actor text;
begin
  foreach actor in array array[
    'incoherent', 'retired', 'revoked', 'invited', 'unbound', 'team-disabled'
  ] loop
    perform set_config('request.jwt.claim.sub', pg_temp.fixture_id(actor)::text, true);
    perform pg_temp.assert_true((select count(*) from public.clients) = 0 and
      (select count(*) from public.client_change_requests) = 0,
      actor || ': sin perfil ni solicitudes por la rama Portal');
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true((select count(*) from public.clients) = 0 and
    (select count(*) from public.client_change_requests) = 0,
    'authenticated sin auth.uid no obtiene perfil ni solicitudes');
end;
$invalid_principals$;
reset role;

-- Retiro y revocación posteriores al login también cortan ambos recursos.
savepoint retired_after_login;
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('client-A');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_true((select count(*) from public.clients) = 0 and
  (select count(*) from public.client_change_requests) = 0,
  'Retirar cliente tras login corta perfil y solicitudes');
reset role;
rollback to retired_after_login;
release retired_after_login;

savepoint revoked_after_login;
update public.client_users set status = 'revoked'
where auth_user_id = pg_temp.fixture_id('portal-A');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_true((select count(*) from public.clients) = 0 and
  (select count(*) from public.client_change_requests) = 0,
  'Revocar vínculo tras login corta perfil y solicitudes');
reset role;
rollback to revoked_after_login;
release revoked_after_login;

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('team-A')::text, true);
select pg_temp.assert_true((select count(*) from public.clients) = 7 and
  (select count(*) from public.client_change_requests) = 10 and
  (select count(*) from public.client_change_requests where source = 'admin') = 1,
  'Equipo A conserva siete perfiles y diez solicitudes, incluida traza admin');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('team-B')::text, true);
select pg_temp.assert_true((select count(*) from public.clients) = 3 and
  (select count(*) from public.client_change_requests) = 4,
  'Equipo B conserva sus tres perfiles y cuatro solicitudes por tenant');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('hybrid-same')::text, true);
select pg_temp.assert_true((select count(*) from public.clients) = 7 and
  (select count(*) from public.client_change_requests) = 10,
  'Híbrido del mismo tenant conserva exactamente derechos de equipo A');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('hybrid-cross')::text, true);
select pg_temp.assert_true((select count(*) from public.clients) = 8 and
  (select count(*) from public.client_change_requests) = 11,
  'Híbrido equipo A y Portal B conserva unión de derechos sin abrir el resto de B');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('hybrid-revoked')::text, true);
select pg_temp.assert_true((select count(*) from public.clients) = 7 and
  (select count(*) from public.client_change_requests) = 10,
  'Revocar rama Portal no revoca los derechos activos de equipo');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('hybrid-disabled')::text, true);
select pg_temp.assert_true((select array_agg(name) from public.clients) = array['client-hybrid-disabled'] and
  (select array_agg(proposed_name) from public.client_change_requests) = array['request-client-hybrid-disabled'],
  'Deshabilitar equipo no revoca la rama Portal activa y coherente');
reset role;

set local role anon;
do $anon$
declare blocked_clients boolean := false; blocked_requests boolean := false;
begin
  begin perform 1 from public.clients; exception when insufficient_privilege then blocked_clients := true; end;
  begin perform 1 from public.client_change_requests; exception when insufficient_privilege then blocked_requests := true; end;
  if not blocked_clients or not blocked_requests then raise exception 'TEST 0430: anon recibió SELECT'; end if;
end;
$anon$;
reset role;
set local role service_role;
select pg_temp.assert_true((select count(*) from public.clients) = 10 and
  (select count(*) from public.client_change_requests) = 14,
  'service_role conserva ambos tenants, retirados y todas las trazas');
reset role;

select pg_temp.assert_true((select catalog from before_state) = pg_temp.catalog_snapshot(),
  'Catálogo permanece estable al finalizar todas las sondas');
select pg_temp.assert_true((select rows from before_state) = pg_temp.row_snapshot(),
  'Todas las filas originales permanecen intactas al finalizar');
select last_value as assertions_0430 from assertion_count;

rollback;
select to_regclass('public.clients') is null and to_regnamespace('auth') is null
  as fixture_0430_rolled_back;
