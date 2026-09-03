\set ON_ERROR_STOP on
-- SDD-0380: PostgreSQL desechable; migraciones reales y datos sintéticos.
-- RED: -v apply_fix=false. GREEN: default con 0428. Nunca usar contra Cloud.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $guard$
begin
  if to_regclass('public.quotes') is not null or to_regnamespace('auth') is not null then
    raise exception 'TEST 0428 requiere una base desechable vacía';
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
-- Dependencias mínimas explícitas de 0006/0007/0080, no copias de sus policies.
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
create type public.shipment_service as enum (
  'consolidacion', 'puerta_a_puerta_DDP', 'reserva_FCL', 'transporte_terrestre'
);
create table public.rates (id uuid primary key);
create table public.shipments (
  id uuid primary key, tenant_id uuid, client_markbox text, deleted_at timestamptz
);
alter table public.shipments enable row level security;
-- tenants vacío evita el seed demo histórico de 0006.
\ir ../migrations/0006_clients.sql
\ir ../migrations/0007_quotes.sql
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0113_estimado_web.sql
\ir ../migrations/0117_quotes_portal_rls.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
-- Emula sólo el grant de servicio de plataforma; 0428 debe conservarlo.
grant select, insert, update, delete on public.quotes to service_role;

create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0428-synthetic-' || label)::uuid
$$;
create temporary table assertions (label text primary key);
create temporary sequence assertion_count;
grant select, insert on assertions to authenticated, service_role;
grant usage on sequence assertion_count to authenticated, service_role;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0428: %', label; end if;
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
  ('client-other-A', 'tenant-A', 'OTHER'), ('client-other-B', 'tenant-B', 'OTHER'),
  ('client-retired', 'tenant-A', 'RETIRED'), ('client-revoked', 'tenant-A', 'REVOKED'),
  ('client-invited', 'tenant-A', 'INVITED')
) v(label, tenant, markbox);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(actor), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client),
  actor || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'),
  ('portal-B', 'tenant-B', 'client-B', 'active'),
  -- FK reales permiten una relación incoherente sin desactivar constraints.
  ('incoherent', 'tenant-A', 'client-B', 'active'),
  ('revoked', 'tenant-A', 'client-revoked', 'revoked'),
  ('invited', 'tenant-A', 'client-invited', 'invited'),
  ('retired', 'tenant-A', 'client-retired', 'active')
) v(actor, tenant, client, status);
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('client-retired');
insert into public.quotes (
  id, tenant_id, quote_code, client_markbox, client_name, service, origin,
  destination, subtotal_usd, total_usd, source, deleted_at
)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), label, markbox,
  'synthetic client snapshot', 'consolidacion', 'synthetic origin', 'synthetic destination',
  100, 100, case when label = 'A-web' then 'web' else 'studio' end,
  case when label in ('A-deleted', 'B-deleted') then now() else null end
from (values
  ('A-own', 'tenant-A', 'DUP'), ('A-web', 'tenant-A', 'DUP'),
  ('A-other', 'tenant-A', 'OTHER'), ('A-retired', 'tenant-A', 'RETIRED'),
  ('A-revoked', 'tenant-A', 'REVOKED'), ('A-invited', 'tenant-A', 'INVITED'),
  ('A-null', 'tenant-A', null), ('A-orphan', 'tenant-A', 'NO-CLIENT'),
  ('A-deleted', 'tenant-A', 'DUP'), ('B-own', 'tenant-B', 'DUP'),
  ('B-other', 'tenant-B', 'OTHER'), ('B-deleted', 'tenant-B', 'DUP')
) v(label, tenant, markbox);

-- Reproducción causal antes de cualquier arreglo, también en la corrida GREEN.
savepoint legacy_probe;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $legacy_cross$
declare n bigint;
begin
  select count(*) into n from public.quotes where quote_code = 'B-own';
  if n <> 1 then raise exception 'TEST 0428 fixture no reproduce cruce de tenant'; end if;
  raise notice 'TEST 0428 RED baseline: Portal A lee % cotización del tenant B', n;
end;
$legacy_cross$;
reset role;
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('client-A');
set local role authenticated;
do $legacy_retired$
declare n bigint;
begin
  select count(*) into n from public.quotes;
  if n <> 3 then raise exception 'TEST 0428 fixture no reproduce cliente retirado: %', n; end if;
  raise notice 'TEST 0428 RED baseline: cliente A retirado conserva % cotizaciones', n;
end;
$legacy_retired$;
reset role;
rollback to legacy_probe;
release legacy_probe;

create function pg_temp.catalog_snapshot() returns jsonb language sql stable as $catalog$
select jsonb_build_object(
  'tables', (select jsonb_agg(jsonb_build_array(c.oid, c.relname, c.relowner, c.relacl,
    c.relrowsecurity, c.relforcerowsecurity) order by c.oid)
    from pg_class c where c.relnamespace in ('public'::regnamespace, 'auth'::regnamespace)),
  'columns', (select jsonb_agg(to_jsonb(a) order by a.attrelid, a.attnum)
    from pg_attribute a join pg_class c on c.oid = a.attrelid
    where c.relnamespace in ('public'::regnamespace, 'auth'::regnamespace) and a.attnum > 0),
  'constraints', (select jsonb_agg(to_jsonb(c) order by c.oid) from pg_constraint c
    where c.connamespace in ('public'::regnamespace, 'auth'::regnamespace)),
  'triggers', (select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t
    join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace),
  'indexes', (select jsonb_agg(to_jsonb(i) order by i.indexrelid) from pg_index i
    join pg_class c on c.oid = i.indrelid where c.relnamespace = 'public'::regnamespace),
  'other_policies', (select jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname) from pg_policies p
    where p.schemaname = 'public' and not (p.tablename = 'quotes' and p.policyname = 'quotes portal self read')),
  'functions', (select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'auth'::regnamespace)),
  'schemas', (select jsonb_agg(jsonb_build_array(oid, nspowner, nspacl) order by oid)
    from pg_namespace where nspname in ('public', 'auth', 'extensions'))
);
$catalog$;
create function pg_temp.row_snapshot() returns jsonb language sql stable as $rows$
select jsonb_build_object(
  'quotes', (select jsonb_agg(to_jsonb(q) order by id) from public.quotes q),
  'clients', (select jsonb_agg(to_jsonb(c) order by id) from public.clients c),
  'bindings', (select jsonb_agg(to_jsonb(cu) order by id) from public.client_users cu),
  'team', (select jsonb_agg(to_jsonb(ut) order by user_id) from public.user_tenants ut),
  'users', (select jsonb_agg(to_jsonb(u) order by id) from auth.users u),
  'shipments', (select jsonb_agg(to_jsonb(s) order by id) from public.shipments s),
  'rates', (select jsonb_agg(to_jsonb(r) order by id) from public.rates r)
);
$rows$;
create temporary table before_state as select pg_temp.catalog_snapshot() catalog, pg_temp.row_snapshot() rows;
\if :apply_fix
\ir ../migrations/0428_portal_quotes_principal_tenant.sql
create temporary table policy_after_first as
select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname) value from pg_policies p;
\ir ../migrations/0428_portal_quotes_principal_tenant.sql
select pg_temp.assert_true((select value from policy_after_first) =
  (select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname) from pg_policies p),
  'Reejecución idempotente conserva todas las policies');
do $drift$
declare drift text; failed boolean; message text; after_drift jsonb;
  original jsonb := pg_temp.catalog_snapshot();
  original_rows jsonb := pg_temp.row_snapshot();
  migration text := pg_read_file('/sb/migrations/0428_portal_quotes_principal_tenant.sql');
begin
  foreach drift in array array[
    'create policy fixture_0428_extra on public.quotes for select to authenticated using(true)',
    'drop policy "quotes portal self read" on public.quotes',
    'alter policy "quotes portal self read" on public.quotes to anon',
    'alter policy "quotes by tenant" on public.quotes to anon',
    'drop policy "quotes portal self read" on public.quotes; create policy "quotes portal self read" on public.quotes as restrictive for select to authenticated using(true)',
    'alter table public.quotes disable row level security',
    'alter table public.clients disable row level security',
    'alter table public.client_users disable row level security'
  ] loop
    failed := false;
    begin
      execute drift;
      after_drift := pg_temp.catalog_snapshot();
      begin execute migration;
      exception when others then
        get stacked diagnostics message = message_text;
        if sqlstate <> 'P0001' or message not like '0428%' then
          raise exception 'TEST 0428: drift no falló en preflight: % / %', sqlstate, message;
        end if;
        failed := true;
      end;
      if not failed or after_drift <> pg_temp.catalog_snapshot() or original_rows <> pg_temp.row_snapshot() then
        raise exception 'TEST 0428: preflight aceptó drift o dejó cambios parciales: %', drift;
      end if;
      raise exception using errcode = 'PT428', message = 'rollback drift sintético';
    exception when sqlstate 'PT428' then null;
    end;
    perform pg_temp.assert_true(failed and original = pg_temp.catalog_snapshot(),
      'Preflight rechaza y revierte: ' || drift);
  end loop;
end;
$drift$;
\endif
select pg_temp.assert_true((select catalog from before_state) = pg_temp.catalog_snapshot(),
  'Preserva tablas, columnas, ACL, índices, triggers, helpers y policies ajenas');
select pg_temp.assert_true((select rows from before_state) = pg_temp.row_snapshot(),
  'Migración no modifica cotizaciones ni filas de soporte');

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
-- Falla por assertion en RED, no porque falte el archivo 0428.
select pg_temp.assert_true((select count(*) from public.quotes where quote_code = 'B-own') = 0,
  'Portal A no lee quote B aunque Shipping Mark sea igual');
select pg_temp.assert_true((select array_agg(quote_code order by quote_code) from public.quotes) = array['A-own', 'A-web'],
  'Portal A conserva sólo sus cotizaciones vivas, studio y web');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
select pg_temp.assert_true((select array_agg(quote_code order by quote_code) from public.quotes) = array['B-own'],
  'Portal B conserva sólo su cotización viva sin cruce recíproco');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_true((select count(*) from public.quotes
  where quote_code in ('A-other', 'B-other', 'A-deleted', 'B-deleted', 'A-null', 'A-orphan')) = 0,
  'Portal no ve otro markbox, históricos, prospectos sin vínculo ni markbox huérfano');
do $invalid_principals$
declare actor text;
begin
  foreach actor in array array['retired', 'incoherent', 'revoked', 'invited', 'unbound', 'team-disabled'] loop
    perform set_config('request.jwt.claim.sub', pg_temp.fixture_id(actor)::text, true);
    perform pg_temp.assert_true((select count(*) from public.quotes) = 0,
      actor || ': principal inválido no lee cotizaciones');
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true((select count(*) from public.quotes) = 0,
    'authenticated sin auth.uid no lee cotizaciones');
end;
$invalid_principals$;
reset role;

savepoint retired_after_login;
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('client-A');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_true((select count(*) from public.quotes) = 0,
  'Retiro del cliente tras login corta también cotizaciones ya vinculadas');
reset role;
rollback to retired_after_login;
release retired_after_login;

savepoint revoked_after_login;
update public.client_users set status = 'revoked' where auth_user_id = pg_temp.fixture_id('portal-A');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_true((select count(*) from public.quotes) = 0,
  'Revocación del vínculo tras login corta la lectura');
reset role;
rollback to revoked_after_login;
release revoked_after_login;

-- ACL conceden escritura a authenticated; la RLS real debe negarla al Portal.
set local role authenticated;
do $portal_writes$
declare actor text; n bigint; blocked boolean;
begin
  foreach actor in array array['portal-A', 'portal-B', 'retired', 'incoherent', 'revoked', 'invited', 'unbound'] loop
    perform set_config('request.jwt.claim.sub', pg_temp.fixture_id(actor)::text, true);
    update public.quotes set notes = 'synthetic-forbidden-update';
    get diagnostics n = row_count;
    perform pg_temp.assert_true(n = 0, actor || ': UPDATE de cotizaciones modifica cero filas');
    delete from public.quotes;
    get diagnostics n = row_count;
    perform pg_temp.assert_true(n = 0, actor || ': DELETE físico modifica cero filas');
    blocked := false;
    begin
      insert into public.quotes (tenant_id, quote_code, client_markbox, client_name,
        service, origin, destination, subtotal_usd, total_usd)
      values (pg_temp.fixture_id('tenant-A'), 'synthetic-forbidden-insert', 'DUP',
        'synthetic', 'consolidacion', 'synthetic', 'synthetic', 1, 1);
    exception when insufficient_privilege then blocked := true; end;
    perform pg_temp.assert_true(blocked, actor || ': INSERT denegado con 42501');
  end loop;
end;
$portal_writes$;
reset role;
select pg_temp.assert_true((select rows from before_state) = pg_temp.row_snapshot(),
  'Todas las pruebas negativas preservan cada fila original');

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('team-A')::text, true);
select pg_temp.assert_true((select count(*) from public.quotes) = 9 and
  (select count(*) from public.quotes where quote_code = 'A-deleted') = 1 and
  (select count(*) from public.quotes where tenant_id = pg_temp.fixture_id('tenant-B')) = 0,
  'Equipo A conserva sus nueve filas, histórico incluido, y no lee B');
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('team-B')::text, true);
select pg_temp.assert_true((select count(*) from public.quotes) = 3 and
  (select count(*) from public.quotes where quote_code = 'B-deleted') = 1,
  'Equipo B conserva las tres filas de su tenant, histórico incluido');
reset role;

savepoint staff_writes;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('team-A')::text, true);
do $staff$
declare n bigint; blocked boolean := false;
begin
  insert into public.quotes (id, tenant_id, quote_code, client_markbox, client_name,
    service, origin, destination, subtotal_usd, total_usd)
  values (pg_temp.fixture_id('staff-new'), pg_temp.fixture_id('tenant-A'), 'staff-new', 'OTHER',
    'synthetic', 'consolidacion', 'synthetic', 'synthetic', 1, 1);
  perform pg_temp.assert_true((select count(*) from public.quotes where quote_code = 'staff-new') = 1,
    'Equipo conserva INSERT de cotización para otro cliente propio');
  update public.quotes set notes = 'synthetic-staff-edit' where quote_code = 'staff-new';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Equipo conserva UPDATE propio');
  update public.quotes set deleted_at = now() where quote_code = 'staff-new';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Equipo conserva soft delete desde 0230');
  delete from public.quotes where quote_code = 'staff-new';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Equipo conserva DELETE físico propio');
  update public.quotes set notes = 'synthetic-forbidden' where quote_code = 'B-own';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0, 'Equipo A no actualiza cotización B');
  delete from public.quotes where quote_code = 'B-own';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0, 'Equipo A no borra cotización B');
  begin
    insert into public.quotes (tenant_id, quote_code, client_markbox, client_name,
      service, origin, destination, subtotal_usd, total_usd)
    values (pg_temp.fixture_id('tenant-B'), 'staff-forbidden', 'DUP',
      'synthetic', 'consolidacion', 'synthetic', 'synthetic', 1, 1);
  exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'Equipo A no inserta en tenant B');
end;
$staff$;
reset role;
rollback to staff_writes;
release staff_writes;

-- Las policies permisivas conservan la unión de derechos; el filtrado del
-- consumidor Portal híbrido se prueba aparte, no se finge que la RLS lo retira.
savepoint hybrid_principal;
insert into public.user_tenants values (pg_temp.fixture_id('portal-B'), pg_temp.fixture_id('tenant-A'), null);
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
select pg_temp.assert_true((select count(*) from public.quotes) = 10 and
  (select count(*) from public.quotes where quote_code in ('A-other', 'A-deleted', 'B-own')) = 3 and
  (select count(*) from public.quotes where quote_code in ('B-other', 'B-deleted')) = 0,
  'Híbrido equipo A y Portal B conserva equipo A más sólo Portal B propio');
do $hybrid_writes$
declare n bigint;
begin
  update public.quotes set notes = 'synthetic-hybrid-edit' where quote_code = 'A-other';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Híbrido conserva UPDATE por derecho Studio A');
  update public.quotes set notes = 'synthetic-forbidden' where quote_code = 'B-own';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0, 'Híbrido no obtiene UPDATE por su lectura Portal B');
end;
$hybrid_writes$;
reset role;
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('client-B');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
select pg_temp.assert_true((select count(*) from public.quotes) = 9 and
  (select count(*) from public.quotes where tenant_id = pg_temp.fixture_id('tenant-B')) = 0,
  'Retirar cliente Portal B del híbrido no revoca sus nueve derechos Studio A');
reset role;
rollback to hybrid_principal;
release hybrid_principal;

set local role anon;
do $anonymous$
declare blocked boolean := false;
begin
  begin perform 1 from public.quotes;
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'TEST 0428: anon recibió SELECT'; end if;
end;
$anonymous$;
reset role;
select pg_temp.assert_true(not has_table_privilege('anon', 'public.quotes', 'select'),
  'anon conserva ausencia de ACL SELECT, verificada también por ejecución');
set local role service_role;
select pg_temp.assert_true((select count(*) from public.quotes) = 12 and
  (select count(*) from public.quotes where deleted_at is not null) = 2,
  'service_role conserva ambos tenants e históricos');
reset role;
select pg_temp.assert_true((select catalog from before_state) = pg_temp.catalog_snapshot(),
  'Catálogo ajeno a la policy permanece idéntico al finalizar');
select pg_temp.assert_true((select rows from before_state) = pg_temp.row_snapshot(),
  'Fixtures y cotizaciones originales permanecen intactos al finalizar');
select last_value as assertions_0428 from assertion_count;
rollback;
select to_regclass('public.quotes') is null and to_regnamespace('auth') is null as fixture_0428_rolled_back;
