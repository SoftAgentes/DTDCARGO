\set ON_ERROR_STOP on

begin;

select 'create role anon nologin'
where not exists (select 1 from pg_roles where rolname = 'anon')
\gexec
select 'create role authenticated nologin'
where not exists (select 1 from pg_roles where rolname = 'authenticated')
\gexec
select 'create role service_role nologin'
where not exists (select 1 from pg_roles where rolname = 'service_role')
\gexec

grant usage on schema public to anon, authenticated, service_role;

create table public.tenants (
  id uuid primary key
);

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id)
    references public.tenants(id)
    on delete cascade
);

create function public.append_audit_event(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_event_type text,
  p_source text,
  p_result text default 'succeeded',
  p_reason text default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null,
  p_schema_version integer default 1,
  p_sensitivity text default 'internal'
)
returns uuid
language sql
as $function$
  select gen_random_uuid()
$function$;

grant all on table public.tenants to service_role;
grant delete on table public.tenants to public, anon, authenticated;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values (
  '20260729053713',
  '0268_tenant_lifecycle_guardrails',
  array[$sdd0172_tenant_lifecycle_fixture$-- ─────────────────────────────────────────────────────────────
-- 0268 · SDD-0172 · Guardrails de lifecycle tenant/fixtures
--
-- Alcance:
--   1. impedir que borrar un tenant elimine transitivamente auditoría;
--   2. retirar DELETE ordinario de service_role sobre public.tenants.
--
-- Deliberadamente NO:
--   · crea una función de purga;
--   · cambia las otras FK hacia tenants;
--   · implementa suspensión/archivo;
--   · abre los Cortes C, D o E de SDD-0166.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.tenants') is null
     or to_regclass('public.entity_audit_log') is null then
    raise exception '0268 requiere tenants y entity_audit_log';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'c'
      and convalidated
  ) then
    raise exception '0268 requiere la FK audit de tenant validada y CASCADE';
  end if;

  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0268 requiere el writer de 0267';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE')
     or not has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: ACL service_role de tenants no coincide';
  end if;

  if has_table_privilege('anon', 'public.tenants', 'DELETE')
     or has_table_privilege('authenticated', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: un rol cliente puede borrar tenants';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: existe una policy DELETE sobre tenants';
  end if;

  if exists (
    select 1
    from public.tenants
    where id = '01680000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception '0268 abortado: el tenant fixture SDD-0168 sigue presente';
  end if;
end
$preflight$;

alter table public.entity_audit_log
  drop constraint entity_audit_log_tenant_id_fkey,
  add constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id)
    references public.tenants(id)
    on delete restrict
    not valid;

alter table public.entity_audit_log
  validate constraint entity_audit_log_tenant_id_fkey;

revoke delete on table public.tenants from service_role;

do $postconditions$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'r'
      and convalidated
  ) then
    raise exception '0268 abortado: FK audit no quedó RESTRICT y validada';
  end if;

  if has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: service_role conserva DELETE en tenants';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE') then
    raise exception '0268 abortado: se retiró un privilegio fuera de alcance';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: apareció una policy DELETE';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;
$sdd0172_tenant_lifecycle_fixture$]
);

do $fixture_reproduces_r9$
begin
  if not has_table_privilege('anon', 'public.tenants', 'DELETE')
     or not has_table_privilege('authenticated', 'public.tenants', 'DELETE') then
    raise exception 'TEST 0279: el fixture no reproduce el fallo R9';
  end if;
end
$fixture_reproduces_r9$;

\ir ../migrations/0279_restore_tenant_lifecycle_acl_history.sql
\ir ../migrations/0279_restore_tenant_lifecycle_acl_history.sql

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and cardinality(statements) = 2
      and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
      and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
  ) then
    raise exception 'TEST 0279: ledger 0268 incorrecto';
  end if;
end
$ledger_contract$;

select statements[1]
from supabase_migrations.schema_migrations
where version = '20260729053713'
\gexec

select statements[2]
from supabase_migrations.schema_migrations
where version = '20260729053713'
\gexec

do $runtime_contract$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and confdeltype = 'r'
      and convalidated
  ) then
    raise exception 'TEST 0279: 0268 no dejó FK RESTRICT';
  end if;

  if has_table_privilege('anon', 'public.tenants', 'DELETE')
     or has_table_privilege('authenticated', 'public.tenants', 'DELETE')
     or has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception 'TEST 0279: algún rol no-owner conserva DELETE';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE') then
    raise exception 'TEST 0279: 0268 retiró privilegios fuera de alcance';
  end if;
end
$runtime_contract$;

set local role authenticated;

do $authenticated_denied$
begin
  begin
    delete from public.tenants;
    raise exception 'TEST 0279: authenticated todavía puede borrar tenants';
  exception
    when insufficient_privilege then
      null;
  end;
end
$authenticated_denied$;

reset role;

rollback;

select
  to_regclass('public.tenants') is null
  and to_regclass('public.entity_audit_log') is null
  and to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null
  as sdd_0172_tenant_acl_fixture_rolled_back;
