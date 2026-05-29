-- ═════════════════════════════════════════════════════════════
-- Sprint 2 (Plan v3) · operario_action.reassign_od + audit
-- ═════════════════════════════════════════════════════════════
-- Implementa el stub P0101 (`reassign_od`) del Sprint F.
--
-- Caso de uso (handoff bodeguero v1.7):
-- El admin asigna OD con un truck/driver. En runtime el bodeguero descubre
-- que el truck rompió o el driver no llegó, y necesita reasignar EN EL
-- MISMO MODAL sin pedirle al admin. Esta rama del operario_action permite
-- al bodeguero (NO el camionero) modificar dispatch_orders.truck_id /
-- driver_id MIENTRAS el OD esté en estados editables (creada/cargando).
--
-- Reglas:
--  - Solo bodeguero/supervisor (NO camionero).
--  - OD debe estar en creada o cargando (no se puede reasignar en_ruta).
--  - truck_id o driver_id (al menos uno) requerido.
--  - Si el truck cambia, también actualizar capacity snapshots si están
--    pre-cargados (preserva consistencia con la card de capacity_pct).
--  - Audit log con before/after en entity_audit_log.
--  - Setea reassigned_at = now() para badge "reasignada" en Studio.

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
  v_new_truck_id   uuid;
  v_new_driver_id  uuid;
  v_new_truck      record;
  v_new_driver     record;
  v_old_truck_id   uuid;
  v_old_driver_id  uuid;
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
      -- ─────────────────────────────────────────────────────
      -- Sprint 2 · reasignar truck/driver de una OD activa.
      -- Payload: { "od_id": uuid,
      --            "truck_id": uuid?,
      --            "driver_id": uuid?,
      --            "reason": "text" (opcional) }
      -- ─────────────────────────────────────────────────────
      if v_operario.region <> 've' then
        raise exception 'Solo operarios VE pueden reasignar' using errcode = 'P0003';
      end if;
      if not (
        'bodeguero' = any(v_operario.roles) or
        'supervisor' = any(v_operario.roles)
      ) then
        raise exception 'Tu rol no permite reasignar' using errcode = 'P0004';
      end if;

      v_od_id         := (p_payload->>'od_id')::uuid;
      v_new_truck_id  := nullif(p_payload->>'truck_id', '')::uuid;
      v_new_driver_id := nullif(p_payload->>'driver_id', '')::uuid;
      v_reason        := nullif(trim(coalesce(p_payload->>'reason', '')), '');

      if v_od_id is null then
        raise exception 'Falta od_id' using errcode = 'P0110';
      end if;
      if v_new_truck_id is null and v_new_driver_id is null then
        raise exception 'Indicá al menos truck_id o driver_id' using errcode = 'P0130';
      end if;

      -- OD debe pertenecer al tenant + estar en creada/cargando
      select id, tenant_id, status, truck_id, driver_id, hub
        into v_od
        from public.dispatch_orders
       where id = v_od_id;
      if v_od.id is null then
        raise exception 'OD no encontrada' using errcode = 'P0005';
      end if;
      if v_od.tenant_id <> v_operario.tenant_id then
        raise exception 'OD de otro tenant' using errcode = 'P0006';
      end if;
      if v_od.status not in ('creada','cargando') then
        raise exception 'OD en status % · no se puede reasignar', v_od.status using errcode = 'P0131';
      end if;

      v_old_truck_id  := v_od.truck_id;
      v_old_driver_id := v_od.driver_id;

      -- Validar nuevo truck (si cambió)
      if v_new_truck_id is not null and v_new_truck_id is distinct from v_old_truck_id then
        select id, tenant_id, capacity_cbm, capacity_kg, status, hub_code
          into v_new_truck
          from public.tms_trucks
         where id = v_new_truck_id;
        if v_new_truck.id is null then
          raise exception 'Truck no encontrado' using errcode = 'P0132';
        end if;
        if v_new_truck.tenant_id <> v_operario.tenant_id then
          raise exception 'Truck de otro tenant' using errcode = 'P0133';
        end if;
        if v_new_truck.status <> 'disponible' then
          raise exception 'Truck no está disponible (status=%)', v_new_truck.status using errcode = 'P0134';
        end if;
      end if;

      -- Validar nuevo driver (si cambió)
      if v_new_driver_id is not null and v_new_driver_id is distinct from v_old_driver_id then
        select id, tenant_id, hub_code
          into v_new_driver
          from public.tms_drivers
         where id = v_new_driver_id;
        if v_new_driver.id is null then
          raise exception 'Driver no encontrado' using errcode = 'P0135';
        end if;
        if v_new_driver.tenant_id <> v_operario.tenant_id then
          raise exception 'Driver de otro tenant' using errcode = 'P0136';
        end if;
      end if;

      -- Update + capacity snapshot si el truck cambió
      update public.dispatch_orders
         set truck_id              = coalesce(v_new_truck_id, truck_id),
             driver_id             = coalesce(v_new_driver_id, driver_id),
             reassigned_at         = now(),
             capacity_kg_snapshot  = case
                                       when v_new_truck_id is not null
                                            and v_new_truck_id is distinct from v_old_truck_id
                                       then v_new_truck.capacity_kg
                                       else capacity_kg_snapshot
                                     end,
             capacity_cbm_snapshot = case
                                       when v_new_truck_id is not null
                                            and v_new_truck_id is distinct from v_old_truck_id
                                       then v_new_truck.capacity_cbm
                                       else capacity_cbm_snapshot
                                     end
       where id = v_od_id;

      -- Audit log
      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'dispatch_order', v_od_id, 'operario', p_operario_id,
         'reassigned',
         jsonb_build_object(
           'old_truck_id', v_old_truck_id,
           'new_truck_id', coalesce(v_new_truck_id, v_old_truck_id),
           'old_driver_id', v_old_driver_id,
           'new_driver_id', coalesce(v_new_driver_id, v_old_driver_id),
           'reason', v_reason
         ));

      v_result := jsonb_build_object(
        'ok', true,
        'od_id', v_od_id,
        'new_truck_id', coalesce(v_new_truck_id, v_old_truck_id),
        'new_driver_id', coalesce(v_new_driver_id, v_old_driver_id)
      );

    when 'partial_delivery' then
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
        raise exception 'reason es obligatorio para %', v_new_status using errcode = 'P0121';
      end if;

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

      update public.dispatch_order_packages
         set delivery_status = v_new_status
       where od_id = v_od_id and package_id = v_package_id;

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
  'Sprint F+E+3+2: RPC genérica mutaciones operario. Branches: scan_box, seal_reception (Sprint E), partial_delivery (Sprint 3), reassign_od (Sprint 2). SECURITY DEFINER + service_role only.';

revoke all on function public.operario_action(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.operario_action(uuid, text, jsonb) to service_role;
