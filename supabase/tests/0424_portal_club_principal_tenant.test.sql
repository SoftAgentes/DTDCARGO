\set ON_ERROR_STOP on
-- SDD-0368: PostgreSQL aislado, identidad y policies REALES, datos sintéticos.
-- RED: -v apply_fix=false. No depende de que exista 0424.
-- GREEN por defecto aplica la migración real. Nada persiste: BEGIN/ROLLBACK.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
\if :{?club_restrictive_probe}
\else
\set club_restrictive_probe false
\endif
\if :club_restrictive_probe
\else
select pg_backend_pid() as club_previous_backend \gset
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.client_users') is not null
     or to_regclass('public.club_members') is not null
     or to_regnamespace('auth') is not null then
    raise exception 'TEST 0424 exige una base desechable vacía';
  end if;
end;
$fixture_guard$;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
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
create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null references public.tenants(id), disabled_at timestamptz
);
-- Plataforma mínima: identidad de equipo consultada por auth.uid(), nunca GUC de tenant/markbox.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text, rif text, doc_kind text, name text not null, email text, phone text,
  created_at timestamptz not null default now(), deleted_at timestamptz,
  unique (tenant_id, markbox)
);
-- Dependencias ajenas a Club. Ninguna se utiliza para autorizar al principal.
create table public.shipments (
  id uuid primary key, tenant_id uuid references public.tenants(id),
  client_markbox text, deleted_at timestamptz
);
create table public.consolidations (
  id uuid primary key, tenant_id uuid references public.tenants(id), deleted_at timestamptz
);
create table public.inspection_reports (
  id uuid primary key, tenant_id uuid references public.tenants(id), deleted_at timestamptz
);
grant select on public.clients to authenticated;
alter table public.clients enable row level security;
alter table public.shipments enable row level security;
create policy "clients by tenant" on public.clients for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0144_academia.sql
\ir ../migrations/0170_persons.sql
\ir ../migrations/0172_clients_person_link.sql
\ir ../migrations/0177_academia_person_link.sql
\ir ../migrations/0185_club_members.sql
\ir ../migrations/0186_club_group_buys.sql
\ir ../migrations/0187_club_portal_read.sql
\ir ../migrations/0188_club_events_context.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0235_club_registrations_suppliers.sql

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0424-synthetic-' || p_label)::uuid
$$;
create function pg_temp.club_tables() returns text[] language sql immutable as $$
  select array['club_members', 'club_group_buys', 'club_group_buy_participants',
    'academy_cohorts', 'club_event_registrations', 'club_featured_suppliers']
$$;
create temporary table test_assertions (label text primary key);
create temporary sequence test_assertion_count;
grant insert, select on test_assertions to authenticated;
grant usage on sequence test_assertion_count to authenticated;
create function pg_temp.assert_true(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0424: %', p_label; end if;
  insert into pg_temp.test_assertions values (p_label);
  perform nextval('pg_temp.test_assertion_count');
end;
$$;
insert into public.tenants select pg_temp.fixture_id(v) from unnest(array['tenant-A', 'tenant-B']) v;
insert into auth.users (id) select pg_temp.fixture_id(v) from unnest(array[
  'portal-A', 'portal-B', 'bad-link', 'bad-person', 'revoked', 'invited', 'retired',
  'no-person', 'missing', 'team-A', 'team-B', 'team-disabled', 'dual', 'paused', 'cancelled'
]) v;
insert into public.user_tenants values
  (pg_temp.fixture_id('team-A'), pg_temp.fixture_id('tenant-A'), null),
  (pg_temp.fixture_id('team-B'), pg_temp.fixture_id('tenant-B'), null),
  (pg_temp.fixture_id('team-disabled'), pg_temp.fixture_id('tenant-A'), now()),
  (pg_temp.fixture_id('dual'), pg_temp.fixture_id('tenant-B'), null);
insert into public.persons (id, tenant_id, name)
select pg_temp.fixture_id(person), pg_temp.fixture_id(tenant), person
from (values
  ('person-A', 'tenant-A'), ('person-B', 'tenant-B'), ('person-other', 'tenant-A'),
  ('person-paused', 'tenant-A'), ('person-cancelled', 'tenant-A')
) v(person, tenant);
insert into public.clients (id, tenant_id, name, markbox, person_id, deleted_at)
select pg_temp.fixture_id(client), pg_temp.fixture_id(tenant), client, markbox,
  case when person is not null then pg_temp.fixture_id(person) end,
  case when retired then now() end
from (values
  ('client-A', 'tenant-A', 'DUP', 'person-A', false),
  ('client-B', 'tenant-B', 'DUP', 'person-B', false),
  ('client-bad-link', 'tenant-B', 'LINK', 'person-B', false),
  ('client-bad-person', 'tenant-A', 'PERSON', 'person-B', false),
  ('client-revoked', 'tenant-A', 'REVOKED', 'person-A', false),
  ('client-invited', 'tenant-A', 'INVITED', 'person-A', false),
  ('client-retired', 'tenant-A', 'RETIRED', 'person-A', true),
  ('client-no-person', 'tenant-A', 'NONE', null, false),
  ('client-dual', 'tenant-A', 'DUAL', 'person-A', false),
  ('client-paused', 'tenant-A', null, 'person-paused', false),
  ('client-cancelled', 'tenant-A', '', 'person-cancelled', false)
) v(client, tenant, markbox, person, retired);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(principal), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client),
  principal || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'),
  ('portal-B', 'tenant-B', 'client-B', 'active'),
  ('bad-link', 'tenant-A', 'client-bad-link', 'active'),
  ('bad-person', 'tenant-A', 'client-bad-person', 'active'),
  ('revoked', 'tenant-A', 'client-revoked', 'revoked'),
  ('invited', 'tenant-A', 'client-invited', 'invited'),
  ('retired', 'tenant-A', 'client-retired', 'active'),
  ('no-person', 'tenant-A', 'client-no-person', 'active'),
  ('dual', 'tenant-A', 'client-dual', 'active'),
  ('paused', 'tenant-A', 'client-paused', 'active'),
  ('cancelled', 'tenant-A', 'client-cancelled', 'active')
) v(principal, tenant, client, status);
insert into public.club_members (id, tenant_id, person_id, status)
select pg_temp.fixture_id(member), pg_temp.fixture_id(tenant), pg_temp.fixture_id(person), status
from (values
  ('member-A', 'tenant-A', 'person-A', 'activa'),
  ('member-B', 'tenant-B', 'person-B', 'activa'),
  ('member-other', 'tenant-A', 'person-other', 'activa'),
  ('member-paused', 'tenant-A', 'person-paused', 'pausada'),
  ('member-cancelled', 'tenant-A', 'person-cancelled', 'cancelada')
) v(member, tenant, person, status);
insert into public.club_group_buys (id, tenant_id, title, slug, status)
select pg_temp.fixture_id('group-' || v), pg_temp.fixture_id('tenant-' || v), v, v, 'abierta'
from unnest(array['A', 'B']) v;
insert into public.academy_cohorts (id, tenant_id, name, context)
select pg_temp.fixture_id('event-' || v), pg_temp.fixture_id('tenant-' || v), v, 'club'
from unnest(array['A', 'B']) v;
insert into public.club_group_buy_participants (id, tenant_id, group_buy_id, member_id)
select pg_temp.fixture_id('participant-' || v), pg_temp.fixture_id('tenant-' || v),
  pg_temp.fixture_id('group-' || v), pg_temp.fixture_id('member-' || v)
from unnest(array['A', 'B']) v;
insert into public.club_event_registrations (id, tenant_id, event_id, member_id)
select pg_temp.fixture_id('registration-' || v), pg_temp.fixture_id('tenant-' || v),
  pg_temp.fixture_id('event-' || v), pg_temp.fixture_id('member-' || v)
from unnest(array['A', 'B']) v;
insert into public.club_featured_suppliers (id, tenant_id, period, supplier_name, status)
select pg_temp.fixture_id('supplier-' || v), pg_temp.fixture_id('tenant-' || v), '2026-09', v, 'publicado'
from unnest(array['A', 'B']) v;

-- Antes de cualquier fix, medir los dos defectos por separado bajo RLS.
-- Las FK permiten ambos enlaces incoherentes sin desactivar ningún trigger.
set local role authenticated;
do $red_baseline$
declare v_actor text; v_table text; v_count bigint; v_person uuid;
begin
  foreach v_actor in array array['bad-link', 'bad-person'] loop
    perform set_config('request.jwt.claim.sub', pg_temp.fixture_id(v_actor)::text, true);
    v_person := public.get_portal_person_id();
    if v_person is distinct from pg_temp.fixture_id('person-B') then
      raise exception 'TEST 0424: baseline no reproduce helper %', v_actor;
    end if;
    foreach v_table in array pg_temp.club_tables() loop
      execute format('select count(*) from public.%I where tenant_id = $1', v_table)
        into v_count using pg_temp.fixture_id('tenant-B');
      if v_count <> 1 then raise exception 'TEST 0424: baseline % no cruza %', v_actor, v_table; end if;
      raise notice 'TEST 0424 RED baseline: % obtiene persona-B y lee % de tenant-B (% fila)', v_actor, v_table, v_count;
    end loop;
  end loop;
end;
$red_baseline$;
reset role;

-- Historia sintética: padres archivados después de crear hijos válidos.
insert into public.club_group_buys (id, tenant_id, title, slug, status) values
  (pg_temp.fixture_id('group-A-history'), pg_temp.fixture_id('tenant-A'), 'history', 'history', 'cerrada');
insert into public.academy_cohorts (id, tenant_id, name, context, status) values
  (pg_temp.fixture_id('event-A-history'), pg_temp.fixture_id('tenant-A'), 'history', 'club', 'completado'),
  (pg_temp.fixture_id('event-A-completed'), pg_temp.fixture_id('tenant-A'), 'completed', 'club', 'completado'),
  (pg_temp.fixture_id('event-A-academy'), pg_temp.fixture_id('tenant-A'), 'academy', 'academia', 'proximamente');
insert into public.club_group_buy_participants (id, tenant_id, group_buy_id, member_id, status)
select pg_temp.fixture_id('participant-' || suffix), pg_temp.fixture_id('tenant-A'),
  pg_temp.fixture_id('group-A-history'), pg_temp.fixture_id(member), status
from (values
  ('A-history', 'member-A', 'retirado'), ('paused', 'member-paused', 'confirmado'),
  ('cancelled', 'member-cancelled', 'retirado'), ('other', 'member-other', 'interesado')
) v(suffix, member, status);
insert into public.club_event_registrations (id, tenant_id, event_id, member_id, status)
select pg_temp.fixture_id('registration-' || suffix), pg_temp.fixture_id('tenant-A'),
  pg_temp.fixture_id('event-A-history'), pg_temp.fixture_id(member), status
from (values
  ('A-history', 'member-A', 'asistio'), ('paused', 'member-paused', 'no_asistio'),
  ('cancelled', 'member-cancelled', 'asistio'), ('other', 'member-other', 'inscrito')
) v(suffix, member, status);
update public.club_group_buys set deleted_at = now() where id = pg_temp.fixture_id('group-A-history');
update public.academy_cohorts set deleted_at = now() where id = pg_temp.fixture_id('event-A-history');
insert into public.club_members (id, tenant_id, person_id, status, deleted_at) values
  (pg_temp.fixture_id('member-A-deleted'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('person-A'), 'cancelada', now());
insert into public.club_group_buy_participants (id, tenant_id, group_buy_id, member_id, deleted_at) values
  (pg_temp.fixture_id('participant-A-deleted'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('group-A'), pg_temp.fixture_id('member-A'), now());
insert into public.club_event_registrations (id, tenant_id, event_id, member_id, deleted_at) values
  (pg_temp.fixture_id('registration-A-deleted'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('event-A'), pg_temp.fixture_id('member-A'), now());
insert into public.club_featured_suppliers (id, tenant_id, period, supplier_name, status, deleted_at) values
  (pg_temp.fixture_id('supplier-A-draft'), pg_temp.fixture_id('tenant-A'), '2026-10', 'draft', 'borrador', null),
  (pg_temp.fixture_id('supplier-A-deleted'), pg_temp.fixture_id('tenant-A'), '2026-11', 'deleted', 'publicado', now());

-- Expectativas por identidad, nunca derivadas del predicado del helper nuevo.
create temporary table portal_expected (actor text, table_name text, row_id uuid, primary key (actor, table_name, row_id));
insert into portal_expected
select actor, table_name, pg_temp.fixture_id(label)
from (values
  ('portal-A', 'club_members', 'member-A'),
  ('portal-A', 'club_group_buys', 'group-A'),
  ('portal-A', 'club_group_buy_participants', 'participant-A'),
  ('portal-A', 'club_group_buy_participants', 'participant-A-history'),
  ('portal-A', 'academy_cohorts', 'event-A'),
  ('portal-A', 'academy_cohorts', 'event-A-completed'),
  ('portal-A', 'club_event_registrations', 'registration-A'),
  ('portal-A', 'club_event_registrations', 'registration-A-history'),
  ('portal-A', 'club_featured_suppliers', 'supplier-A'),
  ('portal-B', 'club_members', 'member-B'),
  ('portal-B', 'club_group_buys', 'group-B'),
  ('portal-B', 'club_group_buy_participants', 'participant-B'),
  ('portal-B', 'academy_cohorts', 'event-B'),
  ('portal-B', 'club_event_registrations', 'registration-B'),
  ('portal-B', 'club_featured_suppliers', 'supplier-B'),
  ('paused', 'club_members', 'member-paused'),
  ('paused', 'club_group_buy_participants', 'participant-paused'),
  ('paused', 'club_event_registrations', 'registration-paused'),
  ('cancelled', 'club_members', 'member-cancelled'),
  ('cancelled', 'club_group_buy_participants', 'participant-cancelled'),
  ('cancelled', 'club_event_registrations', 'registration-cancelled')
) v(actor, table_name, label);
create temporary table owner_rows (table_name text, row_id uuid, tenant_id uuid, row_value jsonb);
do $owner_rows$
declare v_table text;
begin
  foreach v_table in array pg_temp.club_tables() loop
    execute format('insert into pg_temp.owner_rows select %L, id, tenant_id, to_jsonb(t) from public.%I t', v_table, v_table);
  end loop;
end;
$owner_rows$;
insert into portal_expected select 'team-A', table_name, row_id from owner_rows where tenant_id = pg_temp.fixture_id('tenant-A');
insert into portal_expected select 'team-B', table_name, row_id from owner_rows where tenant_id = pg_temp.fixture_id('tenant-B');
insert into portal_expected select 'dual', table_name, row_id from portal_expected where actor in ('portal-A', 'team-B');
grant select on portal_expected, owner_rows to authenticated;

create function pg_temp.assert_reads(p_actor text, p_expected_actor text, p_context text) returns void
language plpgsql as $$
declare v_table text; v_actual uuid[]; v_expected uuid[];
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(p_actor)::text, ''), true);
  foreach v_table in array pg_temp.club_tables() loop
    execute format('select coalesce(array_agg(id order by id), array[]::uuid[]) from public.%I', v_table) into v_actual;
    select coalesce(array_agg(row_id order by row_id), array[]::uuid[]) into v_expected
      from pg_temp.portal_expected where actor = p_expected_actor and table_name = v_table;
    if v_actual is distinct from v_expected then
      raise notice 'TEST 0424 diagnóstico %: uid %, persona %, tabla %, actual %, esperado %',
        p_context, auth.uid(), public.get_portal_person_id(), v_table, v_actual, v_expected;
    end if;
    perform pg_temp.assert_true(v_actual = v_expected, p_context || ': lectura exacta de ' || v_table);
  end loop;
end;
$$;
create function pg_temp.catalog_snapshot() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'policies', (select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname)
      from pg_catalog.pg_policies p where schemaname = 'public'),
    'tables', (select jsonb_agg(jsonb_build_array(oid, relname, relowner, relacl, relrowsecurity, relforcerowsecurity) order by oid)
      from pg_catalog.pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')),
    'columns', (select jsonb_agg(to_jsonb(a) order by attrelid, attnum) from pg_catalog.pg_attribute a
      where attrelid in (select oid from pg_catalog.pg_class where relnamespace = 'public'::regnamespace)),
    'functions', (select jsonb_agg(case when oid = 'public.get_portal_person_id()'::regprocedure
      then to_jsonb(p) - 'prosrc' - 'proconfig' else to_jsonb(p) end order by oid)
      from pg_catalog.pg_proc p where pronamespace = 'public'::regnamespace),
    'triggers', (select jsonb_agg(to_jsonb(t) order by oid) from pg_catalog.pg_trigger t),
    'dependencies', (select jsonb_agg(to_jsonb(d) order by classid, objid, objsubid, refclassid, refobjid, refobjsubid, deptype)
      from pg_catalog.pg_depend d where refobjid = 'public.get_portal_person_id()'::regprocedure)
  )
$$;
create function pg_temp.data_snapshot() returns jsonb language plpgsql as $$
declare v_result jsonb := '{}'::jsonb; v_table text; v_rows jsonb;
begin
  for v_table in select relname from pg_catalog.pg_class
    where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') order by relname loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from public.%I t', v_table) into v_rows;
    v_result := v_result || jsonb_build_object(v_table, v_rows);
  end loop;
  return v_result;
end;
$$;
create temporary table original_snapshot as select pg_temp.catalog_snapshot() as catalog, pg_temp.data_snapshot() as rows;
-- Baseline de lecturas correctas y operación interna antes del ALTER FUNCTION.
set local role authenticated;
select pg_temp.assert_reads('portal-A', 'portal-A', 'baseline A');
\if :club_restrictive_probe
\else
select pg_temp.assert_reads('portal-B', 'portal-B', 'baseline B');
select pg_temp.assert_reads('paused', 'paused', 'baseline pausada');
select pg_temp.assert_reads('cancelled', 'cancelled', 'baseline cancelada');
select pg_temp.assert_reads('team-A', 'team-A', 'baseline equipo A');
select pg_temp.assert_reads('team-B', 'team-B', 'baseline equipo B');
select pg_temp.assert_reads('dual', 'dual', 'baseline dual Portal A/equipo B');
\endif
reset role;


\if :apply_fix

-- Derivas concretas del contrato (no detector universal de cambios semánticos).
-- Cada subtransacción revierte la deriva; el intento debe fallar antes del fix.
create temporary sequence drift_count;
create function pg_temp.guard_snapshot() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'functions', (select jsonb_agg(to_jsonb(p) order by p.oid) from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth')),
    'tables', (select jsonb_agg(jsonb_build_array(oid, relname, relacl, relowner, relrowsecurity, relforcerowsecurity) order by oid)
      from pg_catalog.pg_class where relnamespace = 'public'::regnamespace),
    'policies', (select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname) from pg_catalog.pg_policies p),
    'triggers', (select jsonb_agg(to_jsonb(t) order by oid) from pg_catalog.pg_trigger t)
  )
$$;
\endif

\if :club_restrictive_probe
-- Canario aislado, tras rollback del contrato principal y conexión nueva.
-- Limitación observada del arnés: DROP/CREATE AS RESTRICTIVE + rollback parcial
-- contaminaba lecturas posteriores aunque pg_policies volviera a PERMISSIVE.
-- No se atribuye causa al servidor ni se añade workaround al runtime.
select pg_temp.assert_true(pg_backend_pid() <> :club_previous_backend, 'canario restrictivo usa conexión nueva');
drop policy "club_members portal read" on public.club_members;
create policy "club_members portal read" on public.club_members as restrictive for select to authenticated
  using (deleted_at is null and person_id = public.get_portal_person_id());
do $restrictive_preflight$
declare v_failed boolean := false; v_message text;
  v_catalog jsonb := pg_temp.guard_snapshot(); v_rows jsonb := pg_temp.data_snapshot();
begin
  begin execute pg_read_file('/sb/migrations/0424_portal_club_principal_tenant.sql');
  exception when others then
    get stacked diagnostics v_message = message_text;
    if sqlstate <> 'P0001' or v_message not like '0424:%' then
      raise exception 'TEST 0424: consumidor restrictivo falla fuera de preflight: % / %', sqlstate, v_message;
    end if;
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'preflight rechaza policy restrictiva');
  perform pg_temp.assert_true(v_catalog = pg_temp.guard_snapshot(), 'policy restrictiva: preflight no escribe catálogo');
  perform pg_temp.assert_true(v_rows = pg_temp.data_snapshot(), 'policy restrictiva: preflight no escribe filas');
  perform nextval('pg_temp.drift_count');
end;
$restrictive_preflight$;
select last_value as restrictive_preflight_drifts from drift_count;
\else
\if :apply_fix
do $preflight_drifts$
declare v_drift text; v_failed boolean; v_message text; v_catalog jsonb; v_rows jsonb;
  v_original_catalog jsonb := pg_temp.guard_snapshot(); v_original_rows jsonb := pg_temp.data_snapshot();
  v_migration text := pg_read_file('/sb/migrations/0424_portal_club_principal_tenant.sql');
begin
  foreach v_drift in array array[
    'alter table public.client_users disable row level security',
    'alter table public.clients disable row level security',
    'alter table public.persons disable row level security',
    'alter table public.club_members disable row level security',
    'alter table public.club_group_buys disable row level security',
    'alter table public.club_group_buy_participants disable row level security',
    'alter table public.academy_cohorts disable row level security',
    'alter table public.club_event_registrations disable row level security',
    'alter table public.club_featured_suppliers disable row level security',
    'alter table public.persons rename to fixture_missing_persons',
    'alter function auth.uid() rename to fixture_missing_uid',
    'alter function public.get_portal_person_id() rename to fixture_missing_person',
    'alter function public.get_portal_person_id() security invoker',
    'alter function public.get_portal_person_id() volatile',
    'alter function public.get_portal_person_id() owner to authenticated',
    'alter function public.get_portal_person_id() set search_path=public,pg_temp',
    'alter function public.get_portal_person_id() leakproof',
    'grant execute on function public.get_portal_person_id() to anon',
    'revoke execute on function public.get_portal_person_id() from authenticated',
    'drop policy "club_events portal read" on public.academy_cohorts',
    'create policy fixture_extra on public.club_members for select to authenticated using(false)',
    'alter policy "club_members portal read" on public.club_members to anon',
    'alter policy "club_members portal read" on public.club_members using(true)',
    'create policy fixture_extra_consumer on public.shipments for select to authenticated using(public.get_portal_person_id() is not null)',
    'helper_body_drift',
    'helper_signature_drift'
  ] loop
    begin
      if v_drift = 'helper_body_drift' then
        execute (select format('create or replace function public.get_portal_person_id() returns uuid language sql stable security definer set search_path=public as %L',
          prosrc || E'\n-- fixture fingerprint drift') from pg_catalog.pg_proc where oid = 'public.get_portal_person_id()'::regprocedure);
      elsif v_drift = 'helper_signature_drift' then
        alter function public.get_portal_person_id() rename to fixture_old_signature;
        execute 'create function public.get_portal_person_id() returns text language sql stable security definer set search_path=public as ''select null::text''';
      else execute v_drift;
      end if;
      v_catalog := pg_temp.guard_snapshot(); v_rows := pg_temp.data_snapshot(); v_failed := false;
      begin execute v_migration;
      exception when others then
        get stacked diagnostics v_message = message_text;
        if sqlstate <> 'P0001' or v_message not like '0424:%' then
          raise exception 'TEST 0424: deriva % falló fuera de preflight: % / %', v_drift, sqlstate, v_message;
        end if;
        v_failed := true;
      end;
      perform pg_temp.assert_true(v_failed, 'preflight rechaza: ' || v_drift);
      perform pg_temp.assert_true(v_catalog = pg_temp.guard_snapshot(), 'preflight no escribe catálogo: ' || v_drift);
      perform pg_temp.assert_true(v_rows = pg_temp.data_snapshot(), 'preflight no escribe filas: ' || v_drift);
      perform nextval('pg_temp.drift_count');
      raise exception using errcode = 'PT424', message = 'rollback de deriva sintética';
    exception when sqlstate 'PT424' then null;
    end;
    perform pg_temp.assert_true(v_original_catalog = pg_temp.guard_snapshot() and v_original_rows = pg_temp.data_snapshot(),
      'deriva retirada: ' || v_drift);
  end loop;
end;
$preflight_drifts$;


select last_value as preflight_drifts from drift_count;

\ir ../migrations/0424_portal_club_principal_tenant.sql
\endif

-- El fallo RED es de conducta: helper original devuelve la persona ajena.
set local role authenticated;
do $deny_cross$
declare v_actor text; v_table text; v_count bigint;
begin
  foreach v_actor in array array['bad-link', 'bad-person'] loop
    perform set_config('request.jwt.claim.sub', pg_temp.fixture_id(v_actor)::text, true);
    perform pg_temp.assert_true(public.get_portal_person_id() is null, v_actor || ': helper debe denegar vínculo incoherente');
    foreach v_table in array pg_temp.club_tables() loop
      execute format('select count(*) from public.%I', v_table) into v_count;
      perform pg_temp.assert_true(v_count = 0, v_actor || ': sin lectura de ' || v_table);
    end loop;
  end loop;
end;
$deny_cross$;
reset role;

-- Lecturas exactas después del fix: misma persona, historia y unión de roles.
set local role authenticated;
do $green_read_matrix$
declare v_actor text; v_person text;
begin
  for v_actor, v_person in select * from (values
    ('portal-A', 'person-A'), ('portal-B', 'person-B'), ('paused', 'person-paused'),
    ('cancelled', 'person-cancelled'), ('dual', 'person-A'),
    ('team-A', null), ('team-B', null)
  ) v(actor, person) loop
    perform pg_temp.assert_reads(v_actor, v_actor, 'GREEN ' || v_actor);
    perform pg_temp.assert_true(public.get_portal_person_id() is not distinct from pg_temp.fixture_id(v_person),
      'GREEN principal exacto ' || v_actor);
  end loop;
  foreach v_actor in array array['revoked', 'invited', 'retired', 'no-person', 'missing', 'team-disabled'] loop
    perform pg_temp.assert_reads(v_actor, null, 'denegado ' || v_actor);
    perform pg_temp.assert_true(public.get_portal_person_id() is null, 'helper deniega ' || v_actor);
  end loop;
  perform pg_temp.assert_reads(null, null, 'sin sesión');
  perform pg_temp.assert_true(public.get_portal_person_id() is null, 'helper deniega sin sesión');
end;
$green_read_matrix$;
reset role;

-- No convertir archivo de persons ni Shipping Mark en un revocador nuevo.
savepoint archived_person;
update public.persons set deleted_at = now() where id = pg_temp.fixture_id('person-A');
set local role authenticated;
select pg_temp.assert_reads('portal-A', 'portal-A', 'persona archivada conserva historia');
select pg_temp.assert_true(public.get_portal_person_id() = pg_temp.fixture_id('person-A'), 'persona archivada conserva identidad');
reset role;
rollback to archived_person;
release archived_person;
savepoint empty_mark;
update public.clients set markbox = '   ' where id = pg_temp.fixture_id('client-A');
set local role authenticated;
select pg_temp.assert_reads('portal-A', 'portal-A', 'Shipping Mark vacío conserva identidad');
reset role;
rollback to empty_mark;
release empty_mark;
savepoint missing_mark;
update public.clients set markbox = null where id = pg_temp.fixture_id('client-A');
set local role authenticated;
select pg_temp.assert_reads('portal-A', 'portal-A', 'Shipping Mark ausente conserva identidad');
reset role;
rollback to missing_mark;
release missing_mark;

-- Cadena válida primero, luego se revoca: ninguna identidad queda cacheada.
savepoint revoked_live;
update public.client_users set status = 'revoked' where auth_user_id = pg_temp.fixture_id('portal-A');
set local role authenticated;
select pg_temp.assert_reads('portal-A', null, 'revocación vigente');
select pg_temp.assert_true(public.get_portal_person_id() is null, 'revocación vigente no reutiliza identidad anterior');
reset role;
rollback to revoked_live;
release revoked_live;
savepoint retired_live;
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('client-B');
set local role authenticated;
select pg_temp.assert_reads('portal-B', null, 'cliente retirado vigente');
select pg_temp.assert_true(public.get_portal_person_id() is null, 'cliente retirado no reutiliza identidad anterior');
reset role;
rollback to retired_live;
release retired_live;
savepoint archived_membership;
update public.club_members set deleted_at = now() where id = pg_temp.fixture_id('member-A');
set local role authenticated;
select pg_temp.assert_reads('portal-A', null, 'membresía eliminada mantiene filtros originales');
select pg_temp.assert_true(public.get_portal_person_id() = pg_temp.fixture_id('person-A'), 'helper no inventa revocación de persona por membresía');
reset role;
rollback to archived_membership;
release archived_membership;

-- Cruce inverso: tampoco se admite B -> cliente/persona del tenant A.
savepoint reverse_link;
update public.client_users set tenant_id = pg_temp.fixture_id('tenant-B') where auth_user_id = pg_temp.fixture_id('portal-A');
set local role authenticated;
select pg_temp.assert_reads('portal-A', null, 'vínculo B contra cliente A');
select pg_temp.assert_true(public.get_portal_person_id() is null, 'helper deniega vínculo B contra cliente A');
reset role;
rollback to reverse_link;
release reverse_link;
savepoint reverse_person;
update public.clients set person_id = pg_temp.fixture_id('person-A') where id = pg_temp.fixture_id('client-B');
set local role authenticated;
select pg_temp.assert_reads('portal-B', null, 'cliente B contra persona A');
select pg_temp.assert_true(public.get_portal_person_id() is null, 'helper deniega cliente B contra persona A');
reset role;
rollback to reverse_person;
release reverse_person;

-- DML real con filas válidas: INSERT/DELETE rechazan, UPDATE no alcanza filas.
-- deleted_at en el clon evita colisiones de índices; no evita las RLS.
set local role authenticated;
do $portal_no_dml$
declare v_actor text; v_table text; v_row record; v_payload jsonb; v_denied boolean; v_count bigint;
begin
  foreach v_actor in array array['portal-A', 'portal-B'] loop
    perform set_config('request.jwt.claim.sub', pg_temp.fixture_id(v_actor)::text, true);
    foreach v_table in array pg_temp.club_tables() loop
      select o.* into strict v_row from pg_temp.owner_rows o
        join pg_temp.portal_expected e on e.table_name = o.table_name and e.row_id = o.row_id
        where e.actor = v_actor and e.table_name = v_table and (o.row_value->>'deleted_at') is null
        order by o.row_id limit 1;
      -- Siempre referencias vivas para probar RLS y no fallar por el trigger histórico.
      if v_table = 'club_group_buy_participants' then
        select * into strict v_row from pg_temp.owner_rows where row_id = pg_temp.fixture_id('participant-' || right(v_actor, 1));
      elsif v_table = 'club_event_registrations' then
        select * into strict v_row from pg_temp.owner_rows where row_id = pg_temp.fixture_id('registration-' || right(v_actor, 1));
      end if;
      v_payload := v_row.row_value || jsonb_build_object(
        'id', pg_temp.fixture_id('insert-' || v_actor || '-' || v_table), 'deleted_at', now());
      v_denied := false;
      begin
        execute format('insert into public.%I select (jsonb_populate_record(null::public.%I, $1)).*', v_table, v_table) using v_payload;
      exception when insufficient_privilege then v_denied := true;
      end;
      perform pg_temp.assert_true(v_denied, v_actor || ': INSERT denegado ' || v_table);
      execute format('update public.%I set updated_at = clock_timestamp() where id = $1', v_table) using v_row.row_id;
      get diagnostics v_count = row_count;
      perform pg_temp.assert_true(v_count = 0, v_actor || ': UPDATE sin filas ' || v_table);
      v_denied := false;
      begin
        execute format('delete from public.%I where id = $1', v_table) using v_row.row_id;
      exception when insufficient_privilege then v_denied := true;
      end;
      perform pg_temp.assert_true(v_denied, v_actor || ': DELETE denegado ' || v_table);
    end loop;
  end loop;
end;
$portal_no_dml$;
reset role;

savepoint team_writes;
set local role authenticated;
do $team_updates$
declare v_actor text; v_table text; v_row uuid; v_count bigint;
begin
  foreach v_actor in array array['team-A', 'team-B'] loop
    perform set_config('request.jwt.claim.sub', pg_temp.fixture_id(v_actor)::text, true);
    foreach v_table in array pg_temp.club_tables() loop
      select row_id into strict v_row from pg_temp.portal_expected
        where actor = v_actor and table_name = v_table order by row_id limit 1;
      execute format('update public.%I set updated_at = clock_timestamp() where id = $1', v_table) using v_row;
      get diagnostics v_count = row_count;
      perform pg_temp.assert_true(v_count = 1, v_actor || ': UPDATE interno conservado ' || v_table);
    end loop;
  end loop;
end;
$team_updates$;
reset role;
rollback to team_writes;
release team_writes;

set local role anon;
do $anon_helper$
declare v_denied boolean := false;
begin
  begin perform public.get_portal_person_id();
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'TEST 0424: anon obtuvo EXECUTE del helper'; end if;
end;
$anon_helper$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon', 'public.get_portal_person_id()', 'EXECUTE'), 'anon sigue sin EXECUTE');

select pg_temp.assert_true((select catalog = pg_temp.catalog_snapshot() from original_snapshot),
  'catálogo preservado: policies, ACL, columnas, triggers, funciones ajenas y dependencias');
select pg_temp.assert_true((select rows = pg_temp.data_snapshot() from original_snapshot),
  'ninguna fila modificada por migración o intentos DML Portal');
\if :apply_fix
-- Reejecución soportada, sin renovar OID/ACL ni generar efectos secundarios.
create temporary table fixed_snapshot as select pg_temp.guard_snapshot() as catalog, pg_temp.data_snapshot() as rows;
\ir ../migrations/0424_portal_club_principal_tenant.sql
select pg_temp.assert_true((select catalog = pg_temp.guard_snapshot() and rows = pg_temp.data_snapshot() from fixed_snapshot),
  '0424 idempotente: catálogo y filas idénticos');
\endif

\endif
\if :club_restrictive_probe
select last_value as club_probe_assertions from test_assertion_count \gset
\else
select last_value as club_main_assertions from test_assertion_count \gset
\endif
select :'club_restrictive_probe' as restrictive_probe, last_value as assertions from test_assertion_count;
rollback;
do $rollback_guard$
begin
  if to_regclass('public.club_members') is not null
     or to_regclass('public.clients') is not null
     or to_regnamespace('auth') is not null then
    raise exception 'TEST 0424: rollback dejó restos del fixture';
  end if;
end;
$rollback_guard$;
select true as rollback_clean;
\if :club_restrictive_probe
\else
\if :apply_fix
-- Reusar el archivo, no el estado: conexión nueva a la misma DB desechable.
-- psql conserva parámetros de conexión; se exige PID distinto y DB vacía.
-- https://www.postgresql.org/docs/17/app-psql.html
\set club_restrictive_probe true
\connect
\ir 0424_portal_club_principal_tenant.test.sql
\unset club_restrictive_probe
select :club_main_assertions + :club_probe_assertions as total_assertions, 27 as total_preflight_drifts;
\unset club_probe_assertions
\endif
\unset club_previous_backend
\unset club_main_assertions
\endif
