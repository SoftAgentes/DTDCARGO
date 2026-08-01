\set ON_ERROR_STOP on

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create type public.customs_status as enum (
  'en_revision', 'observacion', 'liberacion', 'pagado', 'liberado'
);
create type public.customs_doc_type as enum (
  'commercial', 'packing', 'bl', 'cert_origin', 'sanitary', 'dua', 'payment'
);
create type public.shipment_status as enum (
  'draft', 'in_warehouse', 'consolidating', 'shipped', 'in_transit',
  'in_customs', 'arrived_destination', 'delayed_warehouse',
  'out_for_delivery', 'last_mile', 'delivered', 'exception', 'cancelled'
);

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create table public.audit_entity_types (
  entity_type text primary key, status text not null, domain_code text not null,
  contract_version integer not null, introduced_by_ref text not null
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, source text not null,
  result text not null, reason text, before_data jsonb, after_data jsonb,
  payload jsonb not null default '{}', correlation_id text,
  schema_version integer not null, sensitivity text not null
);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null, code text not null,
  status public.shipment_status not null, arrived_destination_at timestamptz,
  deleted_at timestamptz, updated_at timestamptz not null default now()
);
create table public.customs_filings (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid not null,
  dua_code text not null, status public.customs_status not null,
  arrived_at date not null, cleared_at date, alert text, deleted_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.customs_documents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  filing_id uuid not null, doc_type public.customs_doc_type not null,
  uploaded boolean not null default false,
  unique (filing_id, doc_type)
);
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  shipment_id uuid not null, status public.shipment_status not null,
  note text, occurred_at timestamptz not null default now(), created_by uuid,
  deleted_at timestamptz, created_at timestamptz not null default now()
);

create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text,
  p_actor_id uuid, p_event_type text, p_source text,
  p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null,
  p_schema_version integer default 1, p_sensitivity text default 'internal'
) returns uuid language plpgsql security definer set search_path = '' as $$
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

\ir ../migrations/0318_customs_clearance_governance.sql

grant select, update on public.customs_filings to authenticated;
grant select, update on public.customs_documents to authenticated;
grant select, update on public.shipments to authenticated;
grant select on public.shipment_events, public.entity_audit_log to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','accounting',null),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','support',null),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','admin',now()),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','admin',null);

insert into public.shipments (id, tenant_id, code, status) values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','DTD-001','in_customs'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','DTD-002','in_customs'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','DTD-003','in_customs'),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','DTD-004','in_customs'),
  ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','DTD-005','delivered');
insert into public.customs_filings (
  id, tenant_id, shipment_id, dua_code, status, arrived_at
) values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','DUA-001','pagado','2026-07-20'),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','DUA-002','pagado','2026-07-20'),
  ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','DUA-003','pagado','2026-07-20'),
  ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','DUA-004','liberacion','2026-07-20'),
  ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005','DUA-005','pagado','2026-07-20');

insert into public.customs_documents (tenant_id, filing_id, doc_type, uploaded)
select f.tenant_id, f.id, t.doc_type,
  not (f.id = '40000000-0000-0000-0000-000000000001' and t.doc_type = 'payment')
from public.customs_filings f
cross join (values
  ('commercial'::public.customs_doc_type),
  ('packing'::public.customs_doc_type),
  ('bl'::public.customs_doc_type),
  ('cert_origin'::public.customs_doc_type),
  ('dua'::public.customs_doc_type),
  ('payment'::public.customs_doc_type)
) as t(doc_type);

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);

do $direct_guard$
begin
  begin
    update public.customs_filings
    set status = 'liberado', cleared_at = '2026-07-31'
    where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0318: UPDATE directo no fue bloqueado';
  exception when insufficient_privilege then null;
  end;
end;
$direct_guard$;

do $missing_document$
begin
  begin
    perform public.clear_customs_filing_governed(
      '40000000-0000-0000-0000-000000000001','2026-07-31',
      'DUA y pago confirmados','customs-clearance-missing'
    );
    raise exception 'TEST 0318: liberó con documento faltante';
  exception when invalid_parameter_value then null;
  end;
  if (select status from public.customs_filings where id='40000000-0000-0000-0000-000000000001') <> 'pagado'
     or (select status from public.shipments where id='30000000-0000-0000-0000-000000000001') <> 'in_customs'
     or exists (select 1 from public.shipment_events where shipment_id='30000000-0000-0000-0000-000000000001') then
    raise exception 'TEST 0318: la falla documental dejó mutación parcial';
  end if;
end;
$missing_document$;

update public.customs_documents
set uploaded = true
where filing_id = '40000000-0000-0000-0000-000000000001'
  and doc_type = 'payment';

do $success_and_replay$
declare v_first text; v_replay text;
begin
  v_first := public.clear_customs_filing_governed(
    '40000000-0000-0000-0000-000000000001','2026-07-31',
    'DUA y pago confirmados','customs-clearance-0001'
  );
  v_replay := public.clear_customs_filing_governed(
    '40000000-0000-0000-0000-000000000001','2026-07-31',
    'DUA y pago confirmados','customs-clearance-0001'
  );
  if v_first <> 'transitioned' or v_replay <> 'replayed' then
    raise exception 'TEST 0318: resultado/replay inesperado %/%', v_first, v_replay;
  end if;
  if (select status from public.customs_filings where id='40000000-0000-0000-0000-000000000001') <> 'liberado'
     or (select cleared_at from public.customs_filings where id='40000000-0000-0000-0000-000000000001') <> '2026-07-31'
     or (select status from public.shipments where id='30000000-0000-0000-0000-000000000001') <> 'arrived_destination'
     or (select count(*) from public.shipment_events where shipment_id='30000000-0000-0000-0000-000000000001') <> 1
     or (select count(*) from public.entity_audit_log where event_type='customs_filing_cleared') <> 1 then
    raise exception 'TEST 0318: estado, shipment, evento o auditoría inválidos';
  end if;
  if not exists (
    select 1 from public.entity_audit_log
    where entity_id='40000000-0000-0000-0000-000000000001'
      and actor_id='20000000-0000-0000-0000-000000000001'
      and reason='DUA y pago confirmados'
      and payload->>'request_ref'='customs-clearance-0001'
      and payload->>'shipment_id'='30000000-0000-0000-0000-000000000001'
      and payload->>'required_documents'='6'
  ) or not exists (
    select 1 from public.shipment_events
    where shipment_id='30000000-0000-0000-0000-000000000001'
      and created_by='20000000-0000-0000-0000-000000000001'
      and note like '%DUA-001%'
  ) then raise exception 'TEST 0318: evidencia incompleta'; end if;
end;
$success_and_replay$;

do $context_not_reusable$
begin
  begin
    update public.customs_filings
    set status = 'liberado', cleared_at = '2026-07-31'
    where id = '40000000-0000-0000-0000-000000000002';
    raise exception 'TEST 0318: contexto del RPC se reutilizó en otro filing';
  exception when insufficient_privilege then null;
  end;
end;
$context_not_reusable$;

do $terminal_milestone$
begin
  begin
    update public.customs_filings
    set status = 'pagado'
    where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0318: el filing pudo salir de liberado';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.customs_filings
    set cleared_at = '2026-07-30'
    where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0318: cleared_at pudo reescribirse';
  exception when insufficient_privilege then null;
  end;
end;
$terminal_milestone$;

do $ref_reuse$
begin
  begin
    perform public.clear_customs_filing_governed(
      '40000000-0000-0000-0000-000000000002','2026-07-31',
      'Otra liberación confirmada','customs-clearance-0001'
    );
    raise exception 'TEST 0318: request_ref reutilizada';
  exception when serialization_failure then null;
  end;
end;
$ref_reuse$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $accounting_allowed$
begin
  if public.clear_customs_filing_governed(
    '40000000-0000-0000-0000-000000000002','2026-07-31',
    'Liberación validada por contabilidad','customs-clearance-0002'
  ) <> 'transitioned' then
    raise exception 'TEST 0318: accounting no pudo liberar';
  end if;
end;
$accounting_allowed$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
do $role_denied$
begin
  begin
    perform public.clear_customs_filing_governed(
      '40000000-0000-0000-0000-000000000004','2026-07-31',
      'Soporte válido','customs-clearance-support'
    );
    raise exception 'TEST 0318: support mutó la liberación';
  exception when insufficient_privilege then null;
  end;
end;
$role_denied$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
do $disabled_denied$
begin
  begin
    perform public.clear_customs_filing_governed(
      '40000000-0000-0000-0000-000000000004','2026-07-31',
      'Soporte válido','customs-clearance-disabled'
    );
    raise exception 'TEST 0318: membresía deshabilitada mutó la liberación';
  exception when insufficient_privilege then null;
  end;
end;
$disabled_denied$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $tenant_denied$
begin
  begin
    perform public.clear_customs_filing_governed(
      '40000000-0000-0000-0000-000000000003','2026-07-31',
      'Soporte válido','customs-clearance-tenant'
    );
    raise exception 'TEST 0318: trámite de otro tenant fue visible';
  exception when no_data_found then null;
  end;
end;
$tenant_denied$;

do $state_conflict$
begin
  begin
    perform public.clear_customs_filing_governed(
      '40000000-0000-0000-0000-000000000004','2026-07-31',
      'Soporte válido','customs-clearance-state'
    );
    raise exception 'TEST 0318: estado stale reportó éxito';
  exception when serialization_failure then null;
  end;
end;
$state_conflict$;

do $shipment_conflict$
begin
  begin
    perform public.clear_customs_filing_governed(
      '40000000-0000-0000-0000-000000000005','2026-07-31',
      'Soporte válido','customs-clearance-shipment'
    );
    raise exception 'TEST 0318: shipment incompatible reportó éxito';
  exception when serialization_failure then null;
  end;
end;
$shipment_conflict$;

rollback;
