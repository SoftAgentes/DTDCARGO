\set ON_ERROR_STOP on

-- Fixture D2 desechable. No imprime datos y termina en rollback.
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
  constraint audit_reason_required check (
    event_type !~ '(_voided|_deleted)$' or reason is not null
  )
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

create table public.accounts (
  id uuid primary key,
  tenant_id uuid not null,
  code text,
  type text,
  parent_id uuid,
  subtype text,
  is_postable boolean
);
create table public.journal_entries (
  id uuid primary key,
  tenant_id uuid not null,
  entry_code text,
  status text,
  source text,
  deleted_at timestamptz
);
create table public.invoices (
  id uuid primary key,
  tenant_id uuid not null,
  invoice_code text,
  status text,
  currency text,
  due_date date,
  shipment_id uuid,
  deleted_at timestamptz
);
create table public.payment_receipts (
  id uuid primary key,
  tenant_id uuid not null,
  receipt_code text,
  invoice_id uuid,
  currency text,
  application_status text,
  deleted_at timestamptz
);
create table public.suppliers (
  id uuid primary key,
  tenant_id uuid not null,
  supplier_code text,
  type text,
  country text,
  default_currency text,
  payment_channel text,
  deleted_at timestamptz
);
create table public.supplier_bills (
  id uuid primary key,
  tenant_id uuid not null,
  bill_code text,
  supplier_id uuid,
  status text,
  currency text,
  deleted_at timestamptz
);
create table public.supplier_payments (
  id uuid primary key,
  tenant_id uuid not null,
  payment_code text,
  bill_id uuid,
  supplier_id uuid,
  currency text,
  deleted_at timestamptz
);

\ir ../migrations/0290_audit_d2_financial_domain.sql

insert into public.accounts
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '1.1.1', 'A', null, null, true
);
insert into public.journal_entries
values (
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'A-2026-0001', 'borrador', 'manual', null
);
insert into public.invoices
values (
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'F-2026-0001', 'borrador', 'USD', current_date, null, null
);
insert into public.payment_receipts
values (
  '20000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  'R-2026-0001', null, 'USD', 'recibido_sin_ref', null
);
insert into public.suppliers
values (
  '20000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  'PRV-0001', 'proveedor_cn', 'CN', 'USD', 'transferencia', null
);
insert into public.supplier_bills
values (
  '20000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000001',
  'CXP-2026-0001',
  '20000000-0000-0000-0000-000000000005',
  'pendiente', 'USD', null
);
insert into public.supplier_payments
values (
  '20000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000001',
  'OP-2026-0001',
  '20000000-0000-0000-0000-000000000006',
  '20000000-0000-0000-0000-000000000005',
  'USD', null
);

update public.journal_entries
set status = 'asentado'
where id = '20000000-0000-0000-0000-000000000002';
update public.invoices
set status = 'anulada'
where id = '20000000-0000-0000-0000-000000000003';
update public.payment_receipts
set deleted_at = now()
where id = '20000000-0000-0000-0000-000000000004';

do $events$
declare
  v_count integer;
begin
  select count(*) into v_count from public.entity_audit_log;
  if v_count <> 10 then
    raise exception 'TEST 0290: se esperaban 10 eventos, se obtuvieron %', v_count;
  end if;

  if exists (
    select 1
    from public.entity_audit_log
    where source <> 'rpc'
       or sensitivity <> 'restricted'
       or payload <> '{}'::jsonb
       or before_data::text ~* '(name|phone|email|amount|reference)'
       or after_data::text ~* '(name|phone|email|amount|reference)'
  ) then
    raise exception 'TEST 0290: payload o metadatos fuera de allowlist';
  end if;

  if not exists (
    select 1
    from public.entity_audit_log
    where event_type = 'invoice_voided'
      and reason is not null
  ) then
    raise exception 'TEST 0290: anulación sin motivo';
  end if;
end;
$events$;

-- Reemplazar el writer por un fallo demuestra rollback de la mutación.
create or replace function public.append_audit_event(
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
begin
  raise exception 'forced_audit_failure';
end $$;

do $rollback$
begin
  begin
    update public.accounts
    set is_postable = false
    where id = '20000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0290: el fallo de auditoría no abortó';
  exception
    when others then
      if sqlerrm = 'TEST 0290: el fallo de auditoría no abortó' then
        raise;
      end if;
  end;

  if not (
    select is_postable
    from public.accounts
    where id = '20000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'TEST 0290: la mutación sobrevivió al fallo del evento';
  end if;
end;
$rollback$;

rollback;
select true as audit_d2_fixture_rolled_back;
