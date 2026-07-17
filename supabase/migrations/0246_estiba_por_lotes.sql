-- 0246 · SDD-0155 · Estiba por lotes: escanear una caja monta el lote entero
--
-- EL MODELO (founder, 17-jul)
--   Al montar, el operario escanea UNA caja → "es un lote de 12" → confirma → se
--   montan las 12. La posición a lo largo del contenedor (fondo→puerta) la da el
--   ORDEN DE CARGA (el primer lote va al fondo); el operario solo elige izquierda /
--   centro / derecha. Si de 20 solo caben 11, monta 11 y las 9 quedan recibidas sin
--   montar → próximo contenedor (dos envíos).
--
-- REEMPLAZA el tapeo caja-por-caja de 1-de-18-zonas de SDD-0152, que nunca se usó
-- con carga real (medido 17-jul: 0 posiciones, 0 consolidaciones). La tabla
-- `consolidation_box_positions` está VACÍA → se reforma con ALTER, sin migrar datos.
--
-- COMPATIBILIDAD
--   Se conservan zx/zy/zz (NOT NULL en 0241) con semántica nueva:
--     zx = load_order (profundidad por orden de carga) · zy = 0 (altura no se usa)
--     zz = width_pos (0 izq · 1 centro · 2 der)
--   El zone_code generado (`L{zx}-H{zy}-W{zz}`) sigue siendo válido. Los RPCs
--   stuff_box/unstuff_box de 0241 quedan (sin datos, no estorban); la pantalla nueva
--   usa los RPCs de lote de acá.

-- ── 1. Columnas del modelo por lotes ─────────────────────────

alter table public.consolidation_box_positions
  add column if not exists load_order int;
alter table public.consolidation_box_positions
  add column if not exists width_pos smallint;
alter table public.consolidation_box_positions
  add column if not exists lot_prealerta_id uuid references public.prealertas(id) on delete set null;

alter table public.consolidation_box_positions
  drop constraint if exists consolidation_box_positions_width_pos_check;
alter table public.consolidation_box_positions
  add constraint consolidation_box_positions_width_pos_check
  check (width_pos is null or width_pos between 0 and 2);

comment on column public.consolidation_box_positions.load_order is
  'SDD-0155: slot de profundidad 0,1,2… por consolidación = orden de carga (0 = fondo). Lo asigna el sistema, no el operario. Espejo de zx.';
comment on column public.consolidation_box_positions.width_pos is
  'SDD-0155: 0 izquierda · 1 centro · 2 derecha. Lo ÚNICO que elige el operario por lote. Espejo de zz.';
comment on column public.consolidation_box_positions.lot_prealerta_id is
  'SDD-0155: la compra (prealerta) del lote al que pertenece esta caja. Agrupa el lote en el visor.';

create index if not exists consolidation_box_positions_load_order_idx
  on public.consolidation_box_positions (consolidation_id, load_order)
  where unstuffed_at is null;

-- ── 2. Montar un lote ────────────────────────────────────────

create or replace function public.stuff_lot_as_operario(
  p_operario_id      uuid,
  p_consolidation_id uuid,
  p_scanned_code     text,
  p_width            int,               -- 0 izq · 1 centro · 2 der
  p_count            int default null   -- null = todo el lote; menos = lote partido
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op         record;
  v_consol     record;
  v_box        record;
  v_pre        record;
  v_client     text;
  v_lot_size   int;
  v_stuff      int;
  v_load_order int;
  v_seq        int;
  v_done       int;
begin
  -- 1. Operario CN activo
  select id, tenant_id, region, active into v_op
    from public.operario_pins where id = p_operario_id;
  if v_op.id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_op.active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_op.region <> 'cn' then raise exception 'Solo operarios CN estiban' using errcode = 'P0003'; end if;

  -- 2. Consolidación viva, del tenant, todavía consolidando
  select id, tenant_id, status into v_consol
    from public.consolidations
   where id = p_consolidation_id and tenant_id = v_op.tenant_id and deleted_at is null;
  if v_consol.id is null then raise exception 'Consolidación no encontrada' using errcode = 'P0120'; end if;
  if v_consol.status <> 'consolidando' then
    raise exception 'La consolidación está en % · solo se estiba mientras consolida', v_consol.status using errcode = 'P0121';
  end if;

  -- 3. Ancho válido
  if p_width is null or p_width < 0 or p_width > 2 then
    raise exception 'Posición al ancho inválida (0 izq · 1 centro · 2 der)' using errcode = 'P0123';
  end if;

  -- 4. Caja escaneada: recibida, del tenant, sin montar
  select id, tenant_id, prealerta_id, status, code, markbox into v_box
    from public.warehouse_boxes
   where tenant_id = v_op.tenant_id and code = upper(trim(p_scanned_code)) and deleted_at is null;
  if v_box.id is null then raise exception 'La caja % no existe · revisa la etiqueta', p_scanned_code using errcode = 'P0124'; end if;
  if v_box.status <> 'recibida' then
    raise exception 'La caja % todavía no se recibió · recíbela primero', v_box.code using errcode = 'P0128';
  end if;
  if v_box.prealerta_id is null then
    raise exception 'La caja % no viene de una compra · no se puede armar el lote', v_box.code using errcode = 'P0132';
  end if;
  if exists (select 1 from public.consolidation_box_positions p where p.box_id = v_box.id and p.unstuffed_at is null) then
    raise exception 'La caja % ya está montada', v_box.code using errcode = 'P0125';
  end if;

  -- 5. El lote = cajas recibidas de la misma compra, sin montar. El filtro de
  --    tenant es explícito (no se apoya en el invariante caja.tenant==prealerta.tenant,
  --    que ningún FK fuerza) — hardening del review adversarial.
  select count(*) into v_lot_size
    from public.warehouse_boxes b
   where b.tenant_id = v_op.tenant_id
     and b.prealerta_id = v_box.prealerta_id
     and b.status = 'recibida'
     and b.deleted_at is null
     and not exists (select 1 from public.consolidation_box_positions p where p.box_id = b.id and p.unstuffed_at is null);

  v_stuff := coalesce(p_count, v_lot_size);
  if v_stuff < 1 then v_stuff := 1; end if;
  if v_stuff > v_lot_size then v_stuff := v_lot_size; end if;

  -- 6. load_order = siguiente por consolidación; seq = corrido
  select coalesce(max(load_order), -1) + 1 into v_load_order
    from public.consolidation_box_positions
   where consolidation_id = p_consolidation_id and unstuffed_at is null;
  select coalesce(max(seq), 0) into v_seq
    from public.consolidation_box_positions
   where consolidation_id = p_consolidation_id and unstuffed_at is null;

  -- 7. Montar las primeras v_stuff cajas del lote. La escaneada primero (está en la
  --    mano del operario), el resto por seq. El trigger require_recibida (0244) y el
  --    unique parcial (box_id) where unstuffed_at is null (0241) son la red de seguridad.
  with lote as (
    select b.id,
           row_number() over (order by (b.id = v_box.id) desc, b.seq) as rn
      from public.warehouse_boxes b
     where b.tenant_id = v_op.tenant_id
       and b.prealerta_id = v_box.prealerta_id
       and b.status = 'recibida'
       and b.deleted_at is null
       and not exists (select 1 from public.consolidation_box_positions p where p.box_id = b.id and p.unstuffed_at is null)
  )
  insert into public.consolidation_box_positions (
    tenant_id, consolidation_id, box_id,
    zx, zy, zz, seq,
    load_order, width_pos, lot_prealerta_id,
    stuffed_by_operario_id, stuffed_manual
  )
  select
    v_consol.tenant_id, p_consolidation_id, lote.id,
    v_load_order, 0, p_width, v_seq + lote.rn,
    v_load_order, p_width, v_box.prealerta_id,
    p_operario_id, false
  from lote
  where lote.rn <= v_stuff;

  get diagnostics v_done = row_count;

  -- 8. Auditoría unificada (ISO 9001 §7.5) — igual que stuff_box de 0241, un evento
  --    por LOTE en vez de por caja.
  insert into public.entity_audit_log
    (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
  values
    (v_op.tenant_id, 'consolidation', p_consolidation_id, 'operario', p_operario_id,
     'lote_stuffed',
     jsonb_build_object(
       'scanned_code', v_box.code, 'prealerta_id', v_box.prealerta_id,
       'load_order', v_load_order, 'width', p_width,
       'stuffed', v_done, 'lot_size', v_lot_size
     ));

  -- 9. Datos para la UI
  select code, client_markbox into v_pre from public.prealertas where id = v_box.prealerta_id;
  select name into v_client from public.clients
   where tenant_id = v_op.tenant_id and markbox = v_pre.client_markbox limit 1;

  return jsonb_build_object(
    'ok', true,
    'lot_size', v_lot_size,
    'stuffed', v_done,
    'remaining', v_lot_size - v_done,
    'load_order', v_load_order,
    'width', p_width,
    'prealerta_code', v_pre.code,
    'client_markbox', v_pre.client_markbox,
    'client_name', v_client,
    'scanned_code', v_box.code
  );
end;
$$;

comment on function public.stuff_lot_as_operario(uuid, uuid, text, int, int) is
  'SDD-0155: monta un lote (cajas recibidas de una compra, sin montar) escaneando una de sus cajas. load_order automático por orden de carga; el operario solo elige el ancho (0/1/2). p_count < lote = lote partido (el resto queda sin montar para otro contenedor). Devuelve el resumen para la UI.';

-- ── 3. Deshacer el último lote (corrección) ──────────────────

create or replace function public.unstuff_lot_as_operario(
  p_operario_id      uuid,
  p_consolidation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op       record;
  v_consol   record;
  v_last     int;
  v_done     int;
begin
  select id, tenant_id, region, active into v_op
    from public.operario_pins where id = p_operario_id;
  if v_op.id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_op.active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_op.region <> 'cn' then raise exception 'Solo operarios CN estiban' using errcode = 'P0003'; end if;

  select id, tenant_id, status into v_consol
    from public.consolidations
   where id = p_consolidation_id and tenant_id = v_op.tenant_id and deleted_at is null;
  if v_consol.id is null then raise exception 'Consolidación no encontrada' using errcode = 'P0120'; end if;

  -- El último lote = el mayor load_order vivo
  select max(load_order) into v_last
    from public.consolidation_box_positions
   where consolidation_id = p_consolidation_id and unstuffed_at is null;
  if v_last is null then
    raise exception 'No hay nada montado para deshacer' using errcode = 'P0129';
  end if;

  update public.consolidation_box_positions
     set unstuffed_at = now(), unstuffed_by_operario_id = p_operario_id
   where consolidation_id = p_consolidation_id
     and unstuffed_at is null
     and load_order = v_last;
  get diagnostics v_done = row_count;

  insert into public.entity_audit_log
    (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
  values
    (v_op.tenant_id, 'consolidation', p_consolidation_id, 'operario', p_operario_id,
     'lote_unstuffed',
     jsonb_build_object('load_order', v_last, 'unstuffed', v_done));

  return jsonb_build_object('ok', true, 'unstuffed', v_done, 'load_order', v_last);
end;
$$;

comment on function public.unstuff_lot_as_operario(uuid, uuid) is
  'SDD-0155: deshace el último lote montado (mayor load_order vivo) de una consolidación. Para corregir en el galpón. Las cajas vuelven a estar recibidas sin montar.';

-- ── 4. Grants ────────────────────────────────────────────────
-- Solo el server action (service_role) las invoca — el operario no es auth.users.

revoke execute on function public.stuff_lot_as_operario(uuid, uuid, text, int, int) from public;
revoke execute on function public.stuff_lot_as_operario(uuid, uuid, text, int, int) from anon;
revoke execute on function public.stuff_lot_as_operario(uuid, uuid, text, int, int) from authenticated;
grant  execute on function public.stuff_lot_as_operario(uuid, uuid, text, int, int) to service_role;

revoke execute on function public.unstuff_lot_as_operario(uuid, uuid) from public;
revoke execute on function public.unstuff_lot_as_operario(uuid, uuid) from anon;
revoke execute on function public.unstuff_lot_as_operario(uuid, uuid) from authenticated;
grant  execute on function public.unstuff_lot_as_operario(uuid, uuid) to service_role;
