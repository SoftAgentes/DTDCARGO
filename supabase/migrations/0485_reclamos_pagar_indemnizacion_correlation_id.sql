-- ─────────────────────────────────────────────────────────────────────────────
-- 0485 · SDD-0534 — Pagar la indemnización de un reclamo (Reclamos) deja de
-- fallar siempre: el correlation_id que pay_claim_indemnity_governed le pasa
-- al writer AUD-01 cabe en los 128 caracteres que el writer admite.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Producción es el Supabase
--    self-hosted del servidor propio. Antes de aplicar, el Director lee en
--    producción, READ ONLY y sólo de catálogo, el md5 de prosrc, SECURITY
--    DEFINER, search_path, owner y ACL de pay_claim_indemnity_governed que el
--    preflight y el postflight exigen. Fusionar la PR NO autoriza aplicarla.
--    ORDEN: indiferente, también respecto de las otras migraciones de la
--    SDD-0534 (0483–0489): cada una toca una sola RPC y se aplica de a una. La
--    app no cambia: la pantalla y la Server Action siguen mandando la misma
--    referencia, y la firma de la RPC es la misma. Basta aplicarla para que la
--    acción funcione.
--
-- ── El defecto ──────────────────────────────────────────────
-- La pantalla arma la referencia como `claim-indemnity-payment:<id>:<uuid>`,
-- con un UUID aleatorio
-- (app/studio/(app)/reclamos/_components/ReclamosClient.tsx:513): 97
-- caracteres siempre, porque sus tres partes tienen largo fijo. La 0319
-- (0319:387-389) arma el correlation_id como
-- `claim-indemnity-payment:<id>:<referencia>`: 24 + 36 + 1 + 97 = 158. El
-- writer real (append_audit_event 0294 → append_audit_event_v1 0267:542-545) y
-- el CHECK entity_audit_log_correlation_id_check (0267:318-322) exigen
-- '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$', o sea 128 como máximo. El writer
-- levanta 22023 «audit: correlation_id inválido» al final de la RPC, y la
-- transacción entera se revierte: el reclamo sigue `aprobado`, sin asiento
-- contable y sin AUD-01. Con ese prefijo, cualquier referencia de más de 67
-- caracteres falla, aunque la propia RPC acepte hasta 128 (0319:221-225).
-- Reproducido en PGlite con el writer real (0267 + 0294), no con el simulado
-- del contrato 0319:
-- supabase/tests/0485_reclamos_pagar_indemnizacion_correlation_id.test.sql sin
-- esta migración es el control rojo.
--
-- ── El arreglo ──────────────────────────────────────────────
-- El mismo de la 0482 (SDD-0532, Naviera): el correlation_id usa el md5 de la
-- referencia en vez de la referencia:
-- `claim-indemnity-payment:<id>:<md5(referencia)>` = 24 + 36 + 1 + 32 = 93
-- caracteres, para CUALQUIER referencia que la RPC acepte. Sigue siendo
-- determinista (la misma referencia da el mismo correlation_id), conserva el
-- espacio de nombres de la 0319 y distingue referencias que comparten un
-- prefijo largo. La referencia completa sigue en payload.request_ref, que es
-- la llave de idempotencia y no cambia. md5 y no sha256, como en la 0482: con
-- los 64 caracteres del hex de sha256 el correlation_id mediría 125 y cabría,
-- pero las ocho RPC del lote R3 quedan con el mismo formato, y el hash no
-- cumple aquí una función de seguridad (no es llave única ni secreto). No se
-- toca nada más: el resto del cuerpo es el de 0319, byte a byte.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: reemplaza el cuerpo y el comentario de una función. No toca
-- filas ni toma locks de tabla. lock_timeout 5 s y statement_timeout 30 s con
-- set de sesión, como 0319.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

-- Aborta sin cambiar nada si la RPC no es la de 0319 (md5 del prosrc con
-- CRLF→LF, o sin espacios), o si perdió SECURITY DEFINER o el search_path
-- sellado. El writer AUD-01 no se vuelve a exigir: la 0319 aplicada ya lo
-- exigió en su preflight y su cuerpo lo llama.
do $preflight$
declare
  v_md5 text;
  v_md5_normalized text;
begin
  select pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')),
         pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g'))
    into v_md5, v_md5_normalized
  from pg_catalog.pg_proc p
  where p.oid = pg_catalog.to_regprocedure(
          'public.pay_claim_indemnity_governed(uuid,text,date,text,text)'
        )
    and p.prosecdef
    and p.proconfig = array['search_path=""'];

  if v_md5 is null then
    raise exception '0485 abortado: pay_claim_indemnity_governed falta o no es SECURITY DEFINER con search_path vacío';
  end if;
  if v_md5 <> 'c236f0e1701a2e46d7c7bc67a1f50288'
     and v_md5_normalized <> '701ea78b498e7f081fc6f6d25abd3ff6' then
    raise exception '0485 abortado: pay_claim_indemnity_governed tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
      v_md5, v_md5_normalized;
  end if;
end;
$preflight$;

create or replace function public.pay_claim_indemnity_governed(
  p_claim_id uuid,
  p_payment_method text,
  p_effective_date date,
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
  v_tenant uuid;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_method text := nullif(pg_catalog.btrim(p_payment_method), '');
  v_claim public.client_claims%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_stored_method text := 'transfer';
  v_cash_code text;
  v_indemnity_account uuid;
  v_cash_account uuid;
  v_entry_id uuid;
  v_entry_code text;
  v_closing_date date;
  v_attempt integer;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'claims: autenticación requerida'
      using errcode = '42501';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'claims: motivo inválido'
      using errcode = '22023';
  end if;
  if p_effective_date is null or p_effective_date > current_date then
    raise exception 'claims: fecha efectiva inválida'
      using errcode = '22023';
  end if;
  if v_method not in ('cash', 'transfer', 'usdt') then
    raise exception 'claims: medio de pago inválido'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'claims: referencia inválida'
      using errcode = '22023';
  end if;

  select c.* into v_claim
  from public.client_claims c
  join public.user_tenants ut
    on ut.tenant_id = c.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('accounting', 'admin')
   and ut.disabled_at is null
  where c.id = p_claim_id
    and c.deleted_at is null
  for update of c;

  if not found then
    raise exception 'claims: reclamo no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_claim.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'claim-indemnity-payment:' || v_tenant::text || ':' || v_request_ref,
      229
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'client_claim_indemnity_paid'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;

  if found then
    if v_existing.entity_id = p_claim_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'effective_date' = p_effective_date::text
       and v_existing.payload ->> 'payment_method' = v_method then
      return 'replayed';
    end if;
    raise exception 'claims: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_claim.status <> 'aprobado' then
    raise exception 'claims: conflicto de estado'
      using errcode = '40001';
  end if;
  if v_claim.amount_usd <= 0 then
    raise exception 'claims: indemnización sin monto positivo'
      using errcode = '22023';
  end if;
  if p_effective_date < v_claim.created_at::date then
    raise exception 'claims: fecha anterior al reclamo'
      using errcode = '22023';
  end if;

  select f.payment_method into v_stored_method
  from public.client_claim_financials f
  where f.claim_id = p_claim_id
    and f.tenant_id = v_tenant
  for update;
  if not found then
    v_stored_method := 'transfer';
  end if;
  if v_stored_method is distinct from v_method then
    raise exception 'claims: el medio de pago cambió'
      using errcode = '40001';
  end if;

  select s.closing_date into v_closing_date
  from public.accounting_settings s
  where s.tenant_id = v_tenant;
  if v_closing_date is not null and p_effective_date <= v_closing_date then
    raise exception 'claims: período contable cerrado'
      using errcode = '23514';
  end if;

  v_cash_code := case v_method
    when 'cash' then '1.1.1.1'
    when 'usdt' then '1.1.1.3'
    else '1.1.1.2'
  end;

  select a.id into v_indemnity_account
  from public.accounts a
  where a.tenant_id = v_tenant
    and a.code = '6.20'
    and a.is_postable
  for share;
  select a.id into v_cash_account
  from public.accounts a
  where a.tenant_id = v_tenant
    and a.code = v_cash_code
    and a.is_postable
  for share;
  if v_indemnity_account is null or v_cash_account is null then
    raise exception 'claims: faltan cuentas contables del pago'
      using errcode = '55000';
  end if;

  if exists (
    select 1 from public.journal_entries je
    where je.claim_id = p_claim_id
      and je.status = 'asentado'
      and je.deleted_at is null
  ) then
    raise exception 'claims: el reclamo ya tiene un asiento vivo'
      using errcode = '55000';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.claim_indemnity_payment', v_request_ref, true);
  perform pg_catalog.set_config(
    'dtd.claim_indemnity_payment_claim',
    p_claim_id::text,
    true
  );

  update public.client_claims
  set status = 'pagado',
      resolution_note = v_reason
  where id = p_claim_id
    and tenant_id = v_tenant
    and status = 'aprobado'
    and deleted_at is null;
  if not found then
    raise exception 'claims: conflicto al declarar el pago'
      using errcode = '40001';
  end if;

  for v_attempt in 1..3 loop
    begin
      v_entry_code := public.next_entry_code(v_tenant);
      insert into public.journal_entries (
        tenant_id, entry_code, entry_date, memo, status, source,
        claim_id, posted_at
      ) values (
        v_tenant,
        v_entry_code,
        p_effective_date,
        'Indemnización ' || v_claim.claim_code,
        'asentado',
        'claim',
        p_claim_id,
        pg_catalog.clock_timestamp()
      ) returning id into v_entry_id;
      exit;
    exception when unique_violation then
      if v_attempt = 3 then
        raise exception 'claims: no se pudo reservar el código del asiento'
          using errcode = '40001';
      end if;
    end;
  end loop;

  insert into public.journal_lines (
    entry_id, account_id, debit, credit, line_memo
  ) values
    (v_entry_id, v_indemnity_account, v_claim.amount_usd, 0, 'Indemnización al cliente'),
    (v_entry_id, v_cash_account, 0, v_claim.amount_usd, 'Salida de caja / banco');

  -- SDD-0534: el writer AUD-01 admite 128 caracteres de correlation_id. Con
  -- el md5 de la referencia mide siempre 93; la referencia completa queda en
  -- payload.request_ref.
  v_correlation := pg_catalog.concat(
    'claim-indemnity-payment:', p_claim_id::text, ':',
    pg_catalog.md5(v_request_ref)
  );
  perform public.append_audit_event(
    v_tenant,
    'client_claim',
    p_claim_id,
    'user',
    v_actor,
    'client_claim_indemnity_paid',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_claim.status,
      'resolution_note', v_claim.resolution_note
    ),
    pg_catalog.jsonb_build_object(
      'status', 'pagado',
      'resolution_note', v_reason
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'effective_date', p_effective_date,
      'payment_method', v_method,
      'amount_usd', v_claim.amount_usd,
      'journal_entry_id', v_entry_id,
      'entry_code', v_entry_code,
      'from', v_claim.status,
      'to', 'pagado'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

-- CREATE OR REPLACE conserva el owner y la ACL que dejó 0319 (postgres;
-- EXECUTE sólo para authenticated). No se reafirman: si producción los tiene
-- distintos, el postflight aborta y se revisa antes de aplicar.
comment on function public.pay_claim_indemnity_governed(uuid, text, date, text, text) is
  'SDD-0229: pago R3 de indemnización con rol, tenant, estado, período, asiento balanceado, idempotencia y AUD-01 atómicos. SDD-0534: correlation_id con md5 de la referencia, 93 caracteres.';

-- El cuerpo instalado es el de esta migración, con la seguridad, el owner y
-- la ACL de 0319.
do $postflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(
            'public.pay_claim_indemnity_governed(uuid,text,date,text,text)'
          )
      and p.prosecdef
      and p.proconfig = array['search_path=""']
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n'))
          = 'c09dd95160a6925af110759a5a0b379f'
  ) then
    raise exception '0485: postflight — pay_claim_indemnity_governed no quedó con el cuerpo, DEFINER, search_path u owner de 0485';
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.pay_claim_indemnity_governed(uuid,text,date,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.pay_claim_indemnity_governed(uuid,text,date,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.pay_claim_indemnity_governed(uuid,text,date,text,text)',
       'execute'
     ) then
    raise exception '0485: postflight — EXECUTE de pay_claim_indemnity_governed no es sólo de authenticated';
  end if;
end;
$postflight$;
