\set ON_ERROR_STOP on
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$roles$;

create schema auth;
create function auth.uid()
returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

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
  sensitivity text not null,
  check (event_type !~ '(_voided|_deleted|_cancelled)$' or reason is not null)
);
create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text,
  p_actor_id uuid, p_event_type text, p_source text,
  p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null,
  p_schema_version integer default 1, p_sensitivity text default 'internal'
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.entity_audit_log values (
    gen_random_uuid(), p_tenant_id, p_entity_type, p_entity_id, p_actor_type,
    p_actor_id, p_event_type, p_source, p_result, p_reason, p_before_data,
    p_after_data, p_payload, p_correlation_id, p_schema_version, p_sensitivity
  ) returning id into v_id;
  return v_id;
end $$;

create table public.renditions (
  id uuid primary key,
  tenant_id uuid not null,
  rendition_code text,
  status text,
  period_from date,
  period_to date,
  receipt_count integer,
  void_reason text
);
create table public.purchase_orders (
  id uuid primary key,
  tenant_id uuid not null,
  purchase_order_code text,
  status text,
  supplier_id uuid,
  sales_order_id uuid,
  bill_id uuid,
  deleted_at timestamptz
);
create table public.sales_orders (
  id uuid primary key,
  tenant_id uuid not null,
  sales_order_code text,
  status text,
  quote_id uuid,
  service text,
  deleted_at timestamptz
);
create table public.prealertas (
  id uuid primary key,
  tenant_id uuid not null,
  sales_order_id uuid
);

\ir ../migrations/0291_audit_d3_commercial_cycle.sql

insert into public.renditions values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'RND-2026-0001', 'emitida', current_date - 15, current_date, 2, null
);
insert into public.purchase_orders values (
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'OC-2026-0001', 'borrador', null, null, null, null
);
insert into public.sales_orders values (
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'OV-2026-0001', 'confirmada', null, 'consolidacion', null
);
insert into public.prealertas values (
  '20000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  null
);

update public.renditions
set status='anulada', void_reason='Prueba de anulación controlada'
where id='20000000-0000-0000-0000-000000000001';
update public.purchase_orders
set status='cancelada'
where id='20000000-0000-0000-0000-000000000002';
update public.sales_orders
set status='cancelada'
where id='20000000-0000-0000-0000-000000000003';
update public.prealertas
set sales_order_id='20000000-0000-0000-0000-000000000003'
where id='20000000-0000-0000-0000-000000000004';

do $events$
begin
  if (select count(*) from public.entity_audit_log) <> 7 then
    raise exception 'TEST 0291: cantidad de eventos inesperada';
  end if;
  if exists (
    select 1 from public.entity_audit_log
    where source <> 'rpc'
       or sensitivity <> 'restricted'
       or payload <> '{}'::jsonb
       or before_data::text ~* '(client_name|supplier_name|notes|total|amount)'
       or after_data::text ~* '(client_name|supplier_name|notes|total|amount)'
  ) then
    raise exception 'TEST 0291: payload fuera de allowlist';
  end if;
end;
$events$;

create or replace function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text,
  p_actor_id uuid, p_event_type text, p_source text,
  p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null,
  p_schema_version integer default 1, p_sensitivity text default 'internal'
)
returns uuid language plpgsql security definer set search_path = ''
as $$ begin raise exception 'forced_audit_failure'; end $$;

do $rollback$
begin
  begin
    update public.sales_orders
    set service='ddp'
    where id='20000000-0000-0000-0000-000000000003';
    raise exception 'TEST 0291: writer fallido no abortó';
  exception when others then
    if sqlerrm = 'TEST 0291: writer fallido no abortó' then raise; end if;
  end;
  if (
    select service <> 'consolidacion'
    from public.sales_orders
    where id='20000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'TEST 0291: la mutación sobrevivió al fallo';
  end if;
end;
$rollback$;

rollback;
select true as audit_d3_fixture_rolled_back;
