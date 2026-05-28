-- ═════════════════════════════════════════════════════════════
-- Sprint 3 (Plan v3) · POD parcial + GPS addons
-- ═════════════════════════════════════════════════════════════
-- Cambios:
--   1. dispatch_pods: + pod_lat / pod_lng / pod_accuracy_m / pod_gps_status
--   2. dispatch_order_packages: + delivery_status (pendiente|entregado|rechazado|retornado)
--   3. camionero_pod RPC: signature extendida con GPS
--   4. operario_action: rama partial_delivery implementada
--
-- Convención: Sprint F (0066) trajo `tms_truck_locations` para GPS live
-- continuo del camión. Este sprint suma GPS POD-puntual (un snapshot al
-- momento de confirmar la entrega) que vive en dispatch_pods. NO duplica
-- info con tms_truck_locations · son dos casos de uso distintos.

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. dispatch_pods · GPS puntual                            ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.dispatch_pods
  add column if not exists pod_lat        numeric(9, 6),
  add column if not exists pod_lng        numeric(9, 6),
  add column if not exists pod_accuracy_m numeric(7, 2),
  add column if not exists pod_gps_status text;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and constraint_name = 'dispatch_pods_gps_status_check'
  ) then
    alter table public.dispatch_pods
      add constraint dispatch_pods_gps_status_check
      check (pod_gps_status is null or pod_gps_status in ('on','off','denied','unavailable'));
  end if;
end $$;

comment on column public.dispatch_pods.pod_lat is
  'Sprint 3 · GPS lat al confirmar POD (snapshot puntual · diferente de tms_truck_locations que es stream live).';
comment on column public.dispatch_pods.pod_gps_status is
  'Estado del GPS al momento del POD: on=ok captura · off=user desactivó toggle · denied=permiso denegado · unavailable=device sin GPS.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. dispatch_order_packages · delivery_status              ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.dispatch_order_packages
  add column if not exists delivery_status text not null default 'pendiente';

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and constraint_name = 'dispatch_order_packages_delivery_status_check'
  ) then
    alter table public.dispatch_order_packages
      add constraint dispatch_order_packages_delivery_status_check
      check (delivery_status in ('pendiente','entregado','rechazado','retornado'));
  end if;
end $$;

create index if not exists dispatch_order_packages_delivery_status_idx
  on public.dispatch_order_packages (od_id, delivery_status);

comment on column public.dispatch_order_packages.delivery_status is
  'Sprint 3 · status per-paquete del POD parcial: pendiente al crear, transiciona a entregado/rechazado/retornado via operario_action.partial_delivery.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. camionero_pod RPC · extender con GPS                   ║
-- ╚═══════════════════════════════════════════════════════════╝

drop function if exists public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text);

create or replace function public.camionero_pod(
  p_operario_id      uuid,
  p_od_id            uuid,
  p_package_id       uuid,                    -- nullable: POD por paquete
  p_photo_path       text,
  p_signature_path   text,
  p_received_by      text,
  p_received_doc     text,
  p_notes            text,
  p_pod_lat          numeric default null,
  p_pod_lng          numeric default null,
  p_pod_accuracy_m   numeric default null,
  p_pod_gps_status   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
  v_pod_id     uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede confirmar POD' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_received_by is null or length(trim(p_received_by)) = 0 then
    raise exception 'Receptor obligatorio' using errcode = 'P0010';
  end if;
  if p_photo_path is null or length(trim(p_photo_path)) = 0 then
    raise exception 'Foto del POD obligatoria' using errcode = 'P0011';
  end if;
  if p_signature_path is null or length(trim(p_signature_path)) = 0 then
    raise exception 'Firma del POD obligatoria' using errcode = 'P0012';
  end if;
  if p_pod_gps_status is not null and p_pod_gps_status not in ('on','off','denied','unavailable') then
    raise exception 'pod_gps_status inválido' using errcode = 'P0013';
  end if;

  insert into public.dispatch_pods (
    tenant_id, od_id, package_id, photo_path, signature_path,
    received_by, received_doc, notes, created_by_operario_id,
    pod_lat, pod_lng, pod_accuracy_m, pod_gps_status
  ) values (
    v_tenant_id, p_od_id, p_package_id, p_photo_path, p_signature_path,
    trim(p_received_by), nullif(trim(coalesce(p_received_doc, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_operario_id,
    p_pod_lat, p_pod_lng, p_pod_accuracy_m, p_pod_gps_status
  )
  returning id into v_pod_id;

  return v_pod_id;
end;
$$;

comment on function public.camionero_pod(
  uuid, uuid, uuid, text, text, text, text, text,
  numeric, numeric, numeric, text
) is
  'Sprint 3 · POD con GPS opcional (snapshot puntual al confirmar entrega). Mantiene compatibilidad: GPS fields default null si no se mandan.';

revoke all on function public.camionero_pod(
  uuid, uuid, uuid, text, text, text, text, text,
  numeric, numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.camionero_pod(
  uuid, uuid, uuid, text, text, text, text, text,
  numeric, numeric, numeric, text
) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. operario_action · implementar partial_delivery         ║
-- ║    Mantiene scan_box + seal_reception del Sprint E (0067) ║
-- ╚═══════════════════════════════════════════════════════════╝

create or replace function public.operario_action(
  p_operario_id  uuid,
  p_action_type  text,
  p_payload      jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operario       record;
  v_result         jsonb := '{}'::jsonb;
  v_receipt_id     uuid;
  v_box_code       text;
  v_box            record;
  v_receipt        record;
  v_force          boolean;
  v_scanned_count  int;
  v_expected_count int;
  v_od_id          uuid;
  v_package_id     uuid;
  v_new_status     text;
  v_reason         text;
  v_od             record;
  v_pkg            record;
begin
  select id, tenant_id, role, roles, region, active
    into v_operario
    from public.operario_pins
   where id = p_operario_id;

  if v_operario.id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_operario.active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;

  case p_action_type
    when 'edit_receipt' then
      raise exception 'edit_receipt branch pendiente · Sprint 1' using errcode = 'P0100';

    when 'reassign_od' then
      raise exception 'reassign_od branch pendiente · Sprint 2' using errcode = 'P0101';

    when 'partial_delivery' then
      -- ─────────────────────────────────────────────────────
      -- Sprint 3 · cambiar delivery_status de un package
      -- Payload: { "od_id": uuid, "package_id": uuid,
      --            "status": "entregado"|"rechazado"|"retornado",
      --            "reason": "text" (opcional · obligatorio si rechazado/retornado) }
      -- ─────────────────────────────────────────────────────
      if v_operario.region <> 've' then
        raise exception 'Solo operarios VE pueden marcar entregas' using errcode = 'P0003';
      end if;
      if not (
        'camionero' = any(v_operario.roles) or
        'supervisor' = any(v_operario.roles)
      ) then
        raise exception 'Tu rol no permite marcar entregas' using errcode = 'P0004';
      end if;

      v_od_id      := (p_payload->>'od_id')::uuid;
      v_package_id := (p_payload->>'package_id')::uuid;
      v_new_status := nullif(trim(p_payload->>'status'), '');
      v_reason     := nullif(trim(coalesce(p_payload->>'reason', '')), '');

      if v_od_id is null or v_package_id is null or v_new_status is null then
        raise exception 'Falta od_id / package_id / status' using errcode = 'P0110';
      end if;
      if v_new_status not in ('entregado','rechazado','retornado') then
        raise exception 'status inválido (entregado|rechazado|retornado)' using errcode = 'P0120';
      end if;
      if v_new_status in ('rechazado','retornado') and v_reason is null then
        raise exception 'reason es obligatorio para % ', v_new_status using errcode = 'P0121';
      end if;

      -- OD debe pertenecer al tenant + estar en en_ruta
      select id, tenant_id, status
        into v_od
        from public.dispatch_orders
       where id = v_od_id;
      if v_od.id is null then
        raise exception 'OD no encontrada' using errcode = 'P0005';
      end if;
      if v_od.tenant_id <> v_operario.tenant_id then
        raise exception 'OD de otro tenant' using errcode = 'P0006';
      end if;
      if v_od.status not in ('en_ruta','entregada') then
        raise exception 'OD debe estar en_ruta para marcar entregas (status=%)', v_od.status using errcode = 'P0007';
      end if;

      -- Package debe pertenecer a la OD y estar pendiente
      select od_id, package_id, delivery_status
        into v_pkg
        from public.dispatch_order_packages
       where od_id = v_od_id and package_id = v_package_id;
      if v_pkg.package_id is null then
        raise exception 'Paquete no encontrado en la OD' using errcode = 'P0008';
      end if;
      if v_pkg.delivery_status <> 'pendiente' then
        raise exception 'Paquete ya marcado como %', v_pkg.delivery_status using errcode = 'P0122';
      end if;

      -- Update
      update public.dispatch_order_packages
         set delivery_status = v_new_status
       where od_id = v_od_id and package_id = v_package_id;

      -- Audit log
      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'dispatch_order', v_od_id, 'operario', p_operario_id,
         'package_' || v_new_status,
         jsonb_build_object('package_id', v_package_id, 'reason', v_reason));

      v_result := jsonb_build_object(
        'ok', true,
        'package_id', v_package_id,
        'new_status', v_new_status
      );

    when 'scan_box' then
      -- ─────────────────────────────────────────────────────
      -- Sprint E · escanear caja del receipt VE (sin cambios vs 0067)
      -- ─────────────────────────────────────────────────────
      if v_operario.region <> 've' then
        raise exception 'Solo operarios VE pueden escanear cajas' using errcode = 'P0003';
      end if;
      if not (
        'bodeguero' = any(v_operario.roles) or
        'supervisor' = any(v_operario.roles)
      ) then
        raise exception 'Tu rol no permite escanear cajas' using errcode = 'P0004';
      end if;

      v_receipt_id := (p_payload->>'receipt_id')::uuid;
      v_box_code := nullif(trim(p_payload->>'code'), '');
      if v_receipt_id is null or v_box_code is null then
        raise exception 'Falta receipt_id o code' using errcode = 'P0110';
      end if;

      select id, tenant_id, status, started_at
        into v_receipt
        from public.warehouse_receipts_ve
       where id = v_receipt_id
         and tenant_id = v_operario.tenant_id
         and deleted_at is null;
      if v_receipt.id is null then
        raise exception 'Receipt no encontrado' using errcode = 'P0111';
      end if;
      if v_receipt.status = 'sellado' then
        raise exception 'Receipt ya está sellado · no admite más escaneos' using errcode = 'P0112';
      end if;

      select id, scanned_at
        into v_box
        from public.warehouse_receipt_ve_boxes
       where receipt_id = v_receipt_id
         and code = v_box_code;
      if v_box.id is null then
        raise exception 'Caja % no figura en este receipt', v_box_code using errcode = 'P0113';
      end if;
      if v_box.scanned_at is not null then
        raise exception 'Caja % ya estaba escaneada', v_box_code using errcode = 'P0114';
      end if;

      update public.warehouse_receipt_ve_boxes
         set scanned_at             = now(),
             scanned_by_operario_id = p_operario_id,
             scanned_manual         = coalesce((p_payload->>'manual')::boolean, false)
       where id = v_box.id;

      if v_receipt.status = 'en_muelle' then
        update public.warehouse_receipts_ve
           set status      = 'recibiendo',
               started_at  = coalesce(started_at, now()),
               received_by_operario_id = coalesce(received_by_operario_id, p_operario_id)
         where id = v_receipt_id;
      end if;

      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'warehouse_receipt', v_receipt_id, 'operario', p_operario_id,
         'box_scanned',
         jsonb_build_object('code', v_box_code, 'manual', coalesce((p_payload->>'manual')::boolean, false)));

      select count(*) filter (where scanned_at is not null),
             count(*)
        into v_scanned_count, v_expected_count
        from public.warehouse_receipt_ve_boxes
       where receipt_id = v_receipt_id;

      v_result := jsonb_build_object(
        'ok', true,
        'box_id', v_box.id,
        'scanned_count', v_scanned_count,
        'expected_count', v_expected_count
      );

    when 'seal_reception' then
      if v_operario.region <> 've' then
        raise exception 'Solo operarios VE pueden sellar receipts' using errcode = 'P0003';
      end if;
      if not (
        'bodeguero' = any(v_operario.roles) or
        'supervisor' = any(v_operario.roles)
      ) then
        raise exception 'Tu rol no permite sellar receipts' using errcode = 'P0004';
      end if;

      v_receipt_id := (p_payload->>'receipt_id')::uuid;
      v_force := coalesce((p_payload->>'force')::boolean, false);
      if v_receipt_id is null then
        raise exception 'Falta receipt_id' using errcode = 'P0110';
      end if;

      select id, tenant_id, status
        into v_receipt
        from public.warehouse_receipts_ve
       where id = v_receipt_id
         and tenant_id = v_operario.tenant_id
         and deleted_at is null;
      if v_receipt.id is null then
        raise exception 'Receipt no encontrado' using errcode = 'P0111';
      end if;
      if v_receipt.status = 'sellado' then
        raise exception 'Receipt ya estaba sellado' using errcode = 'P0112';
      end if;

      select count(*) filter (where scanned_at is not null),
             count(*)
        into v_scanned_count, v_expected_count
        from public.warehouse_receipt_ve_boxes
       where receipt_id = v_receipt_id;

      if v_scanned_count < v_expected_count and not v_force then
        raise exception 'Faltan % cajas por escanear · usá force=true si querés sellar con incidencia',
          (v_expected_count - v_scanned_count) using errcode = 'P0115';
      end if;

      update public.warehouse_receipts_ve
         set status                = case
                                       when v_scanned_count < v_expected_count then 'con_incidencia'
                                       else 'sellado'
                                     end,
             sealed_at             = now(),
             sealed_by_operario_id = p_operario_id,
             incident_note         = nullif(trim(coalesce(p_payload->>'incident_note', '')), '')
       where id = v_receipt_id;

      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'warehouse_receipt', v_receipt_id, 'operario', p_operario_id,
         'sealed',
         jsonb_build_object(
           'scanned', v_scanned_count,
           'expected', v_expected_count,
           'force', v_force,
           'incident_note', p_payload->>'incident_note'
         ));

      v_result := jsonb_build_object(
        'ok', true,
        'scanned_count', v_scanned_count,
        'expected_count', v_expected_count,
        'status', case
                    when v_scanned_count < v_expected_count then 'con_incidencia'
                    else 'sellado'
                  end
      );

    else
      raise exception 'action_type % desconocido', p_action_type using errcode = 'P0105';
  end case;

  return v_result;
end;
$$;

comment on function public.operario_action(uuid, text, jsonb) is
  'Sprint F + E + 3: RPC genérica mutaciones operario. Branches: scan_box + seal_reception (Sprint E) + partial_delivery (Sprint 3). SECURITY DEFINER + service_role only.';

revoke all on function public.operario_action(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.operario_action(uuid, text, jsonb) to service_role;
