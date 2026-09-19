\set ON_ERROR_STOP on
-- SDD-0484: confirmar un reporte nunca deja pagado > total, y la cancelación
-- guarda su motivo en el reporte. Sólo datos sintéticos, PostgreSQL desechable
-- vacío, BEGIN/ROLLBACK. Sin Cloud ni datos reales.
-- RED: psql -v apply_fix=false -f /sb/tests/0464_reporte_pago_factura_pagada.test.sql
\if :{?apply_fix}
\else
\set apply_fix true
\endif
\set apply_paid_rule :apply_fix
\set apply_fix true
\set fixture_in_transaction true
begin;
\ir 0421_payment_report_commands.test.sql
\set fixture_in_transaction false
\set apply_fix :apply_paid_rule

-- El bootstrap deja abierta ESTA transacción con la fixture y la 0421 real, sin
-- correr su suite: el contrato de 0421 sigue en su prueba independiente y su
-- sobrepago heredado (línea 644) sigue siendo cierto para la 0421 sola.
create temporary sequence paid_assertions;
create function pg_temp.paid_assert(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'TEST 0464: %', label; end if;
  perform nextval('pg_temp.paid_assertions');
end;
$$;
create function pg_temp.paid_actor(actor text, statement text) returns jsonb language plpgsql as $$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(actor)::text, ''), true);
  execute 'set local role authenticated';
  execute statement into result;
  reset role;
  return result;
exception when others then reset role; raise;
end;
$$;
create function pg_temp.paid_state() returns jsonb language sql as $$
  select jsonb_build_object(
    'reports', (select jsonb_agg(to_jsonb(t) order by id) from public.payment_reports t),
    'invoices', (select jsonb_agg(to_jsonb(t) order by id) from public.invoices t),
    'events', (select jsonb_agg(to_jsonb(t) order by id) from public.entity_audit_log t),
    'receipts', (select jsonb_agg(to_jsonb(t) order by request_id) from payment_private.report_commands t))
$$;
-- Rechazo EXACTO: SQLSTATE y mensaje funcional que la app traduce, sin
-- mutación, recibo ni evento de auditoría.
create function pg_temp.paid_denied(label text, actor text, statement text,
  expected_message text, expected_state text default '23514') returns void language plpgsql as $$
declare before_state jsonb := pg_temp.paid_state(); denied boolean := false; code text; message text;
begin
  begin perform pg_temp.paid_actor(actor, statement);
  exception when others then
    get stacked diagnostics code = returned_sqlstate, message = message_text;
    if code <> expected_state or message <> expected_message then
      raise exception 'TEST 0464: % esperaba % %, obtuvo % %', label, expected_state, expected_message, code, message;
    end if;
    denied := true;
  end;
  perform pg_temp.paid_assert(denied, label || ': se esperaba rechazo ' || expected_message);
  perform pg_temp.paid_assert(pg_temp.paid_state() = before_state, label || ': ninguna mutación, recibo ni evento');
end;
$$;
create function pg_temp.paid_resolve(request text, report text, action text default 'confirmado',
  reason text default 'Pago cotejado por finanzas') returns text language sql as $$
  select format('select public.resolve_payment_report(%L::uuid,%L::uuid,%L::public.payment_report_status,%L)',
    pg_temp.fixture_id(request), pg_temp.fixture_id(report), action, reason)
$$;
create function pg_temp.paid_cancel(request text, report text, code text, reason text) returns text language sql as $$
  select format('select public.cancel_portal_payment_report(%L::uuid,%L::uuid,%L,%L)',
    pg_temp.fixture_id(request), pg_temp.fixture_id(report), code, reason)
$$;
create function pg_temp.paid_invoice(label text) returns public.invoices language sql as $$
  select * from public.invoices where id = pg_temp.fixture_id(label)
$$;
create function pg_temp.paid_report(label text) returns public.payment_reports language sql as $$
  select * from public.payment_reports where id = pg_temp.fixture_id(label)
$$;

-- Facturas del cliente A (Shipping Mark DUP) en cada estado cobrable, con
-- reportes pendientes ya cargados ANTES de 0464, como en producción.
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, base_amount, total_amount, paid_amount, status, currency)
select pg_temp.fixture_id(v.label), pg_temp.fixture_id('tenant-A'), v.code, 'DUP', 'synthetic',
  v.total, v.total, v.paid, v.status::public.invoice_status, 'USD'
from (values
  ('paid-full', 'F-PAGADA-TOTAL', 1000, 1000, 'pagada'),
  ('paid-short', 'F-PAGADA-MANUAL', 1000, 600, 'pagada'),
  ('balance', 'F-SALDO', 1000, 20, 'emitida'),
  ('duplicate', 'F-DUPLICADO', 1000, 20, 'emitida'),
  ('overdue', 'F-VENCIDA', 500, 0, 'vencida'),
  ('partial', 'F-PARCIAL', 1000, 700, 'parcial'),
  ('replay', 'F-REPLAY', 1000, 20, 'emitida')
) v(label, code, total, paid, status);
insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, currency, method, paid_at, note, proof_path)
select pg_temp.fixture_id(v.label), i.tenant_id, i.id, i.invoice_code, i.client_markbox, v.amount, i.currency,
  'transferencia', current_date - 1, 'Nota original sintética', pg_temp.proof_path('tenant-A', v.invoice, v.label)
from (values
  ('pf-confirm', 'paid-full', 100.00), ('pf-reject', 'paid-full', 100.00), ('pf-cancel', 'paid-full', 100.00),
  ('ps-confirm', 'paid-short', 100.00), ('ps-cancel-max', 'paid-short', 100.00),
  ('bal-over', 'balance', 981.00), ('bal-exact', 'balance', 980.00),
  ('dup-1', 'duplicate', 980.00), ('dup-2', 'duplicate', 980.00),
  ('ov-1', 'overdue', 499.99), ('ov-2', 'overdue', 0.02), ('ov-3', 'overdue', 0.01),
  ('pa-over', 'partial', 300.01), ('pa-exact', 'partial', 300.00),
  ('rp-1', 'replay', 980.00)
) v(label, invoice, amount) join public.invoices i on i.id = pg_temp.fixture_id(v.invoice);

\if :apply_fix
\ir ../migrations/0464_reporte_pago_factura_pagada.sql
\endif

-- 1 · Factura ya pagada: confirmar se rechaza; rechazar y cancelar siguen.
select pg_temp.paid_denied('confirmar sobre factura pagada', 'accounting-A',
  pg_temp.paid_resolve('req-pf-confirm', 'pf-confirm'), 'PAYMENT_INVOICE_PAID');
select pg_temp.paid_denied('admin tampoco confirma sobre factura pagada', 'admin-A',
  pg_temp.paid_resolve('req-pf-confirm-admin', 'pf-confirm'), 'PAYMENT_INVOICE_PAID');
select pg_temp.paid_denied('pagada a mano con saldo: manda el estado', 'accounting-A',
  pg_temp.paid_resolve('req-ps-confirm', 'ps-confirm'), 'PAYMENT_INVOICE_PAID');
do $paid_exits$
declare v_result jsonb;
begin
  v_result := pg_temp.paid_actor('admin-A',
    pg_temp.paid_resolve('req-pf-reject', 'pf-reject', 'rechazado', 'Pago ya registrado en cobranza'));
  perform pg_temp.paid_assert(v_result->>'status' = 'rechazado' and (v_result->>'replayed')::boolean = false,
    'rechazar sobre factura pagada devuelve recibo rechazado');
  perform pg_temp.paid_assert((pg_temp.paid_report('pf-reject')).resolution_reason = 'Pago ya registrado en cobranza',
    'el rechazo guarda su motivo');
  perform pg_temp.paid_assert((pg_temp.paid_invoice('paid-full')).paid_amount = 1000
    and (pg_temp.paid_invoice('paid-full')).status = 'pagada', 'rechazar no mueve el saldo de la factura pagada');
end;
$paid_exits$;

-- 2 · Excedente sobre el saldo (total − pagado) en cada estado cobrable.
select pg_temp.paid_denied('emitida: un centavo sobre el saldo', 'accounting-A',
  pg_temp.paid_resolve('req-bal-over', 'bal-over'), 'PAYMENT_EXCEEDS_BALANCE');
select pg_temp.paid_denied('parcial: un centavo sobre el saldo', 'accounting-A',
  pg_temp.paid_resolve('req-pa-over', 'pa-over'), 'PAYMENT_EXCEEDS_BALANCE');
do $exact_balance$
begin
  perform pg_temp.paid_actor('accounting-A', pg_temp.paid_resolve('req-bal-exact', 'bal-exact'));
  perform pg_temp.paid_assert((pg_temp.paid_invoice('balance')).paid_amount = 1000
    and (pg_temp.paid_invoice('balance')).status = 'pagada', 'emitida: el saldo exacto la deja pagada, sin excedente');
  perform pg_temp.paid_actor('accounting-A', pg_temp.paid_resolve('req-pa-exact', 'pa-exact'));
  perform pg_temp.paid_assert((pg_temp.paid_invoice('partial')).paid_amount = 1000
    and (pg_temp.paid_invoice('partial')).status = 'pagada', 'parcial: el saldo exacto la deja pagada');
  perform pg_temp.paid_actor('accounting-A', pg_temp.paid_resolve('req-ov-1', 'ov-1'));
  perform pg_temp.paid_assert((pg_temp.paid_invoice('overdue')).paid_amount = 499.99
    and (pg_temp.paid_invoice('overdue')).status = 'parcial', 'vencida: un abono menor conserva la fórmula de 0134');
end;
$exact_balance$;
select pg_temp.paid_denied('vencida: dos centavos contra un saldo de uno', 'accounting-A',
  pg_temp.paid_resolve('req-ov-2', 'ov-2'), 'PAYMENT_EXCEEDS_BALANCE');
do $last_cent$
begin
  perform pg_temp.paid_actor('accounting-A', pg_temp.paid_resolve('req-ov-3', 'ov-3'));
  perform pg_temp.paid_assert((pg_temp.paid_invoice('overdue')).paid_amount = 500
    and (pg_temp.paid_invoice('overdue')).status = 'pagada', 'vencida: el último centavo la deja pagada');
end;
$last_cent$;
-- Una vez pagada, el reporte que excedía ahora choca con la regla de estado.
select pg_temp.paid_denied('el excedente de una factura ya saldada', 'accounting-A',
  pg_temp.paid_resolve('req-bal-over-2', 'bal-over'), 'PAYMENT_INVOICE_PAID');

-- 3 · El mismo pago reportado dos veces: sólo el primero se acredita.
do $duplicate$
begin
  perform pg_temp.paid_actor('accounting-A', pg_temp.paid_resolve('req-dup-1', 'dup-1'));
  perform pg_temp.paid_assert((pg_temp.paid_invoice('duplicate')).paid_amount = 1000,
    'el primer reporte salda la factura');
end;
$duplicate$;
select pg_temp.paid_denied('el duplicado no se acredita dos veces', 'accounting-A',
  pg_temp.paid_resolve('req-dup-2', 'dup-2'), 'PAYMENT_INVOICE_PAID');
do $duplicate_exit$
begin
  perform pg_temp.paid_actor('accounting-A',
    pg_temp.paid_resolve('req-dup-2-reject', 'dup-2', 'rechazado', 'Reporte duplicado del mismo pago'));
  perform pg_temp.paid_assert((pg_temp.paid_report('dup-2')).status = 'rechazado'
    and (pg_temp.paid_invoice('duplicate')).paid_amount = 1000, 'el duplicado se rechaza y el saldo no cambia');
end;
$duplicate_exit$;

-- 4 · Replay: el recibo se busca antes de las reglas de estado. Repetir una
-- confirmación ya hecha devuelve su recibo aunque la factura quedó pagada.
do $replay$
declare v_first jsonb; v_replay jsonb; v_before jsonb;
begin
  v_first := pg_temp.paid_actor('accounting-A', pg_temp.paid_resolve('req-rp', 'rp-1'));
  perform pg_temp.paid_assert((pg_temp.paid_invoice('replay')).status = 'pagada', 'la confirmación salda la factura');
  v_before := pg_temp.paid_state();
  v_replay := pg_temp.paid_actor('accounting-A', pg_temp.paid_resolve('req-rp', 'rp-1'));
  perform pg_temp.paid_assert(v_replay = v_first || jsonb_build_object('replayed', true),
    'replay de una confirmación ya hecha devuelve el mismo recibo');
  perform pg_temp.paid_assert(pg_temp.paid_state() = v_before, 'el replay no suma ni audita otra vez');
end;
$replay$;
select pg_temp.paid_denied('otra clave sobre el reporte ya confirmado sigue siendo estado', 'accounting-A',
  pg_temp.paid_resolve('req-rp-again', 'rp-1'), 'PAYMENT_STATE');

-- 5 · La cancelación guarda su motivo en el reporte, recortado igual que el
-- evento de auditoría; el recibo sigue sin texto libre.
do $cancel_reason$
declare v_result jsonb; v_replay jsonb; v_before jsonb; v_event public.entity_audit_log; v_receipt text;
begin
  v_result := pg_temp.paid_actor('portal-A',
    pg_temp.paid_cancel('req-pf-cancel', 'pf-cancel', 'F-PAGADA-TOTAL', '   Ya lo pagué por cobranza   '));
  perform pg_temp.paid_assert((v_result->>'cancelled')::boolean and v_result->>'status' = 'reportado',
    'cancelar sobre factura pagada sigue permitido');
  perform pg_temp.paid_assert((pg_temp.paid_report('pf-cancel')).resolution_reason = 'Ya lo pagué por cobranza',
    'el motivo de la cancelación queda en el reporte, recortado');
  perform pg_temp.paid_assert((pg_temp.paid_report('pf-cancel')).cancelled_by = pg_temp.fixture_id('portal-A')
    and (pg_temp.paid_report('pf-cancel')).cancelled_at is not null
    and (pg_temp.paid_report('pf-cancel')).note = 'Nota original sintética',
    'cancelación conserva actor, fecha y nota original');
  select * into strict v_event from public.entity_audit_log where id = (v_result->>'audit_event_id')::uuid;
  perform pg_temp.paid_assert(v_event.event_type = 'payment_report_cancelled'
    and v_event.reason = (pg_temp.paid_report('pf-cancel')).resolution_reason and v_event.sensitivity = 'restricted',
    'la auditoría conserva el mismo motivo');
  perform pg_temp.paid_assert(not (v_event.after_data ? 'resolution_reason') and not (v_event.payload::text ~ 'pagué'),
    'el motivo no se copia al payload de auditoría');
  select to_jsonb(c)::text into strict v_receipt from payment_private.report_commands c
    where c.request_id = pg_temp.fixture_id('req-pf-cancel');
  perform pg_temp.paid_assert(pg_catalog.strpos(v_receipt, 'pagué') = 0, 'el recibo no guarda el motivo');
  perform pg_temp.paid_assert((select count(*) from jsonb_object_keys(v_result)) = 8,
    'el resultado sigue teniendo los ocho campos que decodifica la app');
  v_before := pg_temp.paid_state();
  v_replay := pg_temp.paid_actor('portal-A',
    pg_temp.paid_cancel('req-pf-cancel', 'pf-cancel', 'F-PAGADA-TOTAL', '   Ya lo pagué por cobranza   '));
  perform pg_temp.paid_assert(v_replay = v_result || jsonb_build_object('replayed', true)
    and pg_temp.paid_state() = v_before, 'el replay de la cancelación no reescribe el motivo');
  v_result := pg_temp.paid_actor('portal-A',
    pg_temp.paid_cancel('req-ps-cancel-max', 'ps-cancel-max', 'F-PAGADA-MANUAL', repeat('m', 500)));
  perform pg_temp.paid_assert((pg_temp.paid_report('ps-cancel-max')).resolution_reason = repeat('m', 500),
    'un motivo de 500 caracteres cabe completo');
end;
$cancel_reason$;
select pg_temp.paid_denied('la API no reescribe el motivo guardado', 'accounting-A',
  format('update public.payment_reports set resolution_reason = %L where id = %L::uuid returning jsonb_build_object(''id'', id)',
    'Motivo sustituido', pg_temp.fixture_id('pf-cancel')), 'PAYMENT_COMMAND_REQUIRED', '42501');

-- 6 · Lo que exige el preflight de 0422 sigue intacto después de 0464.
do $boundary_contract$
declare v_api record;
begin
  for v_api in select * from (values
    ('public.create_portal_payment_report(uuid,uuid,text,numeric,public.payment_report_method,date,text,text)', false),
    ('public.cancel_portal_payment_report(uuid,uuid,text,text)', false),
    ('public.resolve_payment_report(uuid,uuid,public.payment_report_status,text)', false),
    ('payment_private.run_report_command(uuid,uuid,text,jsonb)', true)
  ) api(signature, is_definer) loop
    perform pg_temp.paid_assert(exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_api.signature)
        and p.prosecdef = v_api.is_definer and p.proowner = 'postgres'::regrole
        and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')),
      'owner, seguridad y ACL que exige 0422: ' || v_api.signature);
  end loop;
end;
$boundary_contract$;

do $paid_result$
begin
  raise notice 'TEST 0464 GREEN: % aserciones; factura pagada, excedente, duplicado, replay, motivo y frontera 0422',
    (select last_value from pg_temp.paid_assertions);
end;
$paid_result$;
rollback;
