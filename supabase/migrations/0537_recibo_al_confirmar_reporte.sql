-- ─────────────────────────────────────────────────────────────────────────────
-- 0537 · SDD-0630 — Confirmar un reporte de pago del portal crea su recibo de
-- cobro en la misma transacción, por la misma vía que Cobranzas.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: después de la 0533 (su preflight exige el cuerpo de run_report_command
--    que deja la 0533) y MIGRATE-FIRST respecto de la app de SDD-0630, con el
--    despliegue inmediatamente después. Entre las dos, la confirmación del
--    Studio no se aplica (ver «Convivencia»); rechazar y cancelar siguen igual.
--    La 0422 y la 0423 se pueden aplicar después de esta: no tocan nada de lo
--    que esta cambia, y su contrato se corre encima en
--    supabase/tests/0537_recibo_al_confirmar_reporte.test.sql.
--
-- ── El defecto ──────────────────────────────────────────────
-- Confirmar un reporte (0421, con el tope de saldo de la 0464 y la fecha de la
-- 0533) sólo sumaba invoices.paid_amount. No creaba recibo, ni asiento, ni
-- movimiento de caja. Si además el pago se registraba en Cobranzas
-- (register_collection_receipt, 0467), la factura lo contaba dos veces.
--
-- ── Qué cambia ──────────────────────────────────────────────
-- 1. payment_receipts.payment_report_id: el vínculo del recibo con el reporte
--    que lo originó. FK a payment_reports, único donde no es NULL (un reporte,
--    a lo sumo un recibo) y protegido por un trigger: sólo lo fija el owner
--    postgres (el comando DEFINER), sólo de NULL a un reporte confirmado del
--    mismo tenant y de la misma factura, y nunca se cambia ni se borra.
-- 2. payment_private.run_report_command: copia íntegra del cuerpo de la 0533
--    con estos deltas, sólo para 'confirm':
--      · el input admite y EXIGE cash_account_id (uuid). Entra en la huella:
--        un reintento con la misma clave y otra cuenta es PAYMENT_REQUEST_CONFLICT;
--      · la cuenta tiene que ser de caja o banco postable del tenant, con la
--        regla de lib/studio/payment-queries.ts › isCashAccount
--        (qbo_type 'Bank' o código 1.1.1…). Si no, PAYMENT_CASH_ACCOUNT (22023);
--      · en lugar de sumar paid_amount a mano, llama a
--        public.register_collection_receipt (0467/0533), la función de
--        Cobranzas: correlativo R- serializado por tenant, cuenta de caja,
--        fund_class heredada, recibo 'aplicado', paid_amount, status y
--        last_payment_at, con sus mismas reglas de saldo. La factura ya está
--        FOR UPDATE: el lock se repite sin espera;
--      · fija payment_report_id en el recibo y devuelve el recibo en el
--        resultado, que queda guardado en payment_private.report_commands: un
--        reintento con la misma clave devuelve el MISMO recibo sin crear otro;
--      · la auditoría del reporte suma related_receipt_id en su metadata.
--    'create', 'cancel' y 'reject' quedan byte a byte como en la 0533.
-- 3. public.confirm_payment_report_with_receipt(request, report, cuenta, motivo):
--    el wrapper nuevo, INVOKER, como los tres de la 0421. resolve_payment_report
--    se conserva intacto (la 0422 lo exige y la app lo sigue usando para
--    rechazar): con 'confirmado' ahora devuelve PAYMENT_CASH_ACCOUNT, porque no
--    trae cuenta. Ese camino queda cerrado; el cierre COMPLETO llega sólo
--    después de aplicar la 0422: hasta entonces siguen vivos el RPC viejo
--    public.confirm_payment_report (0359) y la policy ALL de payment_reports,
--    que confirman sin recibo. La 0422 los revoca. El contrato lo documenta.
--
-- ── Asiento contable ────────────────────────────────────────
-- Igual que en Cobranzas (SDD-0041/0068/0488): el asiento DR caja / CR 1.1.2 lo
-- arma la app con lib/studio/accounting/receipt-posting.ts después del COMMIT,
-- idempotente por receipt_id. Si falla, el recibo queda en «Por contabilizar».
-- La app reintenta el asiento también en un replay. Esta migración no lo
-- mueve a SQL: sería una segunda implementación del posteo de cobros.
--
-- ── Fechas ──────────────────────────────────────────────────
-- received_at del recibo = paid_at del reporte, la fecha en que el cliente
-- declaró el pago y que el equipo verificó. El asiento usa esa misma fecha.
--
-- ── Método ──────────────────────────────────────────────────
-- payment_report_method → método del recibo: transferencia, pago_movil, zelle y
-- otro pasan iguales; binance → usdt (lib/studio/payment-types.ts).
--
-- ── Convivencia ─────────────────────────────────────────────
-- Con esta migración y la app anterior: la app vieja confirma con
-- resolve_payment_report, recibe PAYMENT_CASH_ACCOUNT, no cambia nada y muestra
-- «no pudimos confirmar el resultado». Con la app nueva y sin esta migración:
-- PostgREST no encuentra el wrapper (PGRST202) y la app lo dice sin efecto.
-- En los dos casos no hay escritura parcial. Un replay de una clave de
-- confirmación anterior a esta migración por resolve_payment_report también
-- recibe PAYMENT_CASH_ACCOUNT: su resultado sigue en report_commands, pero ese
-- camino ya no confirma.
--
-- ── Concurrencia ────────────────────────────────────────────
-- Orden de locks de la confirmación: lock consultivo de la clave → factura FOR
-- UPDATE → reporte FOR UPDATE → (dentro de register_collection_receipt) factura
-- otra vez, ya tomada → lock consultivo 488 del tenant. Cobranzas toma factura
-- → 488. No hay ciclos. Contrato con sesiones reales en
-- supabase/tests/0537_recibo_al_confirmar_reporte.test.sql.
--
-- ── Locks de esta migración ─────────────────────────────────
-- ALTER TABLE payment_receipts ADD COLUMN (nullable, sin default: no reescribe)
-- toma ACCESS EXCLUSIVE sobre payment_receipts y SHARE ROW EXCLUSIVE sobre
-- payment_reports por la FK, hasta el COMMIT. El índice único se construye
-- sobre una columna toda NULL. Reemplazar la función y crear el wrapper y el
-- trigger sólo toca catálogo. No modifica filas. lock_timeout 5 s y
-- statement_timeout 30 s con set local: aplicar en UNA transacción.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_expected record;
  v_proc record;
begin
  -- Tablas y columnas que el cuerpo nuevo lee o escribe, con su tipo.
  for v_expected in select * from (values
    ('public.payment_reports', 'id', 'uuid'), ('public.payment_reports', 'tenant_id', 'uuid'),
    ('public.payment_reports', 'invoice_id', 'uuid'), ('public.payment_reports', 'amount', 'numeric'),
    ('public.payment_reports', 'currency', 'public.invoice_currency'),
    ('public.payment_reports', 'method', 'public.payment_report_method'),
    ('public.payment_reports', 'paid_at', 'date'), ('public.payment_reports', 'status', 'public.payment_report_status'),
    ('public.payment_receipts', 'id', 'uuid'), ('public.payment_receipts', 'tenant_id', 'uuid'),
    ('public.payment_receipts', 'invoice_id', 'uuid'), ('public.payment_receipts', 'receipt_code', 'text'),
    ('public.payment_receipts', 'amount', 'numeric'), ('public.payment_receipts', 'currency', 'public.invoice_currency'),
    ('public.payment_receipts', 'fx_rate', 'numeric'), ('public.payment_receipts', 'cash_account_id', 'uuid'),
    ('public.payment_receipts', 'received_at', 'date'), ('public.payment_receipts', 'fund_class', 'text'),
    ('public.accounts', 'id', 'uuid'), ('public.accounts', 'tenant_id', 'uuid'),
    ('public.accounts', 'code', 'text'), ('public.accounts', 'qbo_type', 'text'),
    ('public.accounts', 'is_postable', 'boolean')
  ) e(rel, col, typ) loop
    if not exists (select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass(v_expected.rel) and a.attname = v_expected.col
        and not a.attisdropped and a.atttypid = pg_catalog.to_regtype(v_expected.typ)) then
      raise exception '0537: columna ausente o con otro tipo: %.%', v_expected.rel, v_expected.col;
    end if;
  end loop;
  if exists (select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.payment_receipts'::pg_catalog.regclass and attname = 'payment_report_id') then
    raise exception '0537 abortado: payment_receipts.payment_report_id ya existe (¿reaplicación?)';
  end if;
  if pg_catalog.to_regprocedure('public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text)') is not null
     or pg_catalog.to_regprocedure('payment_private.guard_receipt_report_link()') is not null then
    raise exception '0537 abortado: el wrapper o el guard ya existen (¿reaplicación?)';
  end if;
  -- payment_receipts sin escritura para anon (0470) y sin el nombre del trigger nuevo.
  if exists (select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.payment_receipts'::pg_catalog.regclass and tgname = 'payment_receipts_report_link_guard') then
    raise exception '0537 abortado: el trigger de vínculo ya existe';
  end if;

  -- Cuerpos exactos vigentes: el motor de comandos que deja la 0533 y el cobro
  -- de la 0533. Firma, seguridad, owner, config y ACL, como en el preflight de
  -- la 0533. Otro cuerpo aborta sin cambiar nada.
  for v_expected in select * from (values
    ('payment_private.run_report_command(uuid,uuid,text,jsonb)', true, 'b156a464950a543f12ac5bccbaa03c3d'),
    ('public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)', false, 'd3fc3f564e04b725861094903df99a04')
  ) x(signature, definer, body_md5) loop
    select * into v_proc from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure(v_expected.signature);
    if v_proc.oid is null or v_proc.proowner <> 'postgres'::pg_catalog.regrole
       or v_proc.prosecdef <> v_expected.definer
       or v_proc.prorettype <> 'jsonb'::pg_catalog.regtype
       or v_proc.proconfig is distinct from array['search_path=""']::text[]
       or not pg_catalog.has_function_privilege('authenticated', v_proc.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('anon', v_proc.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', v_proc.oid, 'EXECUTE') then
      raise exception '0537: firma, seguridad, owner o ACL inesperada: %', v_expected.signature;
    end if;
    if pg_catalog.md5(pg_catalog.replace(v_proc.prosrc, E'\r\n', E'\n')) <> v_expected.body_md5 then
      raise exception '0537 abortado: % tiene otro cuerpo (md5 %); ¿falta la 0533 o ya se aplicó esta?',
        v_expected.signature, pg_catalog.md5(pg_catalog.replace(v_proc.prosrc, E'\r\n', E'\n'));
    end if;
  end loop;
  if pg_catalog.to_regprocedure('public.resolve_payment_report(uuid,uuid,public.payment_report_status,text)') is null
     or pg_catalog.to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is null
     or pg_catalog.to_regprocedure('auth.uid()') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0537 requiere resolve_payment_report (0421), append_audit_event, auth.uid() y get_user_tenant_id()';
  end if;
end;
$preflight$;

create temporary table recibo_0537_before on commit drop as
select oid, proowner, proacl, prosecdef, proconfig, prorettype, proargtypes, proargnames, provolatile,
  pg_catalog.md5(pg_catalog.replace(prosrc, E'\r\n', E'\n')) as body_md5
from pg_catalog.pg_proc
where oid in ('payment_private.run_report_command(uuid,uuid,text,jsonb)'::pg_catalog.regprocedure,
  'public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)'::pg_catalog.regprocedure,
  'public.resolve_payment_report(uuid,uuid,public.payment_report_status,text)'::pg_catalog.regprocedure,
  'public.create_portal_payment_report(uuid,uuid,text,numeric,public.payment_report_method,date,text,text)'::pg_catalog.regprocedure,
  'public.cancel_portal_payment_report(uuid,uuid,text,text)'::pg_catalog.regprocedure);

-- ── 1. Vínculo recibo → reporte ─────────────────────────────
alter table public.payment_receipts
  add column payment_report_id uuid references public.payment_reports(id);
create unique index payment_receipts_payment_report_id_key
  on public.payment_receipts (payment_report_id) where payment_report_id is not null;
comment on column public.payment_receipts.payment_report_id is
  'SDD-0630: reporte de pago del portal que originó este recibo al confirmarse. Lo fija sólo payment_private.run_report_command; inmutable.';

create function payment_private.guard_receipt_report_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.payment_report_id is not distinct from old.payment_report_id then
      return new;
    end if;
    if old.payment_report_id is not null then
      raise exception 'PAYMENT_RECEIPT_REPORT_LINK' using errcode = '42501';
    end if;
  elsif new.payment_report_id is null then
    return new;
  end if;
  -- Sólo el comando DEFINER (owner postgres) vincula. Una sesión API, aunque
  -- tenga UPDATE sobre payment_receipts por 0470, no puede.
  if current_user <> 'postgres' then
    raise exception 'PAYMENT_RECEIPT_REPORT_LINK' using errcode = '42501';
  end if;
  if not exists (select 1 from public.payment_reports r
    where r.id = new.payment_report_id and r.tenant_id = new.tenant_id
      and r.invoice_id = new.invoice_id and r.status = 'confirmado') then
    raise exception 'PAYMENT_RECEIPT_REPORT_LINK' using errcode = '23514';
  end if;
  return new;
end;
$function$;
alter function payment_private.guard_receipt_report_link() owner to postgres;
revoke all on function payment_private.guard_receipt_report_link() from public, anon, authenticated, service_role;
create trigger payment_receipts_report_link_guard
before insert or update of payment_report_id on public.payment_receipts
for each row execute function payment_private.guard_receipt_report_link();

-- ── 2. Motor de comandos: confirmar crea el recibo ──────────
-- Fuente íntegra: 0533_fechas_caracas_operaciones.sql (que a su vez copia la
-- 0464). Deltas SDD-0630 marcados con «0630».
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
  -- 0630: cuenta de caja elegida al confirmar y recibo creado.
  v_cash uuid;
  v_collection jsonb;
  v_receipt_id uuid;
  v_receipt_row public.payment_receipts;
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
      -- 0630: confirmar trae la cuenta de caja; rechazar sigue sólo con motivo.
      when 'confirm' then array['reason', 'cash_account_id']
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
  -- 0630: sin cuenta de caja válida no hay confirmación. Cubre también al
  -- wrapper heredado resolve_payment_report, que no la manda.
  if p_kind = 'confirm' then
    begin
      v_cash := (p_input ->> 'cash_account_id')::uuid;
    exception when data_exception then
      raise exception 'PAYMENT_CASH_ACCOUNT' using errcode = '22023';
    end;
    if v_cash is null then
      raise exception 'PAYMENT_CASH_ACCOUNT' using errcode = '22023';
    end if;
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
  elsif p_kind = 'confirm' then
    -- 0630: la cuenta entra en la huella del intento.
    v_input := pg_catalog.jsonb_build_object('reason', v_reason, 'cash_account_id', v_cash);
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
  -- 0630: la cuenta tiene que ser de caja o banco, postable y del tenant
  -- (la regla de isCashAccount en lib/studio/payment-queries.ts).
  if p_kind = 'confirm' and not exists (select 1 from public.accounts a
    where a.id = v_cash and a.tenant_id = v_tenant and a.is_postable
      and (a.qbo_type = 'Bank' or a.code like '1.1.1%')) then
    raise exception 'PAYMENT_CASH_ACCOUNT' using errcode = '22023';
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
        -- 0630: el cobro va por la función de Cobranzas (0467/0533) en esta
        -- misma transacción: correlativo R-, cuenta de caja, fund_class,
        -- recibo 'aplicado', paid_amount, status y last_payment_at, con sus
        -- reglas de saldo. Reemplaza la suma a mano de la 0421.
        v_collection := public.register_collection_receipt(
          v_inv.id, v_rep.amount, v_cash,
          case v_rep.method when 'binance' then 'usdt' else v_rep.method::text end,
          v_rep.paid_at, null, 'Reporte de pago del portal', 'cliente', null, null, false);
        v_receipt_id := (v_collection ->> 'receipt_id')::uuid;
        if v_receipt_id is null then
          raise exception 'PAYMENT_STATE' using errcode = '23514';
        end if;
      end if;
      update public.payment_reports set
        status = case when p_kind = 'confirm' then 'confirmado'::public.payment_report_status else 'rechazado'::public.payment_report_status end,
        resolution_reason = v_reason, confirmed_by = v_actor, confirmed_at = pg_catalog.clock_timestamp()
      where id = p_report_id returning * into v_rep;
      if p_kind = 'confirm' then
        -- 0630: el vínculo, ya con el reporte confirmado (el guard lo exige).
        update public.payment_receipts set payment_report_id = p_report_id
        where id = v_receipt_id returning * into v_receipt_row;
      end if;
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
      'recovery', 'new_command_required')
      -- 0630: el recibo creado, en la constancia de la confirmación.
      || case when p_kind = 'confirm' then pg_catalog.jsonb_build_object('related_receipt_id', v_receipt_id)
         else '{}'::jsonb end,
    p_request_id::text, 1, 'restricted');
  if v_audit_id is null then
    raise exception 'PAYMENT_AUDIT' using errcode = '23514';
  end if;
  v_result := pg_catalog.jsonb_build_object('request_id', p_request_id, 'report_id', p_report_id,
    'invoice_id', v_inv.id, 'invoice_code', v_inv.invoice_code, 'status', v_rep.status,
    'cancelled', v_rep.cancelled_at is not null, 'audit_event_id', v_audit_id, 'replayed', false);
  -- 0630: la confirmación devuelve su recibo. Queda guardado en el recibo del
  -- comando: el replay devuelve el mismo, sin crear otro.
  if p_kind = 'confirm' then
    v_result := v_result || pg_catalog.jsonb_build_object('receipt', pg_catalog.jsonb_build_object(
      'id', v_receipt_row.id, 'code', v_receipt_row.receipt_code, 'tenant_id', v_receipt_row.tenant_id,
      'amount', v_receipt_row.amount, 'currency', v_receipt_row.currency, 'fx_rate', v_receipt_row.fx_rate,
      'cash_account_id', v_receipt_row.cash_account_id, 'received_at', v_receipt_row.received_at,
      'paid_amount', (v_collection ->> 'paid_amount')::numeric,
      'invoice_status', v_collection ->> 'status',
      'fully_paid', (v_collection ->> 'fully_paid')::boolean));
  end if;
  insert into payment_private.report_commands (request_id, tenant_id, actor_id, report_id, verb, input_hash, result, audit_event_id)
  values (p_request_id, v_tenant, v_actor, p_report_id, p_kind, v_hash, v_result, v_audit_id);
  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_old_reason, ''), true);
  return v_result;
end;
$function$;

-- ── 3. Wrapper de la confirmación con recibo ────────────────
create function public.confirm_payment_report_with_receipt(
  p_request_id uuid, p_report_id uuid, p_cash_account_id uuid, p_reason text
) returns jsonb language sql security invoker set search_path = '' as $function$
  select payment_private.run_report_command(p_request_id, p_report_id, 'confirm',
    pg_catalog.jsonb_build_object('reason', p_reason, 'cash_account_id', p_cash_account_id));
$function$;
alter function public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text) owner to postgres;
revoke all on function public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text) to authenticated;
comment on function public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text) is
  'SDD-0630: confirma un reporte de pago del portal y crea su recibo de cobro (register_collection_receipt) en la misma transacción. Rol accounting/admin; idempotente por p_request_id; la cuenta entra en la huella.';

do $postflight$
declare v_proc record; v_index record;
begin
  -- Identidad, firma y privilegios de las funciones previas, intactos.
  if exists (select 1 from recibo_0537_before b left join pg_catalog.pg_proc p on p.oid = b.oid
    where p.oid is null
       or (p.proowner, p.proacl, p.prosecdef, p.proconfig, p.prorettype, p.proargtypes, p.proargnames, p.provolatile)
          is distinct from (b.proowner, b.proacl, b.prosecdef, b.proconfig, b.prorettype, b.proargtypes, b.proargnames, b.provolatile)) then
    raise exception '0537: cambió identidad, firma o privilegios de una función previa';
  end if;
  -- Sólo cambia el cuerpo del motor; cobro y wrappers de la 0421 quedan igual.
  if exists (select 1 from recibo_0537_before b join pg_catalog.pg_proc p on p.oid = b.oid
    where p.oid <> 'payment_private.run_report_command(uuid,uuid,text,jsonb)'::pg_catalog.regprocedure
      and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) <> b.body_md5) then
    raise exception '0537: cambió el cuerpo de una función que no debía tocar';
  end if;
  if (select pg_catalog.md5(pg_catalog.replace(prosrc, E'\r\n', E'\n')) from pg_catalog.pg_proc
      where oid = 'payment_private.run_report_command(uuid,uuid,text,jsonb)'::pg_catalog.regprocedure)
     = 'b156a464950a543f12ac5bccbaa03c3d' then
    raise exception '0537: run_report_command conserva el cuerpo de la 0533';
  end if;
  select * into v_proc from pg_catalog.pg_proc
  where oid = pg_catalog.to_regprocedure('public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text)');
  if v_proc.oid is null or v_proc.prosecdef or v_proc.proowner <> 'postgres'::pg_catalog.regrole
     or v_proc.proconfig is distinct from array['search_path=""']::text[]
     or not pg_catalog.has_function_privilege('authenticated', v_proc.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', v_proc.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_proc.oid, 'EXECUTE')
     or exists (select 1 from pg_catalog.aclexplode(v_proc.proacl) a where a.grantee = 0) then
    raise exception '0537: wrapper sin la seguridad o la ACL esperadas';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p
    where p.oid = 'payment_private.guard_receipt_report_link()'::pg_catalog.regprocedure
      and (p.prosecdef or pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        or pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE'))) then
    raise exception '0537: guard del vínculo con seguridad inesperada';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.payment_receipts'::pg_catalog.regclass and tgname = 'payment_receipts_report_link_guard'
      and tgfoid = 'payment_private.guard_receipt_report_link()'::pg_catalog.regprocedure
      and tgenabled = 'O' and not tgisinternal) then
    raise exception '0537: trigger del vínculo ausente';
  end if;
  select i.indisunique, pg_catalog.pg_get_expr(i.indpred, i.indrelid) as pred into v_index
  from pg_catalog.pg_index i
  where i.indexrelid = pg_catalog.to_regclass('public.payment_receipts_payment_report_id_key');
  if v_index.indisunique is distinct from true or v_index.pred is null then
    raise exception '0537: índice único parcial del vínculo ausente';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payment_receipts'::pg_catalog.regclass and contype = 'f'
      and confrelid = 'public.payment_reports'::pg_catalog.regclass and convalidated) then
    raise exception '0537: FK del vínculo ausente';
  end if;
  if exists (select 1 from public.payment_receipts where payment_report_id is not null) then
    raise exception '0537: la migración no debía vincular filas';
  end if;
end;
$postflight$;
notify pgrst, 'reload schema';
