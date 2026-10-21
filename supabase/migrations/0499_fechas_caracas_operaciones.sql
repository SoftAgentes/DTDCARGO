-- 0499 · SDD-0576/C1 · MIGRATE-FIRST. Requiere OK nominal; no aplicada.
-- Ejecutar en UNA transacción. Cambia solo el calendario de operaciones nuevas.
-- Sin backfill: fecha explícita y timestamps de auditoría conservados.
-- Copias completas vigentes de 0467/0468/0340/0464/0128; ACL/OID/owner intactos.
-- ALTER DEFAULT toma ACCESS EXCLUSIVE en cuatro tablas hasta COMMIT, sin reescribir filas.
-- No cambia zona global, policies, correlativos, dinero, hashes ni evidencia.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare e record; p record; v_default text;
begin
  for e in select * from (values
    ('public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)', false, 'jsonb', 'search_path=""', 'authenticated', '914de5ae5032ef17cd79597867ecf219', '9e55a9704f735d22025f54a0c54ab37b'),
    ('public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)', false, 'jsonb', 'search_path=""', 'authenticated', '65d6c9a18b58a0dabafd6de0b03af325', '3f58ebaca513f4895b6ca78a68005dcd'),
    ('public.void_expense_governed(uuid,text,text)', true, 'text', 'search_path=""', 'authenticated', '3c9549caee90fd09812b3de2c97fbe66', 'e71482957075975e0f8a63c03bd07656'),
    ('payment_private.run_report_command(uuid,uuid,text,jsonb)', true, 'jsonb', 'search_path=""', 'authenticated', 'c3aab7fcb10e3bf5de0fa40cc562a45d', 'beabd00d916b142917d95015fe570ed5'),
    ('public.sales_order_claim_and_invoice(uuid,uuid)', true, 'jsonb', 'search_path=public', 'service_role', '2ce6c314ec6b907868af50e604ea5f1a', '8dfdd6e6ce6b2d7fb08317ff166fd9b5')
  ) x(signature, definer, returns, config, role_name, body_md5, normalized_md5) loop
    select * into p from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure(e.signature);
    if p.oid is null or p.proowner <> 'postgres'::regrole or p.prosecdef <> e.definer
       or p.prorettype <> pg_catalog.to_regtype(e.returns) or p.provolatile <> 'v'
       or p.proconfig is distinct from array[e.config]::text[]
       or not pg_catalog.has_function_privilege(e.role_name, p.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege(case e.role_name when 'authenticated' then 'service_role' else 'authenticated' end, p.oid, 'EXECUTE')
       or exists(select 1 from pg_catalog.aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE') then
      raise exception '0499: firma, seguridad, owner o ACL inesperada: %', e.signature;
    end if;
    if pg_catalog.md5(pg_catalog.replace(p.prosrc,E'\r\n',E'\n')) <> e.body_md5
       and pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc,'\s','','g')) <> e.normalized_md5 then
      raise exception '0499: cuerpo previo inesperado o reaplicación: %', e.signature;
    end if;
  end loop;
  for e in select * from (values ('journal_entries','entry_date'),('payment_receipts','received_at'),('supplier_bills','issue_date'),('supplier_payments','paid_at')) x(rel,col) loop
    select pg_catalog.pg_get_expr(d.adbin,d.adrelid) into v_default
    from pg_catalog.pg_attribute a join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=pg_catalog.to_regclass('public.'||e.rel) and a.attname=e.col
      and a.atttypid='date'::regtype and a.attnotnull and not a.attisdropped;
    if v_default is distinct from 'CURRENT_DATE' then raise exception '0499: default previo inesperado: %.%',e.rel,e.col; end if;
  end loop;
  if pg_catalog.to_regprocedure('public.get_accounting_closing_date(uuid)') is null
     or not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.journal_entries'::regclass
       and tgfoid='public.journal_entries_validate_closing()'::regprocedure and tgenabled='O' and not tgisinternal)
     or not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.journal_entries'::regclass
       and tgname='audit_d2_journal_entries' and tgenabled='O' and not tgisinternal) then
    raise exception '0499: cierre o auditoría de asientos ausente';
  end if;
end;
$preflight$;

create temporary table caracas_0499_before on commit drop as
select oid,proowner,proacl,prosecdef,proconfig,prorettype,proargtypes,proargnames,provolatile
from pg_catalog.pg_proc where oid in ('public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)'::regprocedure,'public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)'::regprocedure,'public.void_expense_governed(uuid,text,text)'::regprocedure,'payment_private.run_report_command(uuid,uuid,text,jsonb)'::regprocedure,'public.sales_order_claim_and_invoice(uuid,uuid)'::regprocedure);

-- El comienzo de la sentencia es una sola ancla aun si una fila espera un lock.
alter table public.journal_entries alter column entry_date set default (pg_catalog.statement_timestamp() at time zone 'America/Caracas')::date;
alter table public.payment_receipts alter column received_at set default (pg_catalog.statement_timestamp() at time zone 'America/Caracas')::date;
alter table public.supplier_bills alter column issue_date set default (pg_catalog.statement_timestamp() at time zone 'America/Caracas')::date;
alter table public.supplier_payments alter column paid_at set default (pg_catalog.statement_timestamp() at time zone 'America/Caracas')::date;

-- Fuente íntegra: 0467_cobro_factura_atomico.sql; delta temporal acotado.
create or replace function public.register_collection_receipt(
  p_invoice_id uuid,
  p_amount numeric,
  p_cash_account_id uuid,
  p_method text,
  p_received_at date,
  p_reference text,
  p_notes text,
  p_payer_kind text,
  p_payer_name text,
  p_payer_relation text,
  p_licit_declared boolean
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_business_day date := (pg_catalog.clock_timestamp() at time zone 'America/Caracas')::date;
  v_tenant uuid := public.get_user_tenant_id();
  v_inv public.invoices%rowtype;
  v_code text;
  v_receipt_id uuid;
  v_new_paid numeric(14,2);
  v_new_status public.invoice_status;
begin
  if not exists (select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and ut.role in ('admin', 'accounting')) then
    raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_invoice_id is null or p_cash_account_id is null or p_amount is null
     or p_amount <= 0 or pg_catalog.round(p_amount, 2) <> p_amount then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;

  -- La factura se toma FOR UPDATE antes de leer su saldo: otro cobro, una
  -- confirmación de reporte (0421) o una anulación esperan a este COMMIT y
  -- después leen el pagado que dejó.
  select i.* into v_inv from public.invoices i
  where i.id = p_invoice_id and i.tenant_id = v_tenant
  for update;
  if not found then
    raise exception 'PAYMENT_INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_inv.deleted_at is not null or v_inv.status in ('borrador', 'anulada') then
    raise exception 'PAYMENT_STATE' using errcode = '23514';
  end if;
  if v_inv.status = 'pagada' then
    raise exception 'PAYMENT_INVOICE_PAID' using errcode = '23514';
  end if;
  if p_amount > v_inv.total_amount - v_inv.paid_amount then
    raise exception 'PAYMENT_EXCEEDS_BALANCE' using errcode = '23514';
  end if;

  -- next_receipt_code (0079) calcula max+1 sin lock: el lock consultivo del
  -- tenant, hasta el COMMIT, evita que dos cobros saquen el mismo código.
  perform pg_catalog.pg_advisory_xact_lock(488, pg_catalog.hashtext(v_tenant::text));
  v_code := public.next_receipt_code(v_tenant);

  insert into public.payment_receipts (
    tenant_id, receipt_code, invoice_id, client_markbox, client_name, amount, currency, fx_rate,
    method, cash_account_id, reference, received_at, notes, payer_kind, payer_name, payer_relation,
    licit_declared, application_status, fund_class
  ) values (
    v_tenant, v_code, v_inv.id, v_inv.client_markbox, v_inv.client_name, p_amount, v_inv.currency,
    v_inv.fx_rate, coalesce(p_method, 'transferencia'), p_cash_account_id, p_reference,
    coalesce(p_received_at, v_business_day), p_notes, coalesce(p_payer_kind, 'cliente'), p_payer_name,
    p_payer_relation, coalesce(p_licit_declared, false), 'aplicado',
    case when v_inv.fund_class = 'local_revenue' then 'local_revenue' else 'third_party' end
  )
  returning id into v_receipt_id;

  v_new_paid := v_inv.paid_amount + p_amount;
  v_new_status := case when v_new_paid >= v_inv.total_amount then 'pagada' else 'parcial' end;
  update public.invoices
  set paid_amount = v_new_paid, status = v_new_status, last_payment_at = pg_catalog.clock_timestamp()
  where id = v_inv.id;

  return pg_catalog.jsonb_build_object(
    'receipt_id', v_receipt_id, 'receipt_code', v_code, 'tenant_id', v_tenant,
    'invoice_id', v_inv.id, 'invoice_code', v_inv.invoice_code, 'currency', v_inv.currency,
    'fx_rate', v_inv.fx_rate, 'amount', p_amount, 'paid_amount', v_new_paid,
    'total_amount', v_inv.total_amount, 'status', v_new_status,
    'fully_paid', v_new_status = 'pagada');
end;
$function$;

-- Fuente íntegra: 0468_pago_proveedor_atomico.sql; delta temporal acotado.
create or replace function public.register_supplier_payment_order(
  p_bill_id uuid,
  p_amount numeric,
  p_cash_account_id uuid,
  p_method text,
  p_paid_at date,
  p_reference text,
  p_notes text
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_business_day date := (pg_catalog.clock_timestamp() at time zone 'America/Caracas')::date;
  v_tenant uuid := public.get_user_tenant_id();
  v_bill public.supplier_bills%rowtype;
  v_code text;
  v_payment_id uuid;
  v_new_paid numeric(14,2);
  v_new_status text;
begin
  if not exists (select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and ut.role in ('admin', 'accounting')) then
    raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_bill_id is null or p_cash_account_id is null or p_amount is null
     or p_amount <= 0 or pg_catalog.round(p_amount, 2) <> p_amount then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;

  -- La CxP se toma FOR UPDATE antes de leer su saldo: otro pago, una
  -- anulación de orden o la anulación de la CxP esperan a este COMMIT y
  -- después leen el pagado que dejó.
  select b.* into v_bill from public.supplier_bills b
  where b.id = p_bill_id and b.tenant_id = v_tenant
  for update;
  if not found then
    raise exception 'PAYMENT_BILL_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Los mismos estados que rechazaba la app: anulada y pagada.
  if v_bill.deleted_at is not null or v_bill.status = 'anulada' then
    raise exception 'PAYMENT_STATE' using errcode = '23514';
  end if;
  if v_bill.status = 'pagada' then
    raise exception 'PAYMENT_BILL_PAID' using errcode = '23514';
  end if;
  if p_amount > v_bill.total_amount - v_bill.paid_amount then
    raise exception 'PAYMENT_EXCEEDS_BALANCE' using errcode = '23514';
  end if;

  -- next_payment_order_code (0088) calcula max+1 sin lock: el lock consultivo
  -- del tenant, hasta el COMMIT, evita que dos pagos saquen el mismo código.
  perform pg_catalog.pg_advisory_xact_lock(489, pg_catalog.hashtext(v_tenant::text));
  v_code := public.next_payment_order_code(v_tenant);

  -- La orden hereda de la CxP el proveedor, la moneda y el fx_rate (una orden
  -- por CxP en el MVP, SDD-0044).
  insert into public.supplier_payments (
    tenant_id, payment_code, bill_id, supplier_id, supplier_name, amount, currency, fx_rate,
    method, cash_account_id, reference, paid_at, notes
  ) values (
    v_tenant, v_code, v_bill.id, v_bill.supplier_id, v_bill.supplier_name, p_amount, v_bill.currency,
    v_bill.fx_rate, coalesce(p_method, 'transferencia'), p_cash_account_id, p_reference,
    coalesce(p_paid_at, v_business_day), p_notes
  )
  returning id into v_payment_id;

  v_new_paid := v_bill.paid_amount + p_amount;
  v_new_status := case when v_new_paid >= v_bill.total_amount then 'pagada' else 'parcial' end;
  update public.supplier_bills set paid_amount = v_new_paid, status = v_new_status where id = v_bill.id;

  return pg_catalog.jsonb_build_object(
    'payment_id', v_payment_id, 'payment_code', v_code, 'tenant_id', v_tenant,
    'bill_id', v_bill.id, 'bill_code', v_bill.bill_code, 'currency', v_bill.currency,
    'fx_rate', v_bill.fx_rate, 'amount', p_amount, 'paid_amount', v_new_paid,
    'total_amount', v_bill.total_amount, 'status', v_new_status,
    'fully_paid', v_new_status = 'pagada');
end;
$function$;

-- Fuente íntegra: 0340_expense_void_governance.sql; delta temporal acotado.
create or replace function public.void_expense_governed(
  p_expense_id uuid,
  p_reason text,
  p_request_ref text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_expense public.expenses%rowtype;
  v_journal public.journal_entries%rowtype;
  v_correlation text;
  v_closing_date date;
begin
  if v_actor is null then
    raise exception 'expenses: autenticación requerida' using errcode = '42501';
  end if;
  if p_expense_id is null then
    raise exception 'expenses: identificador inválido' using errcode = '22023';
  end if;
  if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'expenses: motivo inválido' using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'expenses: referencia inválida' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('expense-void:' || v_request_ref, 243)
  );

  select e.* into v_expense
  from public.expenses e
  join public.user_tenants ut
    on ut.tenant_id = e.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('accounting', 'admin')
   and ut.disabled_at is null
  where e.id = p_expense_id
  for update of e;

  if not found then
    raise exception 'expenses: gasto no disponible' using errcode = 'P0002';
  end if;

  if v_expense.deleted_at is not null then
    if exists (
      select 1
      from public.entity_audit_log l
      where l.tenant_id = v_expense.tenant_id
        and l.entity_type = 'expense'
        and l.entity_id = v_expense.id
        and l.event_type = 'expense_voided'
        and l.payload ->> 'request_ref' = v_request_ref
    ) then
      return 'replayed';
    end if;
    raise exception 'expenses: el gasto ya fue anulado' using errcode = '40001';
  end if;

  v_closing_date := public.get_accounting_closing_date(v_expense.tenant_id);
  if v_closing_date is not null
     and (v_expense.occurred_at at time zone 'America/Caracas')::date <= v_closing_date then
    raise exception 'expenses: período contable cerrado' using errcode = '23514';
  end if;

  select j.* into v_journal
  from public.journal_entries j
  where j.tenant_id = v_expense.tenant_id
    and j.expense_id = v_expense.id
    and j.status = 'asentado'
    and j.deleted_at is null
  order by j.id
  limit 1
  for update;

  if found and v_closing_date is not null and v_journal.entry_date <= v_closing_date then
    raise exception 'expenses: período contable cerrado' using errcode = '23514';
  end if;

  if found then
    v_correlation := pg_catalog.concat(
      'd2:journal_entries:', v_journal.id::text, ':',
      pg_catalog.txid_current()::text
    );
  else
    v_correlation := pg_catalog.concat(
      'expense:', v_expense.id::text, ':',
      pg_catalog.txid_current()::text
    );
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.expense_void', v_request_ref, true);

  update public.journal_entries
  set status = 'anulado'
  where tenant_id = v_expense.tenant_id
    and expense_id = v_expense.id
    and status = 'asentado'
    and deleted_at is null;

  update public.expenses
  set
    deleted_at = pg_catalog.statement_timestamp(),
    updated_at = pg_catalog.statement_timestamp()
  where id = v_expense.id
    and tenant_id = v_expense.tenant_id
    and deleted_at is null;
  if not found then
    raise exception 'expenses: conflicto al anular el gasto' using errcode = '40001';
  end if;

  perform public.append_audit_event(
    v_expense.tenant_id,
    'expense',
    v_expense.id,
    'user',
    v_actor,
    'expense_voided',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'expense_code', v_expense.expense_code,
      'deleted_at', v_expense.deleted_at,
      'receipt_path', v_expense.receipt_path,
      'receipt_document_id', v_expense.receipt_document_id
    ),
    pg_catalog.jsonb_build_object(
      'expense_code', v_expense.expense_code,
      'deleted_at', pg_catalog.statement_timestamp(),
      'receipt_path', v_expense.receipt_path,
      'receipt_document_id', v_expense.receipt_document_id
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'permanence', 'P3',
      'journal_entry_id', v_journal.id
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'voided';
end;
$function$;

-- Fuente íntegra: 0464_reporte_pago_factura_pagada.sql; delta temporal acotado.
create or replace function payment_private.run_report_command(
  p_request_id uuid, p_report_id uuid, p_kind text, p_input jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $function$
declare
  v_business_day date := (pg_catalog.clock_timestamp() at time zone 'America/Caracas')::date;
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_markbox text;
  v_invoice_id uuid;
  v_rep public.payment_reports;
  v_inv public.invoices;
  v_receipt payment_private.report_commands;
  v_input jsonb;
  v_hash bytea;
  v_code text;
  v_reason text;
  v_note text;
  v_proof text;
  v_amount numeric;
  v_method public.payment_report_method;
  v_paid_at date;
  v_new_paid numeric(14,2);
  v_new_status public.invoice_status;
  v_before jsonb;
  v_after jsonb;
  v_audit_id uuid;
  v_result jsonb;
  v_old_reason text := pg_catalog.current_setting('dtd.audit_reason', true);
begin
  if v_actor is null then
    raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_request_id is null or p_report_id is null or p_kind is null
     or p_kind not in ('create', 'cancel', 'confirm', 'reject')
     or p_input is null or pg_catalog.jsonb_typeof(p_input) <> 'object' then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;

  -- Autorizar antes de sondear recibos o reportes. SHARE bloquea revocaciones
  -- (también UPDATE no-key), no sólo el borrado físico de la membresía.
  if p_kind in ('create', 'cancel') then
    select cu.tenant_id, c.markbox into v_tenant, v_markbox
    from public.client_users cu join public.clients c
      on c.id = cu.client_id and c.tenant_id = cu.tenant_id
    where cu.auth_user_id = v_actor and cu.status = 'active' and c.deleted_at is null
    for share of cu, c;
    if v_tenant is null or v_markbox is null then
      raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
    end if;
  else
    v_tenant := public.get_user_tenant_id();
    perform 1 from public.user_tenants ut
    where ut.user_id = v_actor and ut.tenant_id = v_tenant
      and ut.disabled_at is null and ut.role in ('admin', 'accounting')
    for share;
    if not found then
      raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  if exists (select 1 from pg_catalog.jsonb_object_keys(p_input) as k(key)
    where not (k.key = any(case p_kind
      when 'create' then array['invoice_code', 'amount', 'method', 'paid_at', 'proof_path', 'note']
      when 'cancel' then array['invoice_code', 'reason']
      else array['reason'] end))) then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;
  v_code := pg_catalog.btrim(p_input ->> 'invoice_code');
  v_reason := nullif(pg_catalog.regexp_replace(p_input ->> 'reason', '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  if p_kind in ('create', 'cancel') and
     (v_code is null or pg_catalog.char_length(v_code) not between 1 and 80 or v_code ~ '[[:cntrl:]]') then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;
  if p_kind <> 'create' and (v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 500) then
    raise exception 'PAYMENT_REASON' using errcode = '22023';
  end if;
  if p_kind = 'create' then
    begin
      v_amount := (p_input ->> 'amount')::numeric;
      v_method := (p_input ->> 'method')::public.payment_report_method;
      v_paid_at := (p_input ->> 'paid_at')::date;
    exception when data_exception then
      raise exception 'PAYMENT_INPUT' using errcode = '22023';
    end;
    v_note := nullif(pg_catalog.regexp_replace(p_input ->> 'note', '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
    v_proof := p_input ->> 'proof_path';
    if v_amount is null or v_amount <= 0 or v_amount > 9999999.99
       or pg_catalog.round(v_amount, 2) <> v_amount or v_method is null
       or v_paid_at is null or not pg_catalog.isfinite(v_paid_at)
       or (p_input ->> 'paid_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or pg_catalog.char_length(v_note) > 500 or v_proof is null then
      raise exception 'PAYMENT_INPUT' using errcode = '22023';
    end if;
    v_input := pg_catalog.jsonb_build_object('invoice_code', v_code,
      'amount', v_amount::numeric(14,2), 'method', v_method, 'paid_at', v_paid_at,
      'proof_path', v_proof, 'note', v_note);
  elsif p_kind = 'cancel' then
    v_input := pg_catalog.jsonb_build_object('invoice_code', v_code, 'reason', v_reason);
  else
    v_input := pg_catalog.jsonb_build_object('reason', v_reason);
  end if;
  v_hash := pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'verb', p_kind, 'report_id', p_report_id, 'input', v_input)::text, 'UTF8'));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payment-command:' || p_request_id::text, 0));

  -- Todos los comandos nuevos bloquean factura ANTES de reporte. El lookup
  -- preliminar no da permiso: después de esperar se revalida toda la relación.
  if p_kind = 'create' then
    select * into v_inv from public.invoices
    where tenant_id = v_tenant and invoice_code = v_code and client_markbox = v_markbox
    for update;
  else
    select invoice_id into v_invoice_id from public.payment_reports
    where id = p_report_id and tenant_id = v_tenant
      and (p_kind <> 'cancel' or (client_markbox = v_markbox and invoice_code = v_code));
    select * into v_inv from public.invoices
    where id = v_invoice_id and tenant_id = v_tenant
      and (p_kind <> 'cancel' or (client_markbox = v_markbox and invoice_code = v_code))
    for update;
    select * into v_rep from public.payment_reports
    where id = p_report_id and tenant_id = v_tenant and invoice_id = v_inv.id
      and client_markbox = v_inv.client_markbox and invoice_code = v_inv.invoice_code
    for update;
    if v_rep.id is null then
      raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  if v_inv.id is null then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_receipt from payment_private.report_commands where request_id = p_request_id;
  if found then
    if v_receipt.actor_id <> v_actor or v_receipt.tenant_id <> v_tenant
       or v_receipt.report_id <> p_report_id or v_receipt.verb <> p_kind or v_receipt.input_hash <> v_hash then
      raise exception 'PAYMENT_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return v_receipt.result || pg_catalog.jsonb_build_object('replayed', true);
  end if;
  -- La frescura solo gobierna CREACIÓN nueva; el replay idéntico y autorizado
  -- ya retornó. El ancla se capturó antes de autorización y locks.
  if p_kind = 'create' and v_paid_at > v_business_day then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;
  if v_inv.deleted_at is not null or v_inv.status in ('borrador', 'anulada') then
    raise exception 'PAYMENT_STATE' using errcode = '23514';
  end if;
  if p_kind <> 'create' and
     (v_rep.deleted_at is not null or v_rep.status <> 'reportado' or v_rep.cancelled_at is not null) then
    raise exception 'PAYMENT_STATE' using errcode = '23514';
  end if;
  if p_kind in ('confirm', 'reject') and v_rep.currency <> v_inv.currency then
    raise exception 'PAYMENT_CURRENCY' using errcode = '23514';
  end if;
  -- SDD-0484 · decisión de Sam: confirmar nunca deja pagado > total. La factura
  -- ya está bloqueada FOR UPDATE: dos confirmaciones concurrentes se serializan
  -- y la segunda compara contra el pagado de la primera. Rechazar y cancelar
  -- siguen disponibles para cerrar el reporte sin tocar el saldo.
  if p_kind = 'confirm' and v_inv.status = 'pagada' then
    raise exception 'PAYMENT_INVOICE_PAID' using errcode = '23514';
  end if;
  if p_kind = 'confirm'
     and v_rep.amount > v_inv.total_amount - coalesce(v_inv.paid_amount, 0) then
    raise exception 'PAYMENT_EXCEEDS_BALANCE' using errcode = '23514';
  end if;

  -- 0294 prioriza este contexto sobre p_reason. Sellarlo impide suplantar el
  -- motivo con un GUC previo; nunca se usa como permiso. Restaurado al terminar.
  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason, ''), true);
  if p_kind = 'create' then
    if v_inv.status = 'pagada' then
      raise exception 'PAYMENT_STATE' using errcode = '23514';
    end if;
    if (select count(*) from public.payment_reports where tenant_id = v_tenant and invoice_id = v_inv.id
      and status = 'reportado' and deleted_at is null and cancelled_at is null) >= 5 then
      raise exception 'PAYMENT_PENDING_LIMIT' using errcode = '23514';
    end if;
    if v_proof !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp|heic|heif)$'
       or v_proof ~ '[[:space:]]'
       or pg_catalog.split_part(v_proof, '/', 1) <> v_tenant::text
       or pg_catalog.split_part(v_proof, '/', 2) <> v_inv.id::text
       or pg_catalog.split_part(v_proof, '/', 3) <> p_report_id::text then
      raise exception 'PAYMENT_PROOF' using errcode = '22023';
    end if;
    perform 1 from storage.objects where bucket_id = 'payment-proofs' and name = v_proof for share;
    if not found then
      raise exception 'PAYMENT_PROOF' using errcode = '22023';
    end if;
    insert into public.payment_reports (
      id, tenant_id, invoice_id, invoice_code, client_markbox, amount, currency,
      method, paid_at, proof_path, status, note
    ) values (
      p_report_id, v_tenant, v_inv.id, v_inv.invoice_code, v_inv.client_markbox,
      v_amount, v_inv.currency, v_method, v_paid_at, v_proof, 'reportado', v_note
    ) returning * into v_rep;
  else
    v_before := pg_catalog.jsonb_build_object('status', v_rep.status, 'cancelled', false, 'invoice_id', v_inv.id);
    if p_kind = 'cancel' then
      -- SDD-0484: el motivo queda también en el reporte, visible para el
      -- cliente y para finanzas. La auditoría conserva su copia.
      update public.payment_reports set cancelled_at = pg_catalog.clock_timestamp(), cancelled_by = v_actor,
        resolution_reason = v_reason
      where id = p_report_id returning * into v_rep;
    else
      if p_kind = 'confirm' then
        v_new_paid := pg_catalog.round(coalesce(v_inv.paid_amount, 0) + v_rep.amount, 2);
        v_new_status := v_inv.status;
        if v_inv.status in ('emitida', 'parcial', 'vencida') then
          if v_new_paid >= v_inv.total_amount then v_new_status := 'pagada';
          elsif v_new_paid > 0 then v_new_status := 'parcial'; end if;
        end if;
        update public.invoices set paid_amount = v_new_paid, status = v_new_status,
          last_payment_at = pg_catalog.clock_timestamp() where id = v_inv.id;
      end if;
      update public.payment_reports set
        status = case when p_kind = 'confirm' then 'confirmado'::public.payment_report_status else 'rechazado'::public.payment_report_status end,
        resolution_reason = v_reason, confirmed_by = v_actor, confirmed_at = pg_catalog.clock_timestamp()
      where id = p_report_id returning * into v_rep;
    end if;
  end if;
  v_after := pg_catalog.jsonb_build_object('status', v_rep.status, 'cancelled', v_rep.cancelled_at is not null, 'invoice_id', v_inv.id);
  v_audit_id := public.append_audit_event(v_tenant, 'payment_report', p_report_id, 'user', v_actor,
    case p_kind when 'create' then 'payment_report_created' when 'cancel' then 'payment_report_cancelled'
      when 'confirm' then 'payment_report_confirmed' else 'payment_report_rejected' end,
    'rpc', 'succeeded', v_reason, v_before, v_after,
    pg_catalog.jsonb_build_object('permanence', 'P3', 'evidence_permanence', 'P4',
      'evidence_retained', true, 'related_report_id', p_report_id,
      'consequence', case p_kind when 'confirm' then 'invoice_paid_amount_updated'
        when 'cancel' then 'report_cancelled_without_payment' when 'reject' then 'report_rejected_without_payment'
        else 'payment_declared_not_credited' end,
      'recovery', 'new_command_required'),
    p_request_id::text, 1, 'restricted');
  if v_audit_id is null then
    raise exception 'PAYMENT_AUDIT' using errcode = '23514';
  end if;
  v_result := pg_catalog.jsonb_build_object('request_id', p_request_id, 'report_id', p_report_id,
    'invoice_id', v_inv.id, 'invoice_code', v_inv.invoice_code, 'status', v_rep.status,
    'cancelled', v_rep.cancelled_at is not null, 'audit_event_id', v_audit_id, 'replayed', false);
  insert into payment_private.report_commands (request_id, tenant_id, actor_id, report_id, verb, input_hash, result, audit_event_id)
  values (p_request_id, v_tenant, v_actor, p_report_id, p_kind, v_hash, v_result, v_audit_id);
  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_old_reason, ''), true);
  return v_result;
end;
$function$;

-- Fuente íntegra: 0128_sales_order_invoicing_hardening.sql; delta temporal acotado.
create or replace function public.sales_order_claim_and_invoice(
  p_tenant_id  uuid,
  p_receipt_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issued_at       date := (pg_catalog.clock_timestamp() at time zone 'America/Caracas')::date;
  v_receipt         record;
  v_so_id           uuid;
  v_so              record;
  v_pre             record;
  v_total_boxes     int;
  v_remaining_boxes int;
  v_is_final        boolean;
  v_received        int;
  v_already         numeric(14,2);
  v_total           numeric(14,2);
  v_remaining_usd   numeric(14,2);
  v_amount          numeric(14,2);
  v_iva_on          boolean;
  v_rate            numeric(5,2);
  v_base            numeric(14,2);
  v_iva             numeric(14,2);
  v_total_inv       numeric(14,2);
  v_code            text;
  v_invoice_id      uuid;
  v_markbox         text;
  v_client_name     text;
  v_target          text;
  v_new_status      text;
begin
  if p_tenant_id is null or p_receipt_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  -- ── 1. La recepción (datos reales; lectura de referencia) ──
  select id, receipt_code, client_markbox, client_name, is_orphan,
         total_cbm, total_weight_kg, prealerta_id, sales_order_id
    into v_receipt
    from public.warehouse_receipts_cn
   where id = p_receipt_id
     and tenant_id = p_tenant_id
     and deleted_at is null;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  -- Gates DUROS re-validados en DB (defensa en profundidad; el gate §3.5
  -- completo — adjuntos + verificación — corre en la app antes de llamar acá).
  if coalesce(v_receipt.is_orphan, false) then
    return jsonb_build_object('outcome', 'gate_failed', 'missing', 'caja huérfana (sin cliente asignado)');
  end if;
  if coalesce(v_receipt.total_cbm, 0) <= 0 or coalesce(v_receipt.total_weight_kg, 0) <= 0 then
    return jsonb_build_object('outcome', 'gate_failed', 'missing', 'CBM (volumen), peso');
  end if;
  if v_receipt.prealerta_id is null then
    return jsonb_build_object('outcome', 'no_box');
  end if;

  -- ── 2. Resolver la OV (denormalizada en la recepción o vía la caja) ──
  v_so_id := v_receipt.sales_order_id;
  if v_so_id is null then
    select sales_order_id into v_so_id
      from public.prealertas
     where id = v_receipt.prealerta_id
       and tenant_id = p_tenant_id
       and deleted_at is null;
  end if;
  if v_so_id is null then
    return jsonb_build_object('outcome', 'no_sales_order');
  end if;

  -- ── 3. LOCKS (orden fijo anti-deadlock: 1º la OV, 2º la caja) ──
  -- El lock de la OV serializa toda la facturación de esta OV: el snapshot de
  -- cajas/ya-facturado que sigue es CONSISTENTE (nadie más factura en paralelo).
  select * into v_so
    from public.sales_orders
   where id = v_so_id and tenant_id = p_tenant_id and deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('outcome', 'no_sales_order');
  end if;
  if v_so.status in ('cerrada', 'cancelada') then
    return jsonb_build_object(
      'outcome', 'so_terminal',
      'sales_order_code', v_so.sales_order_code,
      'sales_order_status', v_so.status
    );
  end if;

  -- Lock de la caja + RE-CHEQUEO post-lock (TOCTOU-safe): sigue viva, sigue
  -- atada a ESTA OV y sigue sin factura.
  select * into v_pre
    from public.prealertas
   where id = v_receipt.prealerta_id
     and tenant_id = p_tenant_id
     and sales_order_id = v_so.id
     and deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('outcome', 'no_box');
  end if;
  if v_pre.invoice_id is not null then
    return jsonb_build_object(
      'outcome', 'already_invoiced',
      'sales_order_code', v_so.sales_order_code
    );
  end if;

  -- ── 4. Denominador CONGELADO + ya-facturado + ¿es la final? ──
  -- Universo del prorrateo: el snapshot de la 1ª factura (invoicing_total_boxes);
  -- si aún no existe (esta ES la 1ª), se calcula ahora y se persiste más abajo
  -- EN LA MISMA transacción.
  if v_so.invoicing_total_boxes is not null then
    v_total_boxes := v_so.invoicing_total_boxes;
  else
    select coalesce(sum(greatest(boxes, 0)), 0)::int into v_total_boxes
      from public.prealertas
     where sales_order_id = v_so.id
       and tenant_id = p_tenant_id
       and deleted_at is null;
  end if;

  -- Ya facturado REAL de la OV: solo facturas vivas que cuentan como emitidas
  -- (excluye 'borrador' y 'anulada' — review 🟡).
  select coalesce(sum(total_amount), 0) into v_already
    from public.invoices
   where sales_order_id = v_so.id
     and tenant_id = p_tenant_id
     and deleted_at is null
     and status not in ('borrador', 'anulada');

  -- ¿Quedan otras cajas vivas sin facturar? (si no → esta recepción es la FINAL
  -- y absorbe el restante exacto).
  select coalesce(sum(greatest(boxes, 0)), 0)::int into v_remaining_boxes
    from public.prealertas
   where sales_order_id = v_so.id
     and tenant_id = p_tenant_id
     and deleted_at is null
     and invoice_id is null
     and id <> v_pre.id;
  v_is_final := v_remaining_boxes <= 0;

  -- ── 5. Monto (espejo aproximado de computeReceiptInvoiceAmount · ±$0.01 en bordes · invoicing.ts) ──
  v_total         := greatest(coalesce(v_so.total_usd, 0), 0);
  v_received      := greatest(coalesce(v_pre.boxes, 0), 0);
  v_remaining_usd := greatest(v_total - v_already, 0);
  if v_total <= 0 or v_received <= 0 then
    v_amount := 0;
  elsif v_is_final or v_total_boxes <= 0 then
    -- final → restante exacto (absorbe redondeos) · sin denominador → restante íntegro.
    v_amount := round(v_remaining_usd, 2);
  else
    -- prorrateo por cajas, clampeado al restante (nunca sobre-factura).
    v_amount := round(least(v_total * v_received / v_total_boxes, v_remaining_usd), 2);
  end if;
  if v_amount <= 0 then
    return jsonb_build_object(
      'outcome', 'zero_amount',
      'sales_order_code', v_so.sales_order_code
    );
  end if;

  -- ── 6. IVA: total CONSTRUIDO desde base + iva (patrón 0021 · review 🟡) ──
  -- Aritmética numeric (sin float): total == base + iva SIEMPRE → el asiento
  -- 0040 nunca aborta por descuadre. El IVA (base+iva) vive solo en este SQL (sin espejo TS).
  select coalesce(iva_enabled, false) into v_iva_on
    from public.tenants
   where id = p_tenant_id;
  v_iva_on := coalesce(v_iva_on, false);
  if v_iva_on then
    v_rate := 16;
    v_base := round(v_amount / 1.16, 2);
    v_iva  := round(v_base * 0.16, 2);
  else
    v_rate := 0;
    v_base := v_amount;
    v_iva  := 0;
  end if;
  v_total_inv := v_base + v_iva;

  -- ── 7. Factura (motor 0021: next_invoice_code + schema 0077) ──
  v_code := public.next_invoice_code(p_tenant_id);
  v_markbox := coalesce(
    nullif(trim(coalesce(v_receipt.client_markbox, '')), ''),
    nullif(trim(coalesce(v_so.client_markbox, '')), ''),
    '—'
  );
  v_client_name := coalesce(
    nullif(trim(coalesce(v_receipt.client_name, '')), ''),
    nullif(trim(coalesce(v_so.client_name, '')), ''),
    'Cliente'
  );

  insert into public.invoices (
    tenant_id, invoice_code, client_markbox, client_name, sales_order_id,
    currency, iva_rate, base_amount, iva_amount, total_amount, lines, notes,
    status, issued_at, due_date, fund_class
  ) values (
    p_tenant_id, v_code, v_markbox, v_client_name, v_so.id,
    'USD', v_rate, v_base, v_iva, v_total_inv,
    jsonb_build_array(jsonb_build_object(
      'desc', 'OV ' || v_so.sales_order_code || ' · recepción ' || v_receipt.receipt_code
              || ' (' || v_received || ' caja' || case when v_received = 1 then '' else 's' end || ')',
      'qty', 1,
      'unitPrice', v_base
    )),
    'Generada automáticamente al confirmar la recepción ' || v_receipt.receipt_code || ' (SDD-0072 Fase 2).',
    'emitida', v_issued_at, v_issued_at + 30,
    -- espejo de deriveFundClass (payment-types.ts · 0122).
    case when v_so.service::text = 'transporte_terrestre' then 'local_revenue' else 'third_party' end
  )
  returning id, issued_at into v_invoice_id, v_issued_at;

  -- ── 8. Ligado GARANTIZADO (misma transacción: o factura+ligado o nada) ──
  update public.prealertas
     set invoice_id = v_invoice_id,
         invoiced_at = now()
   where id = v_pre.id;

  -- ── 9. Status de la OV (espejo nextStatusAfterInvoice + isAllowedTransition)
  --       + congelar el denominador si es la 1ª factura. Un solo UPDATE. ──
  v_target := case when v_remaining_boxes <= 0 then 'facturada' else 'parcial' end;
  if v_so.status <> v_target
     and (v_so.status = 'confirmada' or (v_so.status = 'parcial' and v_target = 'facturada')) then
    v_new_status := v_target;
  else
    v_new_status := null;
  end if;

  update public.sales_orders
     set invoicing_total_boxes = coalesce(invoicing_total_boxes, v_total_boxes),
         status = coalesce(v_new_status, status)
   where id = v_so.id
     and tenant_id = p_tenant_id;

  -- ── 10. Denormalizar la OV en la recepción (provenance) ──
  update public.warehouse_receipts_cn
     set sales_order_id = v_so.id
   where id = p_receipt_id
     and tenant_id = p_tenant_id;

  return jsonb_build_object(
    'outcome', 'invoiced',
    'invoice_id', v_invoice_id,
    'issued_at', v_issued_at,
    'invoice_code', v_code,
    'base_amount', v_base,
    'iva_amount', v_iva,
    'total_amount', v_total_inv,
    'claimed_boxes', v_received,
    'sales_order_id', v_so.id,
    'sales_order_code', v_so.sales_order_code,
    'sales_order_status', coalesce(v_new_status, v_so.status),
    'sales_order_status_changed', v_new_status is not null
  );
end;
$$;

do $postflight$
declare e record; v_default text;
begin
  if exists(select 1 from caracas_0499_before b left join pg_catalog.pg_proc p on p.oid=b.oid
    where p.oid is null or (p.proowner,p.proacl,p.prosecdef,p.proconfig,p.prorettype,p.proargtypes,p.proargnames,p.provolatile)
    is distinct from (b.proowner,b.proacl,b.prosecdef,b.proconfig,b.prorettype,b.proargtypes,b.proargnames,b.provolatile)) then
    raise exception '0499: cambió identidad, firma o privilegios';
  end if;
  for e in select * from (values
    ('public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)', 'd3fc3f564e04b725861094903df99a04'),
    ('public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)', 'f5f7bb5d67494522126b28ef9d33a677'),
    ('public.void_expense_governed(uuid,text,text)', '00903e20e1ee724862f4cd55557b3e83'),
    ('payment_private.run_report_command(uuid,uuid,text,jsonb)', 'b156a464950a543f12ac5bccbaa03c3d'),
    ('public.sales_order_claim_and_invoice(uuid,uuid)', 'c0f506f44cda20909a430befc240a8b3')
  ) x(signature,body_md5) loop
    if (select pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n')) from pg_catalog.pg_proc where oid=e.signature::regprocedure) is distinct from e.body_md5 then
      raise exception '0499: cuerpo nuevo inesperado: %',e.signature;
    end if;
  end loop;
  for e in select * from (values ('journal_entries','entry_date'),('payment_receipts','received_at'),('supplier_bills','issue_date'),('supplier_payments','paid_at')) x(rel,col) loop
    select pg_catalog.pg_get_expr(d.adbin,d.adrelid) into v_default from pg_catalog.pg_attribute a join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=pg_catalog.to_regclass('public.'||e.rel) and a.attname=e.col
      and a.atttypid='date'::regtype and a.attnotnull and not a.attisdropped;
    -- pg_get_expr conserva un par adicional de paréntesis según versión PG.
    -- Ambas formas exactas tienen el mismo reloj, zona y cast; nada genérico.
    if v_default is null or v_default not in ('(statement_timestamp() AT TIME ZONE ''America/Caracas''::text)::date',
      '((statement_timestamp() AT TIME ZONE ''America/Caracas''::text))::date') then
      raise exception '0499: default Caracas no instalado: %.% = %',e.rel,e.col,v_default;
    end if;
  end loop;
end;
$postflight$;
notify pgrst, 'reload schema';
