-- ─────────────────────────────────────────────────────────────────────────────
-- 0489 · SDD-0534 — Cancelar una orden de Despacho (OD) deja de fallar
-- siempre: el correlation_id que cancel_dispatch_order_governed le pasa al
-- writer AUD-01 cabe en los 128 caracteres que el writer admite.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Producción es el Supabase
--    self-hosted del servidor propio. Antes de aplicar, el Director lee en
--    producción, READ ONLY y sólo de catálogo, el md5 de prosrc, SECURITY
--    DEFINER, search_path, owner y ACL de cancel_dispatch_order_governed que
--    el preflight y el postflight exigen. Fusionar la PR NO autoriza
--    aplicarla.
--    ORDEN: indiferente, también respecto de las otras migraciones de la
--    SDD-0534 (0483–0489): cada una toca una sola RPC y se aplica de a una. La
--    app no cambia: la pantalla y la Server Action siguen mandando la misma
--    referencia, y la firma de la RPC es la misma. Basta aplicarla para que la
--    acción funcione.
--
-- ── El defecto ──────────────────────────────────────────────
-- La pantalla arma la referencia como
-- `dispatch-order-cancellation:<id>:<uuid>`, con un UUID aleatorio
-- (app/studio/(app)/despacho/_components/CancelOdDrawer.tsx:32): 101
-- caracteres siempre, porque sus tres partes tienen largo fijo. La 0324
-- (0324:213-215) arma el correlation_id como
-- `dispatch-order-cancellation:<id>:<referencia>`: 28 + 36 + 1 + 101 = 166. El
-- writer real (append_audit_event 0294 → append_audit_event_v1 0267:542-545) y
-- el CHECK entity_audit_log_correlation_id_check (0267:318-322) exigen
-- '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$', o sea 128 como máximo. El writer
-- levanta 22023 «audit: correlation_id inválido» al final de la RPC, y la
-- transacción entera se revierte: la OD sigue en su estado, sin motivo, sin
-- actor de cancelación y sin AUD-01. Con ese prefijo, cualquier referencia de
-- más de 63 caracteres falla, aunque la propia RPC acepte hasta 128
-- (0324:145-149). Reproducido en PGlite con el writer real (0267 + 0294), no
-- con el simulado del contrato 0324:
-- supabase/tests/0489_despacho_cancelar_od_correlation_id.test.sql sin esta
-- migración es el control rojo.
--
-- ── El arreglo ──────────────────────────────────────────────
-- El mismo de la 0482 (SDD-0532, Naviera): el correlation_id usa el md5 de la
-- referencia en vez de la referencia:
-- `dispatch-order-cancellation:<id>:<md5(referencia)>` = 28 + 36 + 1 + 32 = 97
-- caracteres, para CUALQUIER referencia que la RPC acepte. Sigue siendo
-- determinista (la misma referencia da el mismo correlation_id), conserva el
-- espacio de nombres de la 0324 y distingue referencias que comparten un
-- prefijo largo. La referencia completa sigue en payload.request_ref, que es
-- la llave de idempotencia y no cambia. md5 y no sha256: el hex de sha256 son
-- 64 caracteres y el correlation_id quedaría en 129, más de 128. No se toca
-- nada más: el resto del cuerpo es el de 0324, byte a byte.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: reemplaza el cuerpo y el comentario de una función. No toca
-- filas ni toma locks de tabla. lock_timeout 5 s y statement_timeout 30 s con
-- set de sesión, como 0324.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

-- Aborta sin cambiar nada si la RPC no es la de 0324 (md5 del prosrc con
-- CRLF→LF, o sin espacios), o si perdió SECURITY DEFINER o el search_path
-- sellado. El writer AUD-01 no se vuelve a exigir: la 0324 aplicada ya lo
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
          'public.cancel_dispatch_order_governed(uuid,text,text,text)'
        )
    and p.prosecdef
    and p.proconfig = array['search_path=""'];

  if v_md5 is null then
    raise exception '0489 abortado: cancel_dispatch_order_governed falta o no es SECURITY DEFINER con search_path vacío';
  end if;
  if v_md5 <> '3f048cb52ae5a8f34675671828230eef'
     and v_md5_normalized <> 'ada23b5b799a03eb16a4ace7d633f793' then
    raise exception '0489 abortado: cancel_dispatch_order_governed tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
      v_md5, v_md5_normalized;
  end if;
end;
$preflight$;

create or replace function public.cancel_dispatch_order_governed(
  p_order_id uuid,
  p_expected_status text,
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
  v_order public.dispatch_orders%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_cancelled_at timestamptz;
  v_cancelled_by uuid;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'despacho: autenticación requerida'
      using errcode = '42501';
  end if;
  if p_expected_status not in ('creada', 'cargando', 'lista', 'en_ruta') then
    raise exception 'despacho: estado esperado inválido'
      using errcode = '22023';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 500 then
    raise exception 'despacho: motivo inválido'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'despacho: referencia inválida'
      using errcode = '22023';
  end if;

  select d.* into v_order
  from public.dispatch_orders d
  join public.user_tenants ut
    on ut.tenant_id = d.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'warehouse')
   and ut.disabled_at is null
  where d.id = p_order_id
  for update of d;
  if not found then
    raise exception 'despacho: OD no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_order.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'dispatch-order-cancellation:' || v_tenant::text || ':' || v_request_ref,
      234
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'dispatch_order_cancelled'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;
  if found then
    if v_existing.entity_id = p_order_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'from_status' = p_expected_status then
      return 'replayed';
    end if;
    raise exception 'despacho: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_order.status::text <> p_expected_status then
    raise exception 'despacho: conflicto de estado'
      using errcode = '40001';
  end if;

  perform pg_catalog.set_config(
    'dtd.dispatch_order_cancellation', v_request_ref, true
  );
  perform pg_catalog.set_config(
    'dtd.dispatch_order_cancellation_id', p_order_id::text, true
  );

  update public.dispatch_orders
  set status = 'cancelada',
      cancel_reason = v_reason
  where id = p_order_id
    and tenant_id = v_tenant
    and status::text = p_expected_status
  returning cancelled_at, cancelled_by into v_cancelled_at, v_cancelled_by;
  if not found then
    raise exception 'despacho: conflicto al cancelar'
      using errcode = '40001';
  end if;

  -- SDD-0534: el writer AUD-01 admite 128 caracteres de correlation_id. Con
  -- el md5 de la referencia mide siempre 97; la referencia completa queda en
  -- payload.request_ref.
  v_correlation := pg_catalog.concat(
    'dispatch-order-cancellation:', p_order_id::text, ':',
    pg_catalog.md5(v_request_ref)
  );
  perform public.append_audit_event(
    v_tenant,
    'dispatch_order',
    p_order_id,
    'user',
    v_actor,
    'dispatch_order_cancelled',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_order.status,
      'cancel_reason', v_order.cancel_reason,
      'cancelled_at', v_order.cancelled_at,
      'cancelled_by', v_order.cancelled_by
    ),
    pg_catalog.jsonb_build_object(
      'status', 'cancelada',
      'cancel_reason', v_reason,
      'cancelled_at', v_cancelled_at,
      'cancelled_by', v_cancelled_by
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'order_code', v_order.order_code,
      'from_status', p_expected_status,
      'to_status', 'cancelada',
      'packages_released_by_status', true,
      'package_count', v_order.package_count
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

-- CREATE OR REPLACE conserva el owner y la ACL que dejó 0324 (postgres;
-- EXECUTE sólo para authenticated). No se reafirman: si producción los tiene
-- distintos, el postflight aborta y se revisa antes de aplicar.
comment on function public.cancel_dispatch_order_governed(uuid, text, text, text) is
  'SDD-0234: cancelación R3 de OD con rol, tenant, estado, actor, motivo, idempotencia y AUD-01 atómicos. SDD-0534: correlation_id con md5 de la referencia, 97 caracteres.';

-- El cuerpo instalado es el de esta migración, con la seguridad, el owner y
-- la ACL de 0324.
do $postflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(
            'public.cancel_dispatch_order_governed(uuid,text,text,text)'
          )
      and p.prosecdef
      and p.proconfig = array['search_path=""']
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n'))
          = 'ad6c86c0c76ae02c5a45a67154b20347'
  ) then
    raise exception '0489: postflight — cancel_dispatch_order_governed no quedó con el cuerpo, DEFINER, search_path u owner de 0489';
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.cancel_dispatch_order_governed(uuid,text,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.cancel_dispatch_order_governed(uuid,text,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.cancel_dispatch_order_governed(uuid,text,text,text)',
       'execute'
     ) then
    raise exception '0489: postflight — EXECUTE de cancel_dispatch_order_governed no es sólo de authenticated';
  end if;
end;
$postflight$;
