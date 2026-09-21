-- ─────────────────────────────────────────────────────────────────────────────
-- 0471 · SDD-0496 — Aplicar y revertir el crédito de referido sobre una factura
-- en una sola transacción, con la factura tomada FOR UPDATE.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: MIGRATE-FIRST. Se aplica ANTES de integrar la PR de SDD-0496. Es
--    aditiva (dos funciones nuevas; no reemplaza ni altera nada), así que la
--    app desplegada hoy no la nota. La app de SDD-0496, en cambio, no puede
--    aplicar ni revertir el crédito sin ella.
--
-- ── El defecto ──────────────────────────────────────────────
-- La SDD-0490 midió y cerró en TypeScript lo que se podía cerrar, y dejó
-- escrito su riesgo residual (spec 0490, «Riesgo residual»): la aplicación y la
-- reversión siguen siendo varias peticiones sin transacción común. Quedan dos
-- ventanas en las que la reversión baja un abono que nunca llegó a la factura:
--
--   · una anulación que cae entre el claim de la aplicación y su UPDATE final;
--   · un proceso de aplicación que murió en ese mismo tramo.
--
-- En las dos, el crédito queda `aplicado` y la factura todavía no tiene el
-- abono. Si tiene otros pagos, la reversión le resta 80 DE MÁS. Es un defecto de
-- dinero: a una factura se le descuenta un crédito que nunca se le abonó.
-- Reproducido con sesiones reales en supabase/tests/0467_reversion_credito_carrera.test.sql
-- (escenarios 5 y 6), cuyas fases ANTES son el control.
--
-- ── Qué agrega ──────────────────────────────────────────────
--   public.apply_referral_credit(uuid, uuid)     aplica el crédito a una factura
--   public.revert_referral_credits(uuid, uuid)   revierte los créditos de una factura
-- Cada una exige rol accounting o admin en el tenant, como 0421 y 0467, y toma
-- la factura FOR UPDATE antes de leer su saldo. Escribe `referrals` e
-- `invoices` en la MISMA transacción. Devuelve en jsonb lo que la app necesita
-- para el asiento, que sigue fuera y best-effort, como en 0467 y SDD-0041/0068.
--
-- ── Por qué el asiento se queda afuera ──────────────────────
-- Decisión de esta SDD, con el precedente de la 0467 («Devuelve en jsonb lo que
-- la app necesita para el asiento, que sigue fuera y best-effort»). El asiento
-- del crédito lo arma lib/studio/accounting/referral-credit-posting.ts: busca
-- dos cuentas del plan POR CÓDIGO, saca el correlativo con next_entry_code e
-- inserta cabecera + dos líneas, con skip graceful si al tenant le falta una
-- cuenta. Portar eso a plpgsql multiplicaría la superficie de la migración sin
-- tocar el defecto: el invariante que el dinero necesita es
-- referrals.status ↔ invoices.paid_amount, y ése es el que el lock protege. El
-- asiento ya tiene su propia idempotencia DURA en la base —el índice único
-- parcial journal_entries_referral_credit_uniq de 0237— y la reversión lo barre
-- por referral_id, así que un asiento no puede duplicarse ni quedar huérfano.
-- Consecuencia asumida y explícita: entre el COMMIT de apply_referral_credit y
-- el asiento hay una ventana en la que el crédito está aplicado y el asiento
-- todavía no existe. Es RECUPERABLE —la app compensa llamando a
-- revert_referral_credits con el mismo crédito, y la reversión barre por
-- referral_id— a diferencia de la ventana que esta migración cierra, que dejaba
-- la factura con dinero de menos y sin rastro.
--
-- ── Orden de locks ──────────────────────────────────────────
-- FACTURA → CRÉDITO(S), el mismo en las dos funciones. En revert_referral_credits
-- los créditos se leen y se toman DESPUÉS del lock de la factura y ordenados por
-- id: así una aplicación en vuelo o ya comprometida no puede quedar fuera del
-- barrido, y dos reversiones de la misma factura se serializan sin ciclo. La
-- 0467 toma recibo → factura y factura → lock consultivo del tenant; la 0421,
-- factura → reporte. Ninguna toma `referrals`, así que la cadena completa
-- (recibo → factura → crédito) no tiene ciclos.
--
-- ── Regla de estado ─────────────────────────────────────────
-- Al APLICAR: `pagada` si el pagado alcanza el total, `parcial` si no — la misma
-- de register_collection_receipt (0467). Al REVERTIR: una factura `anulada` (o
-- en `borrador`) conserva su estado y sólo baja el pagado; otra queda `emitida`
-- sin pagos o `parcial` con pagos — la de void_collection_receipt (0467:332-393).
-- Así una factura no queda «pagada» con saldo pendiente.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: crea funciones, cambia su owner y su ACL. Ninguno sobre
-- invoices ni referrals, y no toca filas. lock_timeout 5 s y statement_timeout
-- 30 s con set de sesión, como 0421-0423 y 0467.
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
     or pg_catalog.to_regclass('public.referrals') is null
     or pg_catalog.to_regclass('public.user_tenants') is null
     or pg_catalog.to_regtype('public.invoice_status') is null
     or pg_catalog.to_regtype('public.invoice_currency') is null
     or pg_catalog.to_regtype('public.referral_status') is null
     or pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0471 requiere invoices, referrals, user_tenants, invoice_status, invoice_currency, referral_status y los roles API';
  end if;

  -- Columnas que las funciones leen o escriben, con su tipo.
  for v_expected in select * from (values
    ('public.invoices', 'id', 'uuid'), ('public.invoices', 'tenant_id', 'uuid'),
    ('public.invoices', 'invoice_code', 'text'), ('public.invoices', 'client_markbox', 'text'),
    ('public.invoices', 'status', 'public.invoice_status'),
    ('public.invoices', 'currency', 'public.invoice_currency'),
    ('public.invoices', 'total_amount', 'numeric'), ('public.invoices', 'paid_amount', 'numeric'),
    ('public.invoices', 'issued_at', 'date'),
    ('public.invoices', 'last_payment_at', 'timestamptz'),
    ('public.invoices', 'deleted_at', 'timestamptz'),
    ('public.referrals', 'id', 'uuid'), ('public.referrals', 'tenant_id', 'uuid'),
    ('public.referrals', 'referral_code', 'text'), ('public.referrals', 'referrer_markbox', 'text'),
    ('public.referrals', 'status', 'public.referral_status'),
    ('public.referrals', 'reward_usd', 'numeric'),
    ('public.referrals', 'accredited_at', 'timestamptz'),
    ('public.referrals', 'applied_invoice_id', 'uuid'),
    ('public.referrals', 'applied_entry_id', 'uuid'),
    ('public.referrals', 'applied_at', 'timestamptz'),
    ('public.referrals', 'deleted_at', 'timestamptz'),
    ('public.user_tenants', 'user_id', 'uuid'), ('public.user_tenants', 'tenant_id', 'uuid'),
    ('public.user_tenants', 'role', 'text'), ('public.user_tenants', 'disabled_at', 'timestamptz')
  ) e(rel, col, typ) loop
    if not exists (select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass(v_expected.rel) and a.attname = v_expected.col
        and not a.attisdropped
        and a.atttypid = pg_catalog.to_regtype(v_expected.typ)) then
      raise exception '0471: columna ausente o con otro tipo: %.%', v_expected.rel, v_expected.col;
    end if;
  end loop;

  -- El estado terminal del crédito y los estados de factura que la regla usa
  -- nacen en 0237 y 0077: sin ellos las dos funciones no compilan su lógica.
  for v_expected in select * from (values
    ('public.referral_status', 'acreditado'), ('public.referral_status', 'aplicado'),
    ('public.invoice_status', 'borrador'), ('public.invoice_status', 'emitida'),
    ('public.invoice_status', 'parcial'), ('public.invoice_status', 'pagada'),
    ('public.invoice_status', 'vencida'), ('public.invoice_status', 'anulada')
  ) e(typ, label) loop
    if not exists (select 1 from pg_catalog.pg_enum
      where enumtypid = pg_catalog.to_regtype(v_expected.typ) and enumlabel = v_expected.label) then
      raise exception '0471: el tipo % no tiene el valor %', v_expected.typ, v_expected.label;
    end if;
  end loop;

  -- La coherencia de campos de 0237: un crédito aplicado tiene factura y
  -- timestamp juntos, y el asiento sólo existe si hay factura. Las dos funciones
  -- escriben los tres campos a la vez para no violarla.
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.referrals'::pg_catalog.regclass and contype = 'c' and convalidated
      and conname = 'referrals_credit_applied_coherent') then
    raise exception '0471 requiere el CHECK referrals_credit_applied_coherent de 0237';
  end if;

  -- Dependencias que se invocan: firma, seguridad y cuerpo vigentes (md5 del
  -- prosrc con CRLF→LF, o sin espacios). Otro cuerpo aborta sin cambiar nada.
  -- Las huellas son las que 0467 y 0468 ya verificaron contra producción al
  -- aplicarse (2026-09-18 y 2026-09-19).
  for v_expected in select * from (values
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
      raise exception '0471: dependencia ausente o con otra firma/seguridad: %', v_expected.signature;
    end if;
    if v_md5 <> v_expected.body_md5 and v_md5_normalized <> v_expected.body_md5_normalized then
      raise exception '0471 abortado: % tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
        v_expected.signature, v_md5, v_md5_normalized;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0471 requiere auth.uid()';
  end if;

  -- Una segunda aplicación aborta: estas funciones no se reemplazan desde acá.
  if pg_catalog.to_regprocedure('public.apply_referral_credit(uuid,uuid)') is not null
     or pg_catalog.to_regprocedure('public.revert_referral_credits(uuid,uuid)') is not null then
    raise exception '0471 abortado: las funciones del crédito de referido ya existen';
  end if;
end;
$preflight$;

create function public.apply_referral_credit(
  p_referral_id uuid,
  p_invoice_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_inv public.invoices%rowtype;
  v_ref public.referrals%rowtype;
  v_amount numeric(14,2);
  v_new_paid numeric(14,2);
  v_new_status public.invoice_status;
  v_applied_at timestamptz := pg_catalog.clock_timestamp();
begin
  if not exists (select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and ut.role in ('admin', 'accounting')) then
    raise exception 'REFERRAL_CREDIT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_referral_id is null or p_invoice_id is null then
    raise exception 'REFERRAL_CREDIT_INPUT' using errcode = '22023';
  end if;

  -- FACTURA → CRÉDITO. La factura se toma FOR UPDATE antes de leer su saldo:
  -- un cobro, una confirmación de reporte (0421), una anulación (0294) u otra
  -- aplicación esperan a este COMMIT y después leen el pagado que dejó. El
  -- claim del crédito y el abono a la factura quedan en la misma transacción:
  -- no existe el estado «crédito aplicado, factura sin el abono».
  select i.* into v_inv from public.invoices i
  where i.id = p_invoice_id and i.tenant_id = v_tenant
  for update;
  if not found or v_inv.deleted_at is not null then
    raise exception 'REFERRAL_CREDIT_INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select r.* into v_ref from public.referrals r
  where r.id = p_referral_id and r.tenant_id = v_tenant and r.deleted_at is null
  for update;
  if not found then
    raise exception 'REFERRAL_CREDIT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- El claim idempotente de SDD-0137: sólo un 'acreditado' se aplica. Bajo el
  -- lock, un segundo intento ya lo ve 'aplicado'.
  if v_ref.status <> 'acreditado' then
    raise exception 'REFERRAL_CREDIT_STATE' using errcode = '23514';
  end if;
  v_amount := pg_catalog.round(coalesce(v_ref.reward_usd, 0), 2);
  if v_amount <= 0 then
    raise exception 'REFERRAL_CREDIT_AMOUNT' using errcode = '23514';
  end if;

  if v_inv.client_markbox is distinct from v_ref.referrer_markbox then
    raise exception 'REFERRAL_CREDIT_OTHER_CLIENT' using errcode = '23514';
  end if;
  if v_inv.status not in ('emitida', 'parcial', 'vencida') then
    raise exception 'REFERRAL_CREDIT_INVOICE_STATE' using errcode = '23514';
  end if;
  if v_inv.currency not in ('USD', 'USDT') then
    raise exception 'REFERRAL_CREDIT_CURRENCY' using errcode = '23514';
  end if;

  -- COMPRA NUEVA (regla del founder 2026-07-15): la factura tiene que ser del
  -- día en que NACIÓ el crédito en adelante. issued_at es `date` y
  -- accredited_at `timestamptz`: se comparan por día UTC, que es lo mismo que
  -- hace toCalendarDay en lib/studio/fidelizacion/referral-credit-queries.ts.
  if v_ref.accredited_at is null or v_inv.issued_at is null
     or v_inv.issued_at < (v_ref.accredited_at at time zone 'UTC')::date then
    raise exception 'REFERRAL_CREDIT_OLD_INVOICE' using errcode = '23514';
  end if;

  -- Fix A (over-credit): contra el SALDO REAL, no el total. V1 no parte el
  -- crédito, así que un saldo menor lo rechaza en vez de dejar la CxC negativa.
  if v_amount > v_inv.total_amount - v_inv.paid_amount then
    raise exception 'REFERRAL_CREDIT_EXCEEDS_BALANCE' using errcode = '23514';
  end if;

  -- applied_entry_id se deja como está (null, porque el CHECK de 0237 lo exige
  -- en un crédito sin factura): lo linkea la app cuando el asiento existe.
  update public.referrals
  set status = 'aplicado', applied_invoice_id = v_inv.id, applied_at = v_applied_at
  where id = v_ref.id;

  -- Fix C — consistencia GL ↔ subledger: el crédito entra como ABONO NO
  -- MONETARIO (sube paid_amount). No hay payment_receipt: no entró caja.
  v_new_paid := v_inv.paid_amount + v_amount;
  v_new_status := case when v_new_paid >= v_inv.total_amount then 'pagada' else 'parcial' end;
  update public.invoices
  set paid_amount = v_new_paid, status = v_new_status, last_payment_at = v_applied_at
  where id = v_inv.id;

  return pg_catalog.jsonb_build_object(
    'referral_id', v_ref.id, 'referral_code', v_ref.referral_code, 'tenant_id', v_tenant,
    'referrer_markbox', v_ref.referrer_markbox, 'amount', v_amount,
    'invoice_id', v_inv.id, 'invoice_code', v_inv.invoice_code, 'currency', v_inv.currency,
    'paid_amount', v_new_paid, 'total_amount', v_inv.total_amount, 'status', v_new_status,
    'applied_at', v_applied_at, 'fully_paid', v_new_status = 'pagada');
end;
$function$;

create function public.revert_referral_credits(
  p_invoice_id uuid,
  p_referral_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_inv public.invoices%rowtype;
  v_ref public.referrals%rowtype;
  v_total numeric(14,2) := 0;
  v_new_paid numeric(14,2);
  v_new_status public.invoice_status;
  v_reverted jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and ut.role in ('admin', 'accounting')) then
    raise exception 'REFERRAL_CREDIT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_invoice_id is null then
    raise exception 'REFERRAL_CREDIT_INPUT' using errcode = '22023';
  end if;

  -- FACTURA → CRÉDITO(S), el mismo orden que apply_referral_credit. La factura
  -- se toma primero y los créditos se leen DESPUÉS, bajo ese lock: una
  -- aplicación en vuelo o ya comprometida no puede quedarse fuera del barrido.
  select i.* into v_inv from public.invoices i
  where i.id = p_invoice_id and i.tenant_id = v_tenant
  for update;
  if not found then
    -- Sin factura no hay abono que deshacer. Es el caso idempotente de
    -- revertReferralCreditsForInvoice, no un error.
    return pg_catalog.jsonb_build_object(
      'invoice_id', p_invoice_id, 'tenant_id', v_tenant, 'reverted', '[]'::jsonb, 'count', 0);
  end if;

  -- Por id, para que dos reversiones de la misma factura tomen los créditos en
  -- el mismo orden. p_referral_id null = barrido completo de la factura.
  for v_ref in
    select r.* from public.referrals r
    where r.tenant_id = v_tenant and r.applied_invoice_id = v_inv.id
      and r.status = 'aplicado' and r.deleted_at is null
      and (p_referral_id is null or r.id = p_referral_id)
    order by r.id
    for update
  loop
    -- El claim de la reversión: 'aplicado' → 'acreditado' con el rastro limpio.
    -- applied_entry_id se limpia junto a los otros dos para no violar el CHECK
    -- de 0237; el asiento lo anula la app, que barre por referral_id.
    update public.referrals
    set status = 'acreditado', applied_invoice_id = null, applied_entry_id = null, applied_at = null
    where id = v_ref.id;

    v_total := v_total + pg_catalog.round(coalesce(v_ref.reward_usd, 0), 2);
    v_reverted := v_reverted || pg_catalog.jsonb_build_object(
      'referral_id', v_ref.id, 'referral_code', v_ref.referral_code,
      'amount', pg_catalog.round(coalesce(v_ref.reward_usd, 0), 2),
      'applied_entry_id', v_ref.applied_entry_id);
  end loop;

  if v_total > 0 then
    v_new_paid := greatest(0, v_inv.paid_amount - v_total);
    -- La regla de void_collection_receipt (0467): una factura anulada o en
    -- borrador no revive; sólo baja el pagado. Así no queda «pagada» con saldo.
    v_new_status := case
      when v_inv.status in ('borrador', 'anulada') then v_inv.status
      when v_new_paid <= 0 then 'emitida'
      else 'parcial'
    end;
    update public.invoices
    set paid_amount = v_new_paid, status = v_new_status where id = v_inv.id;
  else
    v_new_paid := v_inv.paid_amount;
    v_new_status := v_inv.status;
  end if;

  return pg_catalog.jsonb_build_object(
    'invoice_id', v_inv.id, 'invoice_code', v_inv.invoice_code, 'tenant_id', v_tenant,
    'reverted', v_reverted, 'count', pg_catalog.jsonb_array_length(v_reverted),
    'amount', v_total, 'paid_amount', v_new_paid, 'status', v_new_status);
end;
$function$;

comment on function public.apply_referral_credit(uuid,uuid) is
  'SDD-0496: aplica un crédito de referido acreditado a una factura del referidor en una transacción. Rol accounting/admin; factura FOR UPDATE y después el crédito; compra nueva, moneda USD/USDT y saldo estricto (REFERRAL_CREDIT_EXCEEDS_BALANCE); claim del crédito + paid_amount + status juntos. El asiento sigue fuera y best-effort.';
comment on function public.revert_referral_credits(uuid,uuid) is
  'SDD-0496: revierte los créditos de referido aplicados a una factura (p_referral_id null = todos) en una transacción. Rol accounting/admin; factura FOR UPDATE y después los créditos por id; devuelve el crédito a acreditado con el rastro limpio y baja el abono con la regla de estado de void_collection_receipt (0467). Los asientos los anula la app, barriendo por referral_id.';

-- SECURITY INVOKER (el default), search_path vacío, owner postgres y EXECUTE
-- sólo para authenticated: el patrón D2 de 0294 y 0467. Corren con la RLS y los
-- GRANT de quien llama y no amplían ningún privilegio: invoices exige
-- accounting/admin por 0407, y referrals es tenant-wide para authenticated por
-- 0098. La auditoría D2 (0290) sigue en los triggers.
alter function public.apply_referral_credit(uuid,uuid) owner to postgres;
alter function public.revert_referral_credits(uuid,uuid) owner to postgres;

revoke all on function public.apply_referral_credit(uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.revert_referral_credits(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.apply_referral_credit(uuid,uuid) to authenticated;
grant execute on function public.revert_referral_credits(uuid,uuid) to authenticated;

do $postflight$
begin
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.oid in (
          pg_catalog.to_regprocedure('public.apply_referral_credit(uuid,uuid)'),
          pg_catalog.to_regprocedure('public.revert_referral_credits(uuid,uuid)'))
        and not p.prosecdef and p.provolatile = 'v'
        and p.proowner = 'postgres'::pg_catalog.regrole
        and p.prorettype = 'pg_catalog.jsonb'::pg_catalog.regtype
        and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not exists (select 1 from pg_catalog.aclexplode(p.proacl) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE')) <> 2 then
    raise exception '0471: postflight — funciones del crédito de referido sin INVOKER, search_path, owner o ACL esperados';
  end if;
end;
$postflight$;
-- ─────────────────────────────────────────────────────────────────────────────
-- Fin migración 0471_credito_referido_atomico.sql
-- Aplicar SÓLO con OK nominal de Sam nombrando este archivo, con el runbook
-- docs/runbooks/aplicar-migraciones-prod.md y el name exacto
-- 0471_credito_referido_atomico. Fusionar la PR NO lo autoriza.
-- ─────────────────────────────────────────────────────────────────────────────
