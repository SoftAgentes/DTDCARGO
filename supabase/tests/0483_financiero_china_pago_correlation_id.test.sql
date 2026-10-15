\set ON_ERROR_STOP on

-- SDD-0534 · contrato de 0483 con el writer AUD-01 REAL.
--
-- El contrato de 0317 simula append_audit_event sin validar el correlation_id
-- y usa referencias cortas ('partner-payment-0001'). La pantalla
-- (ClaimOffsetsTab.tsx:62) manda `partner-claim-payment:<id>:<uuid>`, 95
-- caracteres, y la 0317 arma con ella un correlation_id de 154. Este contrato
-- monta el writer de verdad (_audit-writer-real.sql: 0267 y 0294 reales), la
-- fixture del contrato 0317 sin su writer simulado, y después 0317 y 0483. Sin
-- 0483 cae en el escenario 2 con 22023 «audit: correlation_id inválido»: ése es
-- el control rojo.
--
-- Termina siempre en ROLLBACK. No imprime payloads.
begin;

\ir _audit-writer-real.sql

-- ── Financiero China: la fixture del contrato 0317 ──────────────────────────
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create table public.supplier_claim_offsets (
  id uuid primary key, tenant_id uuid not null, supplier_id uuid,
  shipment_id uuid, client_id uuid, amount_usd numeric not null,
  claimed_on date not null, recognized_on date, received_in_china_on date,
  applied_to_client_on date, evidence_document_id uuid,
  status text not null, client_invoice_id uuid, journal_entry_id uuid,
  deleted_at timestamptz
);

\ir ../migrations/0317_partner_claim_payment_governance.sql
\ir ../migrations/0483_financiero_china_pago_correlation_id.sql

grant select, update on public.supplier_claim_offsets to authenticated;

insert into public.tenants values ('10000000-0000-0000-0000-000000000001');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','admin',null);
insert into public.supplier_claim_offsets (
  id, tenant_id, supplier_id, amount_usd, claimed_on, recognized_on, status
) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-4000-8000-000000000001',500,'2026-07-20','2026-07-25','reconocido_proveedor'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','40000000-0000-4000-8000-000000000001',700,'2026-07-20','2026-07-25','reconocido_proveedor'),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','40000000-0000-4000-8000-000000000001',900,'2026-07-20','2026-07-25','reconocido_proveedor');

-- ── Escenarios ──────────────────────────────────────────────────────────────
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0483: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Marca pagado como el admin de la fixture, igual que la Server Action.
create function pg_temp.ejecutar(p_id uuid, p_ref text) returns text language plpgsql as $$
declare v_result text;
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  v_result := public.mark_claim_offset_paid_in_china_governed(
    p_id, '2026-07-31', 'Comprobante confirmado con el socio', p_ref
  );
  reset role;
  return v_result;
end;
$$;

-- Lo que el pago tiene que dejar, con la referencia que se le dio.
create function pg_temp.assert_hecho(p_id uuid, p_ref text, p_result text, p_label text)
returns void language plpgsql as $$
declare
  v_correlation text;
  v_events integer;
begin
  perform pg_temp.assert_true(p_result = 'transitioned', p_label || ': la RPC transiciona');
  perform pg_temp.assert_true(exists (
    select 1 from public.supplier_claim_offsets
    where id = p_id and status = 'pagado_en_china'
      and received_in_china_on = '2026-07-31'
  ), p_label || ': el cruce queda pagado en China con su fecha');
  select count(*), max(correlation_id) into v_events, v_correlation
  from public.entity_audit_log
  where entity_id = p_id and event_type = 'partner_claim_paid_in_china';
  perform pg_temp.assert_true(v_events = 1, p_label || ': exactamente un AUD-01');
  perform pg_temp.assert_true(
    v_correlation = 'partner-claim-payment:' || p_id::text || ':' || md5(p_ref),
    p_label || ': correlation_id = prefijo, id y md5 de la referencia');
  perform pg_temp.assert_true(char_length(v_correlation) = 91,
    p_label || ': correlation_id de 91 caracteres');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = p_id and event_type = 'partner_claim_paid_in_china'
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
      '10000000-0000-0000-0000-000000000001', 'supplier_claim_offset',
      '30000000-0000-4000-8000-000000000001', 'system', null,
      'partner_claim_probe', 'rpc', 'succeeded', null, null, null, '{}'::jsonb,
      repeat('a', 129), 1, 'internal'
    );
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  perform pg_temp.assert_true(v_state = '22023' and v_message = 'audit: correlation_id inválido',
    'el writer AUD-01 rechaza un correlation_id de 129');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log where event_type = 'partner_claim_probe'
  ), 'la sonda rechazada no deja evento');
end;
$writer_real$;

-- 2. La referencia que arma la pantalla (ClaimOffsetsTab.tsx:62): 95.
do $pantalla$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000001';
  v_ref text := 'partner-claim-payment:' || v_id::text || ':' || gen_random_uuid()::text;
begin
  perform pg_temp.assert_true(char_length(v_ref) = 95, 'la referencia de la pantalla mide 95');
  perform pg_temp.assert_true(
    char_length('partner-claim-payment:' || v_id::text || ':' || v_ref) = 154,
    'con la 0317 el correlation_id mediría 154');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'pantalla');

  -- 3. Replay idéntico: misma respuesta y ningún evento nuevo.
  perform pg_temp.assert_true(
    pg_temp.ejecutar(v_id, v_ref) = 'replayed'
    and (select count(*) from public.entity_audit_log
         where entity_id = v_id and event_type = 'partner_claim_paid_in_china') = 1,
    'el replay con la misma referencia no escribe otro AUD-01');
end;
$pantalla$;

-- 4. Umbral: 70 es la referencia más corta que la 0317 rechazaba (129).
do $umbral$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000002';
  v_ref text := 'r' || repeat('0', 69);
begin
  perform pg_temp.assert_true(
    char_length('partner-claim-payment:' || v_id::text || ':' || v_ref) = 129,
    'con la 0317 una referencia de 70 da un correlation_id de 129');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 70');
end;
$umbral$;

-- 5. Máxima: 128 es la referencia más larga que la RPC acepta.
do $maxima$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000003';
  v_ref text := 'partner-claim-payment:' || v_id::text || ':' || repeat('f', 128 - 59);
begin
  perform pg_temp.assert_true(char_length(v_ref) = 128, 'la referencia máxima mide 128');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 128');
end;
$maxima$;

-- 6. La RPC instalada es la de 0483 (su comentario lo dice).
do $catalogo$
begin
  perform pg_temp.assert_true(
    obj_description('public.mark_claim_offset_paid_in_china_governed(uuid,date,text,text)'::regprocedure, 'pg_proc')
      like '%SDD-0534%',
    'el comentario de la RPC nombra la SDD-0534');
end;
$catalogo$;

select 'TEST 0483 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
