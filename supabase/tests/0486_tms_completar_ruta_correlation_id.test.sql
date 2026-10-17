\set ON_ERROR_STOP on

-- SDD-0534 · contrato de 0486 con el writer AUD-01 REAL.
--
-- El contrato de 0320 simula append_audit_event sin validar el correlation_id
-- y usa referencias cortas ('tms-route-0001'). La pantalla (RoutesTab.tsx:30)
-- manda `tms-route-completion:<id>:<uuid>`, 94 caracteres, y la 0320 arma con
-- ella un correlation_id de 152. Este contrato monta el writer de verdad
-- (_audit-writer-real.sql: 0267 y 0294 reales), la fixture del contrato 0320
-- sin su writer simulado, y después 0320 y 0486. Sin 0486 cae en el escenario 2
-- con 22023 «audit: correlation_id inválido»: ése es el control rojo.
--
-- Termina siempre en ROLLBACK. No imprime payloads.
begin;

\ir _audit-writer-real.sql

-- ── TMS: la fixture del contrato 0320 ───────────────────────────────────────
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
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

\ir ../migrations/0320_tms_route_completion_governance.sql
\ir ../migrations/0486_tms_completar_ruta_correlation_id.sql

grant select, update, delete on public.tms_routes to authenticated;
grant select on public.tms_trucks, public.tms_drivers, public.shipments,
  public.shipment_events, public.entity_audit_log to authenticated;

insert into public.tenants values ('10000000-0000-0000-0000-000000000001');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null);
insert into public.shipments (id, tenant_id, code, status) values
  ('40000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','DTD-001','out_for_delivery'),
  ('40000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','DTD-002','out_for_delivery'),
  ('40000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','DTD-003','out_for_delivery');
insert into public.tms_trucks (id, tenant_id, plate, status) values
  ('50000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','T-001','en_ruta'),
  ('50000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','T-002','en_ruta'),
  ('50000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','T-003','en_ruta');
insert into public.tms_drivers (id, tenant_id, name, status) values
  ('60000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','Chofer 1','en_ruta'),
  ('60000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','Chofer 2','en_ruta'),
  ('60000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','Chofer 3','en_ruta');
insert into public.tms_routes (
  id, tenant_id, route_code, shipment_id, truck_id, driver_id, progress_pct, status
) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','R-001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',75,'en_ruta'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','R-002','40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002',50,'en_ruta'),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','R-003','40000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000003',90,'en_ruta');

-- ── Escenarios ──────────────────────────────────────────────────────────────
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0486: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Completa como el operador de la fixture, igual que la Server Action.
create function pg_temp.ejecutar(p_id uuid, p_ref text) returns text language plpgsql as $$
declare v_result text;
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  v_result := public.complete_tms_route_governed(
    p_id, 'Ruta finalizada y entrega enviada a POD', p_ref
  );
  reset role;
  return v_result;
end;
$$;

-- Lo que el cierre tiene que dejar, con la referencia que se le dio.
create function pg_temp.assert_hecho(p_id uuid, p_ref text, p_result text, p_label text)
returns void language plpgsql as $$
declare
  v_correlation text;
  v_events integer;
begin
  perform pg_temp.assert_true(p_result = 'transitioned', p_label || ': la RPC transiciona');
  perform pg_temp.assert_true(exists (
    select 1 from public.tms_routes r
    join public.tms_trucks t on t.id = r.truck_id
    join public.tms_drivers d on d.id = r.driver_id
    join public.shipments s on s.id = r.shipment_id
    where r.id = p_id and r.status = 'completado' and r.progress_pct = 100
      and t.status = 'disponible' and d.status = 'disponible'
      and s.status = 'last_mile'
      and (select count(*) from public.shipment_events e where e.shipment_id = s.id) = 1
  ), p_label || ': la ruta queda completada, los recursos libres y el embarque en última milla');
  select count(*), max(correlation_id) into v_events, v_correlation
  from public.entity_audit_log
  where entity_id = p_id and event_type = 'tms_route_completed';
  perform pg_temp.assert_true(v_events = 1, p_label || ': exactamente un AUD-01');
  perform pg_temp.assert_true(
    v_correlation = 'tms-route-completion:' || p_id::text || ':' || md5(p_ref),
    p_label || ': correlation_id = prefijo, id y md5 de la referencia');
  perform pg_temp.assert_true(char_length(v_correlation) = 90,
    p_label || ': correlation_id de 90 caracteres');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = p_id and event_type = 'tms_route_completed'
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
      '10000000-0000-0000-0000-000000000001', 'tms_route',
      '30000000-0000-4000-8000-000000000001', 'system', null,
      'tms_route_probe', 'rpc', 'succeeded', null, null, null, '{}'::jsonb,
      repeat('a', 129), 1, 'internal'
    );
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  perform pg_temp.assert_true(v_state = '22023' and v_message = 'audit: correlation_id inválido',
    'el writer AUD-01 rechaza un correlation_id de 129');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log where event_type = 'tms_route_probe'
  ), 'la sonda rechazada no deja evento');
end;
$writer_real$;

-- 2. La referencia que arma la pantalla (RoutesTab.tsx:30): 94.
do $pantalla$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000001';
  v_ref text := 'tms-route-completion:' || v_id::text || ':' || gen_random_uuid()::text;
begin
  perform pg_temp.assert_true(char_length(v_ref) = 94, 'la referencia de la pantalla mide 94');
  perform pg_temp.assert_true(
    char_length('tms-route-completion:' || v_id::text || ':' || v_ref) = 152,
    'con la 0320 el correlation_id mediría 152');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'pantalla');

  -- 3. Replay idéntico: misma respuesta y ningún evento nuevo.
  perform pg_temp.assert_true(
    pg_temp.ejecutar(v_id, v_ref) = 'replayed'
    and (select count(*) from public.entity_audit_log
         where entity_id = v_id and event_type = 'tms_route_completed') = 1,
    'el replay con la misma referencia no escribe otro AUD-01');
end;
$pantalla$;

-- 4. Umbral: 71 es la referencia más corta que la 0320 rechazaba (129).
do $umbral$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000002';
  v_ref text := 'r' || repeat('0', 70);
begin
  perform pg_temp.assert_true(
    char_length('tms-route-completion:' || v_id::text || ':' || v_ref) = 129,
    'con la 0320 una referencia de 71 da un correlation_id de 129');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 71');
end;
$umbral$;

-- 5. Máxima: 128 es la referencia más larga que la RPC acepta.
do $maxima$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000003';
  v_ref text := 'tms-route-completion:' || v_id::text || ':' || repeat('f', 128 - 58);
begin
  perform pg_temp.assert_true(char_length(v_ref) = 128, 'la referencia máxima mide 128');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 128');
end;
$maxima$;

-- 6. La RPC instalada es la de 0486 (su comentario lo dice).
do $catalogo$
begin
  perform pg_temp.assert_true(
    obj_description('public.complete_tms_route_governed(uuid,text,text)'::regprocedure, 'pg_proc')
      like '%SDD-0534%',
    'el comentario de la RPC nombra la SDD-0534');
end;
$catalogo$;

select 'TEST 0486 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
