-- Casos de una sola sesión del contrato de la 0537 (SDD-0630). NO es un
-- *.test.sql: no corre solo. Lo ejecutan, sobre una base que ya tiene el fixture
-- del contrato 0533 (modo fixture_only) y la 0537 aplicada, como superusuario:
--   · supabase/tests/0537_recibo_al_confirmar_reporte.test.sql (Postgres 17 del
--     runner, por dblink, en su base propia y desechable);
--   · lib/portal/__tests__/payment-report-receipt.migration.test.ts (PGlite).
-- Datos inventados: montos redondos, códigos F-0630-*, ningún cliente real.
-- Cada caso que se rechaza compara el estado completo antes y después.

create schema r0537;
create sequence r0537.aserciones;
create function r0537.id(p text) returns uuid language sql immutable as $$ select md5('0421-synthetic-' || p)::uuid $$;
create function r0537.cid(p text) returns uuid language sql immutable as $$ select md5('0630-synthetic-' || p)::uuid $$;
create function r0537.ok(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST0537: %', p_msg; end if;
  perform nextval('r0537.aserciones');
end;
$$;
-- Ejecuta p_sql como un usuario autenticado del fixture (auth.uid por claim).
create function r0537.como(p_actor text, p_sql text, p_rol text default 'authenticated') returns jsonb
language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(r0537.id(p_actor)::text, ''), true);
  execute format('set local role %I', p_rol);
  execute p_sql into v;
  reset role;
  return v;
exception when others then reset role; raise;
end;
$$;
create function r0537.estado() returns jsonb language sql as $$
  select jsonb_build_object(
    'reports', (select jsonb_agg(to_jsonb(t) order by id) from public.payment_reports t),
    'receipts', (select jsonb_agg(to_jsonb(t) order by id) from public.payment_receipts t),
    'invoices', (select jsonb_agg(to_jsonb(t) order by id) from public.invoices t),
    'commands', (select jsonb_agg(to_jsonb(t) order by request_id) from payment_private.report_commands t),
    'audit', (select count(*) from public.entity_audit_log))
$$;
create function r0537.rechazo(p_caso text, p_actor text, p_sql text, p_msg text, p_estado text, p_rol text default 'authenticated')
returns void language plpgsql as $$
declare v_antes jsonb := r0537.estado(); v_code text; v_text text; v_rechazado boolean := false;
begin
  begin
    perform r0537.como(p_actor, p_sql, p_rol);
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate, v_text = message_text;
    if v_code <> p_estado or (p_msg is not null and v_text <> p_msg) then
      raise exception 'TEST0537: % esperaba % %, obtuvo % %', p_caso, p_estado, p_msg, v_code, v_text;
    end if;
    v_rechazado := true;
  end;
  perform r0537.ok(v_rechazado, p_caso || ': tenía que rechazarse');
  perform r0537.ok(r0537.estado() = v_antes, p_caso || ': el rechazo no puede dejar efectos');
end;
$$;
create function r0537.confirmar(p_req text, p_rep text, p_cash uuid, p_motivo text default 'Pago verificado en el banco')
returns text language sql as $$
  select format('select public.confirm_payment_report_with_receipt(%L, %L, %L, %L)',
    r0537.cid(p_req), r0537.cid(p_rep), p_cash, p_motivo)
$$;
create function r0537.recibos(p_inv text) returns bigint language sql as $$
  select count(*) from public.payment_receipts where invoice_id = r0537.cid(p_inv) and deleted_at is null
$$;
create function r0537.pagado(p_inv text) returns numeric language sql as $$
  select paid_amount from public.invoices where id = r0537.cid(p_inv)
$$;

-- ── Semilla ─────────────────────────────────────────────────
-- Cuentas: la de caja del fixture 0533 (1.1.1.1), una de banco por qbo_type,
-- un grupo no postable, una de gasto y una de caja de otro tenant.
insert into public.accounts (id, tenant_id, code, name, type, qbo_type, is_postable) values
  (r0537.cid('banco'), r0537.id('tenant-A'), '1.9.97', 'Banco sintético por tipo', 'A', 'Bank', true),
  (r0537.cid('grupo'), r0537.id('tenant-A'), '1.1.1.97', 'Grupo sintético', 'A', null, false),
  (r0537.cid('caja-B'), r0537.id('tenant-B'), '1.1.1.98', 'Caja sintética B', 'A', null, true);
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name,
  base_amount, total_amount, paid_amount, status, currency)
select r0537.cid(v.f), r0537.id('tenant-A'), v.code, 'DUP', 'synthetic', 1000, 1000, 0, 'emitida', 'USD'
from (values ('inv-a', 'F-0630-A'), ('inv-b', 'F-0630-B'), ('inv-c', 'F-0630-C'), ('inv-d', 'F-0630-D')) v(f, code);
insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox,
  amount, currency, method, paid_at, note, proof_path)
select r0537.cid(v.r), r0537.id('tenant-A'), r0537.cid(v.f), v.code, 'DUP', v.monto, 'USD',
  v.metodo::public.payment_report_method, current_date - 2, 'Nota sintética', 'sintetico/' || v.r || '.pdf'
from (values
  ('rep-a1', 'inv-a', 'F-0630-A', 600, 'transferencia'), ('rep-a2', 'inv-a', 'F-0630-A', 300, 'zelle'),
  ('rep-a3', 'inv-a', 'F-0630-A', 500, 'pago_movil'),
  ('rep-b1', 'inv-b', 'F-0630-B', 1000, 'binance'), ('rep-b2', 'inv-b', 'F-0630-B', 50, 'otro'),
  ('rep-c1', 'inv-c', 'F-0630-C', 100, 'transferencia'),
  ('rep-d1', 'inv-d', 'F-0630-D', 200, 'transferencia')
) v(r, f, code, monto, metodo);

do $casos$
declare
  v_caja uuid := md5('0533-synthetic-cash')::uuid;
  v_gasto uuid := md5('0533-synthetic-expense-account')::uuid;
  v jsonb;
  v2 jsonb;
  v_rec public.payment_receipts;
  v_antes jsonb;
  v_audit bigint;
begin
  -- 1. Confirmación feliz: recibo, saldo, vínculo, comando y auditoría.
  v_audit := (select count(*) from public.entity_audit_log);
  v := r0537.como('accounting-A', r0537.confirmar('req-a1', 'rep-a1', v_caja));
  perform r0537.ok(v ->> 'status' = 'confirmado' and (v ->> 'replayed')::boolean = false
    and v ->> 'report_id' = r0537.cid('rep-a1')::text, 'confirmar devuelve el reporte confirmado: ' || (v)::text);
  select * into v_rec from public.payment_receipts where payment_report_id = r0537.cid('rep-a1');
  perform r0537.ok(v_rec.id is not null, 'confirmar crea un recibo vinculado al reporte');
  perform r0537.ok(v -> 'receipt' ->> 'id' = v_rec.id::text and v -> 'receipt' ->> 'code' = v_rec.receipt_code,
    'el resultado trae el recibo creado: ' || (v)::text);
  perform r0537.ok(v_rec.receipt_code ~ '^R-\d{4}-\d+$', 'correlativo R- de next_receipt_code: ' || v_rec.receipt_code);
  perform r0537.ok(v_rec.invoice_id = r0537.cid('inv-a') and v_rec.amount = 600 and v_rec.currency = 'USD'
    and v_rec.cash_account_id = v_caja and v_rec.method = 'transferencia'
    and v_rec.received_at = current_date - 2 and v_rec.application_status = 'aplicado'
    and v_rec.fund_class = 'third_party' and v_rec.payer_kind = 'cliente' and v_rec.deleted_at is null,
    'recibo con factura, monto, moneda, cuenta, método, fecha del reporte, aplicado y fund_class: ' || (to_jsonb(v_rec))::text);
  perform r0537.ok(r0537.pagado('inv-a') = 600
    and (select status from public.invoices where id = r0537.cid('inv-a')) = 'parcial'
    and (select last_payment_at from public.invoices where id = r0537.cid('inv-a')) is not null,
    'la factura sube 600 y queda parcial, una sola vez');
  perform r0537.ok(r0537.recibos('inv-a') = 1, 'un solo recibo para la factura');
  perform r0537.ok((select status from public.payment_reports where id = r0537.cid('rep-a1')) = 'confirmado',
    'el reporte queda confirmado');
  perform r0537.ok((v -> 'receipt' ->> 'paid_amount')::numeric = 600 and v -> 'receipt' ->> 'invoice_status' = 'parcial'
    and (v -> 'receipt' ->> 'fully_paid')::boolean = false and v -> 'receipt' ->> 'cash_account_id' = v_caja::text,
    'el resultado trae saldo y estado de la factura: ' || (v)::text);
  perform r0537.ok(exists (select 1 from payment_private.report_commands
    where request_id = r0537.cid('req-a1') and verb = 'confirm' and result = v), 'el comando guarda el resultado con el recibo');
  perform r0537.ok(exists (select 1 from public.entity_audit_log t
      where t.entity_id = r0537.cid('rep-a1') and t.event_type = 'payment_report_confirmed'
        and to_jsonb(t)::text like '%"related_receipt_id": "' || v_rec.id || '"%'),
    'la constancia de la confirmación nombra el recibo');
  perform r0537.ok(exists (select 1 from public.entity_audit_log t
      where t.entity_id = v_rec.id and t.event_type = 'payment_registered'),
    'el recibo tiene su evento D2 payment_registered');
  perform r0537.ok(not exists (select 1 from public.entity_audit_log t
      where t.entity_id = v_rec.id and t.event_type not in ('payment_registered')),
    'fijar el vínculo no agrega eventos D2 al recibo');

  -- 2. Reintento con la misma clave y los mismos datos: el MISMO recibo, nada nuevo.
  v_antes := r0537.estado();
  v2 := r0537.como('accounting-A', r0537.confirmar('req-a1', 'rep-a1', v_caja));
  perform r0537.ok((v2 ->> 'replayed')::boolean and v2 -> 'receipt' = v -> 'receipt',
    'el reintento devuelve el mismo recibo: ' || (v2)::text);
  perform r0537.ok(r0537.estado() = v_antes, 'el reintento no crea ni cambia nada');
  -- Otro miembro con permiso y la misma clave: conflicto, no replay ajeno.
  perform r0537.rechazo('misma clave, otro actor', 'admin-A', r0537.confirmar('req-a1', 'rep-a1', v_caja),
    'PAYMENT_REQUEST_CONFLICT', '23505');
  -- Misma clave con otra cuenta: conflicto, no un segundo recibo.
  perform r0537.rechazo('misma clave, otra cuenta', 'accounting-A', r0537.confirmar('req-a1', 'rep-a1', r0537.cid('banco')),
    'PAYMENT_REQUEST_CONFLICT', '23505');
  -- Clave nueva sobre el reporte ya confirmado.
  perform r0537.rechazo('reporte ya confirmado', 'accounting-A', r0537.confirmar('req-a1-bis', 'rep-a1', v_caja),
    'PAYMENT_STATE', '23514');

  -- 3. Rechazo: ni recibo ni saldo.
  v := r0537.como('accounting-A', format('select public.resolve_payment_report(%L, %L, ''rechazado'', %L)',
    r0537.cid('req-a2'), r0537.cid('rep-a2'), 'No coincide con el banco'));
  perform r0537.ok(v ->> 'status' = 'rechazado' and not v ? 'receipt', 'rechazar no devuelve recibo: ' || (v)::text);
  perform r0537.ok(r0537.recibos('inv-a') = 1 and r0537.pagado('inv-a') = 600
    and not exists (select 1 from public.payment_receipts where payment_report_id = r0537.cid('rep-a2')),
    'rechazar no crea recibo ni toca el saldo');
  -- Rechazar con una cuenta en el input no está permitido.
  perform r0537.rechazo('rechazo con cuenta', 'accounting-A', format(
    'select payment_private.run_report_command(%L, %L, ''reject'', %L)', r0537.cid('req-a2-cash'), r0537.cid('rep-a3'),
    jsonb_build_object('reason', 'Motivo sintético', 'cash_account_id', v_caja)), 'PAYMENT_INPUT', '22023');

  -- 4. Tope de saldo de la 0464, con la misma regla de Cobranzas.
  perform r0537.rechazo('excede el saldo', 'accounting-A', r0537.confirmar('req-a3', 'rep-a3', v_caja),
    'PAYMENT_EXCEEDS_BALANCE', '23514');

  -- 5. Pago completo por banco (qbo_type Bank) con método binance → usdt.
  v := r0537.como('admin-A', r0537.confirmar('req-b1', 'rep-b1', r0537.cid('banco')));
  select * into v_rec from public.payment_receipts where payment_report_id = r0537.cid('rep-b1');
  perform r0537.ok(v_rec.method = 'usdt' and v_rec.cash_account_id = r0537.cid('banco') and v_rec.amount = 1000,
    'binance entra como usdt a la cuenta de banco: ' || (to_jsonb(v_rec))::text);
  perform r0537.ok((select status from public.invoices where id = r0537.cid('inv-b')) = 'pagada'
    and r0537.pagado('inv-b') = 1000 and (v -> 'receipt' ->> 'fully_paid')::boolean,
    'el reporte que salda la factura la deja pagada');
  perform r0537.rechazo('factura ya pagada', 'accounting-A', r0537.confirmar('req-b2', 'rep-b2', v_caja),
    'PAYMENT_INVOICE_PAID', '23514');

  -- 6. Sin cuenta válida no se confirma (y nada cambia).
  perform r0537.rechazo('wrapper heredado sin cuenta', 'accounting-A', format(
    'select public.resolve_payment_report(%L, %L, ''confirmado'', %L)', r0537.cid('req-c1-legacy'), r0537.cid('rep-c1'),
    'Pago verificado en el banco'), 'PAYMENT_CASH_ACCOUNT', '22023');
  perform r0537.rechazo('cuenta nula', 'accounting-A', r0537.confirmar('req-c1-null', 'rep-c1', null),
    'PAYMENT_CASH_ACCOUNT', '22023');
  perform r0537.rechazo('cuenta mal formada', 'accounting-A', format(
    'select payment_private.run_report_command(%L, %L, ''confirm'', %L)', r0537.cid('req-c1-bad'), r0537.cid('rep-c1'),
    jsonb_build_object('reason', 'Motivo sintético', 'cash_account_id', 'no-es-uuid')), 'PAYMENT_CASH_ACCOUNT', '22023');
  perform r0537.rechazo('cuenta de gasto', 'accounting-A', r0537.confirmar('req-c1-gasto', 'rep-c1', v_gasto),
    'PAYMENT_CASH_ACCOUNT', '22023');
  perform r0537.rechazo('cuenta no postable', 'accounting-A', r0537.confirmar('req-c1-grupo', 'rep-c1', r0537.cid('grupo')),
    'PAYMENT_CASH_ACCOUNT', '22023');
  perform r0537.rechazo('cuenta de otro tenant', 'accounting-A', r0537.confirmar('req-c1-B', 'rep-c1', r0537.cid('caja-B')),
    'PAYMENT_CASH_ACCOUNT', '22023');
  perform r0537.rechazo('cuenta inexistente', 'accounting-A', r0537.confirmar('req-c1-x', 'rep-c1', r0537.cid('no-existe')),
    'PAYMENT_CASH_ACCOUNT', '22023');

  -- 7. Permisos: sólo accounting/admin activos del tenant.
  perform r0537.rechazo('marketing', 'marketing-A', r0537.confirmar('req-c1-mk', 'rep-c1', v_caja), 'PAYMENT_FORBIDDEN', '42501');
  perform r0537.rechazo('membresía deshabilitada', 'disabled-A', r0537.confirmar('req-c1-dis', 'rep-c1', v_caja), 'PAYMENT_FORBIDDEN', '42501');
  perform r0537.rechazo('cliente del portal', 'portal-A', r0537.confirmar('req-c1-portal', 'rep-c1', v_caja), 'PAYMENT_FORBIDDEN', '42501');
  perform r0537.rechazo('otro tenant', 'accounting-B', r0537.confirmar('req-c1-B2', 'rep-c1', r0537.cid('caja-B')), 'PAYMENT_NOT_FOUND', 'P0002');
  perform r0537.rechazo('anon sin EXECUTE', 'accounting-A', r0537.confirmar('req-c1-anon', 'rep-c1', v_caja), null, '42501', 'anon');
  perform r0537.ok(not has_function_privilege('anon', 'public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text)', 'EXECUTE'),
    'EXECUTE del wrapper sólo para authenticated');

  -- 8. Cobranzas después: el saldo ya incluye el reporte, no hay doble conteo.
  perform r0537.rechazo('Cobranzas no recobra lo confirmado', 'accounting-A', format(
    'select public.register_collection_receipt(%L, 401, %L, ''transferencia'', current_date, null, null, ''cliente'', null, null, false)',
    r0537.cid('inv-a'), v_caja), 'PAYMENT_EXCEEDS_BALANCE', '23514');
  v := r0537.como('accounting-A', format(
    'select public.register_collection_receipt(%L, 400, %L, ''transferencia'', current_date, null, null, ''cliente'', null, null, false)',
    r0537.cid('inv-a'), v_caja));
  perform r0537.ok(r0537.pagado('inv-a') = 1000
    and r0537.pagado('inv-a') = (select sum(amount) from public.payment_receipts where invoice_id = r0537.cid('inv-a') and deleted_at is null),
    'pagado = suma de recibos vigentes, sin doble conteo');
  perform r0537.ok(not exists (select 1 from public.payment_receipts where id = (v ->> 'receipt_id')::uuid and payment_report_id is not null),
    'el cobro de Cobranzas no lleva vínculo a un reporte');

  -- 9. El vínculo no se falsifica desde la API ni se reescribe. Sobre el recibo
  -- de Cobranzas recién creado, que no tiene vínculo.
  perform r0537.rechazo('API fija el vínculo', 'accounting-A', format(
    'with u as (update public.payment_receipts set payment_report_id = %L where id = %L returning 1) select to_jsonb(count(*)) from u',
    r0537.cid('rep-c1'), v ->> 'receipt_id'), 'PAYMENT_RECEIPT_REPORT_LINK', '42501');
  perform r0537.rechazo('API inserta un recibo con vínculo', 'accounting-A', format(
    'with u as (insert into public.payment_receipts (tenant_id, receipt_code, invoice_id, client_markbox, client_name, amount, currency, method, cash_account_id, received_at, application_status, fund_class, payment_report_id) values (%L, ''R-FALSO-1'', %L, ''DUP'', ''synthetic'', 1, ''USD'', ''transferencia'', %L, current_date, ''aplicado'', ''third_party'', %L) returning 1) select to_jsonb(count(*)) from u',
    r0537.id('tenant-A'), r0537.cid('inv-d'), v_caja, r0537.cid('rep-a1')), 'PAYMENT_RECEIPT_REPORT_LINK', '42501');
  perform r0537.rechazo('API cambia el vínculo', 'accounting-A', format(
    'with u as (update public.payment_receipts set payment_report_id = %L where payment_report_id = %L returning 1) select to_jsonb(count(*)) from u',
    r0537.cid('rep-a2'), r0537.cid('rep-a1')), 'PAYMENT_RECEIPT_REPORT_LINK', '42501');
  v_antes := r0537.estado();
  begin
    update public.payment_receipts set payment_report_id = null where payment_report_id = r0537.cid('rep-a1');
    raise exception 'TEST0537: el owner pudo borrar el vínculo';
  exception when insufficient_privilege then null;
  end;
  begin
    -- Ni el owner vincula un reporte que no está confirmado.
    update public.payment_receipts set payment_report_id = r0537.cid('rep-c1') where id = (v ->> 'receipt_id')::uuid;
    raise exception 'TEST0537: se vinculó un reporte no confirmado';
  exception when check_violation then null;
  end;
  perform r0537.ok(r0537.estado() = v_antes, 'los intentos de reescribir el vínculo no dejan efectos');

  -- 10. La confirmación válida que quedó pendiente pasa después de todos los rechazos.
  v := r0537.como('accounting-A', r0537.confirmar('req-c1', 'rep-c1', v_caja));
  perform r0537.ok(v ->> 'status' = 'confirmado' and r0537.recibos('inv-c') = 1 and r0537.pagado('inv-c') = 100,
    'la confirmación válida de rep-c1 crea su recibo');

  -- Invariante global de las facturas de este contrato.
  perform r0537.ok(not exists (select 1 from public.invoices i where i.client_markbox = 'DUP' and i.invoice_code like 'F-0630-%'
    and i.paid_amount <> coalesce((select sum(r.amount) from public.payment_receipts r where r.invoice_id = i.id and r.deleted_at is null), 0)),
    'en toda factura del contrato, pagado = suma de recibos');
  perform r0537.ok(not exists (select 1 from public.payment_reports p where p.status = 'confirmado' and p.invoice_code like 'F-0630-%'
    and not exists (select 1 from public.payment_receipts r where r.payment_report_id = p.id)),
    'todo reporte confirmado del contrato tiene recibo');
end;
$casos$;

select 'TEST0537 casos OK: ' || (select last_value from r0537.aserciones) || ' aserciones' as resultado;
