-- ─────────────────────────────────────────────────────────────────────────────
-- 0487 · SDD-0534 — Confirmar a mano una entrega en Almacén VE deja de fallar
-- siempre: el correlation_id que complete_ve_delivery_governed le pasa al
-- writer AUD-01 cabe en los 128 caracteres que el writer admite.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Producción es el Supabase
--    self-hosted del servidor propio. Antes de aplicar, el Director lee en
--    producción, READ ONLY y sólo de catálogo, el md5 de prosrc, SECURITY
--    DEFINER, search_path, owner y ACL de complete_ve_delivery_governed que el
--    preflight y el postflight exigen. Fusionar la PR NO autoriza aplicarla.
--    ORDEN: indiferente, también respecto de las otras migraciones de la
--    SDD-0534 (0483–0489): cada una toca una sola RPC y se aplica de a una. La
--    app no cambia: la pantalla y la Server Action siguen mandando la misma
--    referencia, y la firma de la RPC es la misma. Basta aplicarla para que la
--    acción funcione.
--
-- ── El defecto ──────────────────────────────────────────────
-- La pantalla arma la referencia como `warehouse-ve-delivery:<id>:<uuid>`, con
-- un UUID aleatorio (app/studio/(app)/ve/_components/VeRowActions.tsx:160): 95
-- caracteres siempre, porque sus tres partes tienen largo fijo. La 0321
-- (0321:210-212) arma el correlation_id como
-- `warehouse-ve-delivery:<id>:<referencia>`: 22 + 36 + 1 + 95 = 154. El writer
-- real (append_audit_event 0294 → append_audit_event_v1 0267:542-545) y el
-- CHECK entity_audit_log_correlation_id_check (0267:318-322) exigen
-- '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$', o sea 128 como máximo. El writer
-- levanta 22023 «audit: correlation_id inválido» al final de la RPC, y la
-- transacción entera se revierte: el embarque sigue en su estado, sin
-- receptor, sin evento de timeline y sin AUD-01. Con ese prefijo, cualquier
-- referencia de más de 69 caracteres falla, aunque la propia RPC acepte hasta
-- 128 (0321:136-139). Reproducido en PGlite con el writer real (0267 + 0294),
-- no con el simulado del contrato 0321:
-- supabase/tests/0487_ve_confirmar_entrega_correlation_id.test.sql sin esta
-- migración es el control rojo.
--
-- ── El arreglo ──────────────────────────────────────────────
-- El mismo de la 0482 (SDD-0532, Naviera): el correlation_id usa el md5 de la
-- referencia en vez de la referencia:
-- `warehouse-ve-delivery:<id>:<md5(referencia)>` = 22 + 36 + 1 + 32 = 91
-- caracteres, para CUALQUIER referencia que la RPC acepte. Sigue siendo
-- determinista (la misma referencia da el mismo correlation_id), conserva el
-- espacio de nombres de la 0321 y distingue referencias que comparten un
-- prefijo largo. La referencia completa sigue en payload.request_ref, que es
-- la llave de idempotencia y no cambia. md5 y no sha256, como en la 0482: con
-- los 64 caracteres del hex de sha256 el correlation_id mediría 123 y cabría,
-- pero las ocho RPC del lote R3 quedan con el mismo formato, y el hash no
-- cumple aquí una función de seguridad (no es llave única ni secreto). No se
-- toca nada más: el resto del cuerpo es el de 0321, byte a byte.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: reemplaza el cuerpo y el comentario de una función. No toca
-- filas ni toma locks de tabla. lock_timeout 5 s y statement_timeout 30 s con
-- set de sesión, como 0321.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

-- Aborta sin cambiar nada si la RPC no es la de 0321 (md5 del prosrc con
-- CRLF→LF, o sin espacios), o si perdió SECURITY DEFINER o el search_path
-- sellado. El writer AUD-01 no se vuelve a exigir: la 0321 aplicada ya lo
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
          'public.complete_ve_delivery_governed(uuid,text,text,text)'
        )
    and p.prosecdef
    and p.proconfig = array['search_path=""'];

  if v_md5 is null then
    raise exception '0487 abortado: complete_ve_delivery_governed falta o no es SECURITY DEFINER con search_path vacío';
  end if;
  if v_md5 <> '1335070f1b5c27a3b8bbb1b6d643185b'
     and v_md5_normalized <> '1a8b93451720fffcd7772c92decd3407' then
    raise exception '0487 abortado: complete_ve_delivery_governed tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
      v_md5, v_md5_normalized;
  end if;
end;
$preflight$;

create or replace function public.complete_ve_delivery_governed(
  p_shipment_id uuid,
  p_received_by text,
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
  v_received_by text := nullif(pg_catalog.btrim(p_received_by), '');
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_shipment public.shipments%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 've: autenticación requerida' using errcode = '42501';
  end if;
  if v_received_by is null
     or pg_catalog.char_length(v_received_by) not between 2 and 200 then
    raise exception 've: receptor inválido' using errcode = '22023';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 've: motivo inválido' using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 've: referencia inválida' using errcode = '22023';
  end if;

  select s.* into v_shipment
  from public.shipments s
  join public.user_tenants ut
    on ut.tenant_id = s.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'warehouse')
   and ut.disabled_at is null
  where s.id = p_shipment_id
    and s.deleted_at is null
  for update of s;
  if not found then
    raise exception 've: embarque no disponible' using errcode = 'P0002';
  end if;
  v_tenant := v_shipment.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'warehouse-ve-delivery:' || v_tenant::text || ':' || v_request_ref,
      231
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'shipment_delivery_manually_confirmed'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;
  if found then
    if v_existing.entity_id = p_shipment_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'received_by' = v_received_by then
      return 'replayed';
    end if;
    raise exception 've: referencia reutilizada' using errcode = '40001';
  end if;

  if v_shipment.status not in ('out_for_delivery', 'last_mile') then
    raise exception 've: conflicto de estado' using errcode = '40001';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.ve_delivery_completion', v_request_ref, true);
  perform pg_catalog.set_config(
    'dtd.ve_delivery_completion_shipment', p_shipment_id::text, true
  );

  update public.shipments
  set status = 'delivered',
      pod_signed_by = v_received_by
  where id = p_shipment_id
    and tenant_id = v_tenant
    and status = v_shipment.status
    and deleted_at is null;
  if not found then
    raise exception 've: conflicto al confirmar la entrega'
      using errcode = '40001';
  end if;

  insert into public.shipment_events (
    tenant_id, shipment_id, status, note, created_by
  ) values (
    v_tenant,
    p_shipment_id,
    'delivered',
    'Entrega manual confirmada · receptor: ' || v_received_by,
    v_actor
  );

  -- SDD-0534: el writer AUD-01 admite 128 caracteres de correlation_id. Con
  -- el md5 de la referencia mide siempre 91; la referencia completa queda en
  -- payload.request_ref.
  v_correlation := pg_catalog.concat(
    'warehouse-ve-delivery:', p_shipment_id::text, ':',
    pg_catalog.md5(v_request_ref)
  );
  perform public.append_audit_event(
    v_tenant,
    'shipment',
    p_shipment_id,
    'user',
    v_actor,
    'shipment_delivery_manually_confirmed',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_shipment.status,
      'pod_signed_by', v_shipment.pod_signed_by
    ),
    pg_catalog.jsonb_build_object(
      'status', 'delivered',
      'pod_signed_by', v_received_by
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'shipment_code', v_shipment.code,
      'received_by', v_received_by,
      'attestation_kind', 'manual',
      'sealed_dispatch_pod', false,
      'from', v_shipment.status,
      'to', 'delivered'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

-- CREATE OR REPLACE conserva el owner y la ACL que dejó 0321 (postgres;
-- EXECUTE sólo para authenticated). No se reafirman: si producción los tiene
-- distintos, el postflight aborta y se revisa antes de aplicar.
comment on function public.complete_ve_delivery_governed(uuid, text, text, text) is
  'SDD-0231: fallback manual de entrega VE con rol, tenant, estado, receptor, timeline, idempotencia y AUD-01 atómicos; no sustituye dispatch_pods sellado. SDD-0534: correlation_id con md5 de la referencia, 91 caracteres.';

-- El cuerpo instalado es el de esta migración, con la seguridad, el owner y
-- la ACL de 0321.
do $postflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(
            'public.complete_ve_delivery_governed(uuid,text,text,text)'
          )
      and p.prosecdef
      and p.proconfig = array['search_path=""']
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n'))
          = '651252cda7e8354058ecb83b8cc0e324'
  ) then
    raise exception '0487: postflight — complete_ve_delivery_governed no quedó con el cuerpo, DEFINER, search_path u owner de 0487';
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.complete_ve_delivery_governed(uuid,text,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.complete_ve_delivery_governed(uuid,text,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.complete_ve_delivery_governed(uuid,text,text,text)',
       'execute'
     ) then
    raise exception '0487: postflight — EXECUTE de complete_ve_delivery_governed no es sólo de authenticated';
  end if;
end;
$postflight$;
