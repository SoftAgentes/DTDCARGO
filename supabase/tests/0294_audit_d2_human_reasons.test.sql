\set ON_ERROR_STOP on

-- Fixture D2 R3 desechable. No imprime datos y termina en rollback.
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
    create role service_role nologin;
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

create table public.accounts (
  id uuid primary key, tenant_id uuid not null, code text, type text,
  parent_id uuid, subtype text, is_postable boolean
);
create table public.journal_entries (
  id uuid primary key, tenant_id uuid not null, entry_code text,
  status text, source text, deleted_at timestamptz
);
create table public.invoices (
  id uuid primary key, tenant_id uuid not null, invoice_code text,
  status text, currency text, due_date date, shipment_id uuid,
  deleted_at timestamptz
);
create table public.payment_receipts (
  id uuid primary key, tenant_id uuid not null, receipt_code text,
  invoice_id uuid, currency text, application_status text,
  deleted_at timestamptz
);
create table public.suppliers (
  id uuid primary key, tenant_id uuid not null, supplier_code text,
  type text, country text, default_currency text, payment_channel text,
  deleted_at timestamptz
);
create table public.supplier_bills (
  id uuid primary key, tenant_id uuid not null, bill_code text,
  supplier_id uuid, status text, currency text, paid_amount numeric not null,
  deleted_at timestamptz
);
create table public.supplier_payments (
  id uuid primary key, tenant_id uuid not null, payment_code text,
  bill_id uuid, supplier_id uuid, currency text, deleted_at timestamptz
);

\ir ../migrations/0290_audit_d2_financial_domain.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

grant select, update on table
  public.journal_entries,
  public.invoices,
  public.payment_receipts,
  public.supplier_bills,
  public.supplier_payments
to authenticated;

insert into public.journal_entries values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'A-2026-0001', 'asentado', 'manual', null
);
insert into public.invoices values (
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'F-2026-0001', 'emitida', 'USD', current_date, null, null
);
insert into public.payment_receipts values (
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'R-2026-0001', null, 'USD', 'aplicado', null
);
insert into public.supplier_bills values (
  '20000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  'CXP-2026-0001', null, 'pendiente', 'USD', 0, null
);
insert into public.supplier_payments values (
  '20000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  'OP-2026-0001',
  '20000000-0000-0000-0000-000000000004',
  null, 'USD', null
);
insert into public.invoices values (
  '20000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000001',
  'F-2026-0002', 'emitida', 'USD', current_date, null, null
);

set role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);

select public.void_journal_entry_with_audit_reason(
  '20000000-0000-0000-0000-000000000001',
  'Asiento duplicado'
);
select public.void_invoice_with_audit_reason(
  '20000000-0000-0000-0000-000000000002',
  'Condición comercial corregida'
);
select public.void_payment_receipt_with_audit_reason(
  '20000000-0000-0000-0000-000000000003',
  'Pago aplicado a referencia equivocada'
);
select public.void_supplier_bill_with_audit_reason(
  '20000000-0000-0000-0000-000000000004',
  'Documento de proveedor duplicado'
);
select public.void_supplier_payment_with_audit_reason(
  '20000000-0000-0000-0000-000000000005',
  'Orden emitida contra la cuenta incorrecta'
);
reset role;

do $events$
begin
  if (
    select pg_catalog.count(*)
    from public.entity_audit_log
    where (entity_id, reason) in (
      (
        '20000000-0000-0000-0000-000000000001'::uuid,
        'Asiento duplicado'
      ),
      (
        '20000000-0000-0000-0000-000000000002'::uuid,
        'Condición comercial corregida'
      ),
      (
        '20000000-0000-0000-0000-000000000003'::uuid,
        'Pago aplicado a referencia equivocada'
      ),
      (
        '20000000-0000-0000-0000-000000000004'::uuid,
        'Documento de proveedor duplicado'
      ),
      (
        '20000000-0000-0000-0000-000000000005'::uuid,
        'Orden emitida contra la cuenta incorrecta'
      )
    )
      and actor_id = '30000000-0000-0000-0000-000000000001'
      and source = 'rpc'
      and payload = '{}'::jsonb
  ) <> 5 then
    raise exception 'TEST 0294: motivos humanos no llegaron a los cinco eventos';
  end if;

  if pg_catalog.has_function_privilege(
    'anon',
    'public.void_invoice_with_audit_reason(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'TEST 0294: anon conserva EXECUTE';
  end if;

  if pg_catalog.has_function_privilege(
    'service_role',
    'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)',
    'EXECUTE'
  ) then
    raise exception 'TEST 0294: service_role conserva el writer base';
  end if;
end;
$events$;

do $invalid_reason$
begin
  begin
    perform public.void_invoice_with_audit_reason(
      '20000000-0000-0000-0000-000000000006',
      'x'
    );
    raise exception 'TEST 0294: aceptó motivo corto';
  exception
    when sqlstate '22023' then null;
  end;

  if (
    select status
    from public.invoices
    where id = '20000000-0000-0000-0000-000000000006'
  ) <> 'emitida' then
    raise exception 'TEST 0294: motivo inválido mutó la factura';
  end if;
end;
$invalid_reason$;

create or replace function public.append_audit_event_v1(
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
    perform public.void_invoice_with_audit_reason(
      '20000000-0000-0000-0000-000000000006',
      'Prueba de rollback del writer'
    );
    raise exception 'TEST 0294: el fallo de auditoría no abortó';
  exception
    when others then
      if sqlerrm = 'TEST 0294: el fallo de auditoría no abortó' then
        raise;
      end if;
  end;

  if (
    select status
    from public.invoices
    where id = '20000000-0000-0000-0000-000000000006'
  ) <> 'emitida' then
    raise exception 'TEST 0294: la mutación sobrevivió al fallo del evento';
  end if;
end;
$rollback$;

rollback;
select true as audit_d2_human_reasons_fixture_rolled_back;
