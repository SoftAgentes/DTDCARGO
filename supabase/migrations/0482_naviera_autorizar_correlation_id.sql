-- ─────────────────────────────────────────────────────────────────────────────
-- 0482 · SDD-0532 — Autorizar una solicitud de consolidación (Naviera) deja de
-- fallar siempre: el correlation_id que la RPC le pasa al writer AUD-01 cabe en
-- los 128 caracteres que el writer admite.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    Producción es el Supabase self-hosted del servidor propio. Antes de
--    aplicar, el Director lee en producción, READ ONLY y sólo de catálogo, el
--    md5 de prosrc, SECURITY DEFINER, search_path y ACL de
--    authorize_consolidation_governed que el preflight exige. Fusionar la PR NO
--    autoriza aplicarla.
--    ORDEN: indiferente. La app no cambia: la pantalla y la Server Action
--    siguen mandando la misma referencia, y la firma de la RPC es la misma.
--    Basta aplicarla para que «Autorizar» funcione.
--
-- ── El defecto ──────────────────────────────────────────────
-- La pantalla arma la referencia como
-- `naviera-consolidation-authorization:<id>:<uuid aleatorio>`
-- (app/studio/(app)/naviera/_components/NavieraClient.tsx:706-707): 109
-- caracteres siempre, porque sus tres partes tienen largo fijo. La 0322
-- (0322:232-234) arma el correlation_id como
-- `consolidation-authorization:<id>:<referencia>`: 28 + 36 + 1 + 109 = 174.
-- El writer real (append_audit_event 0294 → append_audit_event_v1 0267:542-545)
-- y el CHECK entity_audit_log_correlation_id_check (0267:318-322) exigen
-- '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$', o sea 128 como máximo. El writer
-- levanta 22023 «audit: correlation_id inválido» DESPUÉS de transicionar, y la
-- transacción entera se revierte: la solicitud sigue `solicitada`, no se quema
-- el correlativo, no queda auditoría y la pantalla dice «No se pudo autorizar.
-- Referencia: …». Con ese prefijo, cualquier referencia de más de 63
-- caracteres falla, aunque la propia RPC acepte hasta 128 (0322:137-141).
-- Reproducido en PGlite con el writer real (0267 + 0294), no con el simulado
-- del contrato 0322: supabase/tests/0482_naviera_autorizar_correlation_id.test.sql
-- sin esta migración es el control rojo.
--
-- ── El arreglo ──────────────────────────────────────────────
-- El correlation_id usa el md5 de la referencia en vez de la referencia:
-- `consolidation-authorization:<id>:<md5(referencia)>` = 28 + 36 + 1 + 32 = 97
-- caracteres, para CUALQUIER referencia que la RPC acepte. Sigue siendo
-- determinista (la misma referencia da el mismo correlation_id), conserva el
-- espacio de nombres de la 0322 y distingue referencias que comparten un
-- prefijo largo. La referencia completa sigue en payload.request_ref, que es
-- la llave de idempotencia (índice único de 0322:40-47) y no cambia.
-- md5 y no sha256: el hex de sha256 son 64 caracteres y el correlation_id
-- quedaría en 129.
-- No se toca nada más: el resto del cuerpo es el de 0322, byte a byte.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: reemplaza el cuerpo de una función y reafirma su owner y su
-- ACL. No toca filas ni toma locks de tabla. lock_timeout 5 s y
-- statement_timeout 30 s con set de sesión, como 0322.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

-- Aborta sin cambiar nada si la RPC no es la de 0322 (md5 del prosrc con
-- CRLF→LF, o sin espacios), si perdió SECURITY DEFINER o el search_path
-- sellado, o si falta el writer AUD-01.
do $preflight$
declare
  v_md5 text;
  v_md5_normalized text;
begin
  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0482 requiere el writer AUD-01 append_audit_event';
  end if;

  select pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')),
         pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g'))
    into v_md5, v_md5_normalized
  from pg_catalog.pg_proc p
  where p.oid = pg_catalog.to_regprocedure(
          'public.authorize_consolidation_governed(uuid,text,text)'
        )
    and p.prosecdef
    and p.proconfig = array['search_path=""'];

  if v_md5 is null then
    raise exception '0482 abortado: authorize_consolidation_governed falta o no es SECURITY DEFINER con search_path vacío';
  end if;
  if v_md5 <> 'e65455c17974c8b3ec78044085bca67e'
     and v_md5_normalized <> '3730b203e44360c98bfc8e95248db311' then
    raise exception '0482 abortado: authorize_consolidation_governed tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
      v_md5, v_md5_normalized;
  end if;
end;
$preflight$;

create or replace function public.authorize_consolidation_governed(
  p_consolidation_id uuid,
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
  v_consolidation public.consolidations%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_ref text;
  v_attempt integer;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'naviera: autenticación requerida'
      using errcode = '42501';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'naviera: motivo inválido'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'naviera: referencia inválida'
      using errcode = '22023';
  end if;

  select c.* into v_consolidation
  from public.consolidations c
  join public.user_tenants ut
    on ut.tenant_id = c.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'accounting')
   and ut.disabled_at is null
  where c.id = p_consolidation_id
    and c.deleted_at is null
  for update of c;
  if not found then
    raise exception 'naviera: solicitud no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_consolidation.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'consolidation-authorization:' || v_tenant::text || ':' || v_request_ref,
      232
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'consolidation_authorized'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;

  if found then
    if v_existing.entity_id = p_consolidation_id
       and v_existing.reason = v_reason then
      return pg_catalog.jsonb_build_object(
        'outcome', 'replayed',
        'ref', v_existing.payload ->> 'consolidation_ref',
        'requested_by_operario_id', v_consolidation.requested_by_operario_id,
        'container_type', v_consolidation.container_type
      );
    end if;
    raise exception 'naviera: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_consolidation.status <> 'solicitada' then
    raise exception 'naviera: conflicto de estado'
      using errcode = '40001';
  end if;
  if v_consolidation.ref is not null
     or v_consolidation.authorized_by is not null
     or v_consolidation.authorized_at is not null then
    raise exception 'naviera: solicitud ya contiene evidencia de autorización'
      using errcode = '40001';
  end if;

  perform pg_catalog.set_config(
    'dtd.consolidation_authorization', v_request_ref, true
  );
  perform pg_catalog.set_config(
    'dtd.consolidation_authorization_id', p_consolidation_id::text, true
  );

  for v_attempt in 1..3 loop
    begin
      v_ref := public.next_consolidation_ref(v_tenant);
      update public.consolidations
      set ref = v_ref,
          status = 'consolidando',
          authorized_by = v_actor,
          authorized_at = pg_catalog.clock_timestamp()
      where id = p_consolidation_id
        and tenant_id = v_tenant
        and status = 'solicitada'
        and ref is null
        and authorized_by is null
        and authorized_at is null;
      if not found then
        raise exception 'naviera: conflicto al autorizar'
          using errcode = '40001';
      end if;
      exit;
    exception when unique_violation then
      if v_attempt = 3 then
        raise exception 'naviera: no se pudo reservar el correlativo'
          using errcode = '40001';
      end if;
    end;
  end loop;

  -- SDD-0532: el writer AUD-01 admite 128 caracteres de correlation_id. Con
  -- el md5 de la referencia mide siempre 97; la referencia completa queda en
  -- payload.request_ref.
  v_correlation := pg_catalog.concat(
    'consolidation-authorization:', p_consolidation_id::text, ':',
    pg_catalog.md5(v_request_ref)
  );
  perform public.append_audit_event(
    v_tenant,
    'consolidation',
    p_consolidation_id,
    'user',
    v_actor,
    'consolidation_authorized',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_consolidation.status,
      'ref', v_consolidation.ref,
      'authorized_by', v_consolidation.authorized_by,
      'authorized_at', v_consolidation.authorized_at
    ),
    pg_catalog.jsonb_build_object(
      'status', 'consolidando',
      'ref', v_ref,
      'authorized_by', v_actor,
      'authorized_at', pg_catalog.clock_timestamp()
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'consolidation_ref', v_ref,
      'requested_by_operario_id', v_consolidation.requested_by_operario_id,
      'container_type', v_consolidation.container_type,
      'from', 'solicitada',
      'to', 'consolidando'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'transitioned',
    'ref', v_ref,
    'requested_by_operario_id', v_consolidation.requested_by_operario_id,
    'container_type', v_consolidation.container_type
  );
end;
$function$;

alter function public.authorize_consolidation_governed(uuid, text, text)
  owner to postgres;
revoke all on function public.authorize_consolidation_governed(uuid, text, text)
  from public, anon, service_role;
grant execute on function public.authorize_consolidation_governed(uuid, text, text)
  to authenticated;

comment on function public.authorize_consolidation_governed(uuid, text, text) is
  'SDD-0232: autorización R3 de consolidación con rol, tenant, correlativo, idempotencia y AUD-01 atómicos. SDD-0532: correlation_id con md5 de la referencia, 97 caracteres.';

-- El cuerpo instalado es el de esta migración, con la misma seguridad y ACL.
do $postflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(
            'public.authorize_consolidation_governed(uuid,text,text)'
          )
      and p.prosecdef
      and p.proconfig = array['search_path=""']
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n'))
          = '0f32f8450b38871530ae75e388f04c00'
  ) then
    raise exception '0482: postflight — authorize_consolidation_governed no quedó con el cuerpo, DEFINER, search_path u owner de 0482';
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.authorize_consolidation_governed(uuid,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.authorize_consolidation_governed(uuid,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.authorize_consolidation_governed(uuid,text,text)',
       'execute'
     ) then
    raise exception '0482: postflight — EXECUTE de authorize_consolidation_governed no es sólo de authenticated';
  end if;
end;
$postflight$;
