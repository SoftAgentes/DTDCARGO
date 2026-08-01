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

create type public.dispatch_order_status as enum (
  'creada','cargando','lista','en_ruta','entregada','cerrada','cancelada'
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
create table public.dispatch_orders (
  id uuid primary key, tenant_id uuid not null, order_code text not null,
  status public.dispatch_order_status not null default 'creada', hub text not null default 'valencia',
  package_count integer not null default 0, cancel_reason text,
  cancelled_at timestamptz, cancelled_by uuid,
  updated_at timestamptz not null default now()
);

create function public.dispatch_orders_status_transition_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status <> new.status then
    if old.status in ('cerrada','cancelada') then
      raise exception 'terminal';
    end if;
    if old.status = 'entregada' and new.status <> 'cerrada' then
      raise exception 'desde entregada sólo cerrada';
    end if;
    if new.status = 'cancelada' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger dispatch_orders_status_guard
before update on public.dispatch_orders
for each row execute function public.dispatch_orders_status_transition_guard();

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

\ir ../migrations/0324_dispatch_order_cancellation_governance.sql

grant select, update on public.dispatch_orders to authenticated;
grant select on public.entity_audit_log to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','warehouse',null),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','accounting',null),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','admin',now()),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','admin',null);
insert into public.dispatch_orders (
  id, tenant_id, order_code, status, package_count
) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','OD-2026-0001','lista',3),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','OD-2026-0002','en_ruta',2),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000002','OD-2026-0003','creada',1),
  ('30000000-0000-4000-8000-000000000004','10000000-0000-0000-0000-000000000001','OD-2026-0004','entregada',4),
  ('30000000-0000-4000-8000-000000000005','10000000-0000-0000-0000-000000000001','OD-2026-0005','cargando',5);

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);

do $direct_guard$
begin
  begin
    update public.dispatch_orders
    set status='cancelada', cancel_reason='Intento directo'
    where id='30000000-0000-4000-8000-000000000001';
    raise exception 'TEST 0324: cancelación directa no fue bloqueada';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.dispatch_orders set cancel_reason='Motivo forjado'
    where id='30000000-0000-4000-8000-000000000001';
    raise exception 'TEST 0324: metadata directa no fue bloqueada';
  exception when insufficient_privilege then null;
  end;
end;
$direct_guard$;

do $success_and_replay$
declare v_first text; v_replay text;
begin
  v_first := public.cancel_dispatch_order_governed(
    '30000000-0000-4000-8000-000000000001','lista',
    'Cliente reprogramó la entrega','dispatch-cancel-0001'
  );
  v_replay := public.cancel_dispatch_order_governed(
    '30000000-0000-4000-8000-000000000001','lista',
    'Cliente reprogramó la entrega','dispatch-cancel-0001'
  );
  if v_first <> 'transitioned' or v_replay <> 'replayed' then
    raise exception 'TEST 0324: resultado/replay inesperado %/%', v_first, v_replay;
  end if;
  if not exists (
    select 1 from public.dispatch_orders
    where id='30000000-0000-4000-8000-000000000001'
      and status='cancelada'
      and cancel_reason='Cliente reprogramó la entrega'
      and cancelled_by='20000000-0000-0000-0000-000000000001'
      and cancelled_at is not null
  ) then raise exception 'TEST 0324: cancelación no persistió completa'; end if;
  if not exists (
    select 1 from public.entity_audit_log
    where entity_id='30000000-0000-4000-8000-000000000001'
      and event_type='dispatch_order_cancelled'
      and actor_id='20000000-0000-0000-0000-000000000001'
      and reason='Cliente reprogramó la entrega'
      and payload->>'request_ref'='dispatch-cancel-0001'
      and payload->>'from_status'='lista'
      and payload->>'to_status'='cancelada'
      and payload->>'packages_released_by_status'='true'
      and payload->>'package_count'='3'
  ) or (select count(*) from public.entity_audit_log where event_type='dispatch_order_cancelled') <> 1 then
    raise exception 'TEST 0324: evidencia AUD-01 inválida';
  end if;
end;
$success_and_replay$;

do $terminal_and_reuse$
begin
  begin
    update public.dispatch_orders set cancel_reason='Otro motivo'
    where id='30000000-0000-4000-8000-000000000001';
    raise exception 'TEST 0324: alteró cancelación terminal';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cancel_dispatch_order_governed(
      '30000000-0000-4000-8000-000000000002','en_ruta',
      'Segunda OD cancelada','dispatch-cancel-0001'
    );
    raise exception 'TEST 0324: reutilizó request ref';
  exception when serialization_failure then null;
  end;
  begin
    perform public.cancel_dispatch_order_governed(
      '30000000-0000-4000-8000-000000000004','en_ruta',
      'Estado observado desactualizado','dispatch-cancel-state'
    );
    raise exception 'TEST 0324: canceló desde estado inválido';
  exception when serialization_failure then null;
  end;
end;
$terminal_and_reuse$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
do $wrong_role$
begin
  begin
    perform public.cancel_dispatch_order_governed(
      '30000000-0000-4000-8000-000000000002','en_ruta',
      'Contabilidad intentó cancelar','dispatch-cancel-role'
    );
    raise exception 'TEST 0324: accounting canceló OD';
  exception when no_data_found then null;
  end;
end;
$wrong_role$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
do $disabled$
begin
  begin
    perform public.cancel_dispatch_order_governed(
      '30000000-0000-4000-8000-000000000002','en_ruta',
      'Admin deshabilitado intentó cancelar','dispatch-cancel-disabled'
    );
    raise exception 'TEST 0324: membresía deshabilitada canceló';
  exception when no_data_found then null;
  end;
end;
$disabled$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
do $other_tenant$
begin
  begin
    perform public.cancel_dispatch_order_governed(
      '30000000-0000-4000-8000-000000000002','en_ruta',
      'Otro tenant intentó cancelar','dispatch-cancel-tenant'
    );
    raise exception 'TEST 0324: otro tenant canceló';
  exception when no_data_found then null;
  end;
end;
$other_tenant$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $warehouse_and_audit_rollback$
declare v_result text;
begin
  v_result := public.cancel_dispatch_order_governed(
    '30000000-0000-4000-8000-000000000002','en_ruta',
    'Bodega confirmó devolución','dispatch-cancel-warehouse'
  );
  if v_result <> 'transitioned' then
    raise exception 'TEST 0324: warehouse no pudo cancelar';
  end if;
  begin
    perform public.cancel_dispatch_order_governed(
      '30000000-0000-4000-8000-000000000005','cargando',
      'force audit failure','dispatch-cancel-audit-fail'
    );
    raise exception 'TEST 0324: fallo AUD no abortó';
  exception when raise_exception then null;
  end;
  if not exists (
    select 1 from public.dispatch_orders
    where id='30000000-0000-4000-8000-000000000005'
      and status='cargando' and cancel_reason is null
      and cancelled_at is null and cancelled_by is null
  ) then raise exception 'TEST 0324: fallo AUD dejó cancelación parcial'; end if;
end;
$warehouse_and_audit_rollback$;

reset role;

do $grants$
begin
  if has_function_privilege('anon','public.cancel_dispatch_order_governed(uuid,text,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.cancel_dispatch_order_governed(uuid,text,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.cancel_dispatch_order_governed(uuid,text,text,text)','EXECUTE') then
    raise exception 'TEST 0324: grants del RPC inválidos';
  end if;
end;
$grants$;

rollback;
