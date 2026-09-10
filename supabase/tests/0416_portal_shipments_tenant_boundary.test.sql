\set ON_ERROR_STOP on
-- Migraciones Portal reales; fixtures sintéticos. Nunca conecta a Cloud.
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
create schema extensions;
create schema storage;
grant usage on schema auth, storage to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null, disabled_at timestamptz
);
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
  markbox text not null, email text, deleted_at timestamptz, unique (tenant_id, markbox)
);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  code text not null, client_markbox text, deleted_at timestamptz
);
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  shipment_id uuid not null references public.shipments(id), label text, deleted_at timestamptz
);
grant select on public.clients to authenticated;
grant select, insert, update, delete on public.shipments, public.shipment_events to authenticated;
alter table public.clients enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
create policy "clients by tenant" on public.clients for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));
create policy "shipments by tenant" on public.shipments for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));
create policy "shipment_events by tenant" on public.shipment_events for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));
-- Stubs de Storage suficientes para aplicar 0086 íntegra, sin bucket alojado.
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (id uuid primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1, '/')
$$;
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0086_shipment_documents.sql
\ir ../migrations/0196_shipment_events_portal_rls.sql
grant all on public.shipments, public.shipment_documents, public.shipment_events to service_role;

insert into public.tenants values
  ('10000000-4160-0000-0000-000000000001'), ('20000000-4160-0000-0000-000000000002');
insert into auth.users (id) values
  ('aaaaaaaa-4160-0000-0000-000000000001'), -- equipo A
  ('aaaaaaaa-4160-0000-0000-000000000002'), -- equipo desactivado
  ('aaaaaaaa-4160-0000-0000-000000000101'), -- Portal A
  ('bbbbbbbb-4160-0000-0000-000000000101'), -- Portal B; después principal dual
  ('aaaaaaaa-4160-0000-0000-000000000102'), -- revocado
  ('aaaaaaaa-4160-0000-0000-000000000103'), -- cliente retirado
  ('aaaaaaaa-4160-0000-0000-000000000104'), -- relación incoherente
  ('aaaaaaaa-4160-0000-0000-000000000105'); -- invitado
insert into public.user_tenants values
  ('aaaaaaaa-4160-0000-0000-000000000001', '10000000-4160-0000-0000-000000000001', null),
  ('aaaaaaaa-4160-0000-0000-000000000002', '10000000-4160-0000-0000-000000000001', now());
insert into public.clients (id, tenant_id, markbox, deleted_at) values
  ('31000000-4160-0000-0000-000000000001', '10000000-4160-0000-0000-000000000001', 'DUP', null),
  ('31000000-4160-0000-0000-000000000002', '10000000-4160-0000-0000-000000000001', 'OTHER', null),
  ('31000000-4160-0000-0000-000000000003', '10000000-4160-0000-0000-000000000001', 'DEAD', now()),
  ('31000000-4160-0000-0000-000000000005', '10000000-4160-0000-0000-000000000001', 'INVITED', null),
  ('32000000-4160-0000-0000-000000000001', '20000000-4160-0000-0000-000000000002', 'DUP', null),
  ('32000000-4160-0000-0000-000000000002', '20000000-4160-0000-0000-000000000002', 'OTHER', null);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status) values
  ('aaaaaaaa-4160-0000-0000-000000000101', '10000000-4160-0000-0000-000000000001', '31000000-4160-0000-0000-000000000001', 'portal-a@example.invalid', 'active'),
  ('bbbbbbbb-4160-0000-0000-000000000101', '20000000-4160-0000-0000-000000000002', '32000000-4160-0000-0000-000000000001', 'portal-b@example.invalid', 'active'),
  ('aaaaaaaa-4160-0000-0000-000000000102', '10000000-4160-0000-0000-000000000001', '31000000-4160-0000-0000-000000000002', 'revoked@example.invalid', 'revoked'),
  ('aaaaaaaa-4160-0000-0000-000000000103', '10000000-4160-0000-0000-000000000001', '31000000-4160-0000-0000-000000000003', 'dead@example.invalid', 'active'),
  ('aaaaaaaa-4160-0000-0000-000000000104', '10000000-4160-0000-0000-000000000001', '32000000-4160-0000-0000-000000000002', 'mismatch@example.invalid', 'active'),
  ('aaaaaaaa-4160-0000-0000-000000000105', '10000000-4160-0000-0000-000000000001', '31000000-4160-0000-0000-000000000005', 'invited@example.invalid', 'invited');
insert into public.shipments values
  ('81000000-4160-0000-0000-000000000001', '10000000-4160-0000-0000-000000000001', 'A1', 'DUP', null),
  ('81000000-4160-0000-0000-000000000002', '10000000-4160-0000-0000-000000000001', 'A2', 'OTHER', null),
  ('81000000-4160-0000-0000-000000000003', '10000000-4160-0000-0000-000000000001', 'A3', 'DUP', now()),
  ('81000000-4160-0000-0000-000000000004', '10000000-4160-0000-0000-000000000001', 'A4', 'DEAD', null),
  ('81000000-4160-0000-0000-000000000005', '10000000-4160-0000-0000-000000000001', 'A5', null, null),
  ('81000000-4160-0000-0000-000000000006', '10000000-4160-0000-0000-000000000001', 'A6', 'INVITED', null),
  ('82000000-4160-0000-0000-000000000001', '20000000-4160-0000-0000-000000000002', 'B1', 'DUP', null),
  ('82000000-4160-0000-0000-000000000002', '20000000-4160-0000-0000-000000000002', 'B2', 'OTHER', null);
insert into public.shipment_documents (tenant_id, shipment_id, client_markbox, file_name, storage_path, deleted_at)
select v.tenant_id::uuid, s.id, v.markbox, v.label, 'synthetic/' || v.label,
       case when v.label = 'D-deleted' then now() else null end
from (values
  ('10000000-4160-0000-0000-000000000001', 'A1', 'DUP', 'D-A1'),
  ('20000000-4160-0000-0000-000000000002', 'B1', 'DUP', 'D-B1'),
  ('10000000-4160-0000-0000-000000000001', 'A2', 'DUP', 'D-stale-owner'),
  ('10000000-4160-0000-0000-000000000001', 'B1', 'DUP', 'D-cross-parent'),
  ('20000000-4160-0000-0000-000000000002', 'A1', 'DUP', 'D-cross-tenant'),
  ('10000000-4160-0000-0000-000000000001', 'A3', 'DUP', 'D-retired-parent'),
  ('10000000-4160-0000-0000-000000000001', 'A1', 'DUP', 'D-deleted'),
  ('10000000-4160-0000-0000-000000000001', 'A2', 'OTHER', 'D-other'),
  ('10000000-4160-0000-0000-000000000001', 'A4', 'DEAD', 'D-dead-client'),
  ('10000000-4160-0000-0000-000000000001', 'A1', null, 'D-null-owner')
) v(tenant_id, code, markbox, label) join public.shipments s on s.code = v.code;
insert into public.shipment_events (tenant_id, shipment_id, label, deleted_at)
select v.tenant_id::uuid, s.id, v.label, case when v.label = 'E-deleted' then now() else null end
from (values
  ('10000000-4160-0000-0000-000000000001', 'A1', 'E-A1'),
  ('20000000-4160-0000-0000-000000000002', 'B1', 'E-B1'),
  ('10000000-4160-0000-0000-000000000001', 'B1', 'E-cross-parent'),
  ('20000000-4160-0000-0000-000000000002', 'A1', 'E-cross-tenant'),
  ('10000000-4160-0000-0000-000000000001', 'A3', 'E-retired-parent'),
  ('10000000-4160-0000-0000-000000000001', 'A1', 'E-deleted'),
  ('10000000-4160-0000-0000-000000000001', 'A2', 'E-other'),
  ('10000000-4160-0000-0000-000000000001', 'A4', 'E-dead-client')
) v(tenant_id, code, label) join public.shipments s on s.code = v.code;

-- Primero demuestra el fallo con policies originales reales, sin mocks de RLS.
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4160-0000-0000-000000000101';
do $before_fix$
begin
  if (select count(*) from public.shipments where code = 'B1') <> 1
     or (select count(*) from public.shipment_documents where file_name = 'D-B1') <> 1
     or (select count(*) from public.shipment_events where label = 'E-B1') <> 1 then
    raise exception 'TEST 0416: fixture no reproduce los tres cruces históricos';
  end if;
end;
$before_fix$;
reset role;
create temporary table team_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where schemaname = 'public' and tablename in ('shipments', 'shipment_documents', 'shipment_events')
    and policyname like '% by tenant';
create temporary table table_acl_baseline as
  select oid, relacl from pg_catalog.pg_class
  where oid in ('public.shipments'::regclass, 'public.shipment_documents'::regclass, 'public.shipment_events'::regclass);
\ir ../migrations/0416_portal_shipments_tenant_boundary.sql
do $unchanged_team$
begin
  if exists (select definition from team_policy_baseline except
      select to_jsonb(p) from pg_catalog.pg_policies p
      where schemaname = 'public' and policyname like '% by tenant')
     or exists (select 1 from table_acl_baseline b join pg_catalog.pg_class c on c.oid = b.oid
                where c.relacl is distinct from b.relacl) then
    raise exception 'TEST 0416: cambió una policy de equipo o ACL';
  end if;
end;
$unchanged_team$;

-- Helper INVOKER de prueba: evalúa las tres lecturas con el rol de quien llama.
create function pg_temp.assert_portal(p_shipments text[], p_docs text[], p_events text[])
returns void language plpgsql as $$
begin
  if coalesce((select array_agg(code order by code) from public.shipments), '{}'::text[]) <> p_shipments
     or coalesce((select array_agg(file_name order by file_name) from public.shipment_documents), '{}'::text[]) <> p_docs
     or coalesce((select array_agg(label order by label) from public.shipment_events), '{}'::text[]) <> p_events then
    raise exception 'TEST 0416: visibilidad distinta a la esperada para %', auth.uid();
  end if;
end;
$$;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4160-0000-0000-000000000101';
select pg_temp.assert_portal(array['A1'], array['D-A1'], array['E-A1']);
set local "request.jwt.claim.sub" = 'bbbbbbbb-4160-0000-0000-000000000101';
select pg_temp.assert_portal(array['B1'], array['D-B1'], array['E-B1']);
do $invalid_principals$
declare v_id text;
begin
  foreach v_id in array array[
    'aaaaaaaa-4160-0000-0000-000000000102', 'aaaaaaaa-4160-0000-0000-000000000103',
    'aaaaaaaa-4160-0000-0000-000000000104', 'aaaaaaaa-4160-0000-0000-000000000105',
    'aaaaaaaa-4160-0000-0000-000000000002', 'aaaaaaaa-4160-0000-0000-000000000999', ''
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_id, true);
    perform pg_temp.assert_portal('{}', '{}', '{}');
  end loop;
end;
$invalid_principals$;

-- Portal no obtiene escrituras porque su policy sólo es SELECT.
set local "request.jwt.claim.sub" = 'aaaaaaaa-4160-0000-0000-000000000101';
do $portal_read_only$
declare v_table text; v_count bigint; v_blocked boolean;
begin
  foreach v_table in array array['shipments', 'shipment_documents', 'shipment_events'] loop
    execute format('update public.%I set tenant_id = tenant_id', v_table);
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0416: Portal actualizó %', v_table; end if;
    execute format('delete from public.%I', v_table);
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0416: Portal borró %', v_table; end if;
  end loop;
  v_blocked := false;
  begin
    insert into public.shipments values (gen_random_uuid(), '10000000-4160-0000-0000-000000000001', 'BAD', 'DUP', null);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0416: Portal insertó envío'; end if;
  v_blocked := false;
  begin
    insert into public.shipment_documents (tenant_id, shipment_id, client_markbox, file_name, storage_path)
    values ('10000000-4160-0000-0000-000000000001', '81000000-4160-0000-0000-000000000001', 'DUP', 'BAD', 'synthetic/BAD');
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0416: Portal insertó documento'; end if;
  v_blocked := false;
  begin
    insert into public.shipment_events (tenant_id, shipment_id, label)
    values ('10000000-4160-0000-0000-000000000001', '81000000-4160-0000-0000-000000000001', 'BAD');
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0416: Portal insertó hito'; end if;
end;
$portal_read_only$;

-- Equipo legítimo conserva CRUD por tenant, sin habilitar otro tenant.
set local "request.jwt.claim.sub" = 'aaaaaaaa-4160-0000-0000-000000000001';
do $team_crud$
declare v_id uuid := gen_random_uuid(); v_count bigint; v_table text;
begin
  foreach v_table in array array['shipments', 'shipment_documents', 'shipment_events'] loop
    execute format('select count(*) from public.%I where tenant_id <> public.get_user_tenant_id()', v_table) into v_count;
    if v_count <> 0 then raise exception 'TEST 0416: equipo cruzó tenant en %', v_table; end if;
  end loop;
  insert into public.shipments values (v_id, '10000000-4160-0000-0000-000000000001', 'TEAM', 'DUP', null);
  update public.shipments set code = 'TEAM-EDIT' where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0416: equipo no editó envío'; end if;
  insert into public.shipment_documents (tenant_id, shipment_id, client_markbox, file_name, storage_path)
  values ('10000000-4160-0000-0000-000000000001', v_id, 'DUP', 'TEAM', 'synthetic/TEAM');
  update public.shipment_documents set file_name = 'TEAM-EDIT' where shipment_id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0416: equipo no editó documento'; end if;
  insert into public.shipment_events (tenant_id, shipment_id, label)
  values ('10000000-4160-0000-0000-000000000001', v_id, 'TEAM');
  update public.shipment_events set label = 'TEAM-EDIT' where shipment_id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0416: equipo no editó hito'; end if;
  delete from public.shipment_documents where shipment_id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0416: equipo no borró documento de prueba'; end if;
  delete from public.shipment_events where shipment_id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0416: equipo no borró hito de prueba'; end if;
  delete from public.shipments where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0416: equipo no borró envío de prueba'; end if;
end;
$team_crud$;
reset role;
-- Portal B + equipo A: unión legítima, no acceso a B2 por ser equipo de A.
insert into public.user_tenants values
  ('bbbbbbbb-4160-0000-0000-000000000101', '10000000-4160-0000-0000-000000000001', null);
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-4160-0000-0000-000000000101';
do $dual_principal$
begin
  if (select count(*) from public.shipments where code = 'B1') <> 1
     or (select count(*) from public.shipments where code = 'A2') <> 1
     or (select count(*) from public.shipments where code = 'B2') <> 0
     or (select count(*) from public.shipment_documents where file_name = 'D-cross-tenant') <> 0
     or (select count(*) from public.shipment_events where label = 'E-cross-tenant') <> 0 then
    raise exception 'TEST 0416: principal dual amplió la policy Portal';
  end if;
end;
$dual_principal$;
reset role;
set local role anon;
do $anon_denied$
declare v_table text; v_blocked boolean;
begin
  foreach v_table in array array['shipments', 'shipment_documents', 'shipment_events'] loop
    v_blocked := false;
    begin execute format('select 1 from public.%I', v_table);
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'TEST 0416: anon accedió a %', v_table; end if;
  end loop;
end;
$anon_denied$;
reset role;
set local role service_role;
do $service_preserved$
begin
  if (select count(*) from public.shipments) <> 8
     or (select count(*) from public.shipment_documents) <> 10
     or (select count(*) from public.shipment_events) <> 8 then
    raise exception 'TEST 0416: service_role perdió filas';
  end if;
end;
$service_preserved$;
reset role;
rollback;
select to_regclass('public.shipments') is null as portal_shipments_0416_fixture_rolled_back;
