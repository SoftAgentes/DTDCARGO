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
  status text not null, deleted_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  shipment_id uuid not null, status text not null, note text,
  created_by uuid, deleted_at timestamptz,
  occurred_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.tms_trucks (
  id uuid primary key, tenant_id uuid not null, plate text not null,
  status text not null, deleted_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.tms_drivers (
  id uuid primary key, tenant_id uuid not null, name text not null,
  status text not null, deleted_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.tms_routes (
  id uuid primary key, tenant_id uuid not null, route_code text not null,
  shipment_id uuid not null, truck_id uuid, driver_id uuid,
  progress_pct integer not null default 0, status text not null,
  completed_at timestamptz, deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create function public.tms_route_status_timestamps()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completado'
     and old.status is distinct from 'completado'
     and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end $$;
create trigger tms_routes_timestamps before update on public.tms_routes
for each row execute function public.tms_route_status_timestamps();

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

\ir ../migrations/0320_tms_route_completion_governance.sql

grant select, update, delete on public.tms_routes to authenticated;
grant select on public.tms_trucks, public.tms_drivers, public.shipments,
  public.shipment_events, public.entity_audit_log to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','warehouse',null),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','support',null),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','operations',now()),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','admin',null);

insert into public.shipments values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','DTD-001','out_for_delivery',null,now()),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','DTD-002','out_for_delivery',null,now()),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','DTD-003','out_for_delivery',null,now()),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','DTD-004','out_for_delivery',null,now()),
  ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','DTD-005','arrived_destination',null,now()),
  ('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','DTD-006','out_for_delivery',null,now()),
  ('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','DTD-007','out_for_delivery',null,now());

insert into public.tms_trucks values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','T-001','en_ruta',null,now()),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','T-002','en_ruta',null,now()),
  ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','T-003','en_ruta',null,now()),
  ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','T-004','en_ruta',null,now()),
  ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','T-005','en_ruta',null,now()),
  ('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','T-006','disponible',null,now()),
  ('40000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','T-007','en_ruta',null,now());
insert into public.tms_drivers values
  ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Chofer 1','en_ruta',null,now()),
  ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Chofer 2','en_ruta',null,now()),
  ('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Chofer 3','en_ruta',null,now()),
  ('50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Chofer 4','en_ruta',null,now()),
  ('50000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Chofer 5','en_ruta',null,now()),
  ('50000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Chofer 6','en_ruta',null,now()),
  ('50000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','Chofer 7','en_ruta',null,now());

insert into public.tms_routes values
  ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','R-001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',75,'en_ruta',null,null,now()),
  ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','R-002','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002',50,'en_ruta',null,null,now()),
  ('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','R-003','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003',20,'en_ruta',null,null,now()),
  ('60000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','R-004','30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000004',0,'planificado',null,null,now()),
  ('60000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','R-005','30000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000005',90,'en_ruta',null,null,now()),
  ('60000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','R-006','30000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000006',90,'en_ruta',null,null,now()),
  ('60000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','R-007','30000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000007',95,'en_ruta',null,null,now());

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);

do $direct_guard$
begin
  begin
    update public.tms_routes set status='completado', progress_pct=100
    where id='60000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0320: UPDATE directo no fue bloqueado';
  exception when insufficient_privilege then null;
  end;
end;
$direct_guard$;

do $invalid_state$
begin
  begin
    perform public.complete_tms_route_governed(
      '60000000-0000-0000-0000-000000000004',
      'Ruta todavía planificada','tms-route-state'
    );
    raise exception 'TEST 0320: completó una ruta no iniciada';
  exception when serialization_failure then null;
  end;
  begin
    perform public.complete_tms_route_governed(
      '60000000-0000-0000-0000-000000000005',
      'Shipment fuera del estado esperado','tms-route-shipment'
    );
    raise exception 'TEST 0320: ignoró el estado del shipment';
  exception when serialization_failure then null;
  end;
  begin
    perform public.complete_tms_route_governed(
      '60000000-0000-0000-0000-000000000006',
      'Camión fuera del estado esperado','tms-route-truck'
    );
    raise exception 'TEST 0320: ignoró el estado del camión';
  exception when serialization_failure then null;
  end;
end;
$invalid_state$;

do $success_and_replay$
declare v_first text; v_replay text;
begin
  v_first := public.complete_tms_route_governed(
    '60000000-0000-0000-0000-000000000001',
    'Ruta finalizada y entrega enviada a POD','tms-route-0001'
  );
  v_replay := public.complete_tms_route_governed(
    '60000000-0000-0000-0000-000000000001',
    'Ruta finalizada y entrega enviada a POD','tms-route-0001'
  );
  if v_first <> 'transitioned' or v_replay <> 'replayed' then
    raise exception 'TEST 0320: resultado/replay inesperado %/%', v_first, v_replay;
  end if;
  if (select status from public.tms_routes where id='60000000-0000-0000-0000-000000000001') <> 'completado'
     or (select progress_pct from public.tms_routes where id='60000000-0000-0000-0000-000000000001') <> 100
     or (select completed_at from public.tms_routes where id='60000000-0000-0000-0000-000000000001') is null
     or (select status from public.tms_trucks where id='40000000-0000-0000-0000-000000000001') <> 'disponible'
     or (select status from public.tms_drivers where id='50000000-0000-0000-0000-000000000001') <> 'disponible'
     or (select status from public.shipments where id='30000000-0000-0000-0000-000000000001') <> 'last_mile'
     or (select count(*) from public.shipment_events where shipment_id='30000000-0000-0000-0000-000000000001') <> 1
     or (select count(*) from public.entity_audit_log where entity_id='60000000-0000-0000-0000-000000000001' and event_type='tms_route_completed') <> 1 then
    raise exception 'TEST 0320: ruta, recursos, shipment, timeline o AUD inválidos';
  end if;
  if not exists (
    select 1 from public.entity_audit_log
    where entity_id='60000000-0000-0000-0000-000000000001'
      and actor_id='20000000-0000-0000-0000-000000000001'
      and reason='Ruta finalizada y entrega enviada a POD'
      and payload->>'request_ref'='tms-route-0001'
      and payload->>'shipment_id'='30000000-0000-0000-0000-000000000001'
  ) or not exists (
    select 1 from public.shipment_events
    where shipment_id='30000000-0000-0000-0000-000000000001'
      and created_by='20000000-0000-0000-0000-000000000001'
      and note like '%R-001%POD%'
  ) then raise exception 'TEST 0320: evidencia incompleta'; end if;
end;
$success_and_replay$;

do $sealed_hito$
begin
  begin
    update public.tms_routes set status='en_ruta'
    where id='60000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0320: revirtió una ruta completada';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.tms_routes set shipment_id='30000000-0000-0000-0000-000000000002'
    where id='60000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0320: alteró el vínculo de una ruta completada';
  exception when insufficient_privilege then null;
  end;
end;
$sealed_hito$;

do $request_reuse$
begin
  begin
    perform public.complete_tms_route_governed(
      '60000000-0000-0000-0000-000000000002',
      'Segunda ruta finalizada','tms-route-0001'
    );
    raise exception 'TEST 0320: reutilizó referencia en otra ruta';
  exception when serialization_failure then null;
  end;
end;
$request_reuse$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
do $wrong_role$
begin
  begin
    perform public.complete_tms_route_governed(
      '60000000-0000-0000-0000-000000000002','Soporte intentó cerrar','tms-route-role'
    );
    raise exception 'TEST 0320: Soporte completó la ruta';
  exception when no_data_found then null;
  end;
end;
$wrong_role$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
do $disabled$
begin
  begin
    perform public.complete_tms_route_governed(
      '60000000-0000-0000-0000-000000000002','Membresía deshabilitada','tms-route-disabled'
    );
    raise exception 'TEST 0320: membresía deshabilitada completó la ruta';
  exception when no_data_found then null;
  end;
end;
$disabled$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
do $other_tenant$
begin
  begin
    perform public.complete_tms_route_governed(
      '60000000-0000-0000-0000-000000000002','Otro tenant intentó cerrar','tms-route-tenant'
    );
    raise exception 'TEST 0320: cruzó el tenant';
  exception when no_data_found then null;
  end;
end;
$other_tenant$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $audit_atomicity$
begin
  begin
    perform public.complete_tms_route_governed(
      '60000000-0000-0000-0000-000000000007','force audit failure','tms-route-audit-fail'
    );
    raise exception 'TEST 0320: ignoró la falla de auditoría';
  exception when raise_exception then null;
  end;
  if (select status from public.tms_routes where id='60000000-0000-0000-0000-000000000007') <> 'en_ruta'
     or (select status from public.tms_trucks where id='40000000-0000-0000-0000-000000000007') <> 'en_ruta'
     or (select status from public.tms_drivers where id='50000000-0000-0000-0000-000000000007') <> 'en_ruta'
     or (select status from public.shipments where id='30000000-0000-0000-0000-000000000007') <> 'out_for_delivery'
     or exists (select 1 from public.shipment_events where shipment_id='30000000-0000-0000-0000-000000000007') then
    raise exception 'TEST 0320: la falla AUD dejó mutación parcial';
  end if;
end;
$audit_atomicity$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $warehouse_success$
begin
  if public.complete_tms_route_governed(
    '60000000-0000-0000-0000-000000000002','Almacén confirmó el cierre','tms-route-warehouse'
  ) <> 'transitioned' then
    raise exception 'TEST 0320: Almacén no pudo completar la ruta';
  end if;
end;
$warehouse_success$;

reset role;
do $privileges$
begin
  if has_function_privilege('anon','public.complete_tms_route_governed(uuid,text,text)','execute')
     or has_function_privilege('service_role','public.complete_tms_route_governed(uuid,text,text)','execute')
     or not has_function_privilege('authenticated','public.complete_tms_route_governed(uuid,text,text)','execute') then
    raise exception 'TEST 0320: grants del RPC inválidos';
  end if;
end;
$privileges$;

rollback;
\echo 'TEST 0320 OK: cierre de ruta TMS gobernado'
