-- 0245 · SDD-0154 · Recibir escaneando: la etiqueta pre-declarada materializa la recepción
--
-- EL FLUJO (founder, 17-jul)
--   Llega la mercancía a Yiwu con su etiqueta pegada. El operario ESCANEA una caja
--   → el sistema reconoce que es de tal cliente (por la caja pre-declarada de 0244)
--   → "¿Recibir esta compra?" → rectifica la cantidad si hace falta → recibe.
--   Automáticamente se crea la recepción y se avisa al cliente y al equipo.
--
--   La recepción es POR COMPRA, no caja por caja: escanear UNA etiqueta identifica
--   la prealerta entera y recibe sus N cajas de un golpe (con la cantidad
--   rectificable). Es lo que el founder describió: "escanean, ponen sí recibir,
--   rectifican si las cantidades están bien y avanzan".
--
-- POR QUÉ NO TOCA sync_boxes_for_receipt
--   La adopción (esperada → recibida) se hace EXPLÍCITA acá dentro, no vía el
--   trigger del receipt. Así:
--     · el trigger de 0241 queda intacto (cero drift en una función que ya vive);
--     · se controla EXACTAMENTE cuántas cajas se adoptan (la cantidad rectificada);
--     · el receipt se inserta con boxes=0 → el trigger es no-op → se adopta a mano
--       → se sube boxes al conteo final, cuando v_have ya == boxes → no-op otra vez.
--   El reviewer adversarial había marcado que una adopción DENTRO del trigger nunca
--   correría (create_receipt_as_operario no pasa prealerta_id al insert). Esta ruta
--   la esquiva por completo: la adopción es un acto del operario, no un side-effect.

create or replace function public.receive_prealerta_as_operario(
  p_operario_id     uuid,
  p_code            text,               -- DTD-B-NNNNNN escaneado (o el `b` del QR)
  p_boxes_confirmed int default null    -- conteo rectificado; null = todas las esperadas
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op         record;
  v_box        record;
  v_p          record;
  v_esperadas  int;
  v_receive    int;
  v_year       text;
  v_max        int;
  v_code       text;
  v_receipt_id uuid;
  v_adopted    int;
  v_remaining  int;
begin
  -- 1. Operario CN activo → tenant + warehouse
  select id, tenant_id, region, active, warehouse_id
    into v_op
    from public.operario_pins
   where id = p_operario_id;

  if v_op.id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_op.active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if v_op.region <> 'cn' then
    raise exception 'Solo operarios CN reciben en China' using errcode = 'P0003';
  end if;
  if v_op.warehouse_id is null then
    raise exception 'Operario sin almacén asignado' using errcode = 'P0135';
  end if;

  -- 2. La caja escaneada
  select id, tenant_id, prealerta_id, receipt_id, status, code, markbox
    into v_box
    from public.warehouse_boxes
   where tenant_id = v_op.tenant_id
     and code = upper(trim(p_code))
     and deleted_at is null;

  if v_box.id is null then
    raise exception 'La caja % no existe · revisa la etiqueta', p_code using errcode = 'P0130';
  end if;
  if v_box.status = 'recibida' then
    raise exception 'La caja % ya se recibió', v_box.code using errcode = 'P0131';
  end if;
  if v_box.prealerta_id is null then
    -- No debería pasar con una etiqueta pre-declarada (DTD-B siempre nace de una
    -- prealerta). Defensa: una caja esperada sin prealerta es un estado imposible.
    raise exception 'La caja % no viene de una compra anunciada', v_box.code using errcode = 'P0132';
  end if;

  -- 3. La compra (prealerta) de la caja
  select id, tenant_id, code, client_markbox, client_name_snapshot, supplier_id, status, deleted_at
    into v_p
    from (
      select pr.id, pr.tenant_id, pr.code, pr.client_markbox, pr.supplier_id,
             pr.status, pr.deleted_at,
             (select c.name from public.clients c
               where c.tenant_id = pr.tenant_id and c.markbox = pr.client_markbox
               limit 1) as client_name_snapshot
        from public.prealertas pr
       where pr.id = v_box.prealerta_id
    ) q;

  if v_p.id is null or v_p.deleted_at is not null or v_p.status = 'cancelada' then
    raise exception 'La compra de la caja % no está activa', v_box.code using errcode = 'P0133';
  end if;

  -- 4. Cuántas esperadas hay y cuántas se reciben
  select count(*) into v_esperadas
    from public.warehouse_boxes
   where prealerta_id = v_p.id
     and status = 'esperada'
     and receipt_id is null
     and deleted_at is null;

  v_receive := coalesce(p_boxes_confirmed, v_esperadas);
  if v_receive < 0 then v_receive := 0; end if;
  if v_receive = 0 then
    raise exception 'No hay cajas para recibir en la compra %', v_p.code using errcode = 'P0134';
  end if;

  -- 5. Crear la recepción (boxes=0 → el trigger de sync es no-op; adoptamos a mano)
  v_year := to_char(current_date, 'YYYY');
  select coalesce(max((regexp_match(wr.receipt_code, '^WR-\d{4}-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.warehouse_receipts_cn wr
   where wr.tenant_id = v_op.tenant_id
     and wr.receipt_code like 'WR-' || v_year || '-%';
  v_code := 'WR-' || v_year || '-' || lpad(v_max::text, 4, '0');

  insert into public.warehouse_receipts_cn (
    tenant_id, receipt_code, warehouse_id,
    client_markbox, client_name,
    supplier_name,
    boxes, status, received_at,
    created_by_operario_id, prealerta_id,
    notes
  ) values (
    v_op.tenant_id, v_code, v_op.warehouse_id,
    v_p.client_markbox, v_p.client_name_snapshot,
    (select s.name from public.suppliers_cn s where s.id = v_p.supplier_id),
    0, 'pendiente_consolidacion'::warehouse_receipt_status, current_date,
    p_operario_id, v_p.id,
    'Recibida por escaneo · compra ' || v_p.code
  )
  returning id into v_receipt_id;

  -- 6. ADOPCIÓN explícita. La caja escaneada primero (es la que el operario tiene
  --    en la mano), después el resto por seq asc hasta completar v_receive.
  update public.warehouse_boxes
     set receipt_id = v_receipt_id, status = 'recibida'
   where id = v_box.id
     and status = 'esperada'
     and receipt_id is null;

  update public.warehouse_boxes
     set receipt_id = v_receipt_id, status = 'recibida'
   where id in (
     select b.id
       from public.warehouse_boxes b
      where b.prealerta_id = v_p.id
        and b.status = 'esperada'
        and b.receipt_id is null
        and b.deleted_at is null
        and b.id <> v_box.id
      order by b.seq
      limit greatest(v_receive - 1, 0)
   );

  select count(*) into v_adopted
    from public.warehouse_boxes
   where receipt_id = v_receipt_id and deleted_at is null;

  -- 7. Subir boxes al conteo real. Si v_receive > esperadas (llegó MÁS de lo
  --    anunciado), el trigger de 0241 crea las extras como recibidas. Si es igual,
  --    v_have == boxes → no-op.
  update public.warehouse_receipts_cn
     set boxes = v_receive
   where id = v_receipt_id;

  -- 8. Evento de recepción (misma semántica que 0045)
  insert into public.warehouse_receipt_events (
    tenant_id, receipt_id, event_type, description, occurred_at
  ) values (
    v_op.tenant_id, v_receipt_id,
    'received'::warehouse_receipt_event_type,
    'Recibida por escaneo de etiqueta · compra ' || v_p.code
      || ' · ' || v_receive || ' de ' || v_esperadas || ' anunciadas',
    now()
  );

  -- 9. ¿Se recibió TODA la compra? Entonces la prealerta pasa a 'recibida'.
  --    (No dispara prealertas_sync_boxes: su WHEN solo mira boxes y 'cancelada'.)
  select count(*) into v_remaining
    from public.warehouse_boxes
   where prealerta_id = v_p.id
     and status = 'esperada'
     and receipt_id is null
     and deleted_at is null;

  if v_remaining = 0 then
    update public.prealertas
       set status = 'recibida', received_at = now()
     where id = v_p.id
       and status <> 'recibida';
  end if;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', v_receipt_id,
    'receipt_code', v_code,
    'prealerta_code', v_p.code,
    'client_markbox', v_p.client_markbox,
    'client_name', v_p.client_name_snapshot,
    'received', v_receive,
    'expected', v_esperadas,
    'remaining', v_remaining,
    'scanned_code', v_box.code
  );
end;
$$;

comment on function public.receive_prealerta_as_operario(uuid, text, int) is
  'SDD-0154: recibe una compra escaneando una de sus etiquetas pre-declaradas. Crea la recepción CN, adopta las cajas esperadas (esperada → recibida) por la cantidad rectificada, marca la prealerta recibida si se completó, y devuelve el resumen para la UI + el aviso. NO modifica sync_boxes_for_receipt: la adopción es explícita.';

-- Solo el server action (admin/service_role) la invoca — el operario no es auth.users.
revoke execute on function public.receive_prealerta_as_operario(uuid, text, int) from public;
revoke execute on function public.receive_prealerta_as_operario(uuid, text, int) from anon;
revoke execute on function public.receive_prealerta_as_operario(uuid, text, int) from authenticated;
grant  execute on function public.receive_prealerta_as_operario(uuid, text, int) to service_role;
