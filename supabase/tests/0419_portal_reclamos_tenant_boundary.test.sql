\set ON_ERROR_STOP on
-- SDD-0363: sólo PostgreSQL local, fixtures sintéticos y migraciones reales.
-- RED: psql -v apply_fix=false -f este-archivo; no requiere que exista 0419.
-- GREEN: aplica 0419 por defecto. El fixture entero termina en ROLLBACK.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
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
create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (user_id uuid primary key, tenant_id uuid not null, disabled_at timestamptz);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.assert_tenant_match(p_tenant_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_tenant_id is null or public.get_user_tenant_id() is null
     or p_tenant_id <> public.get_user_tenant_id() then
    raise exception 'Tenant mismatch' using errcode = '42501';
  end if;
end;
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, name text, email text, deleted_at timestamptz, unique (tenant_id, markbox)
);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  code text, client_markbox text, deleted_at timestamptz
);
grant select on public.clients to authenticated;
alter table public.clients enable row level security;
alter table public.shipments enable row level security;
create policy "clients by tenant" on public.clients for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text
);
alter table storage.objects enable row level security;
-- Permisos de plataforma, separados de las policies de aplicación de 0155.
grant select, insert, update, delete on storage.objects to authenticated, service_role;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1, '/')
$$;
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0152_client_claims.sql
\ir ../migrations/0153_client_claims_portal.sql
\ir ../migrations/0155_client_claim_evidence.sql
-- 0230 sí toca estas policies, aunque no nombra las tablas en su SQL dinámico.
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
-- Restrictivas Storage vigentes; no necesitan el resto de bug-replays.
\ir ../migrations/0363_storage_bug_replays_restrictive.sql

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0419-synthetic-' || p_label)::uuid
$$;
insert into public.tenants values
  (pg_temp.fixture_id('tenant-A'), 'synthetic-a'), (pg_temp.fixture_id('tenant-B'), 'synthetic-b');
insert into auth.users (id) select pg_temp.fixture_id(v) from unnest(array[
  'team-A', 'team-disabled', 'portal-A', 'portal-B', 'revoked', 'retired', 'incoherent', 'invited', 'unlinked'
]) v;
insert into public.user_tenants values
  (pg_temp.fixture_id('team-A'), pg_temp.fixture_id('tenant-A'), null),
  (pg_temp.fixture_id('team-disabled'), pg_temp.fixture_id('tenant-A'), now());
insert into public.clients (id, tenant_id, markbox, name, deleted_at)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), markbox, label, case when retired then now() else null end
from (values
  ('client-A', 'tenant-A', 'DUP', false), ('client-A-other', 'tenant-A', 'OTHER', false),
  ('client-retired', 'tenant-A', 'DEAD', true), ('client-invited', 'tenant-A', 'INVITED', false),
  ('client-B', 'tenant-B', 'DUP', false), ('client-B-other', 'tenant-B', 'OTHER', false)
) v(label, tenant, markbox, retired);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(principal), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client), principal || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'), ('portal-B', 'tenant-B', 'client-B', 'active'),
  ('revoked', 'tenant-A', 'client-A-other', 'revoked'), ('retired', 'tenant-A', 'client-retired', 'active'),
  ('incoherent', 'tenant-A', 'client-B-other', 'active'), ('invited', 'tenant-A', 'client-invited', 'invited')
) v(principal, tenant, client, status);
insert into public.shipments (id, tenant_id, code, client_markbox, deleted_at) values
  (pg_temp.fixture_id('shipment-A'), pg_temp.fixture_id('tenant-A'), 'synthetic-A', 'DUP', null),
  (pg_temp.fixture_id('shipment-A-archived'), pg_temp.fixture_id('tenant-A'), 'synthetic-archived', 'DUP', now()),
  (pg_temp.fixture_id('shipment-B'), pg_temp.fixture_id('tenant-B'), 'synthetic-B', 'DUP', null);
insert into public.client_claims (id, tenant_id, claim_code, client_id, client_markbox, shipment_id, claim_type, description, deleted_at)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), label, pg_temp.fixture_id(client), markbox,
       pg_temp.fixture_id(shipment), 'otro', 'synthetic', case when retired then now() else null end
from (values
  ('C-A', 'tenant-A', 'client-A', 'DUP', 'shipment-A', false),
  ('C-A-snapshot', 'tenant-A', null, 'DUP', null, false),
  ('C-A-archived-shipment', 'tenant-A', 'client-A', 'DUP', 'shipment-A-archived', false),
  ('C-A-other', 'tenant-A', 'client-A-other', 'OTHER', null, false),
  ('C-A-deleted', 'tenant-A', 'client-A', 'DUP', null, true),
  ('C-A-wrong-client', 'tenant-A', 'client-A-other', 'DUP', null, false),
  ('C-retired', 'tenant-A', 'client-retired', 'DEAD', null, false),
  ('C-invited', 'tenant-A', 'client-invited', 'INVITED', null, false),
  ('C-nullmark', 'tenant-A', 'client-A', null, null, false),
  ('C-B', 'tenant-B', 'client-B', 'DUP', 'shipment-B', false),
  ('C-B-snapshot', 'tenant-B', null, 'DUP', null, false),
  ('C-B-other', 'tenant-B', 'client-B-other', 'OTHER', null, false),
  ('C-B-wrong-client', 'tenant-B', 'client-B-other', 'DUP', null, false)
) v(label, tenant, client, markbox, shipment, retired);
-- Legado incoherente que el trigger actual no dejaría crear. Se desactiva sólo
-- para montar esas dos filas; vuelve a estar activo ANTES del baseline y RLS.
alter table public.client_claims disable trigger client_claims_check_trg;
insert into public.client_claims (id, tenant_id, claim_code, client_id, client_markbox, claim_type, description) values
  (pg_temp.fixture_id('C-A-foreign-client'), pg_temp.fixture_id('tenant-A'), 'C-A-foreign-client', pg_temp.fixture_id('client-B'), 'DUP', 'otro', 'synthetic legacy'),
  (pg_temp.fixture_id('C-B-foreign-client'), pg_temp.fixture_id('tenant-B'), 'C-B-foreign-client', pg_temp.fixture_id('client-A'), 'DUP', 'otro', 'synthetic legacy');
alter table public.client_claims enable trigger client_claims_check_trg;
insert into public.client_claim_evidence (id, tenant_id, claim_id, storage_path, file_name, deleted_at)
select pg_temp.fixture_id(label), c.tenant_id, c.id, 'synthetic/' || label || '.pdf', label,
       case when retired then now() else null end
from (values
  ('EV-A', 'C-A', false), ('EV-A-snapshot', 'C-A-snapshot', false),
  ('EV-A-archived-shipment', 'C-A-archived-shipment', false), ('EV-A-other', 'C-A-other', false),
  ('EV-A-deleted-parent', 'C-A-deleted', false), ('EV-A-deleted', 'C-A', true),
  ('EV-A-wrong-client', 'C-A-wrong-client', false), ('EV-A-foreign-client', 'C-A-foreign-client', false),
  ('EV-retired', 'C-retired', false), ('EV-invited', 'C-invited', false), ('EV-nullmark', 'C-nullmark', false),
  ('EV-B', 'C-B', false), ('EV-B-snapshot', 'C-B-snapshot', false), ('EV-B-other', 'C-B-other', false),
  ('EV-B-wrong-client', 'C-B-wrong-client', false), ('EV-B-foreign-client', 'C-B-foreign-client', false)
) v(label, claim, retired) join public.client_claims c on c.id = pg_temp.fixture_id(v.claim);
alter table public.client_claim_evidence disable trigger client_claim_evidence_check_trg;
insert into public.client_claim_evidence (id, tenant_id, claim_id, client_markbox, storage_path, file_name)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), pg_temp.fixture_id(claim), markbox, 'synthetic/' || label || '.pdf', label
from (values
  ('EV-stale-owner', 'tenant-A', 'C-A-other', 'DUP'),
  ('EV-cross-parent', 'tenant-A', 'C-B', 'DUP'),
  ('EV-cross-tenant', 'tenant-B', 'C-A', 'DUP'),
  ('EV-child-other', 'tenant-A', 'C-A', 'OTHER'),
  ('EV-child-null', 'tenant-A', 'C-A', null)
) v(label, tenant, claim, markbox);
alter table public.client_claim_evidence enable trigger client_claim_evidence_check_trg;
insert into storage.objects (id, bucket_id, name) values
  (pg_temp.fixture_id('object-A'), 'claim-evidence', pg_temp.fixture_id('tenant-A')::text || '/synthetic-a.pdf'),
  (pg_temp.fixture_id('object-B'), 'claim-evidence', pg_temp.fixture_id('tenant-B')::text || '/synthetic-b.pdf');

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $historical_bug$
begin
  if (select count(*) from public.client_claims where id = pg_temp.fixture_id('C-B')) <> 1
     or (select count(*) from public.client_claim_evidence where id = pg_temp.fixture_id('EV-B')) <> 1 then
    raise exception 'TEST 0419: fixture no reproduce las dos lecturas cross-tenant históricas';
  end if;
  raise notice 'TEST 0419 RED baseline: lectura de reclamo y evidencia de B por principal A con Shipping Mark repetido';
end;
$historical_bug$;
reset role;

-- Inventario vigente: dos policies por tabla, internas ALL y Portal SELECT.
do $baseline_inventory$
begin
  if (select count(*) from pg_catalog.pg_policies where schemaname = 'public'
      and tablename in ('client_claims', 'client_claim_evidence')) <> 4
     or (select count(*) from pg_catalog.pg_policies where schemaname = 'public'
         and tablename in ('client_claims', 'client_claim_evidence') and cmd = 'ALL'
         and qual not ilike '%deleted_at%') <> 2 then
    raise exception 'TEST 0419: fixture no refleja cuatro policies y la corrección interna 0230';
  end if;
  if exists (select 1 from pg_catalog.pg_trigger where tgname in (
      'client_claims_check_trg', 'client_claim_evidence_check_trg') and tgenabled <> 'O') then
    raise exception 'TEST 0419: quedó un trigger de coherencia desactivado en el fixture';
  end if;
end;
$baseline_inventory$;
create temporary table portal_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where schemaname = 'public' and tablename in ('client_claims', 'client_claim_evidence')
    and policyname like '% portal %';
create temporary table other_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where to_jsonb(p) not in (select definition from portal_policy_baseline);
create temporary table table_acl_baseline as
  select oid, relacl, relrowsecurity, relforcerowsecurity from pg_catalog.pg_class
  where relnamespace in ('public'::regnamespace, 'storage'::regnamespace, 'auth'::regnamespace)
    and relkind in ('r', 'p');
create temporary table function_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_proc p
  where pronamespace in ('public'::regnamespace, 'storage'::regnamespace, 'auth'::regnamespace);
create temporary table trigger_baseline as select to_jsonb(t) as definition from pg_catalog.pg_trigger t;
create temporary table data_baseline as
  select 'claims'::text as source, to_jsonb(c) as row_data from public.client_claims c
  union all select 'evidence', to_jsonb(e) from public.client_claim_evidence e
  union all select 'buckets', to_jsonb(b) from storage.buckets b
  union all select 'objects', to_jsonb(o) from storage.objects o;
create temporary table team_rows as
  select 'client_claims'::text as table_name, id from public.client_claims where tenant_id = pg_temp.fixture_id('tenant-A')
  union all select 'client_claim_evidence', id from public.client_claim_evidence where tenant_id = pg_temp.fixture_id('tenant-A');
grant select on team_rows to authenticated;
\if :apply_fix
\ir ../migrations/0419_portal_reclamos_tenant_boundary.sql
-- Ejecuta el archivo real contra drift revertible, sin copiar su preflight.
do $preflight_drift$
declare v_ddl text; v_rejected boolean;
begin
  foreach v_ddl in array array[
    'create policy "0419 unexpected" on public.client_claims for select to authenticated using (true)',
    'drop policy "client_claims portal self read" on public.client_claims',
    'drop policy "client_claim_evidence by tenant" on public.client_claim_evidence',
    'alter policy "client_claims portal self read" on public.client_claims to anon',
    'alter table public.clients disable row level security',
    'alter table public.client_users disable row level security',
    'alter table public.client_claims disable row level security',
    'alter table public.client_claim_evidence disable row level security'
  ] loop
    begin
      execute v_ddl;
      v_rejected := false;
      begin execute pg_catalog.pg_read_file('/sb/migrations/0419_portal_reclamos_tenant_boundary.sql');
      exception when raise_exception then
        if sqlerrm not like '0419:%' then raise; end if;
        v_rejected := true;
      end;
      if not v_rejected then raise exception 'TEST 0419: preflight aceptó drift: %', v_ddl; end if;
      raise sqlstate 'PT419' using message = 'rollback de drift sintético';
    exception when sqlstate 'PT419' then null;
    end;
  end loop;
end;
$preflight_drift$;
do $two_substitutions$
begin
  if (select count(*) from pg_catalog.pg_policies p join portal_policy_baseline b
      on b.definition->>'schemaname' = p.schemaname and b.definition->>'tablename' = p.tablename
      and b.definition->>'policyname' = p.policyname
      where b.definition is distinct from to_jsonb(p)) <> 2 then
    raise exception 'TEST 0419: no sustituyó ambas policies Portal';
  end if;
  if exists (select 1 from pg_catalog.pg_policies p join portal_policy_baseline b
      on b.definition->>'schemaname' = p.schemaname and b.definition->>'tablename' = p.tablename
      and b.definition->>'policyname' = p.policyname
      where b.definition - 'qual' is distinct from to_jsonb(p) - 'qual') then
    raise exception 'TEST 0419: cambió roles, comandos, modo o WITH CHECK del Portal SELECT';
  end if;
end;
$two_substitutions$;
\endif
do $unchanged_catalogs$
begin
  if exists (
    (select definition from other_policy_baseline except
     select to_jsonb(p) from pg_catalog.pg_policies p where not exists (
       select 1 from portal_policy_baseline b where b.definition->>'schemaname' = p.schemaname
         and b.definition->>'tablename' = p.tablename and b.definition->>'policyname' = p.policyname))
    union all
    (select to_jsonb(p) from pg_catalog.pg_policies p where not exists (
       select 1 from portal_policy_baseline b where b.definition->>'schemaname' = p.schemaname
         and b.definition->>'tablename' = p.tablename and b.definition->>'policyname' = p.policyname)
     except select definition from other_policy_baseline)
  ) or exists (
    select 1 from table_acl_baseline b full join (
      select oid, relacl, relrowsecurity, relforcerowsecurity from pg_catalog.pg_class
      where relnamespace in ('public'::regnamespace, 'storage'::regnamespace, 'auth'::regnamespace)
        and relkind in ('r', 'p')
    ) c using (oid)
    where b.oid is null or c.oid is null or c.relacl is distinct from b.relacl
      or c.relrowsecurity is distinct from b.relrowsecurity or c.relforcerowsecurity is distinct from b.relforcerowsecurity
  ) or exists (
    (select definition from function_baseline except select to_jsonb(p) from pg_catalog.pg_proc p
     where pronamespace in ('public'::regnamespace, 'storage'::regnamespace, 'auth'::regnamespace))
    union all
    (select to_jsonb(p) from pg_catalog.pg_proc p
     where pronamespace in ('public'::regnamespace, 'storage'::regnamespace, 'auth'::regnamespace)
     except select definition from function_baseline)
  ) or exists (
    (select definition from trigger_baseline except select to_jsonb(t) from pg_catalog.pg_trigger t)
    union all
    (select to_jsonb(t) from pg_catalog.pg_trigger t except select definition from trigger_baseline)
  ) then raise exception 'TEST 0419: cambió policy interna/Storage, ACL, RLS, función o trigger'; end if;
end;
$unchanged_catalogs$;
create function pg_temp.assert_data_unchanged() returns void language plpgsql as $$
begin
  if exists (
    with current_data as (
      select 'claims'::text as source, to_jsonb(c) as row_data from public.client_claims c
      union all select 'evidence', to_jsonb(e) from public.client_claim_evidence e
      union all select 'buckets', to_jsonb(b) from storage.buckets b
      union all select 'objects', to_jsonb(o) from storage.objects o
    )
    (select * from data_baseline except select * from current_data)
    union all
    (select * from current_data except select * from data_baseline)
  ) then raise exception 'TEST 0419: modificó datos, bucket, objetos o dejó residuo del fixture'; end if;
end;
$$;
select pg_temp.assert_data_unchanged();
-- INVOKER: no bypass de las policies bajo prueba.
create function pg_temp.assert_rows(p_table text, p_labels text[]) returns void language plpgsql as $$
declare v_expected uuid[]; v_actual uuid[];
begin
  select coalesce(array_agg(pg_temp.fixture_id(label) order by pg_temp.fixture_id(label)), '{}'::uuid[])
    into v_expected from unnest(p_labels) label;
  execute format('select coalesce(array_agg(id order by id), ''{}''::uuid[]) from public.%I', p_table) into v_actual;
  if v_expected <> v_actual then
    raise exception 'TEST 0419: visibilidad incorrecta para % en %: esperado %, ids reales %', auth.uid(), p_table, p_labels, v_actual;
  end if;
end;
$$;
create function pg_temp.assert_no_portal_writes() returns void language plpgsql as $$
declare v_table text; v_count bigint; v_blocked boolean;
begin
  foreach v_table in array array['client_claims', 'client_claim_evidence'] loop
    execute format('update public.%I set tenant_id = tenant_id', v_table);
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0419: Portal obtuvo UPDATE de %', v_table; end if;
    execute format('delete from public.%I', v_table);
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0419: Portal obtuvo DELETE de %', v_table; end if;
  end loop;
  v_blocked := false;
  begin
    insert into public.client_claims (tenant_id, claim_code, client_markbox, claim_type, description)
    values (pg_temp.fixture_id('tenant-A'), 'FORBIDDEN', 'DUP', 'otro', 'synthetic');
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'TEST 0419: Portal obtuvo INSERT directo de reclamos'; end if;
  v_blocked := false;
  begin
    insert into public.client_claim_evidence (tenant_id, claim_id, storage_path, file_name)
    values (pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('C-A'), 'synthetic/forbidden.pdf', 'FORBIDDEN');
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'TEST 0419: Portal obtuvo INSERT directo de evidencia'; end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_rows('client_claims', array['C-A', 'C-A-snapshot', 'C-A-archived-shipment']);
select pg_temp.assert_rows('client_claim_evidence', array['EV-A', 'EV-A-snapshot', 'EV-A-archived-shipment']);
select pg_temp.assert_no_portal_writes();
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
select pg_temp.assert_rows('client_claims', array['C-B', 'C-B-snapshot']);
select pg_temp.assert_rows('client_claim_evidence', array['EV-B', 'EV-B-snapshot']);
select pg_temp.assert_no_portal_writes();
do $invalid_principals$
declare v_principal text;
begin
  foreach v_principal in array array['revoked', 'retired', 'incoherent', 'invited', 'unlinked', 'team-disabled', null] loop
    perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(v_principal)::text, ''), true);
    perform pg_temp.assert_rows('client_claims', '{}');
    perform pg_temp.assert_rows('client_claim_evidence', '{}');
    perform pg_temp.assert_no_portal_writes();
  end loop;
end;
$invalid_principals$;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $portal_storage_denied$
declare v_count bigint; v_blocked boolean := false;
begin
  if (select count(*) from storage.objects) <> 0 then
    raise exception 'TEST 0419: Portal obtuvo lectura directa del bucket';
  end if;
  delete from storage.objects;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0419: Portal obtuvo DELETE de objetos'; end if;
  begin
    insert into storage.objects (bucket_id, name)
    values ('claim-evidence', pg_temp.fixture_id('tenant-A')::text || '/forbidden.pdf');
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'TEST 0419: Portal obtuvo INSERT directo en Storage'; end if;
  begin
    perform public.next_claim_code_service(pg_temp.fixture_id('tenant-A'));
    raise exception 'TEST 0419: Portal obtuvo correlativo reservado a service_role';
  exception when insufficient_privilege then null;
  end;
end;
$portal_storage_denied$;
reset role;
savepoint team_operations;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('team-A')::text, true);
do $team_preserved$
declare v_table text; v_expected uuid[]; v_actual uuid[]; v_count bigint; v_id uuid;
begin
  foreach v_table in array array['client_claims', 'client_claim_evidence'] loop
    select array_agg(id order by id) into v_expected from team_rows where table_name = v_table;
    execute format('select array_agg(id order by id) from public.%I', v_table) into v_actual;
    if v_expected is distinct from v_actual then
      raise exception 'TEST 0419: equipo perdió o amplió su lectura histórica de %', v_table;
    end if;
  end loop;
  insert into public.client_claims (id, tenant_id, claim_code, client_id, client_markbox, shipment_id, claim_type, description)
  values (pg_temp.fixture_id('C-team'), pg_temp.fixture_id('tenant-A'), 'C-team', pg_temp.fixture_id('client-A-other'),
          'OTHER', pg_temp.fixture_id('shipment-A'), 'otro', 'synthetic') returning id into v_id;
  if v_id is distinct from pg_temp.fixture_id('C-team') then raise exception 'TEST 0419: equipo perdió INSERT de reclamo'; end if;
  update public.client_claims set status = 'evaluacion' where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 or (select evaluated_at from public.client_claims where id = v_id) is null then
    raise exception 'TEST 0419: equipo perdió UPDATE/sellado histórico';
  end if;
  insert into public.client_claim_evidence (id, tenant_id, claim_id, client_markbox, storage_path, file_name)
  values (pg_temp.fixture_id('EV-team'), pg_temp.fixture_id('tenant-A'), v_id, 'FORGED', 'synthetic/team.pdf', 'synthetic');
  if (select client_markbox from public.client_claim_evidence where id = pg_temp.fixture_id('EV-team')) <> 'OTHER' then
    raise exception 'TEST 0419: trigger dejó de derivar el dueño de la evidencia';
  end if;
  update public.client_claim_evidence set file_name = 'edited' where id = pg_temp.fixture_id('EV-team');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0419: equipo perdió UPDATE de evidencia'; end if;
  -- 0230 permite soft-delete y volver a alcanzar la fila desde la rama interna.
  update public.client_claim_evidence set deleted_at = now() where id = pg_temp.fixture_id('EV-team');
  get diagnostics v_count = row_count;
  if v_count <> 1 or (select deleted_at from public.client_claim_evidence where id = pg_temp.fixture_id('EV-team')) is null then
    raise exception 'TEST 0419: se regresó el soft-delete interno de evidencia';
  end if;
  update public.client_claims set deleted_at = now() where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 or (select deleted_at from public.client_claims where id = v_id) is null then
    raise exception 'TEST 0419: se regresó el soft-delete interno de reclamos';
  end if;
  delete from public.client_claim_evidence where id = pg_temp.fixture_id('EV-team');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0419: equipo perdió DELETE de evidencia'; end if;
  delete from public.client_claims where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0419: equipo perdió DELETE de reclamo'; end if;
  update public.client_claims set description = 'FORBIDDEN' where id = pg_temp.fixture_id('C-B');
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0419: equipo actualizó un reclamo de B'; end if;
  delete from public.client_claim_evidence where id = pg_temp.fixture_id('EV-B');
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0419: equipo borró evidencia de B'; end if;
  if (select count(*) from storage.objects) <> 1
     or (select count(*) from storage.objects where id = pg_temp.fixture_id('object-A')) <> 1 then
    raise exception 'TEST 0419: equipo perdió o amplió lectura del bucket';
  end if;
  insert into storage.objects (id, bucket_id, name)
  values (pg_temp.fixture_id('object-team'), 'claim-evidence', pg_temp.fixture_id('tenant-A')::text || '/team.pdf');
  delete from storage.objects where id = pg_temp.fixture_id('object-team');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0419: equipo perdió alta/borrado de objeto'; end if;
  perform public.next_claim_code(pg_temp.fixture_id('tenant-A'));
end;
$team_preserved$;
rollback to savepoint team_operations;
release savepoint team_operations;
reset role;
insert into public.user_tenants values (pg_temp.fixture_id('portal-B'), pg_temp.fixture_id('tenant-A'), null);
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
do $dual_principal$
declare v_table text; v_expected uuid[]; v_actual uuid[];
begin
  foreach v_table in array array['client_claims', 'client_claim_evidence'] loop
    select array_agg(id order by id) into v_expected from team_rows where table_name = v_table;
    execute format('select array_agg(id order by id) from public.%I where tenant_id = pg_temp.fixture_id(''tenant-A'')', v_table) into v_actual;
    if v_expected is distinct from v_actual then raise exception 'TEST 0419: dual perdió la rama interna A de %', v_table; end if;
  end loop;
  select array_agg(id order by id) into v_actual from public.client_claims where tenant_id = pg_temp.fixture_id('tenant-B');
  select array_agg(pg_temp.fixture_id(label) order by pg_temp.fixture_id(label)) into v_expected
    from unnest(array['C-B', 'C-B-snapshot']) label;
  if v_actual is distinct from v_expected then raise exception 'TEST 0419: dual amplió o perdió reclamos Portal B'; end if;
  select array_agg(id order by id) into v_actual from public.client_claim_evidence where tenant_id = pg_temp.fixture_id('tenant-B');
  select array_agg(pg_temp.fixture_id(label) order by pg_temp.fixture_id(label)) into v_expected
    from unnest(array['EV-B', 'EV-B-snapshot']) label;
  if v_actual is distinct from v_expected then raise exception 'TEST 0419: dual amplió o perdió evidencia Portal B'; end if;
  if (select count(*) from storage.objects) <> 1
     or (select count(*) from storage.objects where id = pg_temp.fixture_id('object-B')) <> 0 then
    raise exception 'TEST 0419: dual extendió Storage interno A al tenant Portal B';
  end if;
end;
$dual_principal$;
reset role;
set local role anon;
do $anon_denied$
declare v_table text; v_blocked boolean;
begin
  foreach v_table in array array['client_claims', 'client_claim_evidence'] loop
    v_blocked := false;
    begin execute format('select 1 from public.%I', v_table);
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'TEST 0419: anon obtuvo SELECT de %', v_table; end if;
  end loop;
end;
$anon_denied$;
reset role;
set local role service_role;
do $service_preserved$
begin
  perform public.next_claim_code_service(pg_temp.fixture_id('tenant-A'));
  if (select count(*) from storage.objects) <> 2 then
    raise exception 'TEST 0419: cambió el acceso de servicio a los objetos';
  end if;
end;
$service_preserved$;
reset role;
select pg_temp.assert_data_unchanged();
rollback;
select to_regclass('public.client_claims') is null as portal_reclamos_0419_fixture_rolled_back;
