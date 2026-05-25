-- ─────────────────────────────────────────────────────────────
-- SDD-0027 follow-up: 4 fixes descubiertos en E2E test post-apply
--   1. verify_operario_pin: search_path debe incluir `extensions`
--      para resolver crypt() / gen_salt() de pgcrypto.
--   2. create_receipt_as_operario: NO puede llamar next_receipt_code /
--      next_orphan_code porque tienen assert_tenant_match() que requiere
--      auth.uid() (el operario usa PIN custom, no Supabase Auth).
--      → inline el cálculo del correlativo, scope-validado contra
--        operario_pins.tenant_id.
--   3. Ambigüedad: receipt_code column de la tabla vs OUT parameter del
--      RETURNS TABLE — aliases internos + return next explícito.
--   4. service_role sin GRANT en clients / warehouses_cn / warehouse_*
--      → las server actions de la PWA no podían leer ni insertar.
--
-- Aplicados originalmente como migrations separadas (0020b/c/d/e)
-- durante el E2E test bug-hunt. Consolidados acá como source-of-truth
-- reproducible para fresh applies.
-- ─────────────────────────────────────────────────────────────

-- ─── 1. verify_operario_pin con search_path extensions ─────────────
create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,
  display_name     text,
  display_name_cn  text,
  role             text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_matches int;
begin
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role;
end;
$$;

-- ─── 2. create_receipt_as_operario · drop + recreate ───────────────
-- Drop necesario porque return type cambia (aliases internos).
drop function if exists public.create_receipt_as_operario(
  uuid, uuid, boolean, text, text, text, text, text, text,
  int, numeric, numeric, date, text, jsonb, boolean, text
);

create function public.create_receipt_as_operario(
  p_operario_id           uuid,
  p_warehouse_id          uuid,
  p_is_orphan             boolean,
  p_client_markbox        text,
  p_client_name           text,
  p_orphan_marks          text,
  p_orphan_brought_by     text,
  p_supplier_name         text,
  p_supplier_translated   text,
  p_boxes                 int,
  p_total_cbm             numeric,
  p_total_weight_kg       numeric,
  p_received_at           date,
  p_notes                 text,
  p_items                 jsonb,
  p_incident              boolean,
  p_incident_note         text
)
returns table (
  receipt_id     uuid,
  receipt_code   text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
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
  -- 1. Resolver tenant del operario (NO usa auth.uid)
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

  -- 2. Correlativo inline (no llama next_*_code que requiere auth.uid).
  --    Aliases wr.* para evitar ambigüedad con OUT param receipt_code.
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

  -- 3. Insert receipt
  insert into public.warehouse_receipts_cn (
    tenant_id, receipt_code, warehouse_id,
    client_markbox, client_name,
    is_orphan, orphan_marks, orphan_brought_by,
    supplier_name, supplier_name_translated,
    boxes, total_cbm, total_weight_kg,
    status, received_at, notes,
    created_by_operario_id
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
    p_operario_id
  )
  returning id into v_receipt_id;

  -- 4. Items
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

  -- 5. Eventos
  insert into public.warehouse_receipt_events (
    tenant_id, receipt_id, event_type, description, occurred_at
  ) values (
    v_tenant_id, v_receipt_id,
    'received'::warehouse_receipt_event_type,
    'Recibida en hub por operario · PWA mobile',
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

  -- Return explícito con OUT params
  receipt_id := v_receipt_id;
  receipt_code := v_code;
  return next;
end;
$$;

-- Re-grants después del drop+recreate (service_role only)
revoke all on function public.create_receipt_as_operario(
  uuid, uuid, boolean, text, text, text, text, text, text,
  int, numeric, numeric, date, text, jsonb, boolean, text
) from public, anon, authenticated;
grant execute on function public.create_receipt_as_operario(
  uuid, uuid, boolean, text, text, text, text, text, text,
  int, numeric, numeric, date, text, jsonb, boolean, text
) to service_role;

-- ─── 3. Grants service_role para tablas que la PWA necesita ────────
-- Las server actions del operario (que usan createAdminClient) necesitan
-- leer clients del tenant, leer warehouses_cn para el header del home,
-- y insertar en warehouse_receipts_cn / items / events via el RPC.

grant select on public.clients to service_role;
grant select on public.warehouses_cn to service_role;
grant select, insert, update on public.warehouse_receipts_cn to service_role;
grant select, insert, update on public.warehouse_receipt_items to service_role;
grant select, insert on public.warehouse_receipt_events to service_role;

-- ─── 4. Reload PostgREST schema cache ──────────────────────────────
notify pgrst, 'reload schema';
