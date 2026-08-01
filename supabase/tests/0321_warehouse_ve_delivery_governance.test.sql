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
  status text not null, delivery_address text, delivered_at timestamptz,
  pod_signed_by text, deleted_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  shipment_id uuid not null, status text not null, note text,
  created_by uuid, deleted_at timestamptz,
  occurred_at timestamptz not null default now(), created_at timestamptz not null default now()
);

create function public.set_delivered_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'delivered'
     and old.status is distinct from 'delivered'
     and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  return new;
end $$;
create trigger shipments_delivered_at before update on public.shipments
for each row execute function public.set_delivered_at();

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
  if p_reason = 'force audit failure' then
    raise exception 'forced audit failure' using errcode = 'P0001';
  end if;
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

\ir ../migrations/0321_warehouse_ve_delivery_governance.sql

grant select, update, delete on public.shipments to authenticated;
grant select on public.shipment_events, public.entity_audit_log to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','support',null),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','accounting',null),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','warehouse',now()),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','admin',null);
insert into public.shipments values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','DTD-001','last_mile','Valencia',null,null,null,now()),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','DTD-002','out_for_delivery','Caracas',null,null,null,now()),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','DTD-003','last_mile','Maracay',null,null,null,now()),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','DTD-004','arrived_destination','Valencia',null,null,null,now()),
  ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','DTD-005','last_mile','Barquisimeto',null,null,null,now());

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);

do $direct_guard$
begin
  begin
    update public.shipments set status='delivered', pod_signed_by='Ana Pérez'
    where id='30000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0321: UPDATE directo no fue bloqueado';
  exception when insufficient_privilege then null;
  end;
end;
$direct_guard$;

do $invalid_state$
begin
  begin
    perform public.complete_ve_delivery_governed(
      '30000000-0000-0000-0000-000000000004','Ana Pérez',
      'Entrega todavía no despachada','ve-delivery-state'
    );
    raise exception 'TEST 0321: confirmó desde estado inválido';
  exception when serialization_failure then null;
  end;
  begin
    perform public.complete_ve_delivery_governed(
      '30000000-0000-0000-0000-000000000001','x',
      'Receptor inválido','ve-delivery-receiver'
    );
    raise exception 'TEST 0321: aceptó receptor inválido';
  exception when invalid_parameter_value then null;
  end;
end;
$invalid_state$;

do $success_and_replay$
declare v_first text; v_replay text;
begin
  v_first := public.complete_ve_delivery_governed(
    '30000000-0000-0000-0000-000000000001','Ana Pérez',
    'Entrega verificada por Operaciones','ve-delivery-0001'
  );
  v_replay := public.complete_ve_delivery_governed(
    '30000000-0000-0000-0000-000000000001','Ana Pérez',
    'Entrega verificada por Operaciones','ve-delivery-0001'
  );
  if v_first <> 'transitioned' or v_replay <> 'replayed' then
    raise exception 'TEST 0321: resultado/replay inesperado %/%', v_first, v_replay;
  end if;
  if (select status from public.shipments where id='30000000-0000-0000-0000-000000000001') <> 'delivered'
     or (select delivered_at from public.shipments where id='30000000-0000-0000-0000-000000000001') is null
     or (select pod_signed_by from public.shipments where id='30000000-0000-0000-0000-000000000001') <> 'Ana Pérez'
     or (select count(*) from public.shipment_events where shipment_id='30000000-0000-0000-0000-000000000001') <> 1
     or (select count(*) from public.entity_audit_log where entity_id='30000000-0000-0000-0000-000000000001' and event_type='shipment_delivery_manually_confirmed') <> 1 then
    raise exception 'TEST 0321: shipment, timeline o auditoría inválidos';
  end if;
  if not exists (
    select 1 from public.entity_audit_log
    where entity_id='30000000-0000-0000-0000-000000000001'
      and actor_id='20000000-0000-0000-0000-000000000001'
      and reason='Entrega verificada por Operaciones'
      and payload->>'request_ref'='ve-delivery-0001'
      and payload->>'received_by'='Ana Pérez'
      and payload->>'attestation_kind'='manual'
      and payload->>'sealed_dispatch_pod'='false'
  ) or not exists (
    select 1 from public.shipment_events
    where shipment_id='30000000-0000-0000-0000-000000000001'
      and created_by='20000000-0000-0000-0000-000000000001'
      and note like '%Ana Pérez%'
  ) then raise exception 'TEST 0321: evidencia manual incompleta o deshonesta'; end if;
end;
$success_and_replay$;

do $sealed_hito$
begin
  begin
    update public.shipments set status='last_mile'
    where id='30000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0321: revirtió la entrega';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.shipments set pod_signed_by='Otro receptor'
    where id='30000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0321: alteró el receptor';
  exception when insufficient_privilege then null;
  end;
end;
$sealed_hito$;

do $request_reuse$
begin
  begin
    perform public.complete_ve_delivery_governed(
      '30000000-0000-0000-0000-000000000002','Luis Gómez',
      'Segunda entrega verificada','ve-delivery-0001'
    );
    raise exception 'TEST 0321: reutilizó referencia en otro shipment';
  exception when serialization_failure then null;
  end;
end;
$request_reuse$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
do $wrong_role$
begin
  begin
    perform public.complete_ve_delivery_governed(
      '30000000-0000-0000-0000-000000000002','Luis Gómez',
      'Contabilidad intentó confirmar','ve-delivery-role'
    );
    raise exception 'TEST 0321: rol fuera de VE confirmó entrega';
  exception when no_data_found then null;
  end;
end;
$wrong_role$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
do $disabled$
begin
  begin
    perform public.complete_ve_delivery_governed(
      '30000000-0000-0000-0000-000000000002','Luis Gómez',
      'Membresía deshabilitada','ve-delivery-disabled'
    );
    raise exception 'TEST 0321: membresía deshabilitada confirmó entrega';
  exception when no_data_found then null;
  end;
end;
$disabled$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
do $other_tenant$
begin
  begin
    perform public.complete_ve_delivery_governed(
      '30000000-0000-0000-0000-000000000002','Luis Gómez',
      'Otro tenant intentó confirmar','ve-delivery-tenant'
    );
    raise exception 'TEST 0321: cruzó el tenant';
  exception when no_data_found then null;
  end;
end;
$other_tenant$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $audit_atomicity$
begin
  begin
    perform public.complete_ve_delivery_governed(
      '30000000-0000-0000-0000-000000000005','Marta León',
      'force audit failure','ve-delivery-audit-fail'
    );
    raise exception 'TEST 0321: ignoró la falla de auditoría';
  exception when raise_exception then null;
  end;
  if (select status from public.shipments where id='30000000-0000-0000-0000-000000000005') <> 'last_mile'
     or (select delivered_at from public.shipments where id='30000000-0000-0000-0000-000000000005') is not null
     or exists (select 1 from public.shipment_events where shipment_id='30000000-0000-0000-0000-000000000005') then
    raise exception 'TEST 0321: la falla AUD dejó mutación parcial';
  end if;
end;
$audit_atomicity$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $support_success$
begin
  if public.complete_ve_delivery_governed(
    '30000000-0000-0000-0000-000000000002','Luis Gómez',
    'Soporte verificó la entrega','ve-delivery-support'
  ) <> 'transitioned' then
    raise exception 'TEST 0321: Support no pudo completar el fallback permitido';
  end if;
end;
$support_success$;

reset role;
do $privileges$
begin
  if has_function_privilege('anon','public.complete_ve_delivery_governed(uuid,text,text,text)','execute')
     or has_function_privilege('service_role','public.complete_ve_delivery_governed(uuid,text,text,text)','execute')
     or not has_function_privilege('authenticated','public.complete_ve_delivery_governed(uuid,text,text,text)','execute') then
    raise exception 'TEST 0321: grants del RPC inválidos';
  end if;
end;
$privileges$;

rollback;
\echo 'TEST 0321 OK: entrega manual VE gobernada'
