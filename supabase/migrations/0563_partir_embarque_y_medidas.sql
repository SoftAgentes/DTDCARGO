-- ─────────────────────────────────────────────────────────────────────────────
-- 0563 · SDD-0673 — Corregir las medidas de un embarque, partirlo en dos y
--        anotar su grupo de WeChat.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam NOMBRANDO este archivo, el runbook
--    docs/runbooks/aplicar-migraciones-prod.md y el Director General, con el
--    name exacto `0563_partir_embarque_y_medidas`. Fusionar la PR NO la aplica.
--    ORDEN: MIGRATE-FIRST. Con la migración y la app de antes no cambia nada
--    visible: nadie llama a las funciones y la columna nueva es nula.
--
-- ── El defecto (main 9434cc4f6) ─────────────────────────────────────────────
-- · La ficha del embarque (`updateShipment`) cambia `weight_kg` y `volume_m3`
--   con un UPDATE directo, sin motivo ni evento, y sólo en `shipments`:
--   `consolidation_items` y `warehouse_receipts_cn` quedan con el valor viejo.
--   Las cajas no se corrigen en ningún lado después de consolidar (0070/0072
--   sólo editan con la recepción en `pendiente_consolidacion`).
-- · No hay forma de partir un embarque que trae la carga de dos clientes.
-- · No hay dónde anotar el grupo de WeChat con el proveedor.
--
-- ── Qué crea ────────────────────────────────────────────────────────────────
-- · `correct_shipment_measures(p_shipment_id, p_boxes, p_cbm, p_weight_kg,
--   p_reason, p_dry_run)`: corrige a la vez el embarque, su línea vigente del
--   contenedor y su recepción CN viva. Las cajas físicas las reconcilia el
--   trigger de 0240/0241 (crea códigos nuevos o borra, lógico, las de seq más
--   alto no estibadas). Evento `shipment_measures_corrected`.
-- · `split_shipment(...)`: parte un embarque de contenedor en dos (SDD-0673 §4).
-- · `shipments.group_reference`: texto libre (1-120), «Grupo de WeChat».
-- Las dos funciones: SECURITY DEFINER, search_path vacío, EXECUTE sólo
-- authenticated, operations o admin (D1 del DG, 2026-11-18), motivo 4-1000 salvo
-- en la vista previa, todo o nada.
--
-- ── Qué NO toca ─────────────────────────────────────────────────────────────
-- RLS, triggers ni grants de tablas. Facturas (ni borradores: se avisa), tarifas
-- congeladas (0496), documentos, avisos, cotizaciones y pagos.
--
-- LOCKS: ALTER TABLE shipments ADD COLUMN (nula, sin default: sólo catálogo,
-- ACCESS EXCLUSIVE breve) y el CHECK con NOT VALID + VALIDATE (la columna es
-- nueva y nula). Sin backfill. Reaplicar: la columna con IF NOT EXISTS y las
-- funciones se reemplazan por el mismo texto.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_req record;
  v_writer oid;
begin
  if pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0563 requiere los roles authenticated, anon y service_role';
  end if;

  -- Cada columna que las funciones leen o escriben.
  for v_req in
    select * from (values
      ('public.shipments', 'id'), ('public.shipments', 'tenant_id'), ('public.shipments', 'code'),
      ('public.shipments', 'client_markbox'), ('public.shipments', 'client_name'),
      ('public.shipments', 'status'), ('public.shipments', 'deleted_at'),
      ('public.shipments', 'volume_m3'), ('public.shipments', 'weight_kg'),
      ('public.shipments', 'origin'), ('public.shipments', 'destination'),
      ('public.shipments', 'shipment_service'), ('public.shipments', 'vehicle_category'),
      ('public.shipments', 'notes'),
      ('public.clients', 'id'), ('public.clients', 'tenant_id'), ('public.clients', 'markbox'),
      ('public.clients', 'name'), ('public.clients', 'deleted_at'), ('public.clients', 'merged_into_client_id'),
      ('public.user_tenants', 'user_id'), ('public.user_tenants', 'tenant_id'),
      ('public.user_tenants', 'role'), ('public.user_tenants', 'disabled_at'),
      ('public.consolidations', 'id'), ('public.consolidations', 'status'),
      ('public.consolidations', 'deleted_at'),
      ('public.consolidation_items', 'id'), ('public.consolidation_items', 'tenant_id'),
      ('public.consolidation_items', 'consolidation_id'), ('public.consolidation_items', 'shipment_id'),
      ('public.consolidation_items', 'client_markbox'), ('public.consolidation_items', 'client_name'),
      ('public.consolidation_items', 'supplier_name'),
      ('public.consolidation_items', 'cbm'), ('public.consolidation_items', 'weight_kg'),
      ('public.consolidation_items', 'pieces'), ('public.consolidation_items', 'created_at'),
      ('public.warehouse_receipts_cn', 'id'), ('public.warehouse_receipts_cn', 'tenant_id'),
      ('public.warehouse_receipts_cn', 'receipt_code'), ('public.warehouse_receipts_cn', 'warehouse_id'),
      ('public.warehouse_receipts_cn', 'shipment_id'), ('public.warehouse_receipts_cn', 'client_markbox'),
      ('public.warehouse_receipts_cn', 'client_name'), ('public.warehouse_receipts_cn', 'is_orphan'),
      ('public.warehouse_receipts_cn', 'boxes'), ('public.warehouse_receipts_cn', 'total_cbm'),
      ('public.warehouse_receipts_cn', 'total_weight_kg'), ('public.warehouse_receipts_cn', 'status'),
      ('public.warehouse_receipts_cn', 'received_at'), ('public.warehouse_receipts_cn', 'deleted_at'),
      ('public.warehouse_boxes', 'id'), ('public.warehouse_boxes', 'receipt_id'),
      ('public.warehouse_boxes', 'code'), ('public.warehouse_boxes', 'seq'),
      ('public.warehouse_boxes', 'markbox'), ('public.warehouse_boxes', 'client_name'),
      ('public.warehouse_boxes', 'deleted_at'),
      ('public.consolidation_box_positions', 'box_id'),
      ('public.warehouse_receipts_ve', 'id'), ('public.warehouse_receipts_ve', 'deleted_at'),
      ('public.warehouse_receipt_ve_boxes', 'receipt_id'), ('public.warehouse_receipt_ve_boxes', 'code'),
      ('public.warehouse_receipt_ve_boxes', 'markbox'), ('public.warehouse_receipt_ve_boxes', 'client_name'),
      ('public.warehouse_receipt_ve_boxes', 'scanned_at'),
      ('public.invoices', 'id'), ('public.invoices', 'tenant_id'), ('public.invoices', 'shipment_id'),
      ('public.invoices', 'status'), ('public.invoices', 'lines'), ('public.invoices', 'deleted_at'),
      ('public.client_claims', 'tenant_id'), ('public.client_claims', 'shipment_id'),
      ('public.client_claims', 'deleted_at'),
      ('public.prealertas', 'tenant_id'), ('public.prealertas', 'shipment_id'),
      ('public.prealertas', 'status'), ('public.prealertas', 'deleted_at'),
      ('public.dispatch_orders', 'id'), ('public.dispatch_orders', 'tenant_id'),
      ('public.dispatch_orders', 'status'),
      ('public.dispatch_order_packages', 'od_id'), ('public.dispatch_order_packages', 'package_kind'),
      ('public.dispatch_order_packages', 'package_id'),
      ('public.shipments', 'created_at'), ('public.shipments', 'destination_gps'),
      ('public.shipments', 'arrived_destination_at'), ('public.shipments', 'planned_departure_at'),
      ('public.shipments', 'planned_arrival_at'), ('public.shipments', 'planned_delivery_at'),
      ('public.shipments', 'planning_timezone'),
      ('public.shipment_rate_snapshots', 'tenant_id'), ('public.shipment_rate_snapshots', 'receipt_id'),
      ('public.shipment_rate_snapshots', 'superseded_at'),
      ('public.shipment_documents', 'tenant_id'), ('public.shipment_documents', 'shipment_id'),
      ('public.shipment_documents', 'deleted_at'),
      ('public.client_notification_schedule', 'shipment_id'), ('public.client_notification_schedule', 'status'),
      ('public.shipment_events', 'tenant_id'), ('public.shipment_events', 'shipment_id'),
      ('public.shipment_events', 'status'), ('public.shipment_events', 'note'),
      ('public.shipment_events', 'occurred_at'), ('public.shipment_events', 'deleted_at')
    ) as r(tbl, col)
  loop
    if pg_catalog.to_regclass(v_req.tbl) is null or not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(v_req.tbl)
        and attname = v_req.col and attnum > 0 and not attisdropped
    ) then
      raise exception '0563 requiere la columna %.%', v_req.tbl, v_req.col;
    end if;
  end loop;

  for v_req in
    select * from (values
      ('public.invoice_status', 'borrador'), ('public.invoice_status', 'anulada'),
      ('public.dispatch_order_status', 'cancelada'),
      ('public.shipment_status', 'delivered'), ('public.shipment_status', 'cancelled')
    ) as e(typ, label)
  loop
    if pg_catalog.to_regtype(v_req.typ) is null or not exists (
      select 1 from pg_catalog.pg_enum
      where enumtypid = pg_catalog.to_regtype(v_req.typ) and enumlabel = v_req.label
    ) then
      raise exception '0563 requiere la etiqueta % del enum %', v_req.label, v_req.typ;
    end if;
  end loop;

  -- Las cajas físicas las reconcilia el trigger de 0240 (con el guard de 0241):
  -- sin él, cambiar `boxes` dejaría las cajas desalineadas.
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.warehouse_receipts_cn'::pg_catalog.regclass
      and tgname = 'warehouse_receipts_cn_sync_boxes_upd' and not tgisinternal and tgenabled <> 'D'
  ) or not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.warehouse_receipts_cn'::pg_catalog.regclass
      and tgname = 'warehouse_receipts_cn_sync_boxes_ins' and not tgisinternal and tgenabled <> 'D'
  ) then
    raise exception '0563 requiere los triggers warehouse_receipts_cn_sync_boxes_ins/_upd (0240) activos';
  end if;
  -- Partir y corregir confían en lo que hace hoy sync_boxes_for_receipt (0241: no
  -- borra cajas estibadas; numera desde el seq vivo más alto, con el índice único
  -- parcial de la 0243). Si el cuerpo cambió, esta migración no lo conoce.
  -- El segundo md5 es el mismo cuerpo de la 0241 sin sus líneas de solo comentario, como quedó al aplicarla desde Supabase Cloud.
  if coalesce((select pg_catalog.md5(p.prosrc) from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure('public.sync_boxes_for_receipt(uuid)')), '')
     not in ('a6e9542fee29b37e015277696433a125', '7cb66f72fc71ea058d7f46fb0551eb05') then
    raise exception '0563 abortada: sync_boxes_for_receipt no es la de la 0241';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public' and tablename = 'warehouse_boxes'
      and indexname = 'warehouse_boxes_receipt_seq_live_key'
  ) then
    raise exception '0563 requiere el índice warehouse_boxes_receipt_seq_live_key (0243)';
  end if;

  v_writer := pg_catalog.to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)');
  if v_writer is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_writer and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception '0563 requiere append_audit_event SECURITY DEFINER con search_path vacío (0267/0294)';
  end if;
  if not pg_catalog.has_function_privilege(current_user, v_writer, 'EXECUTE') then
    raise exception '0563 abortada: el rol que aplica no puede ejecutar append_audit_event';
  end if;
  if pg_catalog.to_regclass('public.audit_entity_types') is null
     or not exists (select 1 from public.audit_entity_types
                    where entity_type = 'shipment' and status = 'active') then
    raise exception '0563 abortada: el tipo de entidad shipment no está activo; cada cambio fallaría';
  end if;

  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.get_user_tenant_id()') and p.prosecdef
  ) then
    raise exception '0563 requiere get_user_tenant_id() SECURITY DEFINER';
  end if;

  -- SECURITY DEFINER: si la RLS le escondiera una factura u orden al dueño, el
  -- bloqueo no la vería.
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception '0563 abortada: el rol que aplica no omite RLS; los bloqueos no verían todo';
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'correct_shipment_measures'
      and pg_catalog.pg_get_function_identity_arguments(p.oid)
          <> 'p_shipment_id uuid, p_boxes integer, p_cbm numeric, p_weight_kg numeric, p_reason text, p_dry_run boolean'
  ) then
    raise exception '0563 abortada: ya existe correct_shipment_measures con otra firma';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'split_shipment'
      and pg_catalog.pg_get_function_identity_arguments(p.oid)
          <> 'p_shipment_id uuid, p_client_id uuid, p_boxes integer, p_cbm numeric, p_weight_kg numeric, p_reason text, p_box_codes text[], p_dry_run boolean'
  ) then
    raise exception '0563 abortada: ya existe split_shipment con otra firma';
  end if;
end;
$preflight$;

-- ── Grupo de WeChat (SDD-0673 §6) ────────────────────────────────────────────
alter table public.shipments add column if not exists group_reference text;
do $check$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.shipments'::pg_catalog.regclass and conname = 'shipments_group_reference_len'
  ) then
    alter table public.shipments add constraint shipments_group_reference_len
      check (group_reference is null
             or pg_catalog.char_length(pg_catalog.btrim(group_reference)) between 1 and 120) not valid;
  end if;
end;
$check$;
alter table public.shipments validate constraint shipments_group_reference_len;
comment on column public.shipments.group_reference is
  'SDD-0673: referencia del grupo de WeChat con el proveedor en China. Texto libre (1-120). NO decide el dueño, no factura y no se muestra en el Portal. Etiqueta visible: «Grupo de WeChat».';

-- ── Corregir medidas (SDD-0673 §5) ───────────────────────────────────────────
create or replace function public.correct_shipment_measures(
  p_shipment_id uuid,
  p_boxes integer default null,
  p_cbm numeric default null,
  p_weight_kg numeric default null,
  p_reason text default null,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_dry boolean := coalesce(p_dry_run, false);
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_reason_prev text := pg_catalog.current_setting('dtd.audit_reason', true);
  v_ship record;
  v_item record;
  v_rec record;
  v_cons_status text;
  v_n_rec integer;
  v_before jsonb;
  v_after jsonb;
  v_blockers jsonb := '{}'::jsonb;
  v_warnings jsonb := '{}'::jsonb;
  v_new_boxes integer;
  v_excess integer;
  v_n integer;
  v_m integer;
begin
  if v_actor is null then
    raise exception 'corregir medidas: autenticación requerida' using errcode = '42501';
  end if;
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null or not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = v_actor and ut.tenant_id = v_tenant
      and ut.role in ('admin', 'operations') and ut.disabled_at is null
  ) then
    raise exception 'corregir medidas: solo operaciones o un administrador puede corregir las medidas de un embarque'
      using errcode = '42501';
  end if;

  if p_shipment_id is null then
    raise exception 'corregir medidas: falta el embarque' using errcode = '22023';
  end if;
  if p_boxes is null and p_cbm is null and p_weight_kg is null then
    raise exception 'corregir medidas: indica al menos cajas, CBM o peso' using errcode = '22023';
  end if;
  if p_boxes is not null and p_boxes < 1 then
    raise exception 'corregir medidas: las cajas van de 1 en adelante' using errcode = '22023';
  end if;
  if p_cbm is not null and (p_cbm < 0 or p_cbm <> pg_catalog.round(p_cbm, 3)) then
    raise exception 'corregir medidas: el CBM va de 0 en adelante y con hasta 3 decimales' using errcode = '22023';
  end if;
  if p_weight_kg is not null and (p_weight_kg < 0 or p_weight_kg <> pg_catalog.round(p_weight_kg, 2)) then
    raise exception 'corregir medidas: el peso va de 0 en adelante y con hasta 2 decimales' using errcode = '22023';
  end if;
  if not v_dry and (v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000) then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres' using errcode = '22023';
  end if;

  -- Aplicar bloquea el embarque, su línea y su recepción; la vista previa no.
  if v_dry then
    select s.id, s.code, s.status::text as status, s.volume_m3, s.weight_kg, s.deleted_at into v_ship
      from public.shipments s where s.id = p_shipment_id and s.tenant_id = v_tenant;
  else
    select s.id, s.code, s.status::text as status, s.volume_m3, s.weight_kg, s.deleted_at into v_ship
      from public.shipments s where s.id = p_shipment_id and s.tenant_id = v_tenant
      for update of s;
  end if;
  if v_ship.id is null or v_ship.deleted_at is not null then
    raise exception 'corregir medidas: embarque no encontrado' using errcode = 'P0002';
  end if;

  -- La línea vigente: la más reciente en un contenedor vivo (la que cuenta 0661).
  select ci.id, ci.cbm, ci.weight_kg, ci.pieces, co.status as cons_status into v_item
    from public.consolidation_items ci
    join public.consolidations co on co.id = ci.consolidation_id and co.deleted_at is null
   where ci.tenant_id = v_tenant and ci.shipment_id = v_ship.id
   order by ci.created_at desc, ci.id desc
   limit 1;
  if v_item.id is not null and not v_dry then
    perform 1 from public.consolidation_items ci where ci.id = v_item.id for update of ci;
  end if;
  v_cons_status := v_item.cons_status;

  select pg_catalog.count(*) into v_n_rec from public.warehouse_receipts_cn r
   where r.tenant_id = v_tenant and r.shipment_id = v_ship.id and r.deleted_at is null;
  -- Siempre se asigna (sin fila, con nulos) para poder leer v_rec.id después.
  select r.id, r.boxes, r.total_cbm, r.total_weight_kg into v_rec
    from public.warehouse_receipts_cn r
   where r.tenant_id = v_tenant and r.shipment_id = v_ship.id and r.deleted_at is null and v_n_rec = 1;
  if v_rec.id is not null then
    if not v_dry then
      perform 1 from public.warehouse_receipts_cn r where r.id = v_rec.id for update of r;
    end if;
  end if;

  if v_n_rec > 1 then
    v_blockers := v_blockers || pg_catalog.jsonb_build_object('varias_recepciones', v_n_rec);
  end if;
  if p_boxes is not null and v_item.id is null and v_n_rec = 0 then
    raise exception 'corregir medidas: el embarque no tiene contenedor ni recepción; no hay cajas que corregir'
      using errcode = '22023';
  end if;

  if v_ship.status in ('delivered', 'cancelled') then
    v_blockers := v_blockers || pg_catalog.jsonb_build_object('estado', v_ship.status);
  end if;

  -- Facturas vivas del embarque, por shipment_id o por una línea con su código.
  select pg_catalog.count(*) filter (where i.status <> 'borrador'),
         pg_catalog.count(*) filter (where i.status = 'borrador')
    into v_n, v_m
    from public.invoices i
   where i.tenant_id = v_tenant and i.deleted_at is null and i.status <> 'anulada'
     and (i.shipment_id = v_ship.id or exists (
       select 1 from pg_catalog.jsonb_array_elements(
         case when pg_catalog.jsonb_typeof(i.lines) = 'array' then i.lines else '[]'::jsonb end) l
       where pg_catalog.btrim(l.value ->> 'shipmentCode') = v_ship.code));
  if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('factura_emitida', v_n); end if;
  if v_m > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('borrador_factura', v_m); end if;

  if v_rec.id is not null then
    select pg_catalog.count(distinct o.id) into v_n
      from public.dispatch_order_packages dp
      join public.dispatch_orders o on o.id = dp.od_id
     where o.tenant_id = v_tenant and o.status <> 'cancelada'
       and dp.package_kind = 'warehouse_receipt_cn' and dp.package_id = v_rec.id;
    if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('orden_despacho', v_n); end if;

    -- La tarifa congelada (0496) guarda su propio CBM y su monto: no se recalcula
    -- sola (es dinero). Contabilidad la reemplaza (decisión del DG, 2026-11-18).
    select pg_catalog.count(*) into v_n from public.shipment_rate_snapshots rs
     where rs.tenant_id = v_tenant and rs.receipt_id = v_rec.id and rs.superseded_at is null;
    if v_n > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('tarifa_congelada', v_n); end if;
  end if;

  -- Cajas físicas: lo que hará el trigger de 0240/0241 al cambiar `boxes`.
  if p_boxes is not null and v_rec.id is not null and p_boxes <> v_rec.boxes then
    select pg_catalog.count(*) into v_n from public.warehouse_boxes b
     where b.receipt_id = v_rec.id and b.deleted_at is null;
    if v_n <> v_rec.boxes then
      v_blockers := v_blockers || pg_catalog.jsonb_build_object('cajas_desalineadas', v_n);
    elsif p_boxes > v_rec.boxes then
      v_warnings := v_warnings || pg_catalog.jsonb_build_object('cajas_nuevas_sin_etiqueta', p_boxes - v_rec.boxes);
      select pg_catalog.count(*) into v_n
        from public.warehouse_boxes b
        join public.warehouse_receipt_ve_boxes vb on vb.code = b.code
        join public.warehouse_receipts_ve ve on ve.id = vb.receipt_id and ve.deleted_at is null
       where b.receipt_id = v_rec.id and b.deleted_at is null;
      if v_n > 0 then
        v_warnings := v_warnings || pg_catalog.jsonb_build_object('recepcion_ve_sin_cajas_nuevas', p_boxes - v_rec.boxes);
      end if;
    else
      v_excess := v_rec.boxes - p_boxes;
      -- Las que borraría el trigger: seq más alto, sin historia de estiba.
      with sale as (
        select b.id, b.code from public.warehouse_boxes b
         where b.receipt_id = v_rec.id and b.deleted_at is null
           and not exists (select 1 from public.consolidation_box_positions p where p.box_id = b.id)
         order by b.seq desc
         limit v_excess
      )
      select pg_catalog.count(*),
             pg_catalog.count(*) filter (where exists (
               select 1 from public.warehouse_receipt_ve_boxes vb
                 join public.warehouse_receipts_ve ve on ve.id = vb.receipt_id and ve.deleted_at is null
                where vb.code = sale.code))
        into v_n, v_m
        from sale;
      if v_n < v_excess then
        v_blockers := v_blockers || pg_catalog.jsonb_build_object('cajas_estibadas', v_excess - v_n);
      end if;
      if v_m > 0 then
        v_blockers := v_blockers || pg_catalog.jsonb_build_object('caja_en_recepcion_ve', v_m);
      end if;
    end if;
  end if;

  if v_cons_status in ('zarpado', 'arribado') then
    v_warnings := v_warnings || pg_catalog.jsonb_build_object('contenedor', v_cons_status);
  end if;

  v_before := pg_catalog.jsonb_build_object(
    'shipment', pg_catalog.jsonb_build_object('cbm', v_ship.volume_m3, 'weight_kg', v_ship.weight_kg),
    'consolidation_item', case when v_item.id is null then null else pg_catalog.jsonb_build_object(
      'cbm', v_item.cbm, 'weight_kg', v_item.weight_kg, 'pieces', v_item.pieces) end,
    'warehouse_receipt_cn', case when v_rec.id is null then null else pg_catalog.jsonb_build_object(
      'boxes', v_rec.boxes, 'cbm', v_rec.total_cbm, 'weight_kg', v_rec.total_weight_kg) end);
  v_after := pg_catalog.jsonb_build_object(
    'shipment', pg_catalog.jsonb_build_object(
      'cbm', coalesce(p_cbm, v_ship.volume_m3), 'weight_kg', coalesce(p_weight_kg, v_ship.weight_kg)),
    'consolidation_item', case when v_item.id is null then null else pg_catalog.jsonb_build_object(
      'cbm', coalesce(p_cbm, v_item.cbm), 'weight_kg', coalesce(p_weight_kg, v_item.weight_kg),
      'pieces', coalesce(p_boxes, v_item.pieces)) end,
    'warehouse_receipt_cn', case when v_rec.id is null then null else pg_catalog.jsonb_build_object(
      'boxes', coalesce(p_boxes, v_rec.boxes), 'cbm', coalesce(p_cbm, v_rec.total_cbm),
      'weight_kg', coalesce(p_weight_kg, v_rec.total_weight_kg)) end);

  if v_before = v_after and v_blockers = '{}'::jsonb then
    raise exception 'corregir medidas: el embarque ya tiene esas medidas' using errcode = '22023';
  end if;

  if v_blockers <> '{}'::jsonb or v_dry then
    return pg_catalog.jsonb_build_object(
      'outcome', case when v_blockers <> '{}'::jsonb then 'blocked' else 'preview' end,
      'shipment_id', v_ship.id, 'shipment_code', v_ship.code,
      'before', v_before, 'after', v_after, 'blockers', v_blockers, 'warnings', v_warnings);
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  update public.shipments s
     set volume_m3 = coalesce(p_cbm, s.volume_m3), weight_kg = coalesce(p_weight_kg, s.weight_kg)
   where s.id = v_ship.id and s.tenant_id = v_tenant;

  if v_item.id is not null then
    update public.consolidation_items ci
       set cbm = coalesce(p_cbm, ci.cbm), weight_kg = coalesce(p_weight_kg, ci.weight_kg),
           pieces = coalesce(p_boxes, ci.pieces)
     where ci.id = v_item.id and ci.tenant_id = v_tenant;
  end if;

  if v_rec.id is not null then
    update public.warehouse_receipts_cn r
       set boxes = coalesce(p_boxes, r.boxes), total_cbm = coalesce(p_cbm, r.total_cbm),
           total_weight_kg = coalesce(p_weight_kg, r.total_weight_kg)
     where r.id = v_rec.id and r.tenant_id = v_tenant
    returning r.boxes into v_new_boxes;
    -- El trigger de 0240/0241 ya reconcilió las cajas; si no alcanzó, se deshace.
    select pg_catalog.count(*) into v_n from public.warehouse_boxes b
     where b.receipt_id = v_rec.id and b.deleted_at is null;
    if v_n <> v_new_boxes then
      raise exception 'corregir medidas: las cajas físicas no quedaron alineadas (% de %)', v_n, v_new_boxes
        using errcode = '40001';
    end if;
  end if;

  perform public.append_audit_event(
    v_tenant,
    'shipment',
    v_ship.id,
    'user',
    v_actor,
    'shipment_measures_corrected',
    'rpc',
    'succeeded',
    v_reason,
    v_before,
    v_after,
    pg_catalog.jsonb_build_object(
      'permanence', 'P1',
      'consequence', 'container_totals_changed',
      'recovery', 'correct_again',
      'shipment_code', v_ship.code,
      'warnings', v_warnings),
    pg_catalog.concat('sdd-0673:measures:', pg_catalog.txid_current()::text),
    1,
    'internal'
  );

  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);

  return pg_catalog.jsonb_build_object(
    'outcome', 'corrected',
    'shipment_id', v_ship.id, 'shipment_code', v_ship.code,
    'before', v_before, 'after', v_after, 'blockers', '{}'::jsonb, 'warnings', v_warnings);
end;
$$;

comment on function public.correct_shipment_measures(uuid, integer, numeric, numeric, text, boolean) is
  'SDD-0673/0563: corrige cajas, CBM y peso de un embarque a la vez en shipments, su línea vigente de consolidation_items y su recepción CN viva (las cajas físicas las reconcilia el trigger de 0240). Sólo operations/admin, motivo 4-1000, todo o nada, evento shipment_measures_corrected. Nulo = no cambia. p_dry_run: vista previa. outcome: preview | blocked | corrected.';

revoke all on function public.correct_shipment_measures(uuid, integer, numeric, numeric, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.correct_shipment_measures(uuid, integer, numeric, numeric, text, boolean) to authenticated;

-- ── Partir un embarque en dos (SDD-0673 §4) ──────────────────────────────────
create or replace function public.split_shipment(
  p_shipment_id uuid,
  p_client_id uuid,
  p_boxes integer,
  p_cbm numeric,
  p_weight_kg numeric,
  p_reason text default null,
  p_box_codes text[] default null,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_dry boolean := coalesce(p_dry_run, false);
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_reason_prev text := pg_catalog.current_setting('dtd.audit_reason', true);
  v_ship record;
  v_client record;
  v_item record;
  v_rec record;
  v_n_rec integer;
  v_live_boxes integer;
  v_box_ids uuid[];
  v_box_codes text[];
  v_codes text[];
  v_blockers jsonb := '{}'::jsonb;
  v_warnings jsonb := '{}'::jsonb;
  v_suffix text;
  v_new_code text;
  v_new_receipt_code text;
  v_new_ship uuid;
  v_new_item uuid;
  v_new_rec uuid;
  v_parts jsonb;
  v_sum_before record;
  v_sum_after record;
  v_n integer;
  v_m integer;
begin
  if v_actor is null then
    raise exception 'partir embarque: autenticación requerida' using errcode = '42501';
  end if;
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null or not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = v_actor and ut.tenant_id = v_tenant
      and ut.role in ('admin', 'operations') and ut.disabled_at is null
  ) then
    raise exception 'partir embarque: solo operaciones o un administrador puede partir un embarque'
      using errcode = '42501';
  end if;

  if p_shipment_id is null or p_client_id is null
     or p_boxes is null or p_cbm is null or p_weight_kg is null then
    raise exception 'partir embarque: faltan el embarque, el cliente o las medidas de la parte nueva'
      using errcode = '22023';
  end if;
  if p_boxes < 1 then
    raise exception 'partir embarque: la parte nueva lleva al menos una caja' using errcode = '22023';
  end if;
  if p_cbm < 0 or p_cbm <> pg_catalog.round(p_cbm, 3) then
    raise exception 'partir embarque: el CBM va de 0 en adelante y con hasta 3 decimales' using errcode = '22023';
  end if;
  if p_weight_kg < 0 or p_weight_kg <> pg_catalog.round(p_weight_kg, 2) then
    raise exception 'partir embarque: el peso va de 0 en adelante y con hasta 2 decimales' using errcode = '22023';
  end if;
  if p_box_codes is not null and (
       pg_catalog.cardinality(p_box_codes) <> p_boxes
       or (select pg_catalog.count(distinct pg_catalog.btrim(c)) from pg_catalog.unnest(p_box_codes) c) <> p_boxes
       or exists (select 1 from pg_catalog.unnest(p_box_codes) c where nullif(pg_catalog.btrim(c), '') is null)) then
    raise exception 'partir embarque: los códigos de caja tienen que ser % y distintos', p_boxes using errcode = '22023';
  end if;
  if not v_dry and (v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000) then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres' using errcode = '22023';
  end if;

  if v_dry then
    select s.* into v_ship
      from public.shipments s where s.id = p_shipment_id and s.tenant_id = v_tenant;
  else
    select s.* into v_ship
      from public.shipments s where s.id = p_shipment_id and s.tenant_id = v_tenant
      for update of s;
  end if;
  if v_ship.id is null or v_ship.deleted_at is not null then
    raise exception 'partir embarque: embarque no encontrado' using errcode = 'P0002';
  end if;

  select c.id, c.markbox, c.name, c.deleted_at, c.merged_into_client_id into v_client
    from public.clients c where c.id = p_client_id and c.tenant_id = v_tenant;
  if v_client.id is null or v_client.deleted_at is not null then
    raise exception 'partir embarque: cliente no encontrado' using errcode = 'P0002';
  end if;
  if v_client.merged_into_client_id is not null then
    raise exception 'partir embarque: esa ficha fue fusionada; elige la que sobrevivió' using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(coalesce(v_client.markbox, '')), '') is null then
    raise exception 'partir embarque: el cliente no tiene Shipping Mark' using errcode = '22023';
  end if;

  if v_ship.status::text in ('delivered', 'cancelled') then
    v_blockers := v_blockers || pg_catalog.jsonb_build_object('estado', v_ship.status::text);
  end if;

  -- La línea vigente del contenedor y la recepción CN: lo que se reparte.
  select ci.id, ci.consolidation_id, ci.supplier_name, ci.cbm, ci.weight_kg, ci.pieces,
         co.status as cons_status into v_item
    from public.consolidation_items ci
    join public.consolidations co on co.id = ci.consolidation_id and co.deleted_at is null
   where ci.tenant_id = v_tenant and ci.shipment_id = v_ship.id
   order by ci.created_at desc, ci.id desc
   limit 1;
  if v_item.id is null then
    v_blockers := v_blockers || pg_catalog.jsonb_build_object('sin_contenedor', 1);
  elsif not v_dry then
    perform 1 from public.consolidation_items ci where ci.id = v_item.id for update of ci;
  end if;

  select pg_catalog.count(*) into v_n_rec from public.warehouse_receipts_cn r
   where r.tenant_id = v_tenant and r.shipment_id = v_ship.id and r.deleted_at is null;
  -- Siempre se asigna (sin fila, con nulos) para poder leer v_rec.id después.
  select r.* into v_rec from public.warehouse_receipts_cn r
   where r.tenant_id = v_tenant and r.shipment_id = v_ship.id and r.deleted_at is null and v_n_rec = 1;
  if v_n_rec <> 1 then
    v_blockers := v_blockers || pg_catalog.jsonb_build_object('recepciones', v_n_rec);
  else
    if not v_dry then
      perform 1 from public.warehouse_receipts_cn r where r.id = v_rec.id for update of r;
      perform 1 from public.warehouse_boxes b
       where b.receipt_id = v_rec.id and b.deleted_at is null order by b.id for update of b;
    end if;
    select pg_catalog.count(*) into v_live_boxes from public.warehouse_boxes b
     where b.receipt_id = v_rec.id and b.deleted_at is null;
  end if;

  -- Sin las tres en la misma cifra no se sabe qué se parte: primero se corrige (§5).
  if v_item.id is not null and v_rec.id is not null and (
       v_ship.volume_m3 is distinct from v_item.cbm or v_item.cbm is distinct from v_rec.total_cbm
       or v_ship.weight_kg is distinct from v_item.weight_kg or v_item.weight_kg is distinct from v_rec.total_weight_kg
       or v_item.pieces is distinct from v_rec.boxes or v_live_boxes is distinct from v_rec.boxes) then
    v_blockers := v_blockers || pg_catalog.jsonb_build_object('medidas_desalineadas', 1);
  end if;

  if v_blockers - 'estado' = '{}'::jsonb then
    if p_boxes >= v_rec.boxes then
      raise exception 'partir embarque: la parte nueva tiene que llevar menos de % cajas', v_rec.boxes
        using errcode = '22023';
    end if;
    if p_cbm > v_rec.total_cbm or p_weight_kg > v_rec.total_weight_kg then
      raise exception 'partir embarque: la parte nueva no puede llevar más CBM o peso que el embarque'
        using errcode = '22023';
    end if;

    -- Las cajas que se van: las indicadas o las de seq más alto.
    if p_box_codes is not null then
      select pg_catalog.array_agg(b.id order by b.seq), pg_catalog.array_agg(b.code order by b.seq)
        into v_box_ids, v_box_codes
        from public.warehouse_boxes b
       where b.receipt_id = v_rec.id and b.deleted_at is null
         and b.code in (select pg_catalog.btrim(c) from pg_catalog.unnest(p_box_codes) c);
      v_n := coalesce(pg_catalog.cardinality(v_box_ids), 0);
      if v_n <> p_boxes then
        v_blockers := v_blockers || pg_catalog.jsonb_build_object('caja_ajena', p_boxes - v_n);
      end if;
    else
      select pg_catalog.array_agg(x.id order by x.seq), pg_catalog.array_agg(x.code order by x.seq)
        into v_box_ids, v_box_codes
        from (select b.id, b.code, b.seq from public.warehouse_boxes b
               where b.receipt_id = v_rec.id and b.deleted_at is null
               order by b.seq desc limit p_boxes) x;
    end if;

    select pg_catalog.count(*) into v_n
      from public.warehouse_receipt_ve_boxes vb
      join public.warehouse_receipts_ve ve on ve.id = vb.receipt_id and ve.deleted_at is null
     where vb.code = any(coalesce(v_box_codes, '{}')) and vb.scanned_at is not null;
    if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('caja_escaneada_ve', v_n); end if;

    select pg_catalog.count(distinct o.id) into v_n
      from public.dispatch_order_packages dp
      join public.dispatch_orders o on o.id = dp.od_id
     where o.tenant_id = v_tenant and o.status <> 'cancelada'
       and dp.package_kind = 'warehouse_receipt_cn' and dp.package_id = v_rec.id;
    if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('orden_despacho', v_n); end if;

    select pg_catalog.count(distinct rs.receipt_id) into v_n
      from public.shipment_rate_snapshots rs
     where rs.tenant_id = v_tenant and rs.receipt_id = v_rec.id and rs.superseded_at is null;
    if v_n > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('tarifa_congelada', v_n); end if;
  end if;

  select pg_catalog.count(*) filter (where i.status <> 'borrador'),
         pg_catalog.count(*) filter (where i.status = 'borrador')
    into v_n, v_m
    from public.invoices i
   where i.tenant_id = v_tenant and i.deleted_at is null and i.status <> 'anulada'
     and (i.shipment_id = v_ship.id or exists (
       select 1 from pg_catalog.jsonb_array_elements(
         case when pg_catalog.jsonb_typeof(i.lines) = 'array' then i.lines else '[]'::jsonb end) l
       where pg_catalog.btrim(l.value ->> 'shipmentCode') = v_ship.code));
  if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('factura_emitida', v_n); end if;
  if v_m > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('borrador_factura', v_m); end if;

  select pg_catalog.count(*) into v_n from public.client_claims c
   where c.tenant_id = v_tenant and c.shipment_id = v_ship.id and c.deleted_at is null;
  if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('reclamo', v_n); end if;

  select pg_catalog.count(*) into v_n from public.prealertas p
   where p.tenant_id = v_tenant and p.shipment_id = v_ship.id and p.deleted_at is null
     and p.status <> 'cancelada';
  if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('prealerta', v_n); end if;

  if v_item.cons_status in ('zarpado', 'arribado') then
    v_warnings := v_warnings || pg_catalog.jsonb_build_object('contenedor', v_item.cons_status);
  end if;
  select pg_catalog.count(*) into v_n from public.shipment_documents d
   where d.tenant_id = v_tenant and d.shipment_id = v_ship.id and d.deleted_at is null;
  if v_n > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('documentos_quedan', v_n); end if;
  select pg_catalog.count(*) into v_n from public.client_notification_schedule n
   where n.shipment_id = v_ship.id and n.status = 'scheduled';
  if v_n > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('avisos_quedan', v_n); end if;

  -- D2 del DG: «<código>-B», y -C, -D… si ya existe (también entre los eliminados).
  if v_rec.id is not null then
    select x.l into v_suffix
      from pg_catalog.unnest(array['B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z'])
           with ordinality as x(l, o)
     where not exists (select 1 from public.shipments s
                        where s.tenant_id = v_tenant and s.code = v_ship.code || '-' || x.l)
       and not exists (select 1 from public.warehouse_receipts_cn r
                        where r.tenant_id = v_tenant and r.receipt_code = v_rec.receipt_code || '-' || x.l)
     order by x.o
     limit 1;
    if v_suffix is null then
      raise exception 'partir embarque: no queda una letra libre para el código de la parte nueva' using errcode = '22023';
    end if;
    v_new_code := v_ship.code || '-' || v_suffix;
    v_new_receipt_code := v_rec.receipt_code || '-' || v_suffix;
  end if;

  v_parts := case when v_rec.id is null then null else pg_catalog.jsonb_build_object(
    'original', pg_catalog.jsonb_build_object('code', v_ship.code, 'boxes', v_rec.boxes - p_boxes,
      'cbm', v_rec.total_cbm - p_cbm, 'weight_kg', v_rec.total_weight_kg - p_weight_kg),
    'nueva', pg_catalog.jsonb_build_object('code', v_new_code, 'boxes', p_boxes,
      'cbm', p_cbm, 'weight_kg', p_weight_kg, 'client_markbox', v_client.markbox),
    'total', pg_catalog.jsonb_build_object('boxes', v_rec.boxes,
      'cbm', v_rec.total_cbm, 'weight_kg', v_rec.total_weight_kg),
    'box_codes', pg_catalog.to_jsonb(coalesce(v_box_codes, '{}'))) end;

  if v_blockers <> '{}'::jsonb or v_dry then
    return pg_catalog.jsonb_build_object(
      'outcome', case when v_blockers <> '{}'::jsonb then 'blocked' else 'preview' end,
      'shipment_id', v_ship.id, 'shipment_code', v_ship.code,
      'parts', v_parts, 'blockers', v_blockers, 'warnings', v_warnings);
  end if;

  select coalesce(pg_catalog.sum(ci.pieces), 0) as pieces, coalesce(pg_catalog.sum(ci.cbm), 0) as cbm,
         coalesce(pg_catalog.sum(ci.weight_kg), 0) as kg into v_sum_before
    from public.consolidation_items ci where ci.consolidation_id = v_item.consolidation_id;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  -- El embarque nuevo: lo mismo del original, con el dueño, las medidas y el código nuevos.
  -- Sin `notes`: son del dueño original y el nuevo las leería en el Portal (0416).
  -- Llegada, planificación y GPS sí: el bodegaje no se reinicia.
  insert into public.shipments
    (tenant_id, code, client_name, client_markbox, origin, destination, destination_gps, shipment_service,
     status, weight_kg, volume_m3, vehicle_category, notes, group_reference, arrived_destination_at,
     planned_departure_at, planned_arrival_at, planned_delivery_at, planning_timezone, created_at)
  values
    (v_tenant, v_new_code, v_client.name, v_client.markbox, v_ship.origin, v_ship.destination,
     v_ship.destination_gps, v_ship.shipment_service, v_ship.status, p_weight_kg, p_cbm,
     v_ship.vehicle_category, null, coalesce(v_ship.group_reference, v_ship.code),
     v_ship.arrived_destination_at, v_ship.planned_departure_at, v_ship.planned_arrival_at,
     v_ship.planned_delivery_at, v_ship.planning_timezone, v_ship.created_at)
  returning id into v_new_ship;

  -- La línea de tiempo del original, para que el dueño nuevo la vea en el Portal.
  -- El evento inicial de 0003 queda como el último: «Nace de partir…».
  update public.shipment_events e
     set note = 'Nace de partir ' || v_ship.code, occurred_at = pg_catalog.now()
   where e.shipment_id = v_new_ship;
  insert into public.shipment_events (tenant_id, shipment_id, status, note, occurred_at)
  select v_tenant, v_new_ship, e.status, e.note, e.occurred_at
    from public.shipment_events e
   where e.shipment_id = v_ship.id and e.deleted_at is null;

  update public.shipments s
     set volume_m3 = v_rec.total_cbm - p_cbm, weight_kg = v_rec.total_weight_kg - p_weight_kg,
         group_reference = coalesce(s.group_reference, s.code)
   where s.id = v_ship.id and s.tenant_id = v_tenant;

  update public.consolidation_items ci
     set cbm = ci.cbm - p_cbm, weight_kg = ci.weight_kg - p_weight_kg, pieces = ci.pieces - p_boxes
   where ci.id = v_item.id and ci.tenant_id = v_tenant;
  insert into public.consolidation_items
    (tenant_id, consolidation_id, shipment_id, client_markbox, client_name, supplier_name, cbm, weight_kg, pieces)
  values
    (v_tenant, v_item.consolidation_id, v_new_ship, v_client.markbox, v_client.name, v_item.supplier_name,
     p_cbm, p_weight_kg, p_boxes)
  returning id into v_new_item;

  -- Recepción nueva con 0 cajas: el trigger de 0240 no crea ninguna; se mueven
  -- las físicas y después se fijan los dos conteos iguales a las filas vivas.
  insert into public.warehouse_receipts_cn
    (tenant_id, receipt_code, warehouse_id, client_markbox, client_name, is_orphan, boxes,
     total_cbm, total_weight_kg, status, shipment_id, received_at)
  values
    (v_tenant, v_new_receipt_code, v_rec.warehouse_id, v_client.markbox, v_client.name, false, 0,
     p_cbm, p_weight_kg, v_rec.status, v_new_ship, v_rec.received_at)
  returning id into v_new_rec;

  update public.warehouse_boxes b
     set receipt_id = v_new_rec, markbox = v_client.markbox, client_name = v_client.name
   where b.id = any(v_box_ids) and b.receipt_id = v_rec.id and b.deleted_at is null;
  get diagnostics v_n = row_count;
  if v_n <> p_boxes then
    raise exception 'partir embarque: conflicto con las cajas' using errcode = '40001';
  end if;

  update public.warehouse_receipts_cn r
     set boxes = r.boxes - p_boxes, total_cbm = r.total_cbm - p_cbm,
         total_weight_kg = r.total_weight_kg - p_weight_kg
   where r.id = v_rec.id and r.tenant_id = v_tenant;
  update public.warehouse_receipts_cn r set boxes = p_boxes where r.id = v_new_rec;

  -- Cajas ya esperadas en una recepción de Venezuela sin escanear: siguen al dueño nuevo.
  update public.warehouse_receipt_ve_boxes vb
     set markbox = v_client.markbox, client_name = v_client.name
    from public.warehouse_receipts_ve ve
   where ve.id = vb.receipt_id and ve.deleted_at is null
     and vb.code = any(v_box_codes) and vb.scanned_at is null;

  -- Postcondiciones: nada se perdió ni se creó.
  select coalesce(pg_catalog.sum(ci.pieces), 0) as pieces, coalesce(pg_catalog.sum(ci.cbm), 0) as cbm,
         coalesce(pg_catalog.sum(ci.weight_kg), 0) as kg into v_sum_after
    from public.consolidation_items ci where ci.consolidation_id = v_item.consolidation_id;
  if v_sum_after.pieces <> v_sum_before.pieces or v_sum_after.cbm <> v_sum_before.cbm
     or v_sum_after.kg <> v_sum_before.kg then
    raise exception 'partir embarque: el total del contenedor cambió' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.warehouse_receipts_cn r
     where r.id in (v_rec.id, v_new_rec)
       and r.boxes <> (select pg_catalog.count(*) from public.warehouse_boxes b
                        where b.receipt_id = r.id and b.deleted_at is null)
  ) then
    raise exception 'partir embarque: las cajas físicas no quedaron alineadas' using errcode = '40001';
  end if;

  perform public.append_audit_event(
    v_tenant, 'shipment', v_ship.id, 'user', v_actor, 'shipment_split_out', 'rpc', 'succeeded', v_reason,
    pg_catalog.jsonb_build_object('boxes', v_rec.boxes, 'cbm', v_rec.total_cbm, 'weight_kg', v_rec.total_weight_kg),
    pg_catalog.jsonb_build_object('boxes', v_rec.boxes - p_boxes, 'cbm', v_rec.total_cbm - p_cbm,
      'weight_kg', v_rec.total_weight_kg - p_weight_kg),
    pg_catalog.jsonb_build_object(
      'permanence', 'P1', 'consequence', 'shipment_split', 'recovery', 'correct_measures_and_reassign',
      'shipment_code', v_ship.code, 'new_shipment_id', v_new_ship, 'new_shipment_code', v_new_code,
      'new_receipt_code', v_new_receipt_code, 'box_codes', pg_catalog.to_jsonb(v_box_codes),
      'warnings', v_warnings),
    pg_catalog.concat('sdd-0673:split:', pg_catalog.txid_current()::text), 1, 'internal');
  perform public.append_audit_event(
    v_tenant, 'shipment', v_new_ship, 'user', v_actor, 'shipment_split_in', 'rpc', 'succeeded', v_reason,
    null,
    pg_catalog.jsonb_build_object('boxes', p_boxes, 'cbm', p_cbm, 'weight_kg', p_weight_kg,
      'client_markbox', v_client.markbox),
    pg_catalog.jsonb_build_object(
      'permanence', 'P1', 'consequence', 'shipment_split', 'recovery', 'correct_measures_and_reassign',
      'shipment_code', v_new_code, 'from_shipment_id', v_ship.id, 'from_shipment_code', v_ship.code),
    pg_catalog.concat('sdd-0673:split:', pg_catalog.txid_current()::text), 1, 'internal');

  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);

  return pg_catalog.jsonb_build_object(
    'outcome', 'split',
    'shipment_id', v_ship.id, 'shipment_code', v_ship.code,
    'new_shipment_id', v_new_ship, 'new_shipment_code', v_new_code,
    'parts', v_parts, 'blockers', '{}'::jsonb, 'warnings', v_warnings);
end;
$$;

comment on function public.split_shipment(uuid, uuid, integer, numeric, numeric, text, text[], boolean) is
  'SDD-0673/0563: parte un embarque de contenedor en dos. La parte nueva (p_boxes, p_cbm, p_weight_kg) va a «<código>-B» con el dueño p_client_id; el original queda con el resto y el total del contenedor no cambia. Mueve cajas físicas (p_box_codes o las de seq más alto) sin cambiarles el código. Sólo operations/admin, motivo 4-1000, todo o nada, eventos shipment_split_out/_in. outcome: preview | blocked | split.';

revoke all on function public.split_shipment(uuid, uuid, integer, numeric, numeric, text, text[], boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.split_shipment(uuid, uuid, integer, numeric, numeric, text, text[], boolean) to authenticated;

do $postflight$
declare
  v_fn oid;
  v_name text;
begin
  foreach v_name in array array[
    'public.correct_shipment_measures(uuid,integer,numeric,numeric,text,boolean)',
    'public.split_shipment(uuid,uuid,integer,numeric,numeric,text,text[],boolean)'
  ] loop
    v_fn := pg_catalog.to_regprocedure(v_name);
    if v_fn is null or not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = v_fn and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
    ) then
      raise exception '0563 postflight: % sin SECURITY DEFINER o con search_path', v_name;
    end if;
    if not pg_catalog.has_function_privilege('authenticated', v_fn, 'EXECUTE')
       or pg_catalog.has_function_privilege('anon', v_fn, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', v_fn, 'EXECUTE') then
      raise exception '0563 postflight: EXECUTE de % debe ser sólo de authenticated', v_name;
    end if;
    if exists (
      select 1 from pg_catalog.aclexplode((select proacl from pg_catalog.pg_proc where oid = v_fn)) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '0563 postflight: PUBLIC conserva EXECUTE sobre %', v_name;
    end if;
  end loop;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.shipments'::pg_catalog.regclass
      and conname = 'shipments_group_reference_len' and convalidated
  ) then
    raise exception '0563 postflight: falta el check validado shipments_group_reference_len';
  end if;
end;
$postflight$;

notify pgrst, 'reload schema';
