-- ─────────────────────────────────────────────────────────────────────────────
-- 0486 · SDD-0534 — Completar una ruta TMS deja de fallar siempre: el
-- correlation_id que complete_tms_route_governed le pasa al writer AUD-01 cabe
-- en los 128 caracteres que el writer admite.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Producción es el Supabase
--    self-hosted del servidor propio. Antes de aplicar, el Director lee en
--    producción, READ ONLY y sólo de catálogo, el md5 de prosrc, SECURITY
--    DEFINER, search_path, owner y ACL de complete_tms_route_governed que el
--    preflight y el postflight exigen. Fusionar la PR NO autoriza aplicarla.
--    ORDEN: indiferente, también respecto de las otras migraciones de la
--    SDD-0534 (0483–0489): cada una toca una sola RPC y se aplica de a una. La
--    app no cambia: la pantalla y la Server Action siguen mandando la misma
--    referencia, y la firma de la RPC es la misma. Basta aplicarla para que la
--    acción funcione.
--
-- ── El defecto ──────────────────────────────────────────────
-- La pantalla arma la referencia como `tms-route-completion:<id>:<uuid>`, con
-- un UUID aleatorio (app/studio/(app)/tms/_components/RoutesTab.tsx:30): 94
-- caracteres siempre, porque sus tres partes tienen largo fijo. La 0320
-- (0320:294-296) arma el correlation_id como
-- `tms-route-completion:<id>:<referencia>`: 21 + 36 + 1 + 94 = 152. El writer
-- real (append_audit_event 0294 → append_audit_event_v1 0267:542-545) y el
-- CHECK entity_audit_log_correlation_id_check (0267:318-322) exigen
-- '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$', o sea 128 como máximo. El writer
-- levanta 22023 «audit: correlation_id inválido» al final de la RPC, y la
-- transacción entera se revierte: la ruta sigue `en_ruta`, el camión y el
-- chofer `en_ruta`, el embarque `out_for_delivery`, sin evento de timeline y
-- sin AUD-01. Con ese prefijo, cualquier referencia de más de 70 caracteres
-- falla, aunque la propia RPC acepte hasta 128 (0320:135-138). Reproducido en
-- PGlite con el writer real (0267 + 0294), no con el simulado del contrato
-- 0320: supabase/tests/0486_tms_completar_ruta_correlation_id.test.sql sin
-- esta migración es el control rojo.
--
-- ── El arreglo ──────────────────────────────────────────────
-- El mismo de la 0482 (SDD-0532, Naviera): el correlation_id usa el md5 de la
-- referencia en vez de la referencia:
-- `tms-route-completion:<id>:<md5(referencia)>` = 21 + 36 + 1 + 32 = 90
-- caracteres, para CUALQUIER referencia que la RPC acepte. Sigue siendo
-- determinista (la misma referencia da el mismo correlation_id), conserva el
-- espacio de nombres de la 0320 y distingue referencias que comparten un
-- prefijo largo. La referencia completa sigue en payload.request_ref, que es
-- la llave de idempotencia y no cambia. md5 y no sha256, como en la 0482: con
-- los 64 caracteres del hex de sha256 el correlation_id mediría 122 y cabría,
-- pero las ocho RPC del lote R3 quedan con el mismo formato, y el hash no
-- cumple aquí una función de seguridad (no es llave única ni secreto). No se
-- toca nada más: el resto del cuerpo es el de 0320, byte a byte.
--
-- ── Locks de esta migración ─────────────────────────────────
-- Sólo catálogo: reemplaza el cuerpo y el comentario de una función. No toca
-- filas ni toma locks de tabla. lock_timeout 5 s y statement_timeout 30 s con
-- set de sesión, como 0320.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

-- Aborta sin cambiar nada si la RPC no es la de 0320 (md5 del prosrc con
-- CRLF→LF, o sin espacios), o si perdió SECURITY DEFINER o el search_path
-- sellado. El writer AUD-01 no se vuelve a exigir: la 0320 aplicada ya lo
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
          'public.complete_tms_route_governed(uuid,text,text)'
        )
    and p.prosecdef
    and p.proconfig = array['search_path=""'];

  if v_md5 is null then
    raise exception '0486 abortado: complete_tms_route_governed falta o no es SECURITY DEFINER con search_path vacío';
  end if;
  if v_md5 <> 'a58ed097b0310dae2d5ff3ea479b592a'
     and v_md5_normalized <> 'de4989211e73ca507756752a3bc04528' then
    raise exception '0486 abortado: complete_tms_route_governed tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
      v_md5, v_md5_normalized;
  end if;
end;
$preflight$;

create or replace function public.complete_tms_route_governed(
  p_route_id uuid,
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
  v_route public.tms_routes%rowtype;
  v_shipment public.shipments%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_truck_status text;
  v_driver_status text;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'tms: autenticación requerida' using errcode = '42501';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'tms: motivo inválido' using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'tms: referencia inválida' using errcode = '22023';
  end if;

  select r.* into v_route
  from public.tms_routes r
  join public.user_tenants ut
    on ut.tenant_id = r.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'warehouse')
   and ut.disabled_at is null
  where r.id = p_route_id
    and r.deleted_at is null
  for update of r;
  if not found then
    raise exception 'tms: ruta no disponible' using errcode = 'P0002';
  end if;
  v_tenant := v_route.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tms-route-completion:' || v_tenant::text || ':' || v_request_ref,
      230
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'tms_route_completed'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;
  if found then
    if v_existing.entity_id = p_route_id
       and v_existing.reason = v_reason then
      return 'replayed';
    end if;
    raise exception 'tms: referencia reutilizada' using errcode = '40001';
  end if;

  if v_route.status <> 'en_ruta' then
    raise exception 'tms: conflicto de estado de la ruta' using errcode = '40001';
  end if;

  select s.* into v_shipment
  from public.shipments s
  where s.id = v_route.shipment_id
    and s.tenant_id = v_tenant
    and s.deleted_at is null
  for update;
  if not found or v_shipment.status <> 'out_for_delivery' then
    raise exception 'tms: conflicto de estado del embarque' using errcode = '40001';
  end if;

  if v_route.truck_id is not null then
    select t.status::text into v_truck_status
    from public.tms_trucks t
    where t.id = v_route.truck_id
      and t.tenant_id = v_tenant
      and t.deleted_at is null
    for update;
    if not found or v_truck_status <> 'en_ruta' then
      raise exception 'tms: conflicto de estado del camión' using errcode = '40001';
    end if;
    if exists (
      select 1 from public.tms_routes other
      where other.tenant_id = v_tenant
        and other.id <> p_route_id
        and other.truck_id = v_route.truck_id
        and other.status in ('planificado', 'en_ruta')
        and other.deleted_at is null
    ) then
      raise exception 'tms: el camión tiene otra ruta activa' using errcode = '40001';
    end if;
  end if;

  if v_route.driver_id is not null then
    select d.status::text into v_driver_status
    from public.tms_drivers d
    where d.id = v_route.driver_id
      and d.tenant_id = v_tenant
      and d.deleted_at is null
    for update;
    if not found or v_driver_status <> 'en_ruta' then
      raise exception 'tms: conflicto de estado del chofer' using errcode = '40001';
    end if;
    if exists (
      select 1 from public.tms_routes other
      where other.tenant_id = v_tenant
        and other.id <> p_route_id
        and other.driver_id = v_route.driver_id
        and other.status in ('planificado', 'en_ruta')
        and other.deleted_at is null
    ) then
      raise exception 'tms: el chofer tiene otra ruta activa' using errcode = '40001';
    end if;
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.tms_route_completion', v_request_ref, true);
  perform pg_catalog.set_config(
    'dtd.tms_route_completion_route', p_route_id::text, true
  );

  update public.tms_routes
  set status = 'completado', progress_pct = 100
  where id = p_route_id
    and tenant_id = v_tenant
    and status = 'en_ruta'
    and deleted_at is null;
  if not found then
    raise exception 'tms: conflicto al completar la ruta' using errcode = '40001';
  end if;

  if v_route.truck_id is not null then
    update public.tms_trucks
    set status = 'disponible'
    where id = v_route.truck_id
      and tenant_id = v_tenant
      and status = 'en_ruta'
      and deleted_at is null;
    if not found then
      raise exception 'tms: conflicto al liberar el camión' using errcode = '40001';
    end if;
  end if;

  if v_route.driver_id is not null then
    update public.tms_drivers
    set status = 'disponible'
    where id = v_route.driver_id
      and tenant_id = v_tenant
      and status = 'en_ruta'
      and deleted_at is null;
    if not found then
      raise exception 'tms: conflicto al liberar el chofer' using errcode = '40001';
    end if;
  end if;

  update public.shipments
  set status = 'last_mile'
  where id = v_route.shipment_id
    and tenant_id = v_tenant
    and status = 'out_for_delivery'
    and deleted_at is null;
  if not found then
    raise exception 'tms: conflicto al mover el embarque' using errcode = '40001';
  end if;

  insert into public.shipment_events (
    tenant_id, shipment_id, status, note, created_by
  ) values (
    v_tenant,
    v_route.shipment_id,
    'last_mile',
    'Ruta ' || v_route.route_code || ' completada · próximo paso: POD del cliente',
    v_actor
  );

  -- SDD-0534: el writer AUD-01 admite 128 caracteres de correlation_id. Con
  -- el md5 de la referencia mide siempre 90; la referencia completa queda en
  -- payload.request_ref.
  v_correlation := pg_catalog.concat(
    'tms-route-completion:', p_route_id::text, ':',
    pg_catalog.md5(v_request_ref)
  );
  perform public.append_audit_event(
    v_tenant,
    'tms_route',
    p_route_id,
    'user',
    v_actor,
    'tms_route_completed',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_route.status,
      'progress_pct', v_route.progress_pct,
      'shipment_status', v_shipment.status
    ),
    pg_catalog.jsonb_build_object(
      'status', 'completado',
      'progress_pct', 100,
      'shipment_status', 'last_mile'
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'route_code', v_route.route_code,
      'shipment_id', v_route.shipment_id,
      'truck_id', v_route.truck_id,
      'driver_id', v_route.driver_id,
      'from', v_route.status,
      'to', 'completado'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

-- CREATE OR REPLACE conserva el owner y la ACL que dejó 0320 (postgres;
-- EXECUTE sólo para authenticated). No se reafirman: si producción los tiene
-- distintos, el postflight aborta y se revisa antes de aplicar.
comment on function public.complete_tms_route_governed(uuid, text, text) is
  'SDD-0230: cierre R3 de ruta con rol, tenant, precondiciones, recursos, shipment, timeline, idempotencia y AUD-01 atómicos. SDD-0534: correlation_id con md5 de la referencia, 90 caracteres.';

-- El cuerpo instalado es el de esta migración, con la seguridad, el owner y
-- la ACL de 0320.
do $postflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(
            'public.complete_tms_route_governed(uuid,text,text)'
          )
      and p.prosecdef
      and p.proconfig = array['search_path=""']
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n'))
          = '8f72f0e10f86b079b2cb345289f02ee5'
  ) then
    raise exception '0486: postflight — complete_tms_route_governed no quedó con el cuerpo, DEFINER, search_path u owner de 0486';
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.complete_tms_route_governed(uuid,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.complete_tms_route_governed(uuid,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.complete_tms_route_governed(uuid,text,text)',
       'execute'
     ) then
    raise exception '0486: postflight — EXECUTE de complete_tms_route_governed no es sólo de authenticated';
  end if;
end;
$postflight$;
