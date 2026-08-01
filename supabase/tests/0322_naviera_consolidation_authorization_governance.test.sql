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
create table public.consolidations (
  id uuid primary key, tenant_id uuid not null, ref text,
  booking_id uuid, sailing_id uuid, container_type text, container_no text,
  status text not null, notes text, requested_by_operario_id uuid,
  requested_at timestamptz, authorized_by uuid, authorized_at timestamptz,
  rejected_reason text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (tenant_id, ref)
);

create function public.next_consolidation_ref(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_max integer;
begin
  select coalesce(max((regexp_match(ref, '^DTD-CONSOL-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.consolidations
  where tenant_id = p_tenant_id;
  return 'DTD-CONSOL-' || lpad(v_max::text, 4, '0');
end $$;

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

\ir ../migrations/0322_naviera_consolidation_authorization_governance.sql

grant select, update on public.consolidations to authenticated;
grant select on public.entity_audit_log to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','accounting',null),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','warehouse',null),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','admin',now()),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','admin',null);
insert into public.consolidations (
  id, tenant_id, ref, container_type, status, requested_by_operario_id, requested_at
) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001',null,'40HC','solicitada','40000000-0000-4000-8000-000000000001',now()),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001',null,'20GP','solicitada','40000000-0000-4000-8000-000000000002',now()),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000002',null,'40HC','solicitada','40000000-0000-4000-8000-000000000003',now()),
  ('30000000-0000-4000-8000-000000000004','10000000-0000-0000-0000-000000000001','DTD-CONSOL-0009','40HC','consolidando','40000000-0000-4000-8000-000000000004',now()),
  ('30000000-0000-4000-8000-000000000005','10000000-0000-0000-0000-000000000001',null,'20GP','solicitada','40000000-0000-4000-8000-000000000005',now());

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);

do $direct_guard$
begin
  begin
    update public.consolidations
    set ref='DTD-CONSOL-0010', status='consolidando',
        authorized_by='20000000-0000-0000-0000-000000000001',
        authorized_at=now()
    where id='30000000-0000-4000-8000-000000000001';
    raise exception 'TEST 0322: UPDATE directo no fue bloqueado';
  exception when insufficient_privilege then null;
  end;
end;
$direct_guard$;

do $success_and_replay$
declare v_first jsonb; v_replay jsonb;
begin
  v_first := public.authorize_consolidation_governed(
    '30000000-0000-4000-8000-000000000001',
    'Capacidad y operación verificadas',
    'naviera-auth-0001'
  );
  v_replay := public.authorize_consolidation_governed(
    '30000000-0000-4000-8000-000000000001',
    'Capacidad y operación verificadas',
    'naviera-auth-0001'
  );
  if v_first->>'outcome' <> 'transitioned'
     or v_replay->>'outcome' <> 'replayed'
     or v_first->>'ref' is distinct from v_replay->>'ref' then
    raise exception 'TEST 0322: resultado/replay inesperado %/%', v_first, v_replay;
  end if;
  if not exists (
    select 1 from public.consolidations
    where id='30000000-0000-4000-8000-000000000001'
      and status='consolidando'
      and ref=v_first->>'ref'
      and authorized_by='20000000-0000-0000-0000-000000000001'
      and authorized_at is not null
  ) then raise exception 'TEST 0322: autorización no persistió completa'; end if;
  if not exists (
    select 1 from public.entity_audit_log
    where entity_id='30000000-0000-4000-8000-000000000001'
      and event_type='consolidation_authorized'
      and actor_id='20000000-0000-0000-0000-000000000001'
      and reason='Capacidad y operación verificadas'
      and payload->>'request_ref'='naviera-auth-0001'
      and payload->>'consolidation_ref'=v_first->>'ref'
      and payload->>'from'='solicitada'
      and payload->>'to'='consolidando'
  ) or (select count(*) from public.entity_audit_log where event_type='consolidation_authorized') <> 1 then
    raise exception 'TEST 0322: evidencia AUD-01 inválida';
  end if;
end;
$success_and_replay$;

do $immutable_evidence$
begin
  begin
    update public.consolidations set ref='DTD-CONSOL-9999'
    where id='30000000-0000-4000-8000-000000000001';
    raise exception 'TEST 0322: cambió correlativo autorizado';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.consolidations set authorized_by=null
    where id='30000000-0000-4000-8000-000000000001';
    raise exception 'TEST 0322: borró actor autorizado';
  exception when insufficient_privilege then null;
  end;
end;
$immutable_evidence$;

do $request_reuse_and_state$
begin
  begin
    perform public.authorize_consolidation_governed(
      '30000000-0000-4000-8000-000000000002',
      'Segunda solicitud verificada',
      'naviera-auth-0001'
    );
    raise exception 'TEST 0322: reutilizó request ref';
  exception when serialization_failure then null;
  end;
  begin
    perform public.authorize_consolidation_governed(
      '30000000-0000-4000-8000-000000000004',
      'Contenedor ya estaba abierto',
      'naviera-auth-state'
    );
    raise exception 'TEST 0322: autorizó desde estado inválido';
  exception when serialization_failure then null;
  end;
end;
$request_reuse_and_state$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
do $wrong_role$
begin
  begin
    perform public.authorize_consolidation_governed(
      '30000000-0000-4000-8000-000000000002',
      'Bodega intentó autorizar',
      'naviera-auth-role'
    );
    raise exception 'TEST 0322: rol warehouse autorizó';
  exception when no_data_found then null;
  end;
end;
$wrong_role$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
do $disabled$
begin
  begin
    perform public.authorize_consolidation_governed(
      '30000000-0000-4000-8000-000000000002',
      'Admin deshabilitado intentó autorizar',
      'naviera-auth-disabled'
    );
    raise exception 'TEST 0322: membresía deshabilitada autorizó';
  exception when no_data_found then null;
  end;
end;
$disabled$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
do $other_tenant$
begin
  begin
    perform public.authorize_consolidation_governed(
      '30000000-0000-4000-8000-000000000002',
      'Otro tenant intentó autorizar',
      'naviera-auth-tenant'
    );
    raise exception 'TEST 0322: otro tenant autorizó';
  exception when no_data_found then null;
  end;
end;
$other_tenant$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $accounting_and_audit_rollback$
declare v_result jsonb;
begin
  v_result := public.authorize_consolidation_governed(
    '30000000-0000-4000-8000-000000000002',
    'Contabilidad verificó el consolidado',
    'naviera-auth-accounting'
  );
  if v_result->>'outcome' <> 'transitioned' then
    raise exception 'TEST 0322: accounting no pudo autorizar';
  end if;
  begin
    perform public.authorize_consolidation_governed(
      '30000000-0000-4000-8000-000000000005',
      'force audit failure',
      'naviera-auth-audit-fail'
    );
    raise exception 'TEST 0322: fallo AUD no abortó';
  exception when raise_exception then null;
  end;
  if not exists (
    select 1 from public.consolidations
    where id='30000000-0000-4000-8000-000000000005'
      and status='solicitada' and ref is null
      and authorized_by is null and authorized_at is null
  ) then raise exception 'TEST 0322: fallo AUD dejó estado parcial'; end if;
end;
$accounting_and_audit_rollback$;

reset role;

do $grants$
begin
  if has_function_privilege('anon','public.authorize_consolidation_governed(uuid,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.authorize_consolidation_governed(uuid,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.authorize_consolidation_governed(uuid,text,text)','EXECUTE') then
    raise exception 'TEST 0322: grants del RPC inválidos';
  end if;
end;
$grants$;

rollback;
