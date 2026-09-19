-- ─────────────────────────────────────────────────────────────────────────────
-- 0467 · SDD-0488 — Cobrar, identificar y anular un recibo de una factura en
-- una sola transacción, con la factura tomada FOR UPDATE.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: MIGRATE-FIRST. Se aplica ANTES de integrar la PR de SDD-0488. Es
--    aditiva (tres funciones nuevas; no reemplaza ni altera nada), así que la
--    app desplegada hoy no la nota. La app de SDD-0488, en cambio, no puede
--    cobrar sin ella.
--
-- ── El defecto ──────────────────────────────────────────────
-- lib/studio/collections-actions.ts cobraba en requests separados: leía la
-- factura sin lock, insertaba (o identificaba, o anulaba) el recibo y después
-- escribía paid_amount ABSOLUTO —lo leído ± el monto— y el status. Dos cobros
-- simultáneos se pisaban, igual que un cobro y una confirmación de reporte
-- (0421 sí toma la factura FOR UPDATE) o una anulación y cualquiera de los dos:
-- se perdía una suma. El saldo se validaba contra una lectura vieja, y si la
-- escritura de la factura fallaba quedaba un recibo sin reflejar en ella.
-- Reproducido con dos sesiones reales en scripts/qa/cobro-factura-race.mjs.
--
-- ── Qué agrega ──────────────────────────────────────────────
--   public.register_collection_receipt(…)          cobro sobre una factura
--   public.identify_collection_receipt(uuid, uuid)  aplica un pago sin referencia
--   public.void_collection_receipt(uuid, text)      anula un recibo y baja el pagado
-- Cada una exige rol accounting o admin en el tenant, como 0421, y toma el
-- recibo y la factura FOR UPDATE antes de leer el saldo. Escribe el recibo, el
-- paid_amount y el status en la MISMA transacción. Devuelve en jsonb lo que la
-- app necesita para el asiento, que sigue fuera y best-effort, como en
-- SDD-0041/0068.
--
-- SECURITY INVOKER, search_path vacío, owner postgres y EXECUTE sólo para
-- authenticated: el patrón D2 de 0294. Corren con la RLS y los GRANT de quien
-- llama y no amplían ningún privilegio: invoices exige accounting/admin por
-- 0407/0414; payment_receipts sólo tenant por 0079/0230. Ese hueco de rol en
-- payment_receipts por PostgREST sigue abierto: esta migración no lo toca. La
-- auditoría D2 (0290) sigue en los triggers. El motivo humano de la anulación
-- lo fija void_payment_receipt_with_audit_reason (0294), que se llama adentro;
-- el evento D2 de la factura de esa misma transacción lleva el mismo motivo.
--
-- ── Regla de saldo (decisión de Sam, 2026-09-18) ────────────
-- «Estricta, como la 0464 (Recomendado)». Un monto mayor que total − pagado →
-- PAYMENT_EXCEEDS_BALANCE; ya no rige la tolerancia de 0,01 de la app. Una
-- factura pagada → PAYMENT_INVOICE_PAID. Son los códigos y el errcode 23514 de
-- la 0464 (SDD-0484).
--
-- ── Estado al anular ────────────────────────────────────────
-- Una factura `anulada` (o `borrador`) conserva su estado: sólo baja el
-- pagado. La app la devolvía a emitida/parcial, y la D2 lo registraba como
-- invoice_emitted. El camino es alcanzable: void_invoice_with_audit_reason
-- (0294) anula una factura `parcial` con recibos aplicados.
--
-- ── Concurrencia ────────────────────────────────────────────
-- Locks de fila: recibo → factura al identificar o anular; factura → lock
-- consultivo del tenant al cobrar. 0421 toma factura → reporte. No hay ciclos.
-- El lock consultivo (clave 488, hashtext del tenant) serializa
-- next_receipt_code, que en 0079 calcula max+1 sin lock, entre cobros del
-- mismo tenant: sin él, dos cobros simultáneos sacaban el mismo código y el
-- segundo moría por el unique.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: crea funciones, cambia su owner y su ACL. Ninguno sobre
-- invoices ni payment_receipts, y no toca filas. lock_timeout 5 s y
-- statement_timeout 30 s con set de sesión, como 0421-0423.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_expected record;
  v_md5 text;
  v_md5_normalized text;
begin
  if pg_catalog.to_regclass('public.invoices') is null
     or pg_catalog.to_regclass('public.payment_receipts') is null
     or pg_catalog.to_regclass('public.user_tenants') is null
     or pg_catalog.to_regtype('public.invoice_status') is null
     or pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0467 requiere invoices, payment_receipts, user_tenants, invoice_status y los roles API';
  end if;

  -- Columnas que las funciones leen o escriben, con su tipo.
  for v_expected in select * from (values
    ('public.invoices', 'id', 'uuid'), ('public.invoices', 'tenant_id', 'uuid'),
    ('public.invoices', 'invoice_code', 'text'), ('public.invoices', 'client_markbox', 'text'),
    ('public.invoices', 'client_name', 'text'), ('public.invoices', 'status', 'public.invoice_status'),
    ('public.invoices', 'currency', 'public.invoice_currency'), ('public.invoices', 'fx_rate', 'numeric'),
    ('public.invoices', 'total_amount', 'numeric'), ('public.invoices', 'paid_amount', 'numeric'),
    ('public.invoices', 'last_payment_at', 'timestamptz'),
    ('public.invoices', 'deleted_at', 'timestamptz'), ('public.invoices', 'fund_class', 'text'),
    ('public.payment_receipts', 'id', 'uuid'), ('public.payment_receipts', 'tenant_id', 'uuid'),
    ('public.payment_receipts', 'receipt_code', 'text'), ('public.payment_receipts', 'invoice_id', 'uuid'),
    ('public.payment_receipts', 'client_markbox', 'text'), ('public.payment_receipts', 'client_name', 'text'),
    ('public.payment_receipts', 'amount', 'numeric'), ('public.payment_receipts', 'currency', 'public.invoice_currency'),
    ('public.payment_receipts', 'fx_rate', 'numeric'), ('public.payment_receipts', 'method', 'text'),
    ('public.payment_receipts', 'cash_account_id', 'uuid'), ('public.payment_receipts', 'reference', 'text'),
    ('public.payment_receipts', 'received_at', 'date'), ('public.payment_receipts', 'notes', 'text'),
    ('public.payment_receipts', 'deleted_at', 'timestamptz'),
    ('public.payment_receipts', 'payer_kind', 'text'), ('public.payment_receipts', 'payer_name', 'text'),
    ('public.payment_receipts', 'payer_relation', 'text'), ('public.payment_receipts', 'licit_declared', 'boolean'),
    ('public.payment_receipts', 'application_status', 'text'),
    ('public.payment_receipts', 'identified_at', 'timestamptz'),
    ('public.payment_receipts', 'fund_class', 'text'),
    ('public.user_tenants', 'user_id', 'uuid'), ('public.user_tenants', 'tenant_id', 'uuid'),
    ('public.user_tenants', 'role', 'text'), ('public.user_tenants', 'disabled_at', 'timestamptz')
  ) e(rel, col, typ) loop
    if not exists (select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass(v_expected.rel) and a.attname = v_expected.col
        and not a.attisdropped
        and a.atttypid = pg_catalog.to_regtype(v_expected.typ)) then
      raise exception '0467: columna ausente o con otro tipo: %.%', v_expected.rel, v_expected.col;
    end if;
  end loop;

  -- La validación del pagador y del sin-ref queda en los CHECK de 0122.
  if (select pg_catalog.count(*) from pg_catalog.pg_constraint
      where conrelid = 'public.payment_receipts'::pg_catalog.regclass and contype = 'c' and convalidated
        and conname in ('payment_receipts_tercero_completo_check', 'payment_receipts_sinref_invoice_check',
                        'payment_receipts_snapshots_check', 'payment_receipts_fund_class_check')) <> 4 then
    raise exception '0467 requiere los CHECK de pagador, sin-ref, snapshots y fund_class de 0122';
  end if;

  -- Dependencias que se invocan: firma, seguridad y cuerpo vigentes (md5 del
  -- prosrc con CRLF→LF, o sin espacios). Otro cuerpo aborta sin cambiar nada.
  for v_expected in select * from (values
    ('public.next_receipt_code(uuid)', true, 'text',
     '7e23723a20335395cd7fc0e872646ce7', '10f0a5df996f2efb720d31afaec68e0f'),                -- 0079
    ('public.void_payment_receipt_with_audit_reason(uuid,text)', false, 'boolean',
     '84882604a0e14fc16d9e76a956d6a63d', '344ff401342529ad131edd35a19b1eca'),                -- 0294
    ('public.get_user_tenant_id()', true, 'uuid',
     '5ff0c51c26a49419c34abc78f1d95c37', '4ce5acd04a577f91ca77b74ebc622c49')                 -- 0453
  ) e(signature, definer, returns, body_md5, body_md5_normalized) loop
    select pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')),
           pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g'))
      into v_md5, v_md5_normalized
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
      and p.prosecdef = v_expected.definer
      and p.prorettype = pg_catalog.to_regtype(v_expected.returns);
    if v_md5 is null then
      raise exception '0467: dependencia ausente o con otra firma/seguridad: %', v_expected.signature;
    end if;
    if v_md5 <> v_expected.body_md5 and v_md5_normalized <> v_expected.body_md5_normalized then
      raise exception '0467 abortado: % tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
        v_expected.signature, v_md5, v_md5_normalized;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0467 requiere auth.uid()';
  end if;

  -- Una segunda aplicación aborta: estas funciones no se reemplazan desde acá.
  if pg_catalog.to_regprocedure('public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)') is not null
     or pg_catalog.to_regprocedure('public.identify_collection_receipt(uuid,uuid)') is not null
     or pg_catalog.to_regprocedure('public.void_collection_receipt(uuid,text)') is not null then
    raise exception '0467 abortado: las funciones de cobro ya existen';
  end if;
end;
$preflight$;

create function public.register_collection_receipt(
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
    coalesce(p_received_at, current_date), p_notes, coalesce(p_payer_kind, 'cliente'), p_payer_name,
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

create function public.identify_collection_receipt(
  p_receipt_id uuid,
  p_invoice_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_rec public.payment_receipts%rowtype;
  v_inv public.invoices%rowtype;
  v_new_paid numeric(14,2);
  v_new_status public.invoice_status;
begin
  if not exists (select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and ut.role in ('admin', 'accounting')) then
    raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_receipt_id is null or p_invoice_id is null then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;

  -- Recibo primero y después la factura, como al anular: dos identificaciones
  -- del mismo pago se serializan y la segunda ya lo ve aplicado.
  select r.* into v_rec from public.payment_receipts r
  where r.id = p_receipt_id and r.tenant_id = v_tenant
  for update;
  if not found then
    raise exception 'PAYMENT_RECEIPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_rec.deleted_at is not null then
    raise exception 'PAYMENT_RECEIPT_VOIDED' using errcode = '23514';
  end if;
  if v_rec.application_status <> 'recibido_sin_ref' or v_rec.invoice_id is not null then
    raise exception 'PAYMENT_RECEIPT_APPLIED' using errcode = '23514';
  end if;

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
  if v_inv.currency <> v_rec.currency then
    raise exception 'PAYMENT_CURRENCY' using errcode = '23514';
  end if;
  if v_rec.amount > v_inv.total_amount - v_inv.paid_amount then
    raise exception 'PAYMENT_EXCEEDS_BALANCE' using errcode = '23514';
  end if;

  -- received_at no se toca: la imputación es a la fecha original (SDD-0068 #6).
  update public.payment_receipts
  set invoice_id = v_inv.id, client_markbox = v_inv.client_markbox, client_name = v_inv.client_name,
      application_status = 'aplicado', identified_at = pg_catalog.clock_timestamp(),
      fund_class = case when v_inv.fund_class = 'local_revenue' then 'local_revenue' else 'third_party' end
  where id = v_rec.id;

  v_new_paid := v_inv.paid_amount + v_rec.amount;
  v_new_status := case when v_new_paid >= v_inv.total_amount then 'pagada' else 'parcial' end;
  update public.invoices
  set paid_amount = v_new_paid, status = v_new_status, last_payment_at = pg_catalog.clock_timestamp()
  where id = v_inv.id;

  return pg_catalog.jsonb_build_object(
    'receipt_id', v_rec.id, 'receipt_code', v_rec.receipt_code, 'tenant_id', v_tenant,
    'invoice_id', v_inv.id, 'invoice_code', v_inv.invoice_code, 'amount', v_rec.amount,
    'currency', v_rec.currency, 'fx_rate', v_rec.fx_rate, 'received_at', v_rec.received_at,
    'paid_amount', v_new_paid, 'total_amount', v_inv.total_amount, 'status', v_new_status,
    'fully_paid', v_new_status = 'pagada');
end;
$function$;

create function public.void_collection_receipt(
  p_receipt_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_rec public.payment_receipts%rowtype;
  v_inv public.invoices%rowtype;
  v_new_paid numeric(14,2);
  v_new_status public.invoice_status;
begin
  if not exists (select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and ut.role in ('admin', 'accounting')) then
    raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_receipt_id is null then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;

  select r.* into v_rec from public.payment_receipts r
  where r.id = p_receipt_id and r.tenant_id = v_tenant
  for update;
  if not found then
    raise exception 'PAYMENT_RECEIPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_rec.deleted_at is not null then
    raise exception 'PAYMENT_RECEIPT_VOIDED' using errcode = '23514';
  end if;
  -- La factura se toma antes de anular: si no se puede ajustar, no se anula.
  if v_rec.invoice_id is not null then
    select i.* into v_inv from public.invoices i
    where i.id = v_rec.invoice_id and i.tenant_id = v_tenant
    for update;
    if not found then
      raise exception 'PAYMENT_INVOICE_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  -- Motivo (4 a 1000) y marca de anulación: el wrapper D2 de 0294, que fija
  -- dtd.audit_reason para esta transacción.
  if not public.void_payment_receipt_with_audit_reason(v_rec.id, p_reason) then
    raise exception 'PAYMENT_RECEIPT_VOIDED' using errcode = '23514';
  end if;

  if v_rec.invoice_id is not null then
    v_new_paid := greatest(0, v_inv.paid_amount - v_rec.amount);
    -- Una factura anulada (o en borrador) no revive: sólo baja el pagado.
    v_new_status := case
      when v_inv.status in ('borrador', 'anulada') then v_inv.status
      when v_new_paid <= 0 then 'emitida'
      else 'parcial'
    end;
    update public.invoices set paid_amount = v_new_paid, status = v_new_status where id = v_inv.id;
  end if;

  return pg_catalog.jsonb_build_object(
    'receipt_id', v_rec.id, 'receipt_code', v_rec.receipt_code, 'tenant_id', v_tenant,
    'invoice_id', v_rec.invoice_id, 'paid_amount', v_new_paid, 'status', v_new_status);
end;
$function$;

comment on function public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean) is
  'SDD-0488: cobro sobre una factura en una transacción. Rol accounting/admin; factura FOR UPDATE; saldo estricto (PAYMENT_EXCEEDS_BALANCE, PAYMENT_INVOICE_PAID); código R- serializado por tenant; recibo + paid_amount + status juntos.';
comment on function public.identify_collection_receipt(uuid,uuid) is
  'SDD-0488: aplica un pago sin referencia a una factura en una transacción. Recibo y factura FOR UPDATE; misma regla de saldo que el cobro; received_at intacto.';
comment on function public.void_collection_receipt(uuid,text) is
  'SDD-0488: anula un recibo (motivo D2 de 0294) y baja el pagado de su factura en una transacción. Una factura anulada conserva su estado.';

alter function public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)
  owner to postgres;
alter function public.identify_collection_receipt(uuid,uuid) owner to postgres;
alter function public.void_collection_receipt(uuid,text) owner to postgres;

revoke all on function public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.identify_collection_receipt(uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.void_collection_receipt(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)
  to authenticated;
grant execute on function public.identify_collection_receipt(uuid,uuid) to authenticated;
grant execute on function public.void_collection_receipt(uuid,text) to authenticated;

do $postflight$
begin
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.oid in (
          pg_catalog.to_regprocedure('public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)'),
          pg_catalog.to_regprocedure('public.identify_collection_receipt(uuid,uuid)'),
          pg_catalog.to_regprocedure('public.void_collection_receipt(uuid,text)'))
        and not p.prosecdef and p.provolatile = 'v'
        and p.proowner = 'postgres'::pg_catalog.regrole
        and p.prorettype = 'pg_catalog.jsonb'::pg_catalog.regtype
        and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not exists (select 1 from pg_catalog.aclexplode(p.proacl) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE')) <> 3 then
    raise exception '0467: postflight — funciones de cobro sin INVOKER, search_path, owner o ACL esperados';
  end if;
end;
$postflight$;
