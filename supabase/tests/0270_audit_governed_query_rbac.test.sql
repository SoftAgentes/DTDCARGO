\set ON_ERROR_STOP on

-- Contrato desechable del Corte C1. No imprime payload ni deja filas.
begin;

do $roles$
begin
  if to_regclass('public.entity_audit_log') is not null then
    raise exception 'Fixture 0270 rechazada: objetos reales presentes';
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
create schema auth;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'aal',
    coalesce(nullif(current_setting('request.jwt.claim.aal', true), ''), 'aal1')
  )
$$;

create table public.tenants (id uuid primary key);

create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);

create table public.user_profiles (
  user_id uuid primary key,
  first_name text,
  last_name text
);

create table public.operario_pins (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  display_name text not null
);

create table public.audit_entity_types (
  entity_type text primary key,
  status text not null
);

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_type text not null references public.audit_entity_types(entity_type),
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  correlation_id text,
  source text not null default 'legacy_unknown',
  result text not null default 'legacy_unknown',
  reason text,
  before_data jsonb,
  after_data jsonb,
  schema_version integer not null default 1,
  sensitivity text not null default 'legacy_unknown',
  constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade
);

create index entity_audit_log_entity_idx
  on public.entity_audit_log (entity_type, entity_id, occurred_at desc);
create index entity_audit_log_tenant_idx
  on public.entity_audit_log (tenant_id, occurred_at desc);
create index entity_audit_log_tenant_correlation_idx
  on public.entity_audit_log (
    tenant_id,
    correlation_id,
    occurred_at desc,
    id desc
  ) where correlation_id is not null;

alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select
  on public.entity_audit_log for select to authenticated using (true);

grant select on public.entity_audit_log to authenticated;
grant insert on public.entity_audit_log to service_role;

create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.entity_audit_log (
    tenant_id,
    entity_type,
    entity_id,
    actor_type,
    actor_id,
    event_type,
    source,
    result,
    reason,
    before_data,
    after_data,
    payload,
    correlation_id,
    schema_version,
    sensitivity
  ) values (
    p_tenant_id,
    p_entity_type,
    p_entity_id,
    p_actor_type,
    p_actor_id,
    p_event_type,
    p_source,
    p_result,
    p_reason,
    p_before_data,
    p_after_data,
    p_payload,
    p_correlation_id,
    p_schema_version,
    p_sensitivity
  ) returning id into v_id;
  return v_id;
end
$$;

revoke all on function public.append_audit_event(
  uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text
) from public, anon, authenticated;
grant execute on function public.append_audit_event(
  uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text
) to service_role;

insert into public.tenants (id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');

insert into public.user_tenants (user_id, tenant_id, role) values
  ('20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'admin'),
  ('20000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001', 'operations'),
  ('20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000002', 'admin');

insert into public.user_profiles (user_id, first_name, last_name) values
  ('20000000-0000-0000-0000-000000000001', 'Admin', 'Uno');

insert into public.operario_pins (id, tenant_id, display_name) values
  ('30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'Operario Uno');

insert into public.audit_entity_types (entity_type, status)
values ('shipment', 'active');

insert into public.entity_audit_log (
  id, tenant_id, entity_type, entity_id, actor_type, actor_id, event_type,
  payload, occurred_at, correlation_id, source, result, sensitivity
) values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'shipment',
    '50000000-0000-0000-0000-000000000001',
    'operario',
    '30000000-0000-0000-0000-000000000001',
    'shipment_created',
    '{"secret":"never-return"}',
    '2026-07-28 12:00:00+00',
    'corr-1',
    'mobile',
    'succeeded',
    'internal'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'shipment',
    '50000000-0000-0000-0000-000000000002',
    'agent',
    '30000000-0000-0000-0000-000000000099',
    'shipment_reviewed',
    '{"unknown":"hidden"}',
    '2026-07-28 11:00:00+00',
    null,
    'ai',
    'succeeded',
    'sensitive'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'shipment',
    '50000000-0000-0000-0000-000000000003',
    'system',
    null,
    'shipment_created',
    '{"tenant_two":"hidden"}',
    '2026-07-28 13:00:00+00',
    null,
    'job',
    'succeeded',
    'internal'
  );

\ir ../migrations/0270_audit_governed_query_rbac.sql

do $acl$
declare
  v_result text;
begin
  if has_table_privilege('authenticated', 'public.entity_audit_log', 'SELECT')
     or not has_table_privilege('service_role', 'public.entity_audit_log', 'INSERT')
     or has_table_privilege('service_role', 'public.entity_audit_log', 'SELECT') then
    raise exception 'TEST 0270: ACL final inválida';
  end if;

  if has_function_privilege(
       'anon',
       'public.audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)',
       'EXECUTE'
     ) then
    raise exception 'TEST 0270: ACL de lista inválida';
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='entity_audit_log'
  ) then
    raise exception 'TEST 0270: Realtime crudo sigue activo';
  end if;

  select pg_get_function_result(
    'public.audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)'::regprocedure
  ) into v_result;
  if v_result ~* '(payload|before_data|after_data|reason)' then
    raise exception 'TEST 0270: firma de lista filtra columnas sensibles';
  end if;
end
$acl$;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '20000000-0000-0000-0000-000000000002';

do $non_admin$
begin
  begin
    perform * from public.audit_list_events();
    raise exception 'TEST 0270: no-admin consultó auditoría';
  exception
    when insufficient_privilege then null;
  end;
end
$non_admin$;

set local "request.jwt.claim.sub" =
  '20000000-0000-0000-0000-000000000001';

do $admin_list$
declare
  v_count integer;
  v_cursor text;
  v_second uuid;
  v_unknown boolean;
begin
  select count(*) into v_count from public.audit_list_events();
  if v_count <> 2 then
    raise exception 'TEST 0270: admin no quedó limitado a su tenant';
  end if;

  select next_cursor into v_cursor
  from public.audit_list_events(1)
  limit 1;
  if v_cursor is null then
    raise exception 'TEST 0270: falta cursor con has_more';
  end if;

  select id into v_second
  from public.audit_list_events(1, null, null, null, null, null, null, null, null, null, v_cursor)
  limit 1;
  if v_second <> '40000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'TEST 0270: cursor omitió o duplicó fila';
  end if;

  select actor_resolved into v_unknown
  from public.audit_list_events(
    50, null, 'agent', null, null, null, null, null, null, null, null
  )
  limit 1;
  if v_unknown is not false then
    raise exception 'TEST 0270: actor desconocido fue falsificado';
  end if;

  begin
    perform * from public.audit_list_events(
      50, null, 'intruso', null, null, null, null, null, null, null, null
    );
    raise exception 'TEST 0270: filtro inválido aceptado';
  exception
    when invalid_parameter_value then null;
  end;
end
$admin_list$;

set local "request.jwt.claim.aal" = 'aal1';

do $aal1$
begin
  begin
    perform public.audit_get_event_detail(
      '40000000-0000-0000-0000-000000000001',
      'Revisión administrativa'
    );
    raise exception 'TEST 0270: reveal aceptó AAL1';
  exception
    when insufficient_privilege then null;
  end;
end
$aal1$;

set local "request.jwt.claim.aal" = 'aal2';

do $reveal$
declare
  v_before integer;
  v_after integer;
  v_detail jsonb;
begin
  select count(*) into v_before from public.audit_list_events();
  v_detail := public.audit_get_event_detail(
    '40000000-0000-0000-0000-000000000001',
    'Revisión administrativa'
  );
  select count(*) into v_after from public.audit_list_events();

  if v_after <> v_before + 1
     or v_detail ->> 'redacted' <> 'true'
     or v_detail -> 'fields' <> '{}'::jsonb
     or v_detail::text like '%never-return%' then
    raise exception 'TEST 0270: reveal no quedó redacted/auditado';
  end if;
end
$reveal$;

reset role;

rollback;

select
  to_regclass('public.entity_audit_log') is null
  and to_regprocedure(
    'public.audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)'
  ) is null
  and to_regprocedure('public.audit_get_event_detail(uuid,text)') is null
  as audit_c1_fixture_rolled_back;
