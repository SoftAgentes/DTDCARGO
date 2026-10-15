-- ─────────────────────────────────────────────────────────────────────────────
-- 0488 · SDD-0534 — Retirar un reporte de Inspecciones deja de fallar siempre:
-- el correlation_id que retire_inspection_report_governed le pasa al writer
-- AUD-01 cabe en los 128 caracteres que el writer admite.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Producción es el Supabase
--    self-hosted del servidor propio. Antes de aplicar, el Director lee en
--    producción, READ ONLY y sólo de catálogo, el md5 de prosrc, SECURITY
--    DEFINER, search_path, owner y ACL de retire_inspection_report_governed
--    que el preflight y el postflight exigen. Fusionar la PR NO autoriza
--    aplicarla.
--    ORDEN: indiferente, también respecto de las otras migraciones de la
--    SDD-0534 (0483–0489): cada una toca una sola RPC y se aplica de a una. La
--    app no cambia: la pantalla y la Server Action siguen mandando la misma
--    referencia, y la firma de la RPC es la misma. Basta aplicarla para que la
--    acción funcione.
--
-- ── El defecto ──────────────────────────────────────────────
-- La pantalla arma la referencia como
-- `inspection-report-retirement:<id>:<uuid>`, con un UUID aleatorio
-- (app/studio/(app)/inspecciones/_components/InspeccionesClient.tsx:506): 102
-- caracteres siempre, porque sus tres partes tienen largo fijo. La 0323
-- (0323:220-222) arma el correlation_id como
-- `inspection-report-retirement:<id>:<referencia>`: 29 + 36 + 1 + 102 = 168.
-- El writer real (append_audit_event 0294 → append_audit_event_v1
-- 0267:542-545) y el CHECK entity_audit_log_correlation_id_check
-- (0267:318-322) exigen '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$', o sea 128 como
-- máximo. El writer levanta 22023 «audit: correlation_id inválido» al final de
-- la RPC, y la transacción entera se revierte: el reporte y sus fotos siguen
-- vivos y sin AUD-01. Con ese prefijo, cualquier referencia de más de 62
-- caracteres falla, aunque la propia RPC acepte hasta 128 (0323:135-139).
-- Reproducido en PGlite con el writer real (0267 + 0294), no con el simulado
-- del contrato 0323:
-- supabase/tests/0488_inspecciones_retirar_reporte_correlation_id.test.sql sin
-- esta migración es el control rojo.
--
-- ── El arreglo ──────────────────────────────────────────────
-- El mismo de la 0482 (SDD-0532, Naviera): el correlation_id usa el md5 de la
-- referencia en vez de la referencia:
-- `inspection-report-retirement:<id>:<md5(referencia)>` = 29 + 36 + 1 + 32 =
-- 98 caracteres, para CUALQUIER referencia que la RPC acepte. Sigue siendo
-- determinista (la misma referencia da el mismo correlation_id), conserva el
-- espacio de nombres de la 0323 y distingue referencias que comparten un
-- prefijo largo. La referencia completa sigue en payload.request_ref, que es
-- la llave de idempotencia y no cambia. md5 y no sha256: el hex de sha256 son
-- 64 caracteres y el correlation_id quedaría en 130, más de 128. No se toca
-- nada más: el resto del cuerpo es el de 0323, byte a byte.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: reemplaza el cuerpo y el comentario de una función. No toca
-- filas ni toma locks de tabla. lock_timeout 5 s y statement_timeout 30 s con
-- set de sesión, como 0323.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

-- Aborta sin cambiar nada si la RPC no es la de 0323 (md5 del prosrc con
-- CRLF→LF, o sin espacios), o si perdió SECURITY DEFINER o el search_path
-- sellado. El writer AUD-01 no se vuelve a exigir: la 0323 aplicada ya lo
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
          'public.retire_inspection_report_governed(uuid,text,text,text)'
        )
    and p.prosecdef
    and p.proconfig = array['search_path=""'];

  if v_md5 is null then
    raise exception '0488 abortado: retire_inspection_report_governed falta o no es SECURITY DEFINER con search_path vacío';
  end if;
  if v_md5 <> 'e8cb95d832168e566e322660af36b2b0'
     and v_md5_normalized <> '1543780f3991b0de237071aacbecd679' then
    raise exception '0488 abortado: retire_inspection_report_governed tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
      v_md5, v_md5_normalized;
  end if;
end;
$preflight$;

create or replace function public.retire_inspection_report_governed(
  p_report_id uuid,
  p_expected_status text,
  p_reason text,
  p_request_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_report public.inspection_reports%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_retired_at timestamptz := pg_catalog.clock_timestamp();
  v_photo_count integer := 0;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'inspecciones: autenticación requerida'
      using errcode = '42501';
  end if;
  if p_expected_status not in ('draft', 'final') then
    raise exception 'inspecciones: estado esperado inválido'
      using errcode = '22023';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'inspecciones: motivo inválido'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'inspecciones: referencia inválida'
      using errcode = '22023';
  end if;

  select r.* into v_report
  from public.inspection_reports r
  join public.user_tenants ut
    on ut.tenant_id = r.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'commercial')
   and ut.disabled_at is null
  where r.id = p_report_id
  for update of r;
  if not found then
    raise exception 'inspecciones: reporte no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_report.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inspection-report-retirement:' || v_tenant::text || ':' || v_request_ref,
      233
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'inspection_report_retired'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;
  if found then
    if v_existing.entity_id = p_report_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'from_status' = p_expected_status then
      return pg_catalog.jsonb_build_object(
        'outcome', 'replayed',
        'report_no', v_existing.payload ->> 'report_no',
        'photo_count', (v_existing.payload ->> 'photo_count')::integer,
        'storage_disposition', 'retained_private_objects'
      );
    end if;
    raise exception 'inspecciones: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_report.deleted_at is not null
     or v_report.status::text <> p_expected_status then
    raise exception 'inspecciones: conflicto de estado'
      using errcode = '40001';
  end if;

  select count(*)::integer into v_photo_count
  from public.inspection_report_photos p
  where p.report_id = p_report_id
    and p.tenant_id = v_tenant
    and p.deleted_at is null;

  perform pg_catalog.set_config(
    'dtd.inspection_report_retirement', v_request_ref, true
  );
  perform pg_catalog.set_config(
    'dtd.inspection_report_retirement_id', p_report_id::text, true
  );

  update public.inspection_reports
  set deleted_at = v_retired_at
  where id = p_report_id
    and tenant_id = v_tenant
    and deleted_at is null
    and status::text = p_expected_status;
  if not found then
    raise exception 'inspecciones: conflicto al retirar'
      using errcode = '40001';
  end if;

  update public.inspection_report_photos
  set deleted_at = v_retired_at
  where report_id = p_report_id
    and tenant_id = v_tenant
    and deleted_at is null;

  -- SDD-0534: el writer AUD-01 admite 128 caracteres de correlation_id. Con
  -- el md5 de la referencia mide siempre 98; la referencia completa queda en
  -- payload.request_ref.
  v_correlation := pg_catalog.concat(
    'inspection-report-retirement:', p_report_id::text, ':',
    pg_catalog.md5(v_request_ref)
  );
  perform public.append_audit_event(
    v_tenant,
    'inspection_report',
    p_report_id,
    'user',
    v_actor,
    'inspection_report_retired',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_report.status,
      'deleted_at', v_report.deleted_at
    ),
    pg_catalog.jsonb_build_object(
      'status', v_report.status,
      'deleted_at', v_retired_at
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'report_no', v_report.report_no,
      'from_status', p_expected_status,
      'photo_count', v_photo_count,
      'photo_metadata_retired', true,
      'storage_disposition', 'retained_private_objects',
      'physical_objects_deleted', false
    ),
    v_correlation,
    1,
    'restricted'
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'transitioned',
    'report_no', v_report.report_no,
    'photo_count', v_photo_count,
    'storage_disposition', 'retained_private_objects'
  );
end;
$function$;

-- CREATE OR REPLACE conserva el owner y la ACL que dejó 0323 (postgres;
-- EXECUTE sólo para authenticated). No se reafirman: si producción los tiene
-- distintos, el postflight aborta y se revisa antes de aplicar.
comment on function public.retire_inspection_report_governed(uuid, text, text, text) is
  'SDD-0233: retiro R3 de reporte y metadata de fotos con rol, tenant, estado, idempotencia, retención honesta de Storage y AUD-01 atómicos. SDD-0534: correlation_id con md5 de la referencia, 98 caracteres.';

-- El cuerpo instalado es el de esta migración, con la seguridad, el owner y
-- la ACL de 0323.
do $postflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(
            'public.retire_inspection_report_governed(uuid,text,text,text)'
          )
      and p.prosecdef
      and p.proconfig = array['search_path=""']
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n'))
          = '88adc4feacfce491ddee40309a744e99'
  ) then
    raise exception '0488: postflight — retire_inspection_report_governed no quedó con el cuerpo, DEFINER, search_path u owner de 0488';
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.retire_inspection_report_governed(uuid,text,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.retire_inspection_report_governed(uuid,text,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.retire_inspection_report_governed(uuid,text,text,text)',
       'execute'
     ) then
    raise exception '0488: postflight — EXECUTE de retire_inspection_report_governed no es sólo de authenticated';
  end if;
end;
$postflight$;
