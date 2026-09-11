\set ON_ERROR_STOP on
-- Contrato sintético aislado. RED: -v apply_fix=false; GREEN: migración real.
-- BEGIN/ROLLBACK incluye fixture, DDL y mutaciones. Nunca usar contra Cloud.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $guard$
begin
  if to_regclass('public.clients') is not null or to_regnamespace('auth') is not null then
    raise exception 'TEST 0425 requiere una base desechable vacía';
  end if;
end;
$guard$;
do $roles$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null references public.tenants(id), disabled_at timestamptz
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
-- Tabla clients, sus constraints/ACL, identidad Portal y direcciones REALES.
-- tenants está vacío: el seed histórico de 0006 no introduce datos demo.
\ir ../migrations/0006_clients.sql
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0198_client_delivery_addresses.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0347_client_delivery_addresses_city_slug.sql

create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0425-synthetic-' || label)::uuid
$$;
create temporary table assertions (label text primary key);
create temporary sequence assertion_count;
grant insert, select on assertions to authenticated, service_role;
grant usage on sequence assertion_count to authenticated, service_role;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0425: %', label; end if;
  insert into pg_temp.assertions values (label);
  perform nextval('pg_temp.assertion_count');
end;
$$;
insert into public.tenants values
  (pg_temp.fixture_id('tenant-A'), 'synthetic-A'), (pg_temp.fixture_id('tenant-B'), 'synthetic-B');
insert into auth.users (id)
select pg_temp.fixture_id(v) from unnest(array[
  'portal-A', 'portal-B', 'revoked', 'invited', 'incoherent', 'retired',
  'unbound', 'team-A', 'team-B', 'team-disabled'
]) v;
insert into public.user_tenants values
  (pg_temp.fixture_id('team-A'), pg_temp.fixture_id('tenant-A'), null),
  (pg_temp.fixture_id('team-B'), pg_temp.fixture_id('tenant-B'), null),
  (pg_temp.fixture_id('team-disabled'), pg_temp.fixture_id('tenant-A'), now());
insert into public.clients (id, tenant_id, markbox, name)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), markbox, label
from (values
  ('client-A', 'tenant-A', 'DUP'), ('client-B', 'tenant-B', 'DUP'),
  ('client-other', 'tenant-A', 'OTHER'), ('client-revoked', 'tenant-A', 'REVOKED'),
  ('client-invited', 'tenant-A', 'INVITED'), ('client-retired', 'tenant-A', 'RETIRED')
) v(label, tenant, markbox);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(actor), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client),
  actor || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'),
  ('portal-B', 'tenant-B', 'client-B', 'active'),
  -- Las FK reales permiten un vínculo incoherente sin desactivar triggers.
  ('incoherent', 'tenant-A', 'client-B', 'active'),
  ('revoked', 'tenant-A', 'client-revoked', 'revoked'),
  ('invited', 'tenant-A', 'client-invited', 'invited'),
  ('retired', 'tenant-A', 'client-retired', 'active')
) v(actor, tenant, client, status);
insert into public.client_delivery_addresses (id, client_id, tenant_id, client_markbox, line)
select pg_temp.fixture_id('address-' || suffix), pg_temp.fixture_id('client-' || suffix),
  pg_temp.fixture_id('tenant-A'), 'forged-input-is-sealed', 'synthetic-address-' || suffix
from unnest(array['A', 'B', 'other', 'revoked', 'invited', 'retired']) suffix;
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('client-retired');

-- Baseline: ejecutar SELECT/INSERT/UPDATE trans-tenant, no inferir de la policy.
savepoint baseline_probe;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $baseline$
declare n bigint; inserted public.client_delivery_addresses; soft_delete_blocked boolean := false;
begin
  select count(*) into n from public.client_delivery_addresses where id = pg_temp.fixture_id('address-B');
  if n <> 1 then raise exception 'TEST 0425 baseline no reproduce SELECT cross-tenant'; end if;
  raise notice 'TEST 0425 RED baseline: SELECT tenant-B = % fila', n;
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-B'), pg_temp.fixture_id('tenant-A'), 'DUP', 'synthetic-foreign-insert')
  returning * into inserted;
  if inserted.tenant_id <> pg_temp.fixture_id('tenant-B') then
    raise exception 'TEST 0425 baseline no reproduce INSERT sellado sobre tenant-B';
  end if;
  raise notice 'TEST 0425 RED baseline: INSERT ajeno permitido y trigger selló tenant-B';
  update public.client_delivery_addresses set line = 'synthetic-foreign-update'
  where id = pg_temp.fixture_id('address-B');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST 0425 baseline no reproduce UPDATE cross-tenant'; end if;
  raise notice 'TEST 0425 RED baseline: UPDATE tenant-B = % fila', n;
  begin
    update public.client_delivery_addresses set deleted_at = now()
    where id = pg_temp.fixture_id('address-A');
  exception when insufficient_privilege then soft_delete_blocked := true; end;
  raise notice 'TEST 0425 baseline: soft delete propio bloqueado por RLS = %', soft_delete_blocked;
end;
$baseline$;
reset role;
rollback to baseline_probe;
release baseline_probe;

-- Se conserva la tabla, ACL, triggers, índices y policies ajenas al Portal.
create function pg_temp.catalog_snapshot() returns jsonb language sql stable as $catalog$
select jsonb_build_object(
  'table', (select jsonb_build_array(c.oid, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity)
    from pg_class c where c.oid = 'public.client_delivery_addresses'::regclass),
  'triggers', (select jsonb_agg(to_jsonb(t) order by oid) from pg_trigger t
    where tgrelid = 'public.client_delivery_addresses'::regclass),
  'indexes', (select jsonb_agg(to_jsonb(i) order by indexrelid) from pg_index i
    where indrelid = 'public.client_delivery_addresses'::regclass),
  'other_policies', (select jsonb_agg(to_jsonb(p) order by tablename, policyname) from pg_policies p
    where schemaname = 'public' and policyname not like 'client_delivery_addresses portal self %'),
  'existing_functions', (select jsonb_agg(jsonb_build_array(oid, proowner, proacl, prosrc, proconfig) order by oid)
    from pg_proc where pronamespace = 'public'::regnamespace)
);
$catalog$;
create temporary table before_catalog as select pg_temp.catalog_snapshot() value;
create temporary table before_rows as
select coalesce(jsonb_agg(to_jsonb(a) order by id), '[]'::jsonb) value from public.client_delivery_addresses a;
\if :apply_fix
\ir ../migrations/0425_portal_delivery_addresses_tenant_boundary.sql
create temporary table applied_policy_snapshot as
select jsonb_agg(to_jsonb(p) order by tablename, policyname) value
from pg_policies p where schemaname = 'public';
\ir ../migrations/0425_portal_delivery_addresses_tenant_boundary.sql
select pg_temp.assert_true((select value from applied_policy_snapshot) =
  (select jsonb_agg(to_jsonb(p) order by tablename, policyname) from pg_policies p where schemaname = 'public'),
  'Reejecución conserva exactamente las mismas policies');
do $drift$
declare drift text; failed boolean; message text; after_drift jsonb;
  original jsonb := pg_temp.catalog_snapshot();
  migration text := pg_read_file('/sb/migrations/0425_portal_delivery_addresses_tenant_boundary.sql');
begin
  foreach drift in array array[
    'create policy fixture_0425_extra on public.client_delivery_addresses for select to authenticated using(true)',
    'drop policy "client_delivery_addresses portal self insert" on public.client_delivery_addresses',
    'alter policy "client_delivery_addresses portal self read" on public.client_delivery_addresses to anon',
    'alter table public.client_users disable row level security',
    'alter table public.clients disable row level security',
    'alter table public.client_delivery_addresses disable row level security',
    'alter function auth.uid() rename to fixture_0425_missing_uid'
  ] loop
    failed := false;
    begin
      execute drift;
      after_drift := pg_temp.catalog_snapshot();
      begin execute migration;
      exception when others then
        get stacked diagnostics message = message_text;
        if sqlstate <> 'P0001' or message not like '0425%' then
          raise exception 'TEST 0425: drift no falló en preflight: % / %', sqlstate, message;
        end if;
        failed := true;
      end;
      if not failed or after_drift <> pg_temp.catalog_snapshot() then
        raise exception 'TEST 0425: preflight aceptó drift o alteró catálogo: %', drift;
      end if;
      raise exception using errcode = 'PT425', message = 'rollback drift sintético';
    exception when sqlstate 'PT425' then null;
    end;
    perform pg_temp.assert_true(failed and original = pg_temp.catalog_snapshot(), 'Preflight rechaza y preserva: ' || drift);
  end loop;
end;
$drift$;
\endif
select pg_temp.assert_true((select value from before_catalog) = pg_temp.catalog_snapshot(),
  'Migración preserva catálogo fuera de las tres policies Portal');
select pg_temp.assert_true((select value from before_rows) =
  (select coalesce(jsonb_agg(to_jsonb(a) order by id), '[]'::jsonb) from public.client_delivery_addresses a),
  'Migración no modifica ninguna dirección histórica');

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
-- Ésta falla causalmente en RED después de demostrar las tres operaciones.
select pg_temp.assert_true(
  (select count(*) from public.client_delivery_addresses where id = pg_temp.fixture_id('address-B')) = 0,
  'Portal A no lee la dirección B aunque Shipping Mark sea igual');
select pg_temp.assert_true(
  (select count(*) from public.client_delivery_addresses where id = pg_temp.fixture_id('address-A')) = 1,
  'Portal A conserva lectura propia');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
select pg_temp.assert_true(
  (select count(*) from public.client_delivery_addresses) = 1 and
  (select count(*) from public.client_delivery_addresses where id = pg_temp.fixture_id('address-B')) = 1,
  'Portal B conserva sólo dirección propia, sin acceso recíproco a A');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $foreign_writes$
declare n bigint; blocked boolean;
begin
  update public.client_delivery_addresses set line = 'forbidden' where id = pg_temp.fixture_id('address-B');
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0, 'UPDATE ajeno modifica cero filas');
  delete from public.client_delivery_addresses where id = pg_temp.fixture_id('address-B');
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0, 'DELETE físico ajeno modifica cero filas');
  blocked := false;
  begin
    insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
    values (pg_temp.fixture_id('client-B'), pg_temp.fixture_id('tenant-A'), 'DUP', 'forbidden');
  exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'INSERT con client_id ajeno es rechazado tras sellado');
  blocked := false;
  begin
    update public.client_delivery_addresses set client_id = pg_temp.fixture_id('client-B')
    where id = pg_temp.fixture_id('address-A');
  exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'UPDATE no reasigna dirección propia a client_id ajeno');
  blocked := false;
  begin
    insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
    values (pg_temp.fixture_id('client-other'), pg_temp.fixture_id('tenant-A'), 'DUP', 'forbidden');
  exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'INSERT tampoco alcanza otro cliente del mismo tenant');
  blocked := false;
  begin
    insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
    values (pg_temp.fixture_id('client-retired'), pg_temp.fixture_id('tenant-A'), 'RETIRED', 'forbidden');
  exception when check_violation then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'Trigger rechaza client_id borrado');
end;
$foreign_writes$;
do $invalid_principals$
declare actor text; n bigint; blocked boolean;
begin
  foreach actor in array array['revoked', 'invited', 'incoherent', 'retired', 'unbound', 'team-disabled'] loop
    perform set_config('request.jwt.claim.sub', pg_temp.fixture_id(actor)::text, true);
    perform pg_temp.assert_true((select count(*) from public.client_delivery_addresses) = 0,
      actor || ': sin lectura de direcciones');
    update public.client_delivery_addresses set line = 'forbidden';
    get diagnostics n = row_count;
    perform pg_temp.assert_true(n = 0, actor || ': sin UPDATE');
    blocked := false;
    begin
      insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
      values (pg_temp.fixture_id('client-A'), pg_temp.fixture_id('tenant-A'), 'DUP', 'forbidden');
    exception when insufficient_privilege then blocked := true; end;
    perform pg_temp.assert_true(blocked, actor || ': sin INSERT');
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true((select count(*) from public.client_delivery_addresses) = 0,
    'authenticated sin auth.uid no obtiene direcciones');
end;
$invalid_principals$;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $own_crud$
declare first_id uuid := pg_temp.fixture_id('own-first'); second_id uuid := pg_temp.fixture_id('own-second'); n bigint; blocked boolean := false;
begin
  insert into public.client_delivery_addresses (id, client_id, tenant_id, client_markbox, line, is_default)
  values (first_id, pg_temp.fixture_id('client-A'), pg_temp.fixture_id('tenant-B'), 'forged', 'synthetic-own-first', true);
  perform pg_temp.assert_true((select tenant_id = pg_temp.fixture_id('tenant-A') and client_markbox = 'DUP'
    from public.client_delivery_addresses where id = first_id), 'INSERT propio conserva sellado de identidad');
  begin
    insert into public.client_delivery_addresses (id, client_id, tenant_id, client_markbox, line, is_default)
    values (second_id, pg_temp.fixture_id('client-A'), pg_temp.fixture_id('tenant-A'), 'DUP', 'synthetic-own-second', true);
  exception when unique_violation then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'Índice impide dos predeterminadas vivas');
  update public.client_delivery_addresses set line = 'synthetic-own-edited', is_default = false where id = first_id;
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Portal edita dirección propia');
  insert into public.client_delivery_addresses (id, client_id, tenant_id, client_markbox, line, is_default)
  values (second_id, pg_temp.fixture_id('client-A'), pg_temp.fixture_id('tenant-A'), 'DUP', 'synthetic-own-second', true);
  blocked := false;
  begin
    update public.client_delivery_addresses set deleted_at = now() where id = second_id;
  exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'Soft delete propio conserva fallo previo 42501: pendiente fuera de 0425');
  perform pg_temp.assert_true((select count(*) from public.client_delivery_addresses
    where id = second_id and deleted_at is null) = 1, 'Soft delete rechazado conserva fila viva íntegra');
  raise notice 'TEST 0425 PENDIENTE separado: soft delete Portal sigue bloqueado; no abrir SELECT histórico en este slice';
  update public.client_delivery_addresses set is_default = false where id = second_id;
  update public.client_delivery_addresses set is_default = true where id = first_id;
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Cambio explícito de predeterminada conserva índice único');
  delete from public.client_delivery_addresses where id = first_id;
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0, 'Portal no obtiene DELETE físico');
end;
$own_crud$;
reset role;
savepoint rename_probe;
-- Primitiva de renombre/propagación: conserva ids y relaciones, cambia sólo
-- Shipping Mark del cliente y sus filas, como hace el procedimiento del repo.
update public.clients set markbox = 'RENAMED-SYNTHETIC' where id = pg_temp.fixture_id('client-A');
update public.client_delivery_addresses set client_markbox = 'RENAMED-SYNTHETIC'
where client_id = pg_temp.fixture_id('client-A');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_true((select count(*) from public.client_delivery_addresses) = 3,
  'Renombre coherente conserva las tres direcciones propias por client_id');
select pg_temp.assert_true((select count(*) from public.client_delivery_addresses where id = pg_temp.fixture_id('address-B')) = 0,
  'Renombre no abre acceso a otro tenant');
reset role;
rollback to rename_probe;
release rename_probe;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('team-A')::text, true);
do $staff$
declare own_id uuid := pg_temp.fixture_id('staff-own'); n bigint;
begin
  perform pg_temp.assert_true((select count(*) from public.client_delivery_addresses where tenant_id = pg_temp.fixture_id('tenant-B')) = 0,
    'Equipo A no ve tenant B');
  insert into public.client_delivery_addresses (id, client_id, tenant_id, client_markbox, line)
  values (own_id, pg_temp.fixture_id('client-other'), pg_temp.fixture_id('tenant-A'), 'OTHER', 'synthetic-staff');
  update public.client_delivery_addresses set line = 'synthetic-staff-edit' where id = own_id;
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Equipo mantiene UPDATE de otro cliente del tenant');
  update public.client_delivery_addresses set deleted_at = now() where id = own_id;
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Equipo conserva soft delete permitido desde 0230');
  delete from public.client_delivery_addresses where id = own_id;
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Equipo conserva DELETE físico propio');
end;
$staff$;
reset role;
set local role anon;
do $anonymous$
declare blocked boolean := false;
begin
  begin perform 1 from public.client_delivery_addresses;
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'TEST 0425: anon recibió SELECT'; end if;
end;
$anonymous$;
reset role;
set local role service_role;
select pg_temp.assert_true(
  (select count(*) from public.client_delivery_addresses where id = pg_temp.fixture_id('address-retired')) = 1 and
  (select count(*) from public.client_delivery_addresses where id = pg_temp.fixture_id('address-B')) = 1,
  'service_role mantiene acceso a históricos y ambos tenants');
reset role;
select pg_temp.assert_true(
  (select count(*) from public.client_delivery_addresses where id = pg_temp.fixture_id('own-second') and deleted_at is null) = 1,
  'Fila con soft delete rechazado permanece viva e íntegra');
select pg_temp.assert_true(
  (select line from public.client_delivery_addresses where id = pg_temp.fixture_id('address-B')) = 'synthetic-address-B',
  'Dirección B se preservó intacta');
select last_value as assertions_0425 from assertion_count;
rollback;
select to_regclass('public.client_delivery_addresses') is null as fixture_0425_rolled_back;
