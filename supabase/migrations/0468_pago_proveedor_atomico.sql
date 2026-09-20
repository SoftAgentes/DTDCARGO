-- ─────────────────────────────────────────────────────────────────────────────
-- 0468 · SDD-0489 — Registrar y anular una orden de pago a proveedor en una
-- sola transacción, con la CxP tomada FOR UPDATE.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: MIGRATE-FIRST, como la 0467. Se aplica ANTES de integrar la PR de
--    SDD-0489. Es aditiva (dos funciones nuevas; no reemplaza ni altera nada),
--    así que la app desplegada hoy no la nota. La app de SDD-0489 no registra
--    ni anula pagos sin ella (degrada con un error, sin escribir nada).
--
-- ── El defecto ──────────────────────────────────────────────
-- lib/studio/treasury/treasury-actions.ts pagaba en requests separados: leía la
-- CxP sin lock, insertaba (o anulaba) la orden de pago y después escribía
-- paid_amount ABSOLUTO —lo leído ± el monto— y el status. Es el mismo defecto
-- que Cobranzas tenía antes de la 0467 (SDD-0488): dos pagos simultáneos se
-- pisaban, igual que un pago y una anulación, y se perdía una suma. El saldo se
-- validaba contra una lectura vieja. Un pago que leyó la CxP antes de que otra
-- sesión la anulara volvía a dejarla `parcial`: la CxP anulada revivía con un
-- pago. Reproducido con dos sesiones reales en
-- supabase/tests/0468_pago_proveedor_carrera.test.sql.
--
-- ── Qué agrega ──────────────────────────────────────────────
--   public.register_supplier_payment_order(…)       pago sobre una CxP
--   public.void_supplier_payment_order(uuid, text)  anula una orden y baja el pagado
-- Cada una exige rol accounting o admin en el tenant (el candado del módulo
-- Tesorería, lib/studio/rbac.ts), como la 0467, y toma la orden y la CxP FOR
-- UPDATE antes de leer el saldo. Escribe la orden, el paid_amount y el status
-- en la MISMA transacción. Devuelve en jsonb lo que la app necesita para el
-- asiento, que sigue fuera y best-effort, como en SDD-0044.
--
-- SECURITY INVOKER, search_path vacío, owner postgres y EXECUTE sólo para
-- authenticated: el patrón D2 de 0294 y de la 0467. Corren con la RLS y los
-- GRANT de quien llama y no amplían ningún privilegio. La RLS de supplier_bills
-- y supplier_payments sólo filtra por tenant (0088/0230): el hueco de rol por
-- PostgREST sigue abierto y esta migración no lo toca. La auditoría D2 (0290)
-- sigue en los triggers. El motivo humano de la anulación lo fija
-- void_supplier_payment_with_audit_reason (0294), que se llama adentro; el
-- evento D2 de la CxP de esa misma transacción lleva el mismo motivo.
--
-- ── Regla de saldo ──────────────────────────────────────────
-- La de Cobranzas (decisión de Sam en SDD-0488, «Estricta, como la 0464»): un
-- monto mayor que total − pagado → PAYMENT_EXCEEDS_BALANCE; una CxP pagada →
-- PAYMENT_BILL_PAID. Sin la tolerancia de 0,01 de la app. Extenderla a
-- Tesorería queda pendiente de que Sam la ratifique (spec 0489).
--
-- ── Estados ─────────────────────────────────────────────────
-- Pagar: la app rechazaba una CxP anulada o pagada, y la RPC también (más una
-- borrada, como la 0467). Queda pagada si el pago cubre el total; si no,
-- parcial. Anular: pendiente si el pagado queda en 0; si no, parcial, igual que
-- la app. Una CxP anulada conserva su estado y sólo baja el pagado, como en la
-- 0467; la app no la tocaba. void_supplier_bill_with_audit_reason (0294) exige
-- paid_amount = 0, así que una CxP anulada con una orden viva sólo existe si la
-- carrera vieja perdió una suma.
--
-- ── Concurrencia ────────────────────────────────────────────
-- Locks de fila: orden → CxP al anular; CxP → lock consultivo del tenant al
-- pagar. La anulación de la CxP (0294) es un UPDATE sobre la misma fila: espera
-- al pago y ya no la anula si quedó con pagado. No hay ciclos. La orden se toma
-- FOR UPDATE también por su journal_entry_id, que la app guarda con un update
-- aparte después del pago: si ese update está en curso, la anulación lo espera
-- y devuelve el asiento que hay que anular, en vez de uno vacío. El lock
-- consultivo (clave 489, hashtext del tenant) serializa next_payment_order_code,
-- que en 0088 calcula max+1 sin lock: sin él, dos pagos simultáneos del mismo
-- tenant sacaban el mismo código OP- y el segundo moría por el unique.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: crea funciones, cambia su owner y su ACL. Ninguno sobre
-- supplier_bills ni supplier_payments, y no toca filas. lock_timeout 5 s y
-- statement_timeout 30 s con set de sesión, como la 0467.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_expected record;
  v_md5 text;
  v_md5_normalized text;
begin
  if pg_catalog.to_regclass('public.supplier_bills') is null
     or pg_catalog.to_regclass('public.supplier_payments') is null
     or pg_catalog.to_regclass('public.user_tenants') is null
     or pg_catalog.to_regtype('public.invoice_currency') is null
     or pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0468 requiere supplier_bills, supplier_payments, user_tenants, invoice_currency y los roles API';
  end if;

  -- Columnas que las funciones leen o escriben, con su tipo.
  for v_expected in select * from (values
    ('public.supplier_bills', 'id', 'uuid'), ('public.supplier_bills', 'tenant_id', 'uuid'),
    ('public.supplier_bills', 'bill_code', 'text'), ('public.supplier_bills', 'supplier_id', 'uuid'),
    ('public.supplier_bills', 'supplier_name', 'text'), ('public.supplier_bills', 'status', 'text'),
    ('public.supplier_bills', 'currency', 'public.invoice_currency'), ('public.supplier_bills', 'fx_rate', 'numeric'),
    ('public.supplier_bills', 'total_amount', 'numeric'), ('public.supplier_bills', 'paid_amount', 'numeric'),
    ('public.supplier_bills', 'deleted_at', 'timestamptz'),
    ('public.supplier_payments', 'id', 'uuid'), ('public.supplier_payments', 'tenant_id', 'uuid'),
    ('public.supplier_payments', 'payment_code', 'text'), ('public.supplier_payments', 'bill_id', 'uuid'),
    ('public.supplier_payments', 'supplier_id', 'uuid'), ('public.supplier_payments', 'supplier_name', 'text'),
    ('public.supplier_payments', 'amount', 'numeric'), ('public.supplier_payments', 'currency', 'public.invoice_currency'),
    ('public.supplier_payments', 'fx_rate', 'numeric'), ('public.supplier_payments', 'method', 'text'),
    ('public.supplier_payments', 'cash_account_id', 'uuid'), ('public.supplier_payments', 'reference', 'text'),
    ('public.supplier_payments', 'paid_at', 'date'), ('public.supplier_payments', 'notes', 'text'),
    ('public.supplier_payments', 'journal_entry_id', 'uuid'),
    ('public.supplier_payments', 'deleted_at', 'timestamptz'),
    ('public.user_tenants', 'user_id', 'uuid'), ('public.user_tenants', 'tenant_id', 'uuid'),
    ('public.user_tenants', 'role', 'text'), ('public.user_tenants', 'disabled_at', 'timestamptz')
  ) e(rel, col, typ) loop
    if not exists (select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass(v_expected.rel) and a.attname = v_expected.col
        and not a.attisdropped
        and a.atttypid = pg_catalog.to_regtype(v_expected.typ)) then
      raise exception '0468: columna ausente o con otro tipo: %.%', v_expected.rel, v_expected.col;
    end if;
  end loop;

  -- Dependencias que se invocan: firma, seguridad y cuerpo vigentes (md5 del
  -- prosrc con CRLF→LF, o sin espacios). Otro cuerpo aborta sin cambiar nada.
  for v_expected in select * from (values
    ('public.next_payment_order_code(uuid)', true, 'text',
     '0e4812685509f756b3c47b117323307a', '00228ea7b7f16924db263a890fbfba64'),                -- 0088
    ('public.void_supplier_payment_with_audit_reason(uuid,text)', false, 'boolean',
     'f06331df9d2c264d3dac7391f0cd0c12', '3488a63b89a9f16a2e7c1e9b306be53d'),                -- 0294
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
      raise exception '0468: dependencia ausente o con otra firma/seguridad: %', v_expected.signature;
    end if;
    if v_md5 <> v_expected.body_md5 and v_md5_normalized <> v_expected.body_md5_normalized then
      raise exception '0468 abortado: % tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
        v_expected.signature, v_md5, v_md5_normalized;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0468 requiere auth.uid()';
  end if;

  -- Una segunda aplicación aborta: estas funciones no se reemplazan desde acá.
  if pg_catalog.to_regprocedure('public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)') is not null
     or pg_catalog.to_regprocedure('public.void_supplier_payment_order(uuid,text)') is not null then
    raise exception '0468 abortado: las funciones de pagos a proveedores ya existen';
  end if;
end;
$preflight$;

create function public.register_supplier_payment_order(
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
    coalesce(p_paid_at, current_date), p_notes
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

create function public.void_supplier_payment_order(
  p_payment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_payment public.supplier_payments%rowtype;
  v_bill public.supplier_bills%rowtype;
  v_new_paid numeric(14,2);
  v_new_status text;
begin
  if not exists (select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and ut.role in ('admin', 'accounting')) then
    raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_payment_id is null then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;

  -- La orden primero: dos anulaciones se serializan acá, y el journal_entry_id
  -- que se devuelve es el que quedó guardado, no uno a medio escribir.
  select sp.* into v_payment from public.supplier_payments sp
  where sp.id = p_payment_id and sp.tenant_id = v_tenant
  for update;
  if not found then
    raise exception 'PAYMENT_ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_payment.deleted_at is not null then
    raise exception 'PAYMENT_ORDER_VOIDED' using errcode = '23514';
  end if;
  -- La CxP se toma antes de anular: si no se puede ajustar, no se anula.
  select b.* into v_bill from public.supplier_bills b
  where b.id = v_payment.bill_id and b.tenant_id = v_tenant
  for update;
  if not found then
    raise exception 'PAYMENT_BILL_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Motivo (4 a 1000) y marca de anulación: el wrapper D2 de 0294, que fija
  -- dtd.audit_reason para esta transacción.
  if not public.void_supplier_payment_with_audit_reason(v_payment.id, p_reason) then
    raise exception 'PAYMENT_ORDER_VOIDED' using errcode = '23514';
  end if;

  v_new_paid := greatest(0, v_bill.paid_amount - v_payment.amount);
  -- Una CxP anulada no revive: sólo baja el pagado.
  v_new_status := case
    when v_bill.status = 'anulada' then v_bill.status
    when v_new_paid <= 0 then 'pendiente'
    else 'parcial'
  end;
  update public.supplier_bills set paid_amount = v_new_paid, status = v_new_status where id = v_bill.id;

  return pg_catalog.jsonb_build_object(
    'payment_id', v_payment.id, 'payment_code', v_payment.payment_code, 'tenant_id', v_tenant,
    'bill_id', v_bill.id, 'bill_code', v_bill.bill_code, 'journal_entry_id', v_payment.journal_entry_id,
    'paid_amount', v_new_paid, 'total_amount', v_bill.total_amount, 'status', v_new_status);
end;
$function$;

comment on function public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text) is
  'SDD-0489: pago a proveedor sobre una CxP en una transacción. Rol accounting/admin; CxP FOR UPDATE; saldo estricto (PAYMENT_EXCEEDS_BALANCE, PAYMENT_BILL_PAID); código OP- serializado por tenant; orden + paid_amount + status juntos.';
comment on function public.void_supplier_payment_order(uuid,text) is
  'SDD-0489: anula una orden de pago (motivo D2 de 0294) y baja el pagado de su CxP en una transacción. Una CxP anulada conserva su estado.';

alter function public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text) owner to postgres;
alter function public.void_supplier_payment_order(uuid,text) owner to postgres;

revoke all on function public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.void_supplier_payment_order(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)
  to authenticated;
grant execute on function public.void_supplier_payment_order(uuid,text) to authenticated;

do $postflight$
begin
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.oid in (
          pg_catalog.to_regprocedure('public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)'),
          pg_catalog.to_regprocedure('public.void_supplier_payment_order(uuid,text)'))
        and not p.prosecdef and p.provolatile = 'v'
        and p.proowner = 'postgres'::pg_catalog.regrole
        and p.prorettype = 'pg_catalog.jsonb'::pg_catalog.regtype
        and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not exists (select 1 from pg_catalog.aclexplode(p.proacl) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE')) <> 2 then
    raise exception '0468: postflight — funciones de pagos sin INVOKER, search_path, owner o ACL esperados';
  end if;
end;
$postflight$;
