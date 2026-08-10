\set ON_ERROR_STOP on
begin;

do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

create type public.operario_region as enum ('cn','ve');

create table public.tenants(id uuid primary key);
create table public.operario_pins(
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  display_name text not null, pin_hash text not null default 'x', role text not null,
  region public.operario_region not null, active boolean not null default true
);
create table public.shipments(
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  code text not null, status text not null, pod_signed_by text,
  delivered_at timestamptz, deleted_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.shipment_events(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, shipment_id uuid not null,
  status text not null, note text, created_by uuid
);
create table public.dispatch_orders(
  id uuid primary key, tenant_id uuid not null references public.tenants(id)
);
create table public.warehouse_receipts_cn(
  id uuid primary key, tenant_id uuid not null, shipment_id uuid, deleted_at timestamptz
);
create table public.dispatch_order_packages(
  od_id uuid not null references public.dispatch_orders(id),
  package_kind text not null, package_id uuid not null,
  delivery_status text not null default 'pendiente'
);
create table public.dispatch_pods(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, od_id uuid not null, package_id uuid,
  photo_path text, signature_path text, received_by text not null,
  received_doc text, notes text, created_by_operario_id uuid,
  pod_lat numeric, pod_lng numeric, pod_accuracy_m numeric, pod_gps_status text
);

-- Stub del guard de 0321: replica la exigencia real de las dos variables de
-- sesión. Si camionero_pod_v2 no las setea, el test explota — que es el punto.
create function public.guard_ve_delivery_completion() returns trigger
language plpgsql as $g$
begin
  if old.status is distinct from new.status and new.status = 'delivered' then
    if nullif(btrim(coalesce(current_setting('dtd.ve_delivery_completion', true),'')),'') is null
       or nullif(btrim(coalesce(current_setting('dtd.ve_delivery_completion_shipment', true),'')),'')
          is distinct from new.id::text then
      raise exception 've: confirmar la entrega requiere el RPC gobernado'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $g$;
create trigger guard_ve_delivery_completion_trg
  before update on public.shipments
  for each row execute function public.guard_ve_delivery_completion();

create table public.audit_sink(
  tenant_id uuid, entity_id uuid, actor_type text, actor_id uuid, payload jsonb
);
create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text,
  p_actor_id uuid, p_event_type text, p_source text, p_result text default 'succeeded',
  p_reason text default null, p_before_data jsonb default null,
  p_after_data jsonb default null, p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null, p_schema_version integer default 1,
  p_sensitivity text default 'internal'
) returns uuid language plpgsql as $a$
begin
  insert into public.audit_sink values (p_tenant_id, p_entity_id, p_actor_type, p_actor_id, p_payload);
  return gen_random_uuid();
end $a$;

\ir ../migrations/0336_pod_closes_shipment.sql

do $$
declare
  t   uuid = '11111111-1111-4111-8111-111111111111';
  op  uuid = '22222222-2222-4222-8222-222222222222';
  od1 uuid = '33333333-3333-4333-8333-333333333333';
  od2 uuid = '44444444-4444-4444-8444-444444444444';
  od3 uuid = '55555555-5555-4555-8555-555555555555';
  sh1 uuid = '66666666-6666-4666-8666-666666666666';
  sh2 uuid = '77777777-7777-4777-8777-777777777777';
  r1  uuid = '88888888-8888-4888-8888-888888888888';
  r2  uuid = '99999999-9999-4999-8999-999999999999';
  r3  uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  n   int;
  res jsonb;
begin
  insert into public.tenants values (t);
  insert into public.operario_pins(id,tenant_id,display_name,role,region)
    values (op,t,'Camionero','camionero','ve');
  insert into public.shipments(id,tenant_id,code,status)
    values (sh1,t,'DTD-S1','out_for_delivery'), (sh2,t,'DTD-S2','out_for_delivery');
  insert into public.dispatch_orders values (od1,t),(od2,t),(od3,t);

  -- ── Caso 1 · FALLO FUERTE: recepción sin shipment_id ──
  insert into public.warehouse_receipts_cn(id,tenant_id,shipment_id) values (r1,t,null);
  insert into public.dispatch_order_packages values (od1,'warehouse_receipt_cn',r1,'entregado');
  begin
    perform public.camionero_pod_v2(op,od1,null,'f.jpg','s.png','Ana','V-1',null,'REF-1');
    raise exception '0336: aceptó un POD cuyo paquete no resuelve a un embarque';
  exception when sqlstate 'P0015' then
    null; -- esperado
  end;
  select count(*) into n from public.dispatch_pods where od_id = od1;
  if n <> 0 then
    raise exception '0336: abortó el cierre pero DEJÓ el POD (%). Debe abortar entero', n;
  end if;

  -- ── Caso 2 · CAMINO FELIZ: todo entregado y vinculado ──
  insert into public.warehouse_receipts_cn(id,tenant_id,shipment_id) values (r2,t,sh1);
  insert into public.dispatch_order_packages values (od2,'warehouse_receipt_cn',r2,'entregado');
  res := public.camionero_pod_v2(op,od2,null,'f.jpg','s.png','Ana','V-1',null,'REF-2','10.1','-68.0','5','on');

  if (select status from public.shipments where id = sh1) <> 'delivered' then
    raise exception '0336: el POD no cerró el embarque';
  end if;
  if (select pod_signed_by from public.shipments where id = sh1) <> 'Ana' then
    raise exception '0336: no grabó el receptor en el embarque';
  end if;
  select count(*) into n from public.shipment_events
   where shipment_id = sh1 and status = 'delivered';
  if n <> 1 then raise exception '0336: no dejó evento de rastreo (%)', n; end if;
  if (res->>'closed_count')::int <> 1 then
    raise exception '0336: closed_count incorrecto → %', res->>'closed_count';
  end if;
  -- La identidad real vive en la auditoría, no en shipment_events.
  select count(*) into n from public.audit_sink
   where entity_id = sh1 and actor_type = 'operario' and actor_id = op
     and (payload->>'sealed_dispatch_pod')::boolean is true;
  if n <> 1 then
    raise exception '0336: no auditó como operario con sealed_dispatch_pod (%)', n;
  end if;
  -- El GPS del POD se conserva.
  if (select pod_gps_status from public.dispatch_pods where od_id = od2) <> 'on' then
    raise exception '0336: perdió el GPS del POD';
  end if;

  -- ── Caso 3 · ENTREGA PARCIAL: un paquete retornado NO cierra ──
  insert into public.warehouse_receipts_cn(id,tenant_id,shipment_id) values (r3,t,sh2);
  insert into public.dispatch_order_packages values
    (od3,'warehouse_receipt_cn',r3,'entregado'),
    (od3,'warehouse_receipt_cn',r3,'retornado');
  res := public.camionero_pod_v2(op,od3,null,'f.jpg','s.png','Luis','V-2',null,'REF-3');
  if (select status from public.shipments where id = sh2) = 'delivered' then
    raise exception '0336: cerró un embarque con un paquete retornado';
  end if;
  select count(*) into n from public.dispatch_pods where od_id = od3;
  if n <> 1 then
    raise exception '0336: la entrega parcial debe grabar el POD igual (%)', n;
  end if;

  raise notice '0336 OK · fallo fuerte, cierre gobernado, auditoría de operario y parcial';
end $$;

-- ── Grants: el RPC no puede quedar expuesto ──
do $$
begin
  if has_function_privilege('anon',
      'public.camionero_pod_v2(uuid,uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric,text)','execute')
     or has_function_privilege('authenticated',
      'public.camionero_pod_v2(uuid,uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric,text)','execute') then
    raise exception '0336: camionero_pod_v2 ejecutable por anon/authenticated';
  end if;
  if not has_function_privilege('service_role',
      'public.camionero_pod_v2(uuid,uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric,text)','execute') then
    raise exception '0336: service_role no puede ejecutar camionero_pod_v2';
  end if;
end $$;

rollback;
