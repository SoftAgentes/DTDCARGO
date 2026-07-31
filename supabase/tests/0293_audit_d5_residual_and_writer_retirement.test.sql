\set ON_ERROR_STOP on
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon,authenticated,service_role;

create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path=''
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

create table public.tenants(id uuid primary key);
create table public.user_tenants(
  user_id uuid, tenant_id uuid, role text, disabled_at timestamptz,
  created_at timestamptz default now()
);
create table public.audit_entity_types(
  entity_type text primary key,status text,domain_code text,
  contract_version integer,introduced_by_ref text
);
create table public.entity_audit_log(
  id uuid primary key default gen_random_uuid(),tenant_id uuid,entity_type text,
  entity_id uuid,actor_type text,actor_id uuid,event_type text,source text,
  result text,reason text,before_data jsonb,after_data jsonb,
  payload jsonb default '{}',correlation_id text,schema_version integer,
  sensitivity text,
  check (source in ('rpc','legacy_unknown')),
  check (result<>'failed' or reason is not null),
  check (event_type !~ '(_deleted|_voided|_cancelled)$' or reason is not null)
);
grant insert on public.entity_audit_log to service_role;
create function public.append_audit_event(
  p_tenant_id uuid,p_entity_type text,p_entity_id uuid,p_actor_type text,
  p_actor_id uuid,p_event_type text,p_source text,
  p_result text default 'succeeded',p_reason text default null,
  p_before_data jsonb default null,p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb,p_correlation_id text default null,
  p_schema_version integer default 1,p_sensitivity text default 'internal'
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  insert into public.entity_audit_log values(
    gen_random_uuid(),p_tenant_id,p_entity_type,p_entity_id,p_actor_type,
    p_actor_id,p_event_type,p_source,p_result,p_reason,p_before_data,
    p_after_data,p_payload,p_correlation_id,p_schema_version,p_sensitivity
  ) returning id into v_id;
  return v_id;
end $$;

create table public.calculator_settings(tenant_id uuid primary key,updated_at timestamptz);
create table public.calculator_cities(id uuid primary key,tenant_id uuid,slug text,deleted_at timestamptz);
create table public.operational_calendar(
  id uuid primary key,tenant_id uuid,country text,kind text,start_date date,
  end_date date,deleted_at timestamptz
);
create table public.tenant_fx_history(id uuid primary key,tenant_id uuid,currency_pair text);
create table public.clients(id uuid primary key,tenant_id uuid,email text,phone text);
create table public.client_users(
  id uuid primary key,tenant_id uuid,client_id uuid,status text,email text
);
create table public.prealerta_addons(
  id uuid primary key,tenant_id uuid,code text,is_active boolean,multi_tracking boolean
);
create table public.dispatch_routes(
  id uuid primary key,tenant_id uuid,route_code text,route_type text,hub text,
  active boolean,deleted_at timestamptz
);
create table public.dispatch_city_catalog(
  id uuid primary key,tenant_id uuid,state_code text,active boolean,is_hq boolean
);
grant select,insert,update,delete on
  public.calculator_settings,
  public.calculator_cities,
  public.operational_calendar,
  public.tenant_fx_history,
  public.clients,
  public.client_users,
  public.prealerta_addons,
  public.dispatch_routes,
  public.dispatch_city_catalog
to authenticated;

insert into auth.users values('20000000-0000-0000-0000-000000000001');
insert into public.tenants values('10000000-0000-0000-0000-000000000001');
insert into public.user_tenants values(
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','admin',null,now()
);
insert into public.clients values(
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',null,null
);

\ir ../migrations/0293_audit_d5_residual_and_writer_retirement.sql

set local role authenticated;
set local "request.jwt.claim.sub"='20000000-0000-0000-0000-000000000001';

insert into public.calculator_settings values(
  '10000000-0000-0000-0000-000000000001',now()
);
update public.clients
set email='persona@example.test',phone='+580000000000'
where id='30000000-0000-0000-0000-000000000001';
insert into public.client_users values(
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'invited','persona@example.test'
);
insert into public.dispatch_routes values(
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'R-001','directa','valencia',true,null
);

select public.audit_d5_external_intent(
  '60000000-0000-0000-0000-000000000001',
  'portal.email_invite',
  '30000000-0000-0000-0000-000000000001'
);
select public.audit_d5_external_intent(
  '60000000-0000-0000-0000-000000000001',
  'portal.email_invite',
  '30000000-0000-0000-0000-000000000001'
);
select public.audit_d5_external_transition(
  '60000000-0000-0000-0000-000000000001','claim',null
);
do $active_lease$
begin
  begin
    perform public.audit_d5_external_transition(
      '60000000-0000-0000-0000-000000000001','claim',null
    );
    raise exception 'TEST 0293: lease activo permitió un segundo claim';
  exception
    when sqlstate '22023' then null;
  end;
end;
$active_lease$;
select public.audit_d5_external_transition(
  '60000000-0000-0000-0000-000000000001',
  'reconciliation_required',
  'provider_outcome_unknown'
);
select public.audit_d5_external_transition(
  '60000000-0000-0000-0000-000000000001','reconcile_succeed',null
);
select public.audit_d5_external_transition(
  '60000000-0000-0000-0000-000000000001','reconcile_succeed',null
);

reset role;

do $assertions$
begin
  if (select count(*) from public.entity_audit_log) <> 6 then
    raise exception 'TEST 0293: cantidad de eventos inesperada';
  end if;
  if exists(
    select 1 from public.entity_audit_log
    where coalesce(before_data::text,'') ~* '(persona@example|580000)'
       or coalesce(after_data::text,'') ~* '(persona@example|580000)'
       or payload <> '{}'::jsonb
  ) then
    raise exception 'TEST 0293: PII o payload prohibido persistido';
  end if;
  if has_table_privilege('service_role','public.entity_audit_log','INSERT') then
    raise exception 'TEST 0293: INSERT service_role no fue revocado';
  end if;
  if (select status from public.audit_d5_external_operations
      where operation_key='60000000-0000-0000-0000-000000000001') <> 'succeeded' then
    raise exception 'TEST 0293: workflow externo no terminó';
  end if;
  if (select attempt_count from public.audit_d5_external_operations
      where operation_key='60000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'TEST 0293: claim idempotente alteró intentos';
  end if;
end;
$assertions$;

create or replace function public.append_audit_event(
  p_tenant_id uuid,p_entity_type text,p_entity_id uuid,p_actor_type text,
  p_actor_id uuid,p_event_type text,p_source text,
  p_result text default 'succeeded',p_reason text default null,
  p_before_data jsonb default null,p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb,p_correlation_id text default null,
  p_schema_version integer default 1,p_sensitivity text default 'internal'
) returns uuid language plpgsql security definer set search_path=''
as $$ begin raise exception 'forced_audit_failure'; end $$;

do $rollback$
begin
  begin
    update public.dispatch_routes set active=false
    where id='50000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0293: writer fallido no abortó';
  exception when others then
    if sqlerrm='TEST 0293: writer fallido no abortó' then raise; end if;
  end;
  if not (select active from public.dispatch_routes
          where id='50000000-0000-0000-0000-000000000001') then
    raise exception 'TEST 0293: la mutación sobrevivió';
  end if;
end;
$rollback$;

rollback;
select true as audit_d5_fixture_rolled_back;
