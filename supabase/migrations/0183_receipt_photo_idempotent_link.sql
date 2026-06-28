-- ─────────────────────────────────────────────────────────────
-- 0183 · Link idempotente de fotos de recepción CN (retry offline seguro).
--   Follow-up de SDD-0028 · rama feat/m-cn-foto-offline.
--
-- La cola offline de fotos (app/m/_lib/photo-queue.ts + PhotoRetryRunner)
-- puede reintentar subir una foto cuya RESPUESTA se perdió en la red
-- ("phantom success"): el server ya insertó la fila pero el cliente no se
-- enteró y reintenta. Sin protección, el retry crea una fila DUPLICADA para
-- la misma (receipt_id, position) → foto repetida en el detail del Studio.
--
-- Esta migración hace el link idempotente:
--   1) dedup defensivo de duplicados existentes (conserva el más nuevo)
--   2) índice UNIQUE en (receipt_id, position)
--   3) link_receipt_photo con ON CONFLICT DO NOTHING (devuelve el id existente)
--
-- Único caller del RPC: app/m/cn/nueva/photo-actions.ts (verificado). El flujo
-- de edición NO toca fotos → ON CONFLICT DO NOTHING no causa regresión.
-- ─────────────────────────────────────────────────────────────

-- 1) Dedup defensivo: si ya existen duplicados (receipt_id, position),
--    conservar la fila más reciente (created_at desc, id desc de desempate).
--    En la práctica suele ser no-op; protege la creación del unique index.
delete from public.warehouse_receipt_photos p
using (
  select id,
         row_number() over (
           partition by receipt_id, position
           order by created_at desc, id desc
         ) as rn
    from public.warehouse_receipt_photos
) dup
where p.id = dup.id
  and dup.rn > 1;

-- 2) Unique index — habilita el ON CONFLICT. La tabla NO tiene soft-delete
--    (sin columna deleted_at) → unique total, no parcial.
create unique index if not exists warehouse_receipt_photos_receipt_pos_uidx
  on public.warehouse_receipt_photos (receipt_id, position);

-- 3) link_receipt_photo idempotente
create or replace function public.link_receipt_photo(
  p_operario_id  uuid,
  p_receipt_id   uuid,
  p_storage_path text,
  p_position     int,
  p_size_bytes   bigint,
  p_content_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id   uuid;
  v_op_tenant   uuid;
  v_active      boolean;
  v_photo_id    uuid;
begin
  select op.tenant_id, op.active into v_op_tenant, v_active
    from public.operario_pins op where op.id = p_operario_id;
  if v_op_tenant is null then
    raise exception 'Operario no encontrado' using errcode = 'P0014';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0015';
  end if;

  select wr.tenant_id into v_tenant_id
    from public.warehouse_receipts_cn wr where wr.id = p_receipt_id;
  if v_tenant_id is null then
    raise exception 'Receipt no encontrado' using errcode = 'P0016';
  end if;
  if v_tenant_id <> v_op_tenant then
    raise exception 'Receipt de otro tenant' using errcode = 'P0017';
  end if;

  insert into public.warehouse_receipt_photos (
    tenant_id, receipt_id, storage_path, position,
    size_bytes, content_type, uploaded_by_operario_id
  ) values (
    v_tenant_id, p_receipt_id, p_storage_path, p_position,
    p_size_bytes, p_content_type, p_operario_id
  )
  on conflict (receipt_id, position) do nothing
  returning id into v_photo_id;

  -- Conflicto = retry de una foto ya linkeada en esa posición. Devolver el
  -- id existente para que el server action sea idempotente (no error). El
  -- objeto recién subido queda huérfano en el bucket (caso raro de phantom
  -- success); es descartable y se puede GC-ear aparte.
  if v_photo_id is null then
    select id into v_photo_id
      from public.warehouse_receipt_photos
     where receipt_id = p_receipt_id and position = p_position;
  end if;

  return v_photo_id;
end;
$$;

comment on function public.link_receipt_photo is
  'Indexa una foto ya subida a Storage al receipt + operario. Idempotente por (receipt_id, position): el retry offline no duplica (SDD-0028 / feat/m-cn-foto-offline).';

-- Grants (replican 0022; CREATE OR REPLACE los preserva, se re-declaran por
-- la regla "revoke from public, anon" en funciones nuevas/modificadas).
revoke all on function public.link_receipt_photo(uuid, uuid, text, int, bigint, text)
  from public, anon;
grant execute on function public.link_receipt_photo(uuid, uuid, text, int, bigint, text)
  to service_role;
