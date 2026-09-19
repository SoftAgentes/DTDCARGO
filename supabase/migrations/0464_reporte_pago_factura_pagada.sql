-- ─────────────────────────────────────────────────────────────────────────────
-- 0464 · SDD-0484 — Confirmar un reporte de pago nunca deja la factura con más
-- pagado que su total, y la cancelación guarda su motivo en el reporte.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    Antes: desplegar la app con los dos códigos nuevos de
--    lib/portal/payment-report-commands.ts. Sin ellos la app vieja muestra el
--    rechazo como «resultado incierto» (no hay mutación, pero confunde).
--
-- ── Qué cambia ──────────────────────────────────────────────
-- Reemplaza sólo payment_private.run_report_command de 0421 (APLICADA,
-- ledger 20260913224126; ese archivo no se edita). El cuerpo es el de 0421
-- copiado textual con tres diferencias:
--   · create → create or replace;
--   · confirmar sobre una factura `pagada` → PAYMENT_INVOICE_PAID, y
--     confirmar un monto mayor que el saldo (total − pagado) →
--     PAYMENT_EXCEEDS_BALANCE; ambos 23514, sin mutación, recibo ni evento;
--   · cancelar escribe el motivo validado también en resolution_reason.
-- Rechazar y cancelar siguen disponibles sobre una factura pagada: son la
-- salida del reporte pendiente y no mueven el saldo. Un replay de una
-- confirmación ya hecha devuelve su recibo aunque la factura quedó pagada:
-- el recibo se busca antes de las reglas de estado, igual que en 0421.
--
-- Decisiones de Sam (2026-09-18, AskUserQuestion): factura pagada →
-- «Rechazar»; excedente sobre el saldo → «Rechazar el excedente» (la regla de
-- Cobranzas); motivo de cancelación → «Mostrarlo en el reporte». Studio y el
-- Portal ya leen resolution_reason como «Motivo»: no cambian.
--
-- ── Qué NO cambia ───────────────────────────────────────────
-- Firma, SECURITY DEFINER, search_path vacío, owner postgres y EXECUTE sólo
-- para authenticated: es lo que exige el preflight de 0422. No toca los
-- wrappers, las policies, el guard de columnas, el validador 0195 (lo exige
-- 0423) ni la RPC heredada confirm_payment_report: hasta aplicar 0422 esa RPC
-- sigue ejecutable y confirma sin estas reglas. Sin backfill: los reportes
-- cancelados antes de esta migración conservan el motivo sólo en la auditoría.
--
-- ── Concurrencia ────────────────────────────────────────────
-- La factura se toma FOR UPDATE antes de leer su saldo (bloque heredado de
-- 0421). Dos confirmaciones simultáneas se serializan y la segunda compara
-- contra el pagado que dejó la primera. Probado con dos sesiones reales en
-- scripts/qa/payment-report-confirm-race.mjs.
--
-- ── Locks ───────────────────────────────────────────────────
-- Medidos en PostgreSQL 17 (PGlite y postgres:17), hasta el COMMIT: ACCESS
-- EXCLUSIVE sobre el objeto run_report_command, que sólo choca con otra DDL
-- sobre la función (llamarla no toma ese lock), y SHARE UPDATE EXCLUSIVE sobre
-- payment_reports por el COMMENT de columna, que no bloquea lecturas ni
-- escrituras. Ninguno sobre invoices ni sobre los recibos; no reescribe filas.
-- lock_timeout 5 s y statement_timeout 30 s con set de sesión, igual que
-- 0421-0423.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_fn oid := pg_catalog.to_regprocedure('payment_private.run_report_command(uuid,uuid,text,jsonb)');
  v_md5 text;
  v_md5_normalized text;
begin
  if v_fn is null
     or pg_catalog.to_regclass('payment_private.report_commands') is null
     or pg_catalog.to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is null then
    raise exception '0464 requiere los comandos, los recibos y la auditoría de 0421';
  end if;
  if not exists (select 1 from pg_catalog.pg_proc p
    where p.oid = v_fn and p.prosecdef and p.proowner = 'postgres'::regrole
      and p.prorettype = 'pg_catalog.jsonb'::regtype
      and p.proconfig = array['search_path=""']::text[]
      and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')) then
    raise exception '0464 abortado: run_report_command sin el owner, la seguridad o la ACL de 0421';
  end if;
  -- Cuerpo vigente: el de 0421 exacto (md5 del texto entre $function$) o el
  -- mismo sin espacios. Cualquier otro —incluida una segunda aplicación de
  -- 0464— aborta sin cambiar nada y muestra las dos huellas leídas.
  select pg_catalog.md5(p.prosrc), pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g'))
    into v_md5, v_md5_normalized
  from pg_catalog.pg_proc p where p.oid = v_fn;
  if v_md5 <> '7814b3911f1e273a52bf870d8db08155'
     and v_md5_normalized <> 'c5ab13c20d8ec372e4399ca08833964c' then
    raise exception '0464 abortado: run_report_command no es el cuerpo de 0421 (md5 %, sin espacios %); revisar antes de aplicar',
      v_md5, v_md5_normalized;
  end if;
  -- El motivo de la cancelación va a resolution_reason: la columna, su CHECK
  -- de 4 a 500 y el guard que impide escribirla por API deben ser los de 0421.
  if not exists (select 1 from pg_catalog.pg_attribute
       where attrelid = 'public.payment_reports'::regclass and attname = 'resolution_reason'
         and not attisdropped and atttypid = 'pg_catalog.text'::regtype)
     or not exists (select 1 from pg_catalog.pg_constraint
       where conrelid = 'public.payment_reports'::regclass
         and conname = 'payment_reports_resolution_reason_length' and convalidated)
     or not exists (select 1 from pg_catalog.pg_trigger
       where tgrelid = 'public.payment_reports'::regclass and tgname = 'payment_reports_command_fields'
         and tgfoid = pg_catalog.to_regprocedure('payment_private.guard_report_command_fields()')
         and tgenabled = 'O' and not tgisinternal) then
    raise exception '0464 requiere resolution_reason, su CHECK de 4 a 500 y el guard de columnas de 0421';
  end if;
end;
$preflight$;

create or replace function payment_private.run_report_command(
  p_request_id uuid, p_report_id uuid, p_kind text, p_input jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $function$
declare
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
       or v_paid_at > (pg_catalog.clock_timestamp() at time zone 'UTC')::date
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

-- create or replace conserva owner y ACL; se reafirman igual que en 0421.
alter function payment_private.run_report_command(uuid,uuid,text,jsonb) owner to postgres;
revoke all on function payment_private.run_report_command(uuid,uuid,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function payment_private.run_report_command(uuid,uuid,text,jsonb) to authenticated;

comment on function payment_private.run_report_command(uuid,uuid,text,jsonb) is
  'SDD-0365/0484: crea, cancela, confirma o rechaza reportes de pago con auditoría y recibo atómicos. Confirmar exige factura no pagada y monto no mayor que el saldo; cancelar guarda su motivo en resolution_reason.';
comment on column public.payment_reports.resolution_reason is
  'SDD-0365/0484: motivo de la resolución de finanzas (confirmado/rechazado) o de la cancelación del cliente, separado de la nota original. 4 a 500 caracteres; sólo lo escribe el comando 0421/0464.';

do $postflight$
declare v_api record;
begin
  -- Las cuatro firmas que revisa el preflight de 0422, con la misma seguridad.
  for v_api in select * from (values
    ('public.create_portal_payment_report(uuid,uuid,text,numeric,public.payment_report_method,date,text,text)', false),
    ('public.cancel_portal_payment_report(uuid,uuid,text,text)', false),
    ('public.resolve_payment_report(uuid,uuid,public.payment_report_status,text)', false),
    ('payment_private.run_report_command(uuid,uuid,text,jsonb)', true)
  ) api(signature, is_definer) loop
    if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_api.signature)
        and p.prosecdef = v_api.is_definer
        and p.proowner = 'postgres'::regrole
        and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')) then
      raise exception '0464 abortado: % quedó sin el owner, la seguridad o la ACL que exige 0422', v_api.signature;
    end if;
  end loop;
  -- Huella del cuerpo de ESTE archivo: la que el Director compara después de
  -- aplicar. Si se edita el cuerpo, se recalcula (la prueba PGlite la verifica).
  if not exists (select 1 from pg_catalog.pg_proc
    where oid = 'payment_private.run_report_command(uuid,uuid,text,jsonb)'::regprocedure
      and pg_catalog.md5(prosrc) = 'c3aab7fcb10e3bf5de0fa40cc562a45d') then
    raise exception '0464 abortado: el cuerpo nuevo de run_report_command no quedó instalado';
  end if;
end;
$postflight$;
