\set ON_ERROR_STOP on

-- SDD-0534 · contrato de 0489 con el writer AUD-01 REAL.
--
-- El contrato de 0324 simula append_audit_event sin validar el correlation_id
-- y usa referencias cortas ('dispatch-cancel-0001'). La pantalla
-- (CancelOdDrawer.tsx:32) manda `dispatch-order-cancellation:<id>:<uuid>`, 101
-- caracteres, y la 0324 arma con ella un correlation_id de 166. Este contrato
-- monta el writer de verdad (_audit-writer-real.sql: 0267 y 0294 reales), la
-- fixture del contrato 0324 sin su writer simulado, y después 0324 y 0489. Sin
-- 0489 cae en el escenario 2 con 22023 «audit: correlation_id inválido»: ése es
-- el control rojo.
--
-- Termina siempre en ROLLBACK. No imprime payloads.
begin;

\ir _audit-writer-real.sql

-- ── Despacho: la fixture del contrato 0324 ──────────────────────────────────
create type public.dispatch_order_status as enum (
  'creada','cargando','lista','en_ruta','entregada','cerrada','cancelada'
);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
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

\ir ../migrations/0324_dispatch_order_cancellation_governance.sql
\ir ../migrations/0489_despacho_cancelar_od_correlation_id.sql

grant select, update on public.dispatch_orders to authenticated;
grant select on public.entity_audit_log to authenticated;

insert into public.tenants values ('10000000-0000-0000-0000-000000000001');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null);
insert into public.dispatch_orders (
  id, tenant_id, order_code, status, package_count
) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','OD-2026-0001','lista',3),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','OD-2026-0002','lista',2),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','OD-2026-0003','lista',1);

-- ── Escenarios ──────────────────────────────────────────────────────────────
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0489: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Cancela como el operador de la fixture, igual que la Server Action.
create function pg_temp.ejecutar(p_id uuid, p_ref text) returns text language plpgsql as $$
declare v_result text;
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  v_result := public.cancel_dispatch_order_governed(
    p_id, 'lista', 'Cliente reprogramó la entrega', p_ref
  );
  reset role;
  return v_result;
end;
$$;

-- Lo que la cancelación tiene que dejar, con la referencia que se le dio.
create function pg_temp.assert_hecho(p_id uuid, p_ref text, p_result text, p_label text)
returns void language plpgsql as $$
declare
  v_correlation text;
  v_events integer;
begin
  perform pg_temp.assert_true(p_result = 'transitioned', p_label || ': la RPC transiciona');
  perform pg_temp.assert_true(exists (
    select 1 from public.dispatch_orders
    where id = p_id and status = 'cancelada'
      and cancel_reason = 'Cliente reprogramó la entrega'
      and cancelled_by = '20000000-0000-0000-0000-000000000001'
      and cancelled_at is not null
  ), p_label || ': la OD queda cancelada con su motivo y su actor');
  select count(*), max(correlation_id) into v_events, v_correlation
  from public.entity_audit_log
  where entity_id = p_id and event_type = 'dispatch_order_cancelled';
  perform pg_temp.assert_true(v_events = 1, p_label || ': exactamente un AUD-01');
  perform pg_temp.assert_true(
    v_correlation = 'dispatch-order-cancellation:' || p_id::text || ':' || md5(p_ref),
    p_label || ': correlation_id = prefijo, id y md5 de la referencia');
  perform pg_temp.assert_true(char_length(v_correlation) = 97,
    p_label || ': correlation_id de 97 caracteres');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = p_id and event_type = 'dispatch_order_cancelled'
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
      '10000000-0000-0000-0000-000000000001', 'dispatch_order',
      '30000000-0000-4000-8000-000000000001', 'system', null,
      'dispatch_order_probe', 'rpc', 'succeeded', null, null, null, '{}'::jsonb,
      repeat('a', 129), 1, 'internal'
    );
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  perform pg_temp.assert_true(v_state = '22023' and v_message = 'audit: correlation_id inválido',
    'el writer AUD-01 rechaza un correlation_id de 129');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log where event_type = 'dispatch_order_probe'
  ), 'la sonda rechazada no deja evento');
end;
$writer_real$;

-- 2. La referencia que arma la pantalla (CancelOdDrawer.tsx:32): 101.
do $pantalla$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000001';
  v_ref text := 'dispatch-order-cancellation:' || v_id::text || ':' || gen_random_uuid()::text;
begin
  perform pg_temp.assert_true(char_length(v_ref) = 101, 'la referencia de la pantalla mide 101');
  perform pg_temp.assert_true(
    char_length('dispatch-order-cancellation:' || v_id::text || ':' || v_ref) = 166,
    'con la 0324 el correlation_id mediría 166');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'pantalla');

  -- 3. Replay idéntico: misma respuesta y ningún evento nuevo.
  perform pg_temp.assert_true(
    pg_temp.ejecutar(v_id, v_ref) = 'replayed'
    and (select count(*) from public.entity_audit_log
         where entity_id = v_id and event_type = 'dispatch_order_cancelled') = 1,
    'el replay con la misma referencia no escribe otro AUD-01');
end;
$pantalla$;

-- 4. Umbral: 64 es la referencia más corta que la 0324 rechazaba (129).
do $umbral$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000002';
  v_ref text := 'r' || repeat('0', 63);
begin
  perform pg_temp.assert_true(
    char_length('dispatch-order-cancellation:' || v_id::text || ':' || v_ref) = 129,
    'con la 0324 una referencia de 64 da un correlation_id de 129');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 64');
end;
$umbral$;

-- 5. Máxima: 128 es la referencia más larga que la RPC acepta.
do $maxima$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000003';
  v_ref text := 'dispatch-order-cancellation:' || v_id::text || ':' || repeat('f', 128 - 65);
begin
  perform pg_temp.assert_true(char_length(v_ref) = 128, 'la referencia máxima mide 128');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 128');
end;
$maxima$;

-- 6. La RPC instalada es la de 0489 (su comentario lo dice).
do $catalogo$
begin
  perform pg_temp.assert_true(
    obj_description('public.cancel_dispatch_order_governed(uuid,text,text,text)'::regprocedure, 'pg_proc')
      like '%SDD-0534%',
    'el comentario de la RPC nombra la SDD-0534');
end;
$catalogo$;

select 'TEST 0489 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
