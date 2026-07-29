\set ON_ERROR_STOP on

-- Fixture PostgreSQL desechable. Toda la prueba termina en ROLLBACK.
begin;

do $roles$
begin
  if to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'Fixture 0268 rechazada: los objetos reales ya existen';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$roles$;

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

create table public.lifecycle_other_child (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  constraint lifecycle_other_child_tenant_fkey
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
as $$
  select gen_random_uuid()
$$;

alter table public.tenants enable row level security;
grant select on public.tenants to authenticated;
grant all on public.tenants to service_role;

insert into public.tenants (id)
values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003');

insert into public.entity_audit_log (tenant_id)
values ('10000000-0000-0000-0000-000000000001');

insert into public.lifecycle_other_child (tenant_id)
values ('10000000-0000-0000-0000-000000000002');

\ir ../migrations/0268_tenant_lifecycle_guardrails.sql

do $contract$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and confdeltype = 'r'
      and convalidated
  ) then
    raise exception 'TEST 0268: la FK audit no quedó RESTRICT';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.lifecycle_other_child'::regclass
      and conname = 'lifecycle_other_child_tenant_fkey'
      and confdeltype = 'c'
      and convalidated
  ) then
    raise exception 'TEST 0268: una FK fuera de alcance cambió';
  end if;

  if has_table_privilege('service_role', 'public.tenants', 'DELETE')
     or not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE') then
    raise exception 'TEST 0268: ACL service_role incorrecta';
  end if;

  begin
    delete from public.tenants
    where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0268: owner eliminó tenant con auditoría';
  exception
    when foreign_key_violation then
      null;
  end;

  if not exists (
    select 1 from public.tenants
    where id = '10000000-0000-0000-0000-000000000001'
  ) or not exists (
    select 1 from public.entity_audit_log
    where tenant_id = '10000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'TEST 0268: intento destructivo perdió historia';
  end if;
end
$contract$;

set local role service_role;

do $service_role_denied$
begin
  begin
    delete from public.tenants
    where id = '10000000-0000-0000-0000-000000000003';
    raise exception 'TEST 0268: service_role todavía borró tenants';
  exception
    when insufficient_privilege then
      null;
  end;
end
$service_role_denied$;

reset role;

do $final$
begin
  if not exists (
    select 1 from public.tenants
    where id = '10000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'TEST 0268: service_role dejó residuo destructivo';
  end if;
end
$final$;

rollback;

select
  to_regclass('public.tenants') is null
  and to_regclass('public.entity_audit_log') is null
  and to_regclass('public.lifecycle_other_child') is null
  and to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null
  as lifecycle_fixture_rolled_back;
