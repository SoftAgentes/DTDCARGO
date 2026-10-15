\set ON_ERROR_STOP on

-- SDD-0534 · contrato de 0487 con el writer AUD-01 REAL.
--
-- El contrato de 0321 simula append_audit_event sin validar el correlation_id
-- y usa referencias cortas ('ve-delivery-0001'). La pantalla
-- (VeRowActions.tsx:160) manda `warehouse-ve-delivery:<id>:<uuid>`, 95
-- caracteres, y la 0321 arma con ella un correlation_id de 154. Este contrato
-- monta el writer de verdad (_audit-writer-real.sql: 0267 y 0294 reales), la
-- fixture del contrato 0321 sin su writer simulado, y después 0321 y 0487. Sin
-- 0487 cae en el escenario 2 con 22023 «audit: correlation_id inválido»: ése es
-- el control rojo.
--
-- Termina siempre en ROLLBACK. No imprime payloads.
begin;

\ir _audit-writer-real.sql

-- ── Almacén VE: la fixture del contrato 0321 ────────────────────────────────
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
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

\ir ../migrations/0321_warehouse_ve_delivery_governance.sql
\ir ../migrations/0487_ve_confirmar_entrega_correlation_id.sql

grant select, update, delete on public.shipments to authenticated;
grant select on public.shipment_events, public.entity_audit_log to authenticated;

insert into public.tenants values ('10000000-0000-0000-0000-000000000001');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null);
insert into public.shipments (id, tenant_id, code, status, delivery_address) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','DTD-001','last_mile','Valencia'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','DTD-002','out_for_delivery','Caracas'),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','DTD-003','last_mile','Maracay');

-- ── Escenarios ──────────────────────────────────────────────────────────────
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0487: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Confirma como el operador de la fixture, igual que la Server Action.
create function pg_temp.ejecutar(p_id uuid, p_ref text) returns text language plpgsql as $$
declare v_result text;
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  v_result := public.complete_ve_delivery_governed(
    p_id, 'Ana Pérez', 'Entrega verificada por Operaciones', p_ref
  );
  reset role;
  return v_result;
end;
$$;

-- Lo que la confirmación tiene que dejar, con la referencia que se le dio.
create function pg_temp.assert_hecho(p_id uuid, p_ref text, p_result text, p_label text)
returns void language plpgsql as $$
declare
  v_correlation text;
  v_events integer;
begin
  perform pg_temp.assert_true(p_result = 'transitioned', p_label || ': la RPC transiciona');
  perform pg_temp.assert_true(exists (
    select 1 from public.shipments s
    where s.id = p_id and s.status = 'delivered' and s.pod_signed_by = 'Ana Pérez'
      and s.delivered_at is not null
      and (select count(*) from public.shipment_events e where e.shipment_id = s.id) = 1
  ), p_label || ': el embarque queda entregado con su receptor y su evento');
  select count(*), max(correlation_id) into v_events, v_correlation
  from public.entity_audit_log
  where entity_id = p_id and event_type = 'shipment_delivery_manually_confirmed';
  perform pg_temp.assert_true(v_events = 1, p_label || ': exactamente un AUD-01');
  perform pg_temp.assert_true(
    v_correlation = 'warehouse-ve-delivery:' || p_id::text || ':' || md5(p_ref),
    p_label || ': correlation_id = prefijo, id y md5 de la referencia');
  perform pg_temp.assert_true(char_length(v_correlation) = 91,
    p_label || ': correlation_id de 91 caracteres');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = p_id and event_type = 'shipment_delivery_manually_confirmed'
      and payload->>'request_ref' = p_ref
  ), p_label || ': payload.request_ref conserva la referencia completa');
end;
$$;

-- 1. El writer de este contrato es el real: rechaza un correlation_id de 129.
do $writer_real$
declare v_state text; v_message text;
begin
  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001', 'shipment',
      '30000000-0000-4000-8000-000000000001', 'system', null,
      'shipment_probe', 'rpc', 'succeeded', null, null, null, '{}'::jsonb,
      repeat('a', 129), 1, 'internal'
    );
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  perform pg_temp.assert_true(v_state = '22023' and v_message = 'audit: correlation_id inválido',
    'el writer AUD-01 rechaza un correlation_id de 129');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log where event_type = 'shipment_probe'
  ), 'la sonda rechazada no deja evento');
end;
$writer_real$;

-- 2. La referencia que arma la pantalla (VeRowActions.tsx:160): 95.
do $pantalla$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000001';
  v_ref text := 'warehouse-ve-delivery:' || v_id::text || ':' || gen_random_uuid()::text;
begin
  perform pg_temp.assert_true(char_length(v_ref) = 95, 'la referencia de la pantalla mide 95');
  perform pg_temp.assert_true(
    char_length('warehouse-ve-delivery:' || v_id::text || ':' || v_ref) = 154,
    'con la 0321 el correlation_id mediría 154');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'pantalla');

  -- 3. Replay idéntico: misma respuesta y ningún evento nuevo.
  perform pg_temp.assert_true(
    pg_temp.ejecutar(v_id, v_ref) = 'replayed'
    and (select count(*) from public.entity_audit_log
         where entity_id = v_id and event_type = 'shipment_delivery_manually_confirmed') = 1,
    'el replay con la misma referencia no escribe otro AUD-01');
end;
$pantalla$;

-- 4. Umbral: 70 es la referencia más corta que la 0321 rechazaba (129).
do $umbral$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000002';
  v_ref text := 'r' || repeat('0', 69);
begin
  perform pg_temp.assert_true(
    char_length('warehouse-ve-delivery:' || v_id::text || ':' || v_ref) = 129,
    'con la 0321 una referencia de 70 da un correlation_id de 129');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 70');
end;
$umbral$;

-- 5. Máxima: 128 es la referencia más larga que la RPC acepta.
do $maxima$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000003';
  v_ref text := 'warehouse-ve-delivery:' || v_id::text || ':' || repeat('f', 128 - 59);
begin
  perform pg_temp.assert_true(char_length(v_ref) = 128, 'la referencia máxima mide 128');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 128');
end;
$maxima$;

-- 6. La RPC instalada es la de 0487 (su comentario lo dice).
do $catalogo$
begin
  perform pg_temp.assert_true(
    obj_description('public.complete_ve_delivery_governed(uuid,text,text,text)'::regprocedure, 'pg_proc')
      like '%SDD-0534%',
    'el comentario de la RPC nombra la SDD-0534');
end;
$catalogo$;

select 'TEST 0487 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
