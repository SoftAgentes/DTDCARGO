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
create table public.inspection_reports (
  id uuid primary key, tenant_id uuid not null, report_no text not null,
  type text not null, client_id uuid, client_name text, title text not null,
  product text, inspection_date date, duration_mandays numeric, score integer,
  conclusion text, status text not null, payload jsonb not null default '{}',
  provider_internal text, created_by uuid, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.inspection_report_photos (
  id uuid primary key, tenant_id uuid not null, report_id uuid not null,
  category text, caption text, storage_path text not null, redacted boolean not null default false,
  sort integer not null default 0, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz
);

grant select, update, delete on public.inspection_reports to authenticated;
grant select, update, delete on public.inspection_report_photos to authenticated;

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

\ir ../migrations/0323_inspection_report_retirement_governance.sql

grant select on public.entity_audit_log to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','commercial',null),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','accounting',null),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','admin',now()),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','admin',null);
insert into public.inspection_reports (
  id, tenant_id, report_no, type, title, status
) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','DTD-QC-0001','product_psi','PSI principal','draft'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','DTD-FA-0002','factory_audit','Auditoría final','final'),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000002','DTD-QC-0003','product_psi','Otro tenant','draft'),
  ('30000000-0000-4000-8000-000000000004','10000000-0000-0000-0000-000000000001','DTD-QC-0004','product_psi','Rollback AUD','draft');
insert into public.inspection_report_photos (
  id, tenant_id, report_id, storage_path
) values
  ('40000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-4000-8000-000000000001','1000/inspection/1/a.jpg'),
  ('40000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-4000-8000-000000000001','1000/inspection/1/b.jpg'),
  ('40000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-4000-8000-000000000004','1000/inspection/4/a.jpg');

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);

do $direct_guards$
begin
  begin
    update public.inspection_reports set deleted_at=now()
    where id='30000000-0000-4000-8000-000000000001';
    raise exception 'TEST 0323: soft-delete directo no fue bloqueado';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.inspection_reports
    where id='30000000-0000-4000-8000-000000000001';
    raise exception 'TEST 0323: hard-delete de reporte no fue bloqueado';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.inspection_report_photos
    where id='40000000-0000-4000-8000-000000000001';
    raise exception 'TEST 0323: hard-delete de foto no fue bloqueado';
  exception when insufficient_privilege then null;
  end;
end;
$direct_guards$;

do $success_and_replay$
declare v_first jsonb; v_replay jsonb;
begin
  v_first := public.retire_inspection_report_governed(
    '30000000-0000-4000-8000-000000000001','draft',
    'Reporte duplicado confirmado','inspection-retire-0001'
  );
  v_replay := public.retire_inspection_report_governed(
    '30000000-0000-4000-8000-000000000001','draft',
    'Reporte duplicado confirmado','inspection-retire-0001'
  );
  if v_first->>'outcome' <> 'transitioned'
     or v_replay->>'outcome' <> 'replayed'
     or v_first->>'report_no' <> 'DTD-QC-0001'
     or (v_first->>'photo_count')::integer <> 2
     or v_first->>'storage_disposition' <> 'retained_private_objects' then
    raise exception 'TEST 0323: resultado/replay inesperado %/%', v_first, v_replay;
  end if;
  if (select deleted_at from public.inspection_reports where id='30000000-0000-4000-8000-000000000001') is null
     or (select count(*) from public.inspection_report_photos where report_id='30000000-0000-4000-8000-000000000001' and deleted_at is not null) <> 2 then
    raise exception 'TEST 0323: reporte o metadata de fotos no fueron retirados';
  end if;
  if not exists (
    select 1 from public.entity_audit_log
    where entity_id='30000000-0000-4000-8000-000000000001'
      and event_type='inspection_report_retired'
      and actor_id='20000000-0000-0000-0000-000000000001'
      and reason='Reporte duplicado confirmado'
      and payload->>'request_ref'='inspection-retire-0001'
      and payload->>'photo_count'='2'
      and payload->>'photo_metadata_retired'='true'
      and payload->>'storage_disposition'='retained_private_objects'
      and payload->>'physical_objects_deleted'='false'
  ) or (select count(*) from public.entity_audit_log where event_type='inspection_report_retired') <> 1 then
    raise exception 'TEST 0323: evidencia AUD-01 o retención deshonesta';
  end if;
end;
$success_and_replay$;

do $immutable_and_reuse$
begin
  begin
    update public.inspection_reports set deleted_at=null
    where id='30000000-0000-4000-8000-000000000001';
    raise exception 'TEST 0323: restauró reporte retirado';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.retire_inspection_report_governed(
      '30000000-0000-4000-8000-000000000002','final',
      'Otro reporte retirado','inspection-retire-0001'
    );
    raise exception 'TEST 0323: reutilizó request ref';
  exception when serialization_failure then null;
  end;
  begin
    perform public.retire_inspection_report_governed(
      '30000000-0000-4000-8000-000000000002','draft',
      'Estado esperado desactualizado','inspection-retire-state'
    );
    raise exception 'TEST 0323: retiró con estado desactualizado';
  exception when serialization_failure then null;
  end;
end;
$immutable_and_reuse$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
do $wrong_role$
begin
  begin
    perform public.retire_inspection_report_governed(
      '30000000-0000-4000-8000-000000000002','final',
      'Contabilidad intentó retirar','inspection-retire-role'
    );
    raise exception 'TEST 0323: accounting retiró reporte';
  exception when no_data_found then null;
  end;
end;
$wrong_role$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
do $disabled$
begin
  begin
    perform public.retire_inspection_report_governed(
      '30000000-0000-4000-8000-000000000002','final',
      'Admin deshabilitado intentó retirar','inspection-retire-disabled'
    );
    raise exception 'TEST 0323: membresía deshabilitada retiró';
  exception when no_data_found then null;
  end;
end;
$disabled$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
do $other_tenant$
begin
  begin
    perform public.retire_inspection_report_governed(
      '30000000-0000-4000-8000-000000000002','final',
      'Otro tenant intentó retirar','inspection-retire-tenant'
    );
    raise exception 'TEST 0323: otro tenant retiró';
  exception when no_data_found then null;
  end;
end;
$other_tenant$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $commercial_and_audit_rollback$
declare v_result jsonb;
begin
  v_result := public.retire_inspection_report_governed(
    '30000000-0000-4000-8000-000000000002','final',
    'Comercial confirmó retiro final','inspection-retire-commercial'
  );
  if v_result->>'outcome' <> 'transitioned' then
    raise exception 'TEST 0323: commercial no pudo retirar';
  end if;
  begin
    perform public.retire_inspection_report_governed(
      '30000000-0000-4000-8000-000000000004','draft',
      'force audit failure','inspection-retire-audit-fail'
    );
    raise exception 'TEST 0323: fallo AUD no abortó';
  exception when raise_exception then null;
  end;
  if (select deleted_at from public.inspection_reports where id='30000000-0000-4000-8000-000000000004') is not null
     or (select deleted_at from public.inspection_report_photos where id='40000000-0000-4000-8000-000000000003') is not null then
    raise exception 'TEST 0323: fallo AUD dejó retiro parcial';
  end if;
end;
$commercial_and_audit_rollback$;

reset role;

do $grants$
begin
  if has_function_privilege('anon','public.retire_inspection_report_governed(uuid,text,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.retire_inspection_report_governed(uuid,text,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.retire_inspection_report_governed(uuid,text,text,text)','EXECUTE')
     or has_table_privilege('authenticated','public.inspection_reports','DELETE')
     or has_table_privilege('authenticated','public.inspection_report_photos','DELETE') then
    raise exception 'TEST 0323: grants del retiro inválidos';
  end if;
end;
$grants$;

rollback;
