\set ON_ERROR_STOP on

-- Contrato desechable D1. No imprime payload y termina en rollback.
begin;

do $roles$
begin
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
create table auth.users (id uuid primary key);

create function auth.uid()
returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create type public.agent_model as enum ('model-a');
create type public.agent_status as enum ('off', 'paused', 'active');

create table public.tenants (
  id uuid primary key,
  legal_name text,
  trade_name text,
  rif text,
  commercial_email text,
  phone text,
  whatsapp text,
  website text,
  iva_enabled boolean default false,
  iva_rate numeric default 16,
  islr_rate numeric default 3,
  igtf_rate numeric default 3,
  invoice_footer_text text,
  invoice_terms_text text
);

create table public.user_tenants (
  user_id uuid not null references auth.users(id),
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  disabled_at timestamptz,
  warehouse_scope text default 'all',
  created_at timestamptz default now(),
  primary key (user_id, tenant_id)
);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id),
  telegram_chat_id text,
  telegram_username text,
  telegram_link_code text unique,
  updated_at timestamptz default now()
);

create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  email text not null,
  role text not null,
  region text not null,
  token text not null,
  revoked_at timestamptz
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  created_by uuid,
  revoked_at timestamptz
);

create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  url text not null,
  events jsonb not null default '[]',
  secret text not null,
  active boolean not null default true,
  deleted_at timestamptz
);

create table public.company_offices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  country text not null,
  name text not null,
  address text not null,
  deleted_at timestamptz
);

create table public.company_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  bank_name text not null,
  account_type text not null,
  currency text not null,
  account_number text not null,
  deleted_at timestamptz
);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  key text not null,
  enabled boolean not null,
  updated_at timestamptz default now(),
  updated_by uuid,
  unique (tenant_id, key)
);

create table public.client_notification_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid,
  trigger_event text not null,
  channel text not null,
  anchor text not null,
  offset_minutes integer not null,
  template_key text,
  custom_title text,
  custom_body text,
  visible_in_portal boolean not null,
  active boolean not null,
  updated_at timestamptz default now()
);
create unique index client_notif_rules_default_uniq
  on public.client_notification_rules (tenant_id, trigger_event)
  where client_id is null;

create table public.skills (
  id uuid primary key,
  active boolean not null default true
);
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  skill_id uuid not null,
  slug text not null,
  name text not null,
  model public.agent_model not null,
  status public.agent_status not null,
  budget_usd_monthly numeric not null,
  trigger_config jsonb not null default '{}',
  created_by uuid,
  deleted_at timestamptz
);
create table public.agent_tool_grants (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  tool_key text not null,
  scope jsonb not null default '{}',
  granted_by uuid,
  unique (agent_id, tool_key)
);

create table public.audit_entity_types (
  entity_type text primary key,
  status text not null,
  domain_code text not null,
  contract_version integer not null,
  introduced_by_ref text
);

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  source text not null,
  result text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  payload jsonb not null default '{}',
  correlation_id text,
  schema_version integer not null,
  sensitivity text not null
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
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.entity_audit_log (
    tenant_id, entity_type, entity_id, actor_type, actor_id, event_type,
    source, result, reason, before_data, after_data, payload, correlation_id,
    schema_version, sensitivity
  ) values (
    p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id,
    p_event_type, p_source, p_result, p_reason, p_before_data, p_after_data,
    p_payload, p_correlation_id, p_schema_version, p_sensitivity
  ) returning id into v_id;
  return v_id;
end $$;

create function public.studio_invite_user(text, text, text)
returns table(invitation_id uuid, token text)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  insert into public.user_invitations (
    tenant_id, email, role, region, token
  ) values (
    '10000000-0000-0000-0000-000000000001',
    $1, $2, $3, 'fixture-token'
  ) returning id, user_invitations.token;
end $$;

create function public.studio_change_user_role(uuid, text)
returns boolean language sql security definer set search_path = ''
as $$ update public.user_tenants set role=$2 where user_id=$1 returning true $$;
create function public.studio_set_user_warehouse_scope(uuid, text)
returns boolean language sql security definer set search_path = ''
as $$ update public.user_tenants set warehouse_scope=$2 where user_id=$1 returning true $$;
create function public.studio_revoke_invitation(uuid)
returns boolean language sql security definer set search_path = ''
as $$ update public.user_invitations set revoked_at=now() where id=$1 returning true $$;
create function public.studio_set_user_disabled(uuid, boolean)
returns boolean language sql security definer set search_path = ''
as $$
  update public.user_tenants
  set disabled_at=case when $2 then now() else null end
  where user_id=$1 returning true
$$;
create function public.next_agent_slug(uuid)
returns text language sql security definer set search_path = ''
as $$ select 'AGT-0001'::text $$;

insert into auth.users (id) values
  ('20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003');
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
insert into public.user_profiles (user_id) values
  ('20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002');
insert into public.feature_flags (tenant_id, key, enabled) values
  ('10000000-0000-0000-0000-000000000001', 'audit_log', false);

\ir ../migrations/0289_audit_d1_access_configuration.sql

set local role authenticated;
set local "request.jwt.claim.sub" =
  '20000000-0000-0000-0000-000000000001';

do $feature_flag$
declare
  v_operation uuid := '30000000-0000-0000-0000-000000000001';
  v_first jsonb;
  v_second jsonb;
begin
  v_first := public.audit_d1_execute(
    v_operation,
    'feature_flag.toggle',
    null,
    '{"key":"audit_log","enabled":true}',
    null
  );
  v_second := public.audit_d1_execute(
    v_operation,
    'feature_flag.toggle',
    null,
    '{"key":"audit_log","enabled":true}',
    null
  );

  if v_first <> v_second then
    raise exception 'TEST 0289: idempotencia devolvió resultados distintos';
  end if;
end
$feature_flag$;

reset role;

do $feature_flag_assertions$
declare
  v_operation uuid := '30000000-0000-0000-0000-000000000001';
  v_event_count integer;
begin
  if not (select enabled from public.feature_flags where key='audit_log') then
    raise exception 'TEST 0289: feature flag no quedó habilitado';
  end if;

  select count(*) into v_event_count
  from public.entity_audit_log
  where correlation_id = v_operation::text;
  if v_event_count <> 1 then
    raise exception 'TEST 0289: repetición duplicó el evento';
  end if;
end
$feature_flag_assertions$;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '20000000-0000-0000-0000-000000000001';

do $auth_workflow$
declare
  v_operation uuid := '30000000-0000-0000-0000-000000000002';
begin
  perform public.audit_d1_auth_intent(
    v_operation,
    '20000000-0000-0000-0000-000000000002',
    true,
    'Suspensión contractual de prueba'
  );
  perform public.audit_d1_auth_transition(v_operation, 'claim');
  perform public.audit_d1_auth_transition(v_operation, 'auth_succeeded');
  perform public.audit_d1_auth_transition(v_operation, 'confirm');

end
$auth_workflow$;

reset role;

do $auth_workflow_assertions$
declare
  v_operation uuid := '30000000-0000-0000-0000-000000000002';
  v_status text;
  v_event_count integer;
begin
  select status into v_status
  from public.audit_external_operations
  where operation_key = v_operation;
  if v_status <> 'confirmed'
     or not exists (
       select 1 from public.user_tenants
       where user_id='20000000-0000-0000-0000-000000000002'
         and disabled_at is not null
     ) then
    raise exception 'TEST 0289: workflow Auth no confirmó DB';
  end if;

  select count(*) into v_event_count
  from public.entity_audit_log
  where correlation_id = v_operation::text;
  if v_event_count <> 2 then
    raise exception 'TEST 0289: intención/final no produjeron dos eventos';
  end if;

  perform public.audit_d1_auth_transition(
    v_operation,
    'reconcile_auth_succeeded'
  );
  perform public.audit_d1_auth_transition(v_operation, 'confirm');

  select count(*) into v_event_count
  from public.entity_audit_log
  where correlation_id = v_operation::text;
  if v_event_count <> 2 then
    raise exception 'TEST 0289: reconciliación idempotente duplicó eventos';
  end if;
end
$auth_workflow_assertions$;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '20000000-0000-0000-0000-000000000002';

do $non_admin$
begin
  begin
    perform public.audit_d1_execute(
      gen_random_uuid(),
      'feature_flag.toggle',
      null,
      '{"key":"audit_log","enabled":false}',
      null
    );
    raise exception 'TEST 0289: no-admin aceptado';
  exception
    when insufficient_privilege then null;
  end;
end
$non_admin$;

reset role;

do $acl$
begin
  if has_function_privilege(
    'anon',
    'public.audit_d1_execute(uuid,text,uuid,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'TEST 0289: anon conserva EXECUTE';
  end if;
  if has_table_privilege(
    'authenticated',
    'public.audit_external_operations',
    'SELECT'
  ) then
    raise exception 'TEST 0289: tabla externa expuesta';
  end if;
  if exists (
    select 1
    from public.entity_audit_log
    where payload::text ~* 'token|secret|password|email|account_number'
       or coalesce(before_data, '{}')::text ~* 'token|secret|password|email|account_number'
       or coalesce(after_data, '{}')::text ~* 'token|secret|password|email|account_number'
  ) then
    raise exception 'TEST 0289: payload prohibido persistido';
  end if;
end
$acl$;

rollback;

select
  to_regclass('public.audit_d1_operations') is null
  and to_regclass('public.audit_external_operations') is null
  and to_regprocedure('public.audit_d1_execute(uuid,text,uuid,jsonb,text)') is null
  as audit_d1_fixture_rolled_back;
