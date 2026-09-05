-- SDD-0443: exact physical box reception; prepares SQL only, no production application.
create or replace function public.receive_prealerta_boxes_as_operario(
  p_operario_id     uuid,
  p_code            text,               -- DTD-B-NNNNNN escaneado (o el `b` del QR)
  p_box_codes text[]                   -- exact boxes confirmed on the phone
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
  v_selected text[];
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

  -- Serialize the short allocation/adoption transaction before locking purchase/boxes.
  lock table public.warehouse_receipts_cn in share row exclusive mode;

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

  if v_box.prealerta_id is null then
    -- No debería pasar con una etiqueta pre-declarada (DTD-B siempre nace de una
    -- prealerta). Defensa: una caja esperada sin prealerta es un estado imposible.
    raise exception 'La caja % no viene de una compra anunciada', v_box.code using errcode = 'P0132';
  end if;

  -- 3. La compra (prealerta) de la caja
  select pr.id, pr.tenant_id, pr.code, pr.client_markbox, pr.supplier_id, pr.status, pr.deleted_at
    into v_p from public.prealertas pr
    where pr.id = v_box.prealerta_id and pr.tenant_id = v_op.tenant_id
    for update;

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

  select array_agg(distinct upper(trim(x))) into v_selected from unnest(p_box_codes) x;
  v_receive := coalesce(cardinality(v_selected), 0);
  if v_receive < 1 or v_receive > 5000 or not (v_box.code = any(v_selected)) then
    raise exception 'Selecciona las cajas presentes, incluida la escaneada' using errcode = 'P0136';
  end if;
  perform id from public.warehouse_boxes where tenant_id = v_op.tenant_id
    and prealerta_id = v_p.id and code = any(v_selected) for update;
  select count(*) into v_adopted from public.warehouse_boxes
    where tenant_id = v_op.tenant_id and prealerta_id = v_p.id
    and code = any(v_selected) and status = 'esperada' and receipt_id is null and deleted_at is null;
  if v_adopted <> v_receive then
    raise exception 'Las cajas cambiaron o ya fueron recibidas. Escanea otra vez.' using errcode = 'P0137';
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
    v_p.client_markbox, null,
    (select s.name from public.suppliers_cn s where s.id = v_p.supplier_id),
    0, 'pendiente_consolidacion'::warehouse_receipt_status, current_date,
    p_operario_id, v_p.id,
    'Recibida por escaneo · compra ' || v_p.code
  )
  returning id into v_receipt_id;

  -- Adopt exactly the physical boxes selected; never infer their identity from a quantity.
  update public.warehouse_boxes set receipt_id = v_receipt_id, status = 'recibida'
   where tenant_id = v_op.tenant_id and prealerta_id = v_p.id
     and code = any(v_selected) and status = 'esperada' and receipt_id is null and deleted_at is null;
  get diagnostics v_adopted = row_count;
  if v_adopted <> v_receive then raise exception 'Recepción concurrente' using errcode = 'P0137'; end if;

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
    'received', v_receive,
    'expected', v_esperadas,
    'remaining', v_remaining,
    'scanned_code', v_box.code
  );
end;
$$;


revoke all on function public.receive_prealerta_boxes_as_operario(uuid,text,text[]) from public, anon, authenticated;
grant execute on function public.receive_prealerta_boxes_as_operario(uuid,text,text[]) to service_role;

-- Presentation history is append-only. Public links resolve their own tenant server-side.
create table public.shipping_label_versions (
  tenant_id uuid not null references public.tenants(id),
  version integer not null check (version > 0),
  settings jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, version)
);
alter table public.shipping_label_versions enable row level security;
grant select on public.shipping_label_versions to authenticated;
grant select, insert on public.shipping_label_versions to service_role;
create policy shipping_label_versions_tenant_read on public.shipping_label_versions
  for select to authenticated using (tenant_id = public.get_user_tenant_id());
create policy shipping_label_versions_server_read on public.shipping_label_versions
  for select to service_role using (true);

create function public.save_shipping_label_presentation(p_settings jsonb, p_expected_version integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_version integer;
begin
  select tenant_id into v_tenant from public.user_tenants
   where user_id = auth.uid() and role = 'admin' and disabled_at is null
     and tenant_id = public.get_user_tenant_id();
  if v_tenant is null then raise exception 'Solo administración puede editar etiquetas' using errcode = '42501'; end if;
  if jsonb_typeof(p_settings) is distinct from 'object'
     or jsonb_typeof(p_settings->'showBrand') is distinct from 'boolean'
     or coalesce(p_settings->>'language', '') not in ('zh-es','zh-en')
     or coalesce(p_settings->>'size', '') not in ('standard','large')
     or (p_settings - array['showBrand','language','size']) <> '{}'::jsonb then
    raise exception 'Configuración inválida' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('shipping-label:' || v_tenant::text, 0));
  select coalesce(max(version), 0) into v_version from public.shipping_label_versions where tenant_id = v_tenant;
  if p_expected_version is distinct from v_version then
    raise exception 'Otra sesión cambió las etiquetas. Actualiza antes de guardar.' using errcode = '40001';
  end if;
  insert into public.shipping_label_versions(tenant_id,version,settings,created_by)
    values(v_tenant,v_version+1,p_settings,auth.uid());
  return v_version+1;
end $$;
revoke all on function public.save_shipping_label_presentation(jsonb,integer) from public,anon;
grant execute on function public.save_shipping_label_presentation(jsonb,integer) to authenticated;

-- Only an explicitly submitted document can reconcile labels. Local drafts never mutate boxes.
-- Once reception starts, preserve physical labels and leave reconciliation to operations.
create function public.reconcile_labels_after_packing_list()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_purchase public.prealertas%rowtype;
begin
  select * into v_purchase from public.prealertas where id = new.prealerta_id
    and tenant_id = new.tenant_id for update;
  if v_purchase.id is null or v_purchase.deleted_at is not null
     or v_purchase.status in ('recibida','consolidada','cancelada')
     or new.total_ctns < 1 or new.total_ctns > 1000 or new.total_ctns <> trunc(new.total_ctns) then return new; end if;
  if exists (select 1 from public.warehouse_boxes where prealerta_id = new.prealerta_id
    and tenant_id = new.tenant_id and deleted_at is null and (receipt_id is not null or status <> 'esperada')) then return new; end if;
  update public.prealertas set boxes = new.total_ctns::integer
    where id = new.prealerta_id and boxes <> new.total_ctns::integer;
  return new;
end $$;
revoke all on function public.reconcile_labels_after_packing_list() from public,anon,authenticated;
create trigger packing_list_reconcile_labels after insert on public.packing_list_submissions
  for each row when (new.is_current and new.deleted_at is null)
  execute function public.reconcile_labels_after_packing_list();
