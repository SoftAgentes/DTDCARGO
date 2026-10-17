-- ─────────────────────────────────────────────────────────────────────────────
-- 0483 · SDD-0534 — Marcar pagado en China un cruce de reclamo (Financiero
-- China) deja de fallar siempre: el correlation_id que
-- mark_claim_offset_paid_in_china_governed le pasa al writer AUD-01 cabe en
-- los 128 caracteres que el writer admite.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Producción es el Supabase
--    self-hosted del servidor propio. Antes de aplicar, el Director lee en
--    producción, READ ONLY y sólo de catálogo, el md5 de prosrc, SECURITY
--    DEFINER, search_path, owner y ACL de
--    mark_claim_offset_paid_in_china_governed que el preflight y el postflight
--    exigen. Fusionar la PR NO autoriza aplicarla.
--    ORDEN: indiferente, también respecto de las otras migraciones de la
--    SDD-0534 (0483–0489): cada una toca una sola RPC y se aplica de a una. La
--    app no cambia: la pantalla y la Server Action siguen mandando la misma
--    referencia, y la firma de la RPC es la misma. Basta aplicarla para que la
--    acción funcione.
--
-- ── El defecto ──────────────────────────────────────────────
-- La pantalla arma la referencia como `partner-claim-payment:<id>:<uuid>`, con
-- un UUID aleatorio
-- (app/studio/(app)/financiero-china/_components/ClaimOffsetsTab.tsx:62): 95
-- caracteres siempre, porque sus tres partes tienen largo fijo. La 0317
-- (0317:187-189) arma el correlation_id como
-- `partner-claim-payment:<id>:<referencia>`: 22 + 36 + 1 + 95 = 154. El writer
-- real (append_audit_event 0294 → append_audit_event_v1 0267:542-545) y el
-- CHECK entity_audit_log_correlation_id_check (0267:318-322) exigen
-- '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$', o sea 128 como máximo. El writer
-- levanta 22023 «audit: correlation_id inválido» al final de la RPC, y la
-- transacción entera se revierte: el cruce sigue `reconocido_proveedor`, sin
-- fecha de recepción y sin AUD-01. Con ese prefijo, cualquier referencia de
-- más de 69 caracteres falla, aunque la propia RPC acepte hasta 128
-- (0317:118-122). Reproducido en PGlite con el writer real (0267 + 0294), no
-- con el simulado del contrato 0317:
-- supabase/tests/0483_financiero_china_pago_correlation_id.test.sql sin esta
-- migración es el control rojo.
--
-- ── El arreglo ──────────────────────────────────────────────
-- El mismo de la 0482 (SDD-0532, Naviera): el correlation_id usa el md5 de la
-- referencia en vez de la referencia:
-- `partner-claim-payment:<id>:<md5(referencia)>` = 22 + 36 + 1 + 32 = 91
-- caracteres, para CUALQUIER referencia que la RPC acepte. Sigue siendo
-- determinista (la misma referencia da el mismo correlation_id), conserva el
-- espacio de nombres de la 0317 y distingue referencias que comparten un
-- prefijo largo. La referencia completa sigue en payload.request_ref, que es
-- la llave de idempotencia y no cambia. md5 y no sha256, como en la 0482: con
-- los 64 caracteres del hex de sha256 el correlation_id mediría 123 y cabría,
-- pero las ocho RPC del lote R3 quedan con el mismo formato, y el hash no
-- cumple aquí una función de seguridad (no es llave única ni secreto). No se
-- toca nada más: el resto del cuerpo es el de 0317, byte a byte.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: reemplaza el cuerpo y el comentario de una función. No toca
-- filas ni toma locks de tabla. lock_timeout 5 s y statement_timeout 30 s con
-- set de sesión, como 0317.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

-- Aborta sin cambiar nada si la RPC no es la de 0317 (md5 del prosrc con
-- CRLF→LF, o sin espacios), o si perdió SECURITY DEFINER o el search_path
-- sellado. El writer AUD-01 no se vuelve a exigir: la 0317 aplicada ya lo
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
          'public.mark_claim_offset_paid_in_china_governed(uuid,date,text,text)'
        )
    and p.prosecdef
    and p.proconfig = array['search_path=""'];

  if v_md5 is null then
    raise exception '0483 abortado: mark_claim_offset_paid_in_china_governed falta o no es SECURITY DEFINER con search_path vacío';
  end if;
  if v_md5 <> '0f44f6f05886263f7212442c1a96500b'
     and v_md5_normalized <> 'ed3b2a4ac99aa45e531938b5b0074876' then
    raise exception '0483 abortado: mark_claim_offset_paid_in_china_governed tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
      v_md5, v_md5_normalized;
  end if;
end;
$preflight$;

create or replace function public.mark_claim_offset_paid_in_china_governed(
  p_claim_id uuid,
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
  v_has_admin boolean;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_claim public.supplier_claim_offsets%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'partner finance: autenticación requerida'
      using errcode = '42501';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'partner finance: motivo inválido'
      using errcode = '22023';
  end if;
  if p_effective_date is null or p_effective_date > current_date then
    raise exception 'partner finance: fecha efectiva inválida'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'partner finance: referencia inválida'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = v_actor
      and ut.role = 'admin'
      and ut.disabled_at is null
  ) into v_has_admin;

  if not v_has_admin then
    raise exception 'partner finance: permiso insuficiente'
      using errcode = '42501';
  end if;

  select c.* into v_claim
  from public.supplier_claim_offsets c
  join public.user_tenants ut
    on ut.tenant_id = c.tenant_id
   and ut.user_id = v_actor
   and ut.role = 'admin'
   and ut.disabled_at is null
  where c.id = p_claim_id
    and c.deleted_at is null
  for update of c;

  if not found then
    raise exception 'partner finance: cruce no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_claim.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'partner-claim-payment:' || v_tenant::text || ':' || v_request_ref,
      227
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'partner_claim_paid_in_china'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;

  if found then
    if v_existing.entity_id = p_claim_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'effective_date' = p_effective_date::text then
      return 'replayed';
    end if;
    raise exception 'partner finance: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_claim.status <> 'reconocido_proveedor' then
    raise exception 'partner finance: conflicto de estado'
      using errcode = '40001';
  end if;
  if p_effective_date < coalesce(v_claim.recognized_on, v_claim.claimed_on) then
    raise exception 'partner finance: fecha anterior al reconocimiento'
      using errcode = '22023';
  end if;

  -- SDD-0534: el writer AUD-01 admite 128 caracteres de correlation_id. Con
  -- el md5 de la referencia mide siempre 91; la referencia completa queda en
  -- payload.request_ref.
  v_correlation := pg_catalog.concat(
    'partner-claim-payment:', p_claim_id::text, ':',
    pg_catalog.md5(v_request_ref)
  );
  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config(
    'dtd.partner_claim_payment',
    v_request_ref,
    true
  );

  update public.supplier_claim_offsets
  set status = 'pagado_en_china',
      received_in_china_on = p_effective_date
  where id = p_claim_id
    and tenant_id = v_tenant
    and status = 'reconocido_proveedor'
    and deleted_at is null;
  if not found then
    raise exception 'partner finance: conflicto al registrar el pago'
      using errcode = '40001';
  end if;

  perform public.append_audit_event(
    v_tenant,
    'supplier_claim_offset',
    p_claim_id,
    'user',
    v_actor,
    'partner_claim_paid_in_china',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_claim.status,
      'received_in_china_on', v_claim.received_in_china_on
    ),
    pg_catalog.jsonb_build_object(
      'status', 'pagado_en_china',
      'received_in_china_on', p_effective_date
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'effective_date', p_effective_date,
      'supplier_id', v_claim.supplier_id,
      'amount_usd', v_claim.amount_usd,
      'from', v_claim.status,
      'to', 'pagado_en_china'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

-- CREATE OR REPLACE conserva el owner y la ACL que dejó 0317 (postgres;
-- EXECUTE sólo para authenticated). No se reafirman: si producción los tiene
-- distintos, el postflight aborta y se revisa antes de aplicar.
comment on function public.mark_claim_offset_paid_in_china_governed(uuid, date, text, text) is
  'SDD-0227: transición R3 reconocido_proveedor→pagado_en_china con admin, tenant, lock, idempotencia y AUD-01 atómicos. SDD-0534: correlation_id con md5 de la referencia, 91 caracteres.';

-- El cuerpo instalado es el de esta migración, con la seguridad, el owner y
-- la ACL de 0317.
do $postflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(
            'public.mark_claim_offset_paid_in_china_governed(uuid,date,text,text)'
          )
      and p.prosecdef
      and p.proconfig = array['search_path=""']
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n'))
          = 'e2cc61b5c1c69d2ecc6f595000b58c18'
  ) then
    raise exception '0483: postflight — mark_claim_offset_paid_in_china_governed no quedó con el cuerpo, DEFINER, search_path u owner de 0483';
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.mark_claim_offset_paid_in_china_governed(uuid,date,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.mark_claim_offset_paid_in_china_governed(uuid,date,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.mark_claim_offset_paid_in_china_governed(uuid,date,text,text)',
       'execute'
     ) then
    raise exception '0483: postflight — EXECUTE de mark_claim_offset_paid_in_china_governed no es sólo de authenticated';
  end if;
end;
$postflight$;
