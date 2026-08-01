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

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create table public.audit_entity_types (
  entity_type text primary key, status text not null, domain_code text not null,
  contract_version integer not null, introduced_by_ref text
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, source text not null,
  result text not null, reason text, before_data jsonb, after_data jsonb,
  payload jsonb not null default '{}', correlation_id text,
  schema_version integer not null, sensitivity text not null
);
create table public.supplier_claim_offsets (
  id uuid primary key, tenant_id uuid not null, supplier_id uuid,
  shipment_id uuid, client_id uuid, amount_usd numeric not null,
  claimed_on date not null, recognized_on date, received_in_china_on date,
  applied_to_client_on date, evidence_document_id uuid,
  status text not null, client_invoice_id uuid, journal_entry_id uuid,
  deleted_at timestamptz
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

\ir ../migrations/0317_partner_claim_payment_governance.sql

grant select, update on public.supplier_claim_offsets to authenticated;
grant select on public.entity_audit_log to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','admin',null),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','accounting',null),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','admin',null),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','admin',now());
insert into public.supplier_claim_offsets (
  id, tenant_id, supplier_id, amount_usd, claimed_on, recognized_on, status
) values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',500,'2026-07-20','2026-07-25','reconocido_proveedor'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',700,'2026-07-20','2026-07-25','reconocido_proveedor'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002',900,'2026-07-20','2026-07-25','reconocido_proveedor');

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);

do $direct_guard$
begin
  begin
    update public.supplier_claim_offsets
    set status = 'pagado_en_china', received_in_china_on = '2026-07-31'
    where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0317: UPDATE directo no fue bloqueado';
  exception when insufficient_privilege then null;
  end;
end;
$direct_guard$;

do $success_and_replay$
declare v_first text; v_replay text;
begin
  v_first := public.mark_claim_offset_paid_in_china_governed(
    '30000000-0000-0000-0000-000000000001','2026-07-31',
    'Comprobante confirmado con el socio','partner-payment-0001'
  );
  v_replay := public.mark_claim_offset_paid_in_china_governed(
    '30000000-0000-0000-0000-000000000001','2026-07-31',
    'Comprobante confirmado con el socio','partner-payment-0001'
  );
  if v_first <> 'transitioned' or v_replay <> 'replayed' then
    raise exception 'TEST 0317: resultado/replay inesperado %/%', v_first, v_replay;
  end if;
  if (select status from public.supplier_claim_offsets where id='30000000-0000-0000-0000-000000000001') <> 'pagado_en_china'
     or (select received_in_china_on from public.supplier_claim_offsets where id='30000000-0000-0000-0000-000000000001') <> '2026-07-31'
     or (select count(*) from public.entity_audit_log where event_type='partner_claim_paid_in_china') <> 1 then
    raise exception 'TEST 0317: estado, fecha o auditoría inválidos';
  end if;
  if not exists (
    select 1 from public.entity_audit_log
    where entity_id='30000000-0000-0000-0000-000000000001'
      and actor_id='20000000-0000-0000-0000-000000000001'
      and reason='Comprobante confirmado con el socio'
      and payload->>'request_ref'='partner-payment-0001'
      and payload->>'amount_usd'='500'
  ) then raise exception 'TEST 0317: evidencia incompleta'; end if;
end;
$success_and_replay$;

do $ref_reuse$
begin
  begin
    perform public.mark_claim_offset_paid_in_china_governed(
      '30000000-0000-0000-0000-000000000002','2026-07-31',
      'Otro comprobante','partner-payment-0001'
    );
    raise exception 'TEST 0317: request_ref reutilizada';
  exception when serialization_failure then null;
  end;
end;
$ref_reuse$;

do $state_conflict$
begin
  begin
    perform public.mark_claim_offset_paid_in_china_governed(
      '30000000-0000-0000-0000-000000000001','2026-07-31',
      'Comprobante nuevo','partner-payment-state-conflict'
    );
    raise exception 'TEST 0317: estado stale reportó éxito';
  exception when serialization_failure then null;
  end;
end;
$state_conflict$;

do $date_invalid$
begin
  begin
    perform public.mark_claim_offset_paid_in_china_governed(
      '30000000-0000-0000-0000-000000000002','2026-07-24',
      'Soporte válido','partner-payment-date-invalid'
    );
    raise exception 'TEST 0317: fecha anterior al reconocimiento fue aceptada';
  exception when invalid_parameter_value then null;
  end;
end;
$date_invalid$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $role_denied$
begin
  begin
    perform public.mark_claim_offset_paid_in_china_governed(
      '30000000-0000-0000-0000-000000000002','2026-07-31','Soporte válido','partner-payment-0002'
    );
    raise exception 'TEST 0317: accounting mutó el pago';
  exception when insufficient_privilege then null;
  end;
end;
$role_denied$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
do $disabled_denied$
begin
  begin
    perform public.mark_claim_offset_paid_in_china_governed(
      '30000000-0000-0000-0000-000000000002','2026-07-31','Soporte válido','partner-payment-disabled'
    );
    raise exception 'TEST 0317: membresía deshabilitada mutó el pago';
  exception when insufficient_privilege then null;
  end;
end;
$disabled_denied$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $tenant_denied$
begin
  begin
    perform public.mark_claim_offset_paid_in_china_governed(
      '30000000-0000-0000-0000-000000000003','2026-07-31','Soporte válido','partner-payment-0003'
    );
    raise exception 'TEST 0317: cruce de otro tenant fue visible';
  exception when no_data_found then null;
  end;
end;
$tenant_denied$;

rollback;
