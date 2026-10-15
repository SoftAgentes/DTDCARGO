-- ─────────────────────────────────────────────────────────────────────────────
-- 0484 · SDD-0534 — Liberar un trámite de Aduana SENIAT deja de fallar
-- siempre: el correlation_id que clear_customs_filing_governed le pasa al
-- writer AUD-01 cabe en los 128 caracteres que el writer admite.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Producción es el Supabase
--    self-hosted del servidor propio. Antes de aplicar, el Director lee en
--    producción, READ ONLY y sólo de catálogo, el md5 de prosrc, SECURITY
--    DEFINER, search_path, owner y ACL de clear_customs_filing_governed que el
--    preflight y el postflight exigen. Fusionar la PR NO autoriza aplicarla.
--    ORDEN: indiferente, también respecto de las otras migraciones de la
--    SDD-0534 (0483–0489): cada una toca una sola RPC y se aplica de a una. La
--    app no cambia: la pantalla y la Server Action siguen mandando la misma
--    referencia, y la firma de la RPC es la misma. Basta aplicarla para que la
--    acción funcione.
--
-- ── El defecto ──────────────────────────────────────────────
-- La pantalla arma la referencia como `customs-clearance:<id>:<uuid>`, con un
-- UUID aleatorio
-- (app/studio/(app)/seniat/_components/FilingDetailDrawer.tsx:119): 91
-- caracteres siempre, porque sus tres partes tienen largo fijo. La 0318
-- (0318:251-253) arma el correlation_id como
-- `customs-clearance:<id>:<referencia>`: 18 + 36 + 1 + 91 = 146. El writer
-- real (append_audit_event 0294 → append_audit_event_v1 0267:542-545) y el
-- CHECK entity_audit_log_correlation_id_check (0267:318-322) exigen
-- '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$', o sea 128 como máximo. El writer
-- levanta 22023 «audit: correlation_id inválido» al final de la RPC, y la
-- transacción entera se revierte: el trámite sigue `pagado`, el embarque
-- `in_customs`, sin evento de timeline y sin AUD-01. Con ese prefijo,
-- cualquier referencia de más de 73 caracteres falla, aunque la propia RPC
-- acepte hasta 128 (0318:138-142). Reproducido en PGlite con el writer real
-- (0267 + 0294), no con el simulado del contrato 0318:
-- supabase/tests/0484_seniat_liberar_correlation_id.test.sql sin esta
-- migración es el control rojo.
--
-- ── El arreglo ──────────────────────────────────────────────
-- El mismo de la 0482 (SDD-0532, Naviera): el correlation_id usa el md5 de la
-- referencia en vez de la referencia:
-- `customs-clearance:<id>:<md5(referencia)>` = 18 + 36 + 1 + 32 = 87
-- caracteres, para CUALQUIER referencia que la RPC acepte. Sigue siendo
-- determinista (la misma referencia da el mismo correlation_id), conserva el
-- espacio de nombres de la 0318 y distingue referencias que comparten un
-- prefijo largo. La referencia completa sigue en payload.request_ref, que es
-- la llave de idempotencia y no cambia. md5 y no sha256, como en la 0482: con
-- los 64 caracteres del hex de sha256 el correlation_id mediría 119 y cabría,
-- pero las ocho RPC del lote R3 quedan con el mismo formato, y el hash no
-- cumple aquí una función de seguridad (no es llave única ni secreto). No se
-- toca nada más: el resto del cuerpo es el de 0318, byte a byte.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: reemplaza el cuerpo y el comentario de una función. No toca
-- filas ni toma locks de tabla. lock_timeout 5 s y statement_timeout 30 s con
-- set de sesión, como 0318.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

-- Aborta sin cambiar nada si la RPC no es la de 0318 (md5 del prosrc con
-- CRLF→LF, o sin espacios), o si perdió SECURITY DEFINER o el search_path
-- sellado. El writer AUD-01 no se vuelve a exigir: la 0318 aplicada ya lo
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
          'public.clear_customs_filing_governed(uuid,date,text,text)'
        )
    and p.prosecdef
    and p.proconfig = array['search_path=""'];

  if v_md5 is null then
    raise exception '0484 abortado: clear_customs_filing_governed falta o no es SECURITY DEFINER con search_path vacío';
  end if;
  if v_md5 <> '6e56e6e9ca817d63664f875a86872c02'
     and v_md5_normalized <> '1a72ff4fd1ca2dbc1a670fbf5ab787f6' then
    raise exception '0484 abortado: clear_customs_filing_governed tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
      v_md5, v_md5_normalized;
  end if;
end;
$preflight$;

create or replace function public.clear_customs_filing_governed(
  p_filing_id uuid,
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
  v_has_role boolean;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_filing public.customs_filings%rowtype;
  v_shipment public.shipments%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_required_count integer;
  v_required_ready boolean;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'customs: autenticación requerida'
      using errcode = '42501';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'customs: motivo inválido'
      using errcode = '22023';
  end if;
  if p_effective_date is null or p_effective_date > current_date then
    raise exception 'customs: fecha efectiva inválida'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'customs: referencia inválida'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = v_actor
      and ut.role in ('admin', 'operations', 'accounting')
      and ut.disabled_at is null
  ) into v_has_role;

  if not v_has_role then
    raise exception 'customs: permiso insuficiente'
      using errcode = '42501';
  end if;

  select f.* into v_filing
  from public.customs_filings f
  join public.user_tenants ut
    on ut.tenant_id = f.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'accounting')
   and ut.disabled_at is null
  where f.id = p_filing_id
    and f.deleted_at is null
  for update of f;

  if not found then
    raise exception 'customs: trámite no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_filing.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'customs-clearance:' || v_tenant::text || ':' || v_request_ref,
      228
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'customs_filing_cleared'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;

  if found then
    if v_existing.entity_id = p_filing_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'effective_date' = p_effective_date::text then
      return 'replayed';
    end if;
    raise exception 'customs: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_filing.status <> 'pagado'::public.customs_status then
    raise exception 'customs: conflicto de estado'
      using errcode = '40001';
  end if;
  if p_effective_date < v_filing.arrived_at then
    raise exception 'customs: fecha anterior al arribo'
      using errcode = '22023';
  end if;

  select s.* into v_shipment
  from public.shipments s
  where s.id = v_filing.shipment_id
    and s.tenant_id = v_tenant
    and s.deleted_at is null
  for update;
  if not found or v_shipment.status <> 'in_customs'::public.shipment_status then
    raise exception 'customs: conflicto del shipment'
      using errcode = '40001';
  end if;

  perform 1
  from public.customs_documents d
  where d.tenant_id = v_tenant
    and d.filing_id = p_filing_id
    and d.doc_type in (
      'commercial'::public.customs_doc_type,
      'packing'::public.customs_doc_type,
      'bl'::public.customs_doc_type,
      'cert_origin'::public.customs_doc_type,
      'dua'::public.customs_doc_type,
      'payment'::public.customs_doc_type
    )
  for update;

  select count(*), coalesce(bool_and(d.uploaded), false)
  into v_required_count, v_required_ready
  from public.customs_documents d
  where d.tenant_id = v_tenant
    and d.filing_id = p_filing_id
    and d.doc_type in (
      'commercial'::public.customs_doc_type,
      'packing'::public.customs_doc_type,
      'bl'::public.customs_doc_type,
      'cert_origin'::public.customs_doc_type,
      'dua'::public.customs_doc_type,
      'payment'::public.customs_doc_type
    );

  if v_required_count <> 6 or not v_required_ready then
    raise exception 'customs: documentos obligatorios incompletos'
      using errcode = '22023';
  end if;

  -- SDD-0534: el writer AUD-01 admite 128 caracteres de correlation_id. Con
  -- el md5 de la referencia mide siempre 87; la referencia completa queda en
  -- payload.request_ref.
  v_correlation := pg_catalog.concat(
    'customs-clearance:', p_filing_id::text, ':',
    pg_catalog.md5(v_request_ref)
  );
  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.customs_clearance', v_request_ref, true);
  perform pg_catalog.set_config(
    'dtd.customs_clearance_filing',
    p_filing_id::text,
    true
  );

  update public.customs_filings
  set status = 'liberado',
      cleared_at = p_effective_date,
      alert = null
  where id = p_filing_id
    and tenant_id = v_tenant
    and status = 'pagado'
    and deleted_at is null;
  if not found then
    raise exception 'customs: conflicto al liberar el trámite'
      using errcode = '40001';
  end if;

  update public.shipments
  set status = 'arrived_destination'
  where id = v_shipment.id
    and tenant_id = v_tenant
    and status = 'in_customs'
    and deleted_at is null;
  if not found then
    raise exception 'customs: conflicto al mover el shipment'
      using errcode = '40001';
  end if;

  insert into public.shipment_events (
    tenant_id, shipment_id, status, note, created_by
  ) values (
    v_tenant,
    v_shipment.id,
    'arrived_destination',
    'Liberación SENIAT confirmada · DUA ' || v_filing.dua_code,
    v_actor
  );

  perform public.append_audit_event(
    v_tenant,
    'customs_filing',
    p_filing_id,
    'user',
    v_actor,
    'customs_filing_cleared',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_filing.status,
      'cleared_at', v_filing.cleared_at,
      'shipment_status', v_shipment.status
    ),
    pg_catalog.jsonb_build_object(
      'status', 'liberado',
      'cleared_at', p_effective_date,
      'shipment_status', 'arrived_destination'
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'effective_date', p_effective_date,
      'shipment_id', v_shipment.id,
      'dua_code', v_filing.dua_code,
      'required_documents', 6,
      'from', v_filing.status,
      'to', 'liberado'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

-- CREATE OR REPLACE conserva el owner y la ACL que dejó 0318 (postgres;
-- EXECUTE sólo para authenticated). No se reafirman: si producción los tiene
-- distintos, el postflight aborta y se revisa antes de aplicar.
comment on function public.clear_customs_filing_governed(uuid, date, text, text) is
  'SDD-0228: transición R3 pagado→liberado con rol, tenant, locks, documentos, shipment, idempotencia y AUD-01 atómicos. SDD-0534: correlation_id con md5 de la referencia, 87 caracteres.';

-- El cuerpo instalado es el de esta migración, con la seguridad, el owner y
-- la ACL de 0318.
do $postflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(
            'public.clear_customs_filing_governed(uuid,date,text,text)'
          )
      and p.prosecdef
      and p.proconfig = array['search_path=""']
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n'))
          = '04d5cf691b31bfa0fc3976b6a143b46b'
  ) then
    raise exception '0484: postflight — clear_customs_filing_governed no quedó con el cuerpo, DEFINER, search_path u owner de 0484';
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.clear_customs_filing_governed(uuid,date,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.clear_customs_filing_governed(uuid,date,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.clear_customs_filing_governed(uuid,date,text,text)',
       'execute'
     ) then
    raise exception '0484: postflight — EXECUTE de clear_customs_filing_governed no es sólo de authenticated';
  end if;
end;
$postflight$;
