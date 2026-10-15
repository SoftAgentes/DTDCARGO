\set ON_ERROR_STOP on

-- SDD-0534 · contrato de 0484 con el writer AUD-01 REAL.
--
-- El contrato de 0318 simula append_audit_event sin validar el correlation_id
-- y usa referencias cortas ('customs-clearance-0001'). La pantalla
-- (FilingDetailDrawer.tsx:119) manda `customs-clearance:<id>:<uuid>`, 91
-- caracteres, y la 0318 arma con ella un correlation_id de 146. Este contrato
-- monta el writer de verdad (_audit-writer-real.sql: 0267 y 0294 reales), la
-- fixture del contrato 0318 sin su writer simulado, y después 0318 y 0484. Sin
-- 0484 cae en el escenario 2 con 22023 «audit: correlation_id inválido»: ése es
-- el control rojo.
--
-- Termina siempre en ROLLBACK. No imprime payloads.
begin;

\ir _audit-writer-real.sql

-- ── Aduana SENIAT: la fixture del contrato 0318 ─────────────────────────────
create type public.customs_status as enum (
  'en_revision', 'observacion', 'liberacion', 'pagado', 'liberado'
);
create type public.customs_doc_type as enum (
  'commercial', 'packing', 'bl', 'cert_origin', 'sanitary', 'dua', 'payment'
);
create type public.shipment_status as enum (
  'draft', 'in_warehouse', 'consolidating', 'shipped', 'in_transit',
  'in_customs', 'arrived_destination', 'delayed_warehouse',
  'out_for_delivery', 'last_mile', 'delivered', 'exception', 'cancelled'
);

create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null, code text not null,
  status public.shipment_status not null, arrived_destination_at timestamptz,
  deleted_at timestamptz, updated_at timestamptz not null default now()
);
create table public.customs_filings (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid not null,
  dua_code text not null, status public.customs_status not null,
  arrived_at date not null, cleared_at date, alert text, deleted_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.customs_documents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  filing_id uuid not null, doc_type public.customs_doc_type not null,
  uploaded boolean not null default false,
  unique (filing_id, doc_type)
);
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  shipment_id uuid not null, status public.shipment_status not null,
  note text, occurred_at timestamptz not null default now(), created_by uuid,
  deleted_at timestamptz, created_at timestamptz not null default now()
);

\ir ../migrations/0318_customs_clearance_governance.sql
\ir ../migrations/0484_seniat_liberar_correlation_id.sql

grant select, update on public.customs_filings to authenticated;
grant select, update on public.customs_documents to authenticated;
grant select, update on public.shipments to authenticated;
grant select on public.shipment_events, public.entity_audit_log to authenticated;

insert into public.tenants values ('10000000-0000-0000-0000-000000000001');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null);
insert into public.shipments (id, tenant_id, code, status) values
  ('40000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','DTD-001','in_customs'),
  ('40000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','DTD-002','in_customs'),
  ('40000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','DTD-003','in_customs');
insert into public.customs_filings (
  id, tenant_id, shipment_id, dua_code, status, arrived_at
) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-4000-8000-000000000001','DUA-001','pagado','2026-07-20'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','40000000-0000-4000-8000-000000000002','DUA-002','pagado','2026-07-20'),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','40000000-0000-4000-8000-000000000003','DUA-003','pagado','2026-07-20');
insert into public.customs_documents (tenant_id, filing_id, doc_type, uploaded)
select f.tenant_id, f.id, t.doc_type, true
from public.customs_filings f
cross join (values
  ('commercial'::public.customs_doc_type),
  ('packing'::public.customs_doc_type),
  ('bl'::public.customs_doc_type),
  ('cert_origin'::public.customs_doc_type),
  ('dua'::public.customs_doc_type),
  ('payment'::public.customs_doc_type)
) as t(doc_type);

-- ── Escenarios ──────────────────────────────────────────────────────────────
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0484: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Libera como el operador de la fixture, igual que la Server Action.
create function pg_temp.ejecutar(p_id uuid, p_ref text) returns text language plpgsql as $$
declare v_result text;
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  v_result := public.clear_customs_filing_governed(
    p_id, '2026-07-31', 'DUA y pago confirmados', p_ref
  );
  reset role;
  return v_result;
end;
$$;

-- Lo que la liberación tiene que dejar, con la referencia que se le dio.
create function pg_temp.assert_hecho(p_id uuid, p_ref text, p_result text, p_label text)
returns void language plpgsql as $$
declare
  v_correlation text;
  v_events integer;
begin
  perform pg_temp.assert_true(p_result = 'transitioned', p_label || ': la RPC transiciona');
  perform pg_temp.assert_true(exists (
    select 1 from public.customs_filings f
    join public.shipments s on s.id = f.shipment_id
    where f.id = p_id and f.status = 'liberado' and f.cleared_at = '2026-07-31'
      and s.status = 'arrived_destination'
      and (select count(*) from public.shipment_events e where e.shipment_id = s.id) = 1
  ), p_label || ': el trámite queda liberado y el embarque llegó a destino con su evento');
  select count(*), max(correlation_id) into v_events, v_correlation
  from public.entity_audit_log
  where entity_id = p_id and event_type = 'customs_filing_cleared';
  perform pg_temp.assert_true(v_events = 1, p_label || ': exactamente un AUD-01');
  perform pg_temp.assert_true(
    v_correlation = 'customs-clearance:' || p_id::text || ':' || md5(p_ref),
    p_label || ': correlation_id = prefijo, id y md5 de la referencia');
  perform pg_temp.assert_true(char_length(v_correlation) = 87,
    p_label || ': correlation_id de 87 caracteres');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = p_id and event_type = 'customs_filing_cleared'
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
      '10000000-0000-0000-0000-000000000001', 'customs_filing',
      '30000000-0000-4000-8000-000000000001', 'system', null,
      'customs_filing_probe', 'rpc', 'succeeded', null, null, null, '{}'::jsonb,
      repeat('a', 129), 1, 'internal'
    );
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  perform pg_temp.assert_true(v_state = '22023' and v_message = 'audit: correlation_id inválido',
    'el writer AUD-01 rechaza un correlation_id de 129');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log where event_type = 'customs_filing_probe'
  ), 'la sonda rechazada no deja evento');
end;
$writer_real$;

-- 2. La referencia que arma la pantalla (FilingDetailDrawer.tsx:119): 91.
do $pantalla$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000001';
  v_ref text := 'customs-clearance:' || v_id::text || ':' || gen_random_uuid()::text;
begin
  perform pg_temp.assert_true(char_length(v_ref) = 91, 'la referencia de la pantalla mide 91');
  perform pg_temp.assert_true(
    char_length('customs-clearance:' || v_id::text || ':' || v_ref) = 146,
    'con la 0318 el correlation_id mediría 146');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'pantalla');

  -- 3. Replay idéntico: misma respuesta y ningún evento nuevo.
  perform pg_temp.assert_true(
    pg_temp.ejecutar(v_id, v_ref) = 'replayed'
    and (select count(*) from public.entity_audit_log
         where entity_id = v_id and event_type = 'customs_filing_cleared') = 1,
    'el replay con la misma referencia no escribe otro AUD-01');
end;
$pantalla$;

-- 4. Umbral: 74 es la referencia más corta que la 0318 rechazaba (129).
do $umbral$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000002';
  v_ref text := 'r' || repeat('0', 73);
begin
  perform pg_temp.assert_true(
    char_length('customs-clearance:' || v_id::text || ':' || v_ref) = 129,
    'con la 0318 una referencia de 74 da un correlation_id de 129');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 74');
end;
$umbral$;

-- 5. Máxima: 128 es la referencia más larga que la RPC acepta.
do $maxima$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000003';
  v_ref text := 'customs-clearance:' || v_id::text || ':' || repeat('f', 128 - 55);
begin
  perform pg_temp.assert_true(char_length(v_ref) = 128, 'la referencia máxima mide 128');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 128');
end;
$maxima$;

-- 6. La RPC instalada es la de 0484 (su comentario lo dice).
do $catalogo$
begin
  perform pg_temp.assert_true(
    obj_description('public.clear_customs_filing_governed(uuid,date,text,text)'::regprocedure, 'pg_proc')
      like '%SDD-0534%',
    'el comentario de la RPC nombra la SDD-0534');
end;
$catalogo$;

select 'TEST 0484 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
