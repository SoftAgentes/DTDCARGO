-- ─────────────────────────────────────────────────────────────
-- RPC create_receipt_as_operario · agregar p_destination_city
--
-- Permite que el operario CN setee destination_city al recibir el
-- paquete via wizard /m/cn/nueva. Decisión Opción A (memoria
-- [[bridge-approach-supabase-realtime]] · 2026-05-27).
--
-- Columna destination_city ya existe en warehouse_receipts_cn
-- (migración 0044). Este cambio expone el field al RPC para que
-- el operario lo pueda popular desde el wizard mobile.
--
-- DROP + CREATE necesario porque la signatura cambia (nuevo param).
-- ─────────────────────────────────────────────────────────────

drop function if exists public.create_receipt_as_operario(uuid, uuid, boolean, text, text, text, text, text, text, integer, numeric, numeric, date, text, jsonb, boolean, text);

create or replace function public.create_receipt_as_operario(
  p_operario_id        uuid,
  p_warehouse_id       uuid,
  p_is_orphan          boolean,
  p_client_markbox     text,
  p_client_name        text,
  p_orphan_marks       text,
  p_orphan_brought_by  text,
  p_supplier_name      text,
  p_supplier_translated text,
  p_boxes              integer,
  p_total_cbm          numeric,
  p_total_weight_kg    numeric,
  p_received_at        date,
  p_notes              text,
  p_items              jsonb,
  p_incident           boolean,
  p_incident_note      text,
  p_destination_city   text default null
)
returns table(receipt_id uuid, receipt_code text)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_tenant_id    uuid;
  v_active       boolean;
  v_code         text;
  v_year         int := extract(year from current_date);
  v_max          int;
  v_receipt_id   uuid;
  v_item         jsonb;
  v_pos          int := 0;
begin
  select op.tenant_id, op.active
    into v_tenant_id, v_active
    from public.operario_pins op
   where op.id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado (id=%)', p_operario_id using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if p_boxes is null or p_boxes <= 0 then
    raise exception 'boxes debe ser > 0' using errcode = 'P0003';
  end if;

  if p_is_orphan then
    select coalesce(max((regexp_match(wr.receipt_code, '^SIN-CODIGO-(\d+)$'))[1]::int), 0) + 1
      into v_max
      from public.warehouse_receipts_cn wr
     where wr.tenant_id = v_tenant_id
       and wr.receipt_code like 'SIN-CODIGO-%';
    v_code := 'SIN-CODIGO-' || lpad(v_max::text, 4, '0');
  else
    if p_client_markbox is null or length(trim(p_client_markbox)) = 0 then
      raise exception 'client_markbox requerido cuando no es huérfana' using errcode = 'P0004';
    end if;
    select coalesce(max((regexp_match(wr.receipt_code, '^WR-\d{4}-(\d+)$'))[1]::int), 0) + 1
      into v_max
      from public.warehouse_receipts_cn wr
     where wr.tenant_id = v_tenant_id
       and wr.receipt_code like 'WR-' || v_year || '-%';
    v_code := 'WR-' || v_year || '-' || lpad(v_max::text, 4, '0');
  end if;

  insert into public.warehouse_receipts_cn (
    tenant_id, receipt_code, warehouse_id,
    client_markbox, client_name,
    is_orphan, orphan_marks, orphan_brought_by,
    supplier_name, supplier_name_translated,
    boxes, total_cbm, total_weight_kg,
    status, received_at, notes,
    created_by_operario_id,
    destination_city
  ) values (
    v_tenant_id, v_code, p_warehouse_id,
    case when p_is_orphan then null else p_client_markbox end,
    case when p_is_orphan then null else p_client_name end,
    p_is_orphan, p_orphan_marks, p_orphan_brought_by,
    p_supplier_name, p_supplier_translated,
    p_boxes, p_total_cbm, p_total_weight_kg,
    case when p_incident then 'incidencia'::warehouse_receipt_status
         else 'pendiente_consolidacion'::warehouse_receipt_status end,
    coalesce(p_received_at, current_date),
    p_notes,
    p_operario_id,
    nullif(trim(p_destination_city), '')
  )
  returning id into v_receipt_id;

  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      insert into public.warehouse_receipt_items (
        tenant_id, receipt_id, description, description_translated,
        hs_code, quantity, unit_value_usd, notes, position
      ) values (
        v_tenant_id, v_receipt_id,
        coalesce(v_item->>'description', ''),
        v_item->>'description_translated',
        v_item->>'hs_code',
        nullif(v_item->>'quantity', '')::int,
        nullif(v_item->>'unit_value_usd', '')::numeric,
        v_item->>'notes',
        v_pos
      );
      v_pos := v_pos + 1;
    end loop;
  end if;

  insert into public.warehouse_receipt_events (
    tenant_id, receipt_id, event_type, description, occurred_at
  ) values (
    v_tenant_id, v_receipt_id,
    'received'::warehouse_receipt_event_type,
    'Recibida en hub por operario · PWA mobile'
      || case when p_destination_city is not null and length(trim(p_destination_city)) > 0
              then ' · destino: ' || trim(p_destination_city)
              else '' end,
    now()
  );

  if p_incident then
    insert into public.warehouse_receipt_events (
      tenant_id, receipt_id, event_type, description, occurred_at
    ) values (
      v_tenant_id, v_receipt_id,
      'incident'::warehouse_receipt_event_type,
      coalesce(nullif(trim(p_incident_note), ''), 'Incidencia reportada sin nota'),
      now()
    );
  end if;

  receipt_id := v_receipt_id;
  receipt_code := v_code;
  return next;
end;
$function$;

grant execute on function public.create_receipt_as_operario(
  uuid, uuid, boolean, text, text, text, text, text, text,
  integer, numeric, numeric, date, text, jsonb, boolean, text, text
) to service_role;
