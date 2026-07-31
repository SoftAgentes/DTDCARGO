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

alter function public.append_audit_event(
  uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text
) rename to append_audit_event_v1;

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
declare
  v_reason text := nullif(
    btrim(current_setting('dtd.audit_reason', true)),
    ''
  );
begin
  return public.append_audit_event_v1(
    p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id,
    p_event_type, p_source, p_result, coalesce(v_reason, p_reason),
    p_before_data, p_after_data, p_payload, p_correlation_id,
    p_schema_version, p_sensitivity
  );
end $$;

\ir ../migrations/0295_audit_d3_human_reasons.sql

grant select, update on public.purchase_orders, public.sales_orders
  to authenticated;

insert into public.purchase_orders values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'OC-2026-0001', 'confirmada', null, null, null, null
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'OC-2026-0002', 'recibida', null, null, null, null
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'OC-2026-0003', 'borrador', null, null, null, null
  );
insert into public.sales_orders values
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'OV-2026-0001', 'parcial', null, 'consolidacion', null
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'OV-2026-0002', 'facturada', null, 'ddp', null
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    'OV-2026-0003', 'confirmada', null, 'consolidacion', null
  );

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select public.cancel_purchase_order_with_audit_reason(
  '20000000-0000-0000-0000-000000000001',
  'Proveedor confirmó que no puede despachar.'
);
select public.cancel_sales_order_with_audit_reason(
  '20000000-0000-0000-0000-000000000003',
  'Cliente retiró la autorización comercial.'
);

do $invalid_and_terminal$
begin
  begin
    perform public.cancel_purchase_order_with_audit_reason(
      '20000000-0000-0000-0000-000000000005',
      'x'
    );
    raise exception 'TEST 0295: motivo corto no falló';
  exception when sqlstate '22023' then
    null;
  end;

  if public.cancel_purchase_order_with_audit_reason(
    '20000000-0000-0000-0000-000000000002',
    'Intento sobre estado terminal.'
  ) then
    raise exception 'TEST 0295: canceló OC no elegible';
  end if;

  if public.cancel_sales_order_with_audit_reason(
    '20000000-0000-0000-0000-000000000004',
    'Intento sobre estado terminal.'
  ) then
    raise exception 'TEST 0295: canceló OV no elegible';
  end if;
end;
$invalid_and_terminal$;

reset role;

do $events$
begin
  if (
    select status
    from public.purchase_orders
    where id = '20000000-0000-0000-0000-000000000001'
  ) <> 'cancelada' then
    raise exception 'TEST 0295: la OC no quedó cancelada';
  end if;

  if (
    select status
    from public.sales_orders
    where id = '20000000-0000-0000-0000-000000000003'
  ) <> 'cancelada' then
    raise exception 'TEST 0295: la OV no quedó cancelada';
  end if;

  if (
    select reason
    from public.entity_audit_log
    where entity_id = '20000000-0000-0000-0000-000000000001'
      and event_type = 'purchase_order_cancelled'
  ) <> 'Proveedor confirmó que no puede despachar.' then
    raise exception 'TEST 0295: motivo humano de OC no llegó exacto';
  end if;

  if (
    select reason
    from public.entity_audit_log
    where entity_id = '20000000-0000-0000-0000-000000000003'
      and event_type = 'sales_order_cancelled'
  ) <> 'Cliente retiró la autorización comercial.' then
    raise exception 'TEST 0295: motivo humano de OV no llegó exacto';
  end if;

  if exists (
    select 1
    from public.entity_audit_log
    where event_type in ('purchase_order_cancelled', 'sales_order_cancelled')
      and (
        source <> 'rpc'
        or sensitivity <> 'restricted'
        or payload <> '{}'::jsonb
      )
  ) then
    raise exception 'TEST 0295: payload o metadatos fuera de contrato';
  end if;

  if (
    select status
    from public.purchase_orders
    where id = '20000000-0000-0000-0000-000000000005'
  ) <> 'borrador' then
    raise exception 'TEST 0295: motivo inválido mutó la OC';
  end if;
end;
$events$;

set local role anon;
do $anon_denied$
begin
  begin
    perform public.cancel_sales_order_with_audit_reason(
      '20000000-0000-0000-0000-000000000006',
      'Anon no puede cancelar esta orden.'
    );
    raise exception 'TEST 0295: anon ejecutó la RPC';
  exception when insufficient_privilege then
    null;
  end;
end;
$anon_denied$;
reset role;

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

set local role authenticated;
do $rollback$
begin
  begin
    perform public.cancel_sales_order_with_audit_reason(
      '20000000-0000-0000-0000-000000000006',
      'Cancelación que debe revertirse.'
    );
    raise exception 'TEST 0295: writer fallido no abortó';
  exception when others then
    if sqlerrm = 'TEST 0295: writer fallido no abortó' then raise; end if;
  end;
end;
$rollback$;
reset role;

do $rollback_assertion$
begin
  if (
    select status
    from public.sales_orders
    where id = '20000000-0000-0000-0000-000000000006'
  ) <> 'confirmada' then
    raise exception 'TEST 0295: la cancelación sobrevivió al fallo del writer';
  end if;
end;
$rollback_assertion$;

rollback;
select true as audit_d3_human_reasons_fixture_rolled_back;
