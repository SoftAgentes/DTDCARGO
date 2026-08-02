-- SDD-0239 · el POD del camionero cierra el embarque.
--
-- DECISIÓN DEL FOUNDER (2026-08-02, camino A): el camionero cierra la entrega
-- desde la calle, con su PIN, sin pasar por escritorio. Se le planteó que eso le
-- da a un PIN de 4 dígitos el poder de producir un hito irreversible y lo eligió
-- igual. Queda escrito acá porque dentro de seis meses nadie se va a acordar de
-- que fue deliberado.
--
-- El guard `guard_ve_delivery_completion` (0321) NO se toca ni se debilita: sigue
-- exigiendo las dos variables de sesión y su allowlist de columnas. Lo que se
-- agrega es un SEGUNDO camino autorizado, con su propia verificación de identidad
-- (operario_pins, región VE, rol camionero/supervisor, activo) y su propia entrada
-- de auditoría con actor_type='operario' — un tipo de actor que el contrato de
-- auditoría ya soporta (45 usos en el repo).
--
-- Fallo fuerte, no silencioso: si algún paquete de la OD no resuelve a un
-- embarque, la transacción ABORTA y no queda ni el POD. Con
-- warehouse_receipts_cn.shipment_id poblado al 0%, un cierre "best-effort"
-- resolvería a NULL siempre y sería un no-op que PARECE arreglado — exactamente
-- el defecto que esta spec corrige.
--
-- camionero_pod (v1) queda intacto y en uso: la PWA sólo llama a v2 con el flag
-- DTD_POD_CLOSES_SHIPMENT encendido.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.dispatch_pods') is null
     or to_regclass('public.dispatch_order_packages') is null
     or to_regclass('public.warehouse_receipts_cn') is null
     or to_regclass('public.shipments') is null
     or to_regclass('public.shipment_events') is null
     or to_regclass('public.operario_pins') is null
     or to_regprocedure('public.guard_ve_delivery_completion()') is null then
    raise exception '0336 requiere Despacho, Almacén CN, Embarques y el guard 0321';
  end if;

  if to_regprocedure(
       'public.camionero_pod_v2(uuid,uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric,text)'
     ) is not null then
    raise exception '0336 abortado: camionero_pod_v2 ya existe';
  end if;
end;
$preflight$;

create function public.camionero_pod_v2(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_package_id     uuid,
  p_photo_path     text,
  p_signature_path text,
  p_received_by    text,
  p_received_doc   text,
  p_notes          text,
  p_request_ref    text,
  p_pod_lat        numeric default null,
  p_pod_lng        numeric default null,
  p_pod_accuracy_m numeric default null,
  p_pod_gps_status text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id   uuid;
  v_role        text;
  v_region      text;
  v_active      boolean;
  v_od_tenant   uuid;
  v_pod_id      uuid;
  v_received_by text := nullif(pg_catalog.btrim(p_received_by), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_sin_vinculo int;
  v_total_pkgs  int;
  v_shipment    public.shipments%rowtype;
  v_cerrados    uuid[] := array[]::uuid[];
  v_correlation text;
  v_reason      text;
begin
  -- ── 1. Identidad del operario (mismo contrato que camionero_pod v1) ──
  select o.tenant_id, o.role::text, o.region::text, o.active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins o
   where o.id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if v_region <> 've' then
    raise exception 'Solo operarios VE' using errcode = 'P0003';
  end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede confirmar POD'
      using errcode = 'P0004';
  end if;

  -- ── 2. Orden de despacho y validaciones de entrada ──
  select d.tenant_id into v_od_tenant
    from public.dispatch_orders d where d.id = p_od_id;
  if v_od_tenant is null then
    raise exception 'OD no encontrada' using errcode = 'P0005';
  end if;
  if v_od_tenant <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  if v_received_by is null
     or pg_catalog.char_length(v_received_by) not between 2 and 200 then
    raise exception 'Receptor obligatorio' using errcode = 'P0010';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_photo_path, '')), '') is null then
    raise exception 'Foto del POD obligatoria' using errcode = 'P0011';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_signature_path, '')), '') is null then
    raise exception 'Firma del POD obligatoria' using errcode = 'P0012';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'Referencia de POD inválida' using errcode = 'P0016';
  end if;
  if p_pod_gps_status is not null
     and p_pod_gps_status not in ('on', 'off', 'denied', 'unavailable') then
    raise exception 'pod_gps_status inválido' using errcode = 'P0013';
  end if;

  -- ── 3. Resolver los embarques de la OD · FALLO FUERTE ──
  -- Si algún paquete no llega a un embarque, se aborta TODO. Un cierre parcial
  -- silencioso es peor que no cerrar: la UI diría entregado y el embarque
  -- seguiría abierto.
  select pg_catalog.count(*)::int into v_total_pkgs
    from public.dispatch_order_packages p
   where p.od_id = p_od_id;

  if v_total_pkgs = 0 then
    raise exception 'La OD no tiene paquetes: no hay embarque que cerrar'
      using errcode = 'P0014';
  end if;

  select pg_catalog.count(*)::int into v_sin_vinculo
    from public.dispatch_order_packages p
    left join public.warehouse_receipts_cn r
      on r.id = p.package_id
     and p.package_kind = 'warehouse_receipt_cn'
   where p.od_id = p_od_id
     and (r.id is null or r.shipment_id is null);

  if v_sin_vinculo > 0 then
    raise exception
      'POD sin cierre: % de % paquete(s) de la OD no resuelven a un embarque (warehouse_receipts_cn.shipment_id vacío). Se aborta para no dejar la entrega a medias.',
      v_sin_vinculo, v_total_pkgs
      using errcode = 'P0015';
  end if;

  -- ── 4. Grabar el POD ──
  insert into public.dispatch_pods (
    tenant_id, od_id, package_id, photo_path, signature_path,
    received_by, received_doc, notes, created_by_operario_id,
    pod_lat, pod_lng, pod_accuracy_m, pod_gps_status
  ) values (
    v_tenant_id, p_od_id, p_package_id,
    pg_catalog.btrim(p_photo_path), pg_catalog.btrim(p_signature_path),
    v_received_by,
    nullif(pg_catalog.btrim(coalesce(p_received_doc, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
    p_operario_id,
    p_pod_lat, p_pod_lng, p_pod_accuracy_m, p_pod_gps_status
  )
  returning id into v_pod_id;

  v_reason := 'Entrega sellada por POD del camionero · ref ' || v_request_ref;
  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  -- ── 5. Cerrar cada embarque cuyos paquetes en esta OD estén TODOS entregados ──
  -- 0068 trajo POD parcial: dispatch_order_packages.delivery_status puede ser
  -- pendiente|entregado|rechazado|retornado. Un paquete retornado o rechazado
  -- significa que la entrega de ESE embarque no se completó, así que no se cierra.
  -- Eso NO es un error: es una entrega parcial legítima. El error de §3 es otra
  -- cosa — que el paquete no resuelva a un embarque, que es un defecto de datos.
  for v_shipment in
    select s.*
      from public.shipments s
     where s.id in (
             select r.shipment_id
               from public.dispatch_order_packages p
               join public.warehouse_receipts_cn r
                 on r.id = p.package_id
                and p.package_kind = 'warehouse_receipt_cn'
              where p.od_id = p_od_id
                and r.shipment_id is not null
              group by r.shipment_id
             having pg_catalog.count(*) filter (
                      where p.delivery_status <> 'entregado'
                    ) = 0
           )
       and s.tenant_id = v_tenant_id
       and s.deleted_at is null
     order by s.id
     for update of s
  loop
    -- Ya entregado: idempotente, no es error (dos PODs de la misma OD).
    if v_shipment.status = 'delivered' then
      continue;
    end if;

    if v_shipment.status not in ('out_for_delivery', 'last_mile') then
      raise exception
        'Embarque % en estado "%": no se puede cerrar desde el POD',
        v_shipment.code, v_shipment.status
        using errcode = '40001';
    end if;

    perform pg_catalog.set_config(
      'dtd.ve_delivery_completion', v_request_ref, true
    );
    perform pg_catalog.set_config(
      'dtd.ve_delivery_completion_shipment', v_shipment.id::text, true
    );

    update public.shipments
       set status = 'delivered',
           pod_signed_by = v_received_by
     where id = v_shipment.id
       and tenant_id = v_tenant_id
       and status = v_shipment.status
       and deleted_at is null;
    if not found then
      raise exception 'Conflicto al cerrar el embarque %', v_shipment.code
        using errcode = '40001';
    end if;

    -- created_by va NULL a propósito: referencia auth.users y el camionero
    -- entra con PIN, no tiene fila ahí. La identidad real queda en la auditoría.
    insert into public.shipment_events (
      tenant_id, shipment_id, status, note, created_by
    ) values (
      v_tenant_id, v_shipment.id, 'delivered',
      'Entrega sellada por POD del camionero · receptor: ' || v_received_by,
      null
    );

    v_correlation := pg_catalog.concat(
      'pod-closes-shipment:', v_shipment.id::text, ':', v_request_ref
    );

    perform public.append_audit_event(
      v_tenant_id,
      'shipment',
      v_shipment.id,
      'operario',
      p_operario_id,
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
        'attestation_kind', 'dispatch_pod',
        'sealed_dispatch_pod', true,
        'pod_id', v_pod_id,
        'od_id', p_od_id,
        'operario_id', p_operario_id,
        'from', v_shipment.status,
        'to', 'delivered'
      ),
      v_correlation,
      1,
      'restricted'
    );

    v_cerrados := v_cerrados || v_shipment.id;
  end loop;

  return pg_catalog.jsonb_build_object(
    'pod_id', v_pod_id,
    'shipments_closed', pg_catalog.to_jsonb(v_cerrados),
    'closed_count', pg_catalog.array_length(v_cerrados, 1)
  );
end;
$function$;

alter function public.camionero_pod_v2(
  uuid, uuid, uuid, text, text, text, text, text, text,
  numeric, numeric, numeric, text
) owner to postgres;

revoke all on function public.camionero_pod_v2(
  uuid, uuid, uuid, text, text, text, text, text, text,
  numeric, numeric, numeric, text
) from public, anon, authenticated;

grant execute on function public.camionero_pod_v2(
  uuid, uuid, uuid, text, text, text, text, text, text,
  numeric, numeric, numeric, text
) to service_role;

comment on function public.camionero_pod_v2(
  uuid, uuid, uuid, text, text, text, text, text, text,
  numeric, numeric, numeric, text
) is
  'SDD-0239 · POD del camionero que SÍ cierra el embarque. Resuelve los embarques de la OD por dispatch_order_packages → warehouse_receipts_cn.shipment_id y los pasa a delivered respetando el guard de 0321. Aborta entera si algún paquete no resuelve. Audita con actor_type=operario y sealed_dispatch_pod=true. camionero_pod (v1) sigue vigente detrás del flag DTD_POD_CLOSES_SHIPMENT.';

-- Marca la v1 como deprecada SI existe. Condicional a propósito: la firma viva
-- de camionero_pod la fija 0068 (agregó GPS y dropeó la de 0025), y una
-- migración no debería morir por un comentario si el orden cambia o si se
-- aplica sobre un árbol parcial.
do $deprecar$
begin
  if to_regprocedure(
       'public.camionero_pod(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,text)'
     ) is not null then
    comment on function public.camionero_pod(
      uuid, uuid, uuid, text, text, text, text, text,
      numeric, numeric, numeric, text
    ) is
      'DEPRECADO (SDD-0239): confirma POD pero NO cierra el embarque. Usar camionero_pod_v2. Se conserva para no romper una PWA vieja en campo.';
  end if;
end;
$deprecar$;
