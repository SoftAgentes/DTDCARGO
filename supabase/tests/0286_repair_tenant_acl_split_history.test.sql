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
values
(
  '20260729053713',
  '0268_tenant_lifecycle_guardrails',
  array[
    $sdd0172_tenant_split_0$revoke delete on table public.tenants from public, anon, authenticated$sdd0172_tenant_split_0$,
    $sdd0172_tenant_split_1$-- ─────────────────────────────────────────────────────────────
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

set lock_timeout = '5s'$sdd0172_tenant_split_1$,
    $sdd0172_tenant_split_2$set statement_timeout = '30s'$sdd0172_tenant_split_2$,
    $sdd0172_tenant_split_3$do $preflight$
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
$preflight$$sdd0172_tenant_split_3$,
    $sdd0172_tenant_split_4$alter table public.entity_audit_log
  drop constraint entity_audit_log_tenant_id_fkey,
  add constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id)
    references public.tenants(id)
    on delete restrict
    not valid$sdd0172_tenant_split_4$,
    $sdd0172_tenant_split_5$alter table public.entity_audit_log
  validate constraint entity_audit_log_tenant_id_fkey$sdd0172_tenant_split_5$,
    $sdd0172_tenant_split_6$revoke delete on table public.tenants from service_role$sdd0172_tenant_split_6$,
    $sdd0172_tenant_split_7$do $postconditions$
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
$postconditions$$sdd0172_tenant_split_7$,
    $sdd0172_tenant_split_8$reset statement_timeout$sdd0172_tenant_split_8$,
    $sdd0172_tenant_split_9$reset lock_timeout$sdd0172_tenant_split_9$
  ]
),
(
  '20260729224850',
  '0279_restore_tenant_lifecycle_acl_history',
  array[$sdd0172_tenant_split_original_0279$-- SDD-0172 · hacer reproducible el preflight histórico de 0268.
-- Sólo antepone al ledger el retiro de DELETE de roles cliente; no ejecuta DDL.

do $sdd0172_tenant_acl_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
          and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
        )
      )
  ) then
    raise exception
      '0279 abortada: ledger 0268 ausente, ambiguo o con payload inesperado';
  end if;
end
$sdd0172_tenant_acl_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_acl_revoke$revoke delete on table public.tenants from public, anon, authenticated;$sdd0172_tenant_acl_revoke$,
  statements[1]
]
where version = '20260729053713'
  and name = '0268_tenant_lifecycle_guardrails'
  and cardinality(statements) = 1
  and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3';

do $sdd0172_tenant_acl_postconditions$
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
    raise exception '0279 abortada: 0268 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_acl_postconditions$;
$sdd0172_tenant_split_original_0279$ || chr(13) || chr(10)]
);

do $fixture_reproduces_r9$
begin
  if not has_table_privilege('anon', 'public.tenants', 'DELETE')
     or not has_table_privilege('authenticated', 'public.tenants', 'DELETE') then
    raise exception 'TEST 0279: el fixture no reproduce el fallo R9';
  end if;
end
$fixture_reproduces_r9$;

\ir ../migrations/0286_repair_tenant_acl_split_history.sql
\ir ../migrations/0286_repair_tenant_acl_split_history.sql

do $patched_0279_contract$
declare
  v_payload text;
begin
  select statements[1]
  into strict v_payload
  from supabase_migrations.schema_migrations
  where version = '20260729224850'
    and name = '0279_restore_tenant_lifecycle_acl_history'
    and cardinality(statements) = 1
    and md5(statements[1]) = 'd67b2e81a67028e56bd994f47ce16f6d';

  if v_payload <> $sdd0172_tenant_split_expected_0279$-- SDD-0172 · hacer reproducible el preflight histórico de 0268.
-- Sólo repara el estado canónico o el split exacto de R17; no ejecuta DDL.
-- 0286 conserva fail-closed cualquier representación no reconocida.

do $sdd0172_tenant_acl_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
          and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
        )
      )
  ) then
    raise exception
      '0279 abortada: ledger 0268 ausente, ambiguo o con payload inesperado';
  end if;
end
$sdd0172_tenant_acl_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_acl_revoke$revoke delete on table public.tenants from public, anon, authenticated;$sdd0172_tenant_acl_revoke$,
  $sdd0172_tenant_acl_canonical_0268$-- ─────────────────────────────────────────────────────────────
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
$sdd0172_tenant_acl_canonical_0268$
]
where version = '20260729053713'
  and name = '0268_tenant_lifecycle_guardrails'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
    )
  );

do $sdd0172_tenant_acl_postconditions$
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
    raise exception '0279 abortada: 0268 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_acl_postconditions$;
$sdd0172_tenant_split_expected_0279$ || chr(13) || chr(10) then
    raise exception 'TEST 0286: payload 0279 no es byte-idéntico al esperado';
  end if;
  if pg_catalog.strpos(v_payload, 'f21fd3848c7a52b0c12c0c215da86c31') = 0
     or pg_catalog.strpos(v_payload, 'cardinality(statements) = 10') = 0 then
    raise exception 'TEST 0286: falta compatibilidad con el split de R17';
  end if;
end
$patched_0279_contract$;

select statements[1]
from supabase_migrations.schema_migrations
where version = '20260729224850'
  and name = '0279_restore_tenant_lifecycle_acl_history'
\gexec

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
