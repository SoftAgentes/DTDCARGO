-- 0243 · Fix: la UNIQUE de `seq` cuenta cajas soft-borradas y revienta el trigger
--
-- BUG (introducido por 0240, vivo en prod):
--   `warehouse_boxes_receipt_seq_key unique (receipt_id, seq)` es una CONSTRAINT
--   de tabla → NO puede ser parcial → incluye las filas con `deleted_at not null`.
--   Pero `sync_boxes_for_receipt` calcula el próximo seq mirando SOLO las vivas:
--
--     select count(*), coalesce(max(seq), 0) into v_have, v_max_seq
--       from public.warehouse_boxes
--      where receipt_id = p_receipt_id and deleted_at is null;   -- ← solo vivas
--
--   Secuencia que lo rompe (alcanzable hoy desde /m/cn/recepcion/[id]/editar,
--   que hace `boxes: input.boxes`):
--     boxes 7 → crea seq 1..7
--     boxes 5 → soft-borra seq 7 y 6 (LIFO)          vivas: 1..5
--     boxes 7 → v_max_seq = 5 → intenta insertar seq 6 y 7
--               → choca contra las soft-borradas → 23505 unique_violation
--               → se cae la transacción ENTERA (la edición del operario falla)
--
-- FIX: la unicidad de `seq` solo aplica entre cajas VIVAS. Se hace con un índice
-- único PARCIAL — mismo patrón que ya usa 0241 en `consolidation_box_positions`
-- (`unique (box_id) where unstuffed_at is null`).
--
-- OJO — `warehouse_boxes_tenant_code_key unique (tenant_id, code)` NO se toca y
-- NO debe hacerse parcial: los codes `DTD-B-NNNNNN` jamás se reusan, ni siquiera
-- tras un soft-delete. Ese es justo el motivo de que `v_base` se calcule SIN
-- filtrar por `deleted_at` (0240:158 / 0241:453). Si se hiciera parcial, un
-- código muerto podría revivir en otra caja física y una etiqueta ya impresa
-- pasaría a apuntar a la caja equivocada.

alter table public.warehouse_boxes
  drop constraint if exists warehouse_boxes_receipt_seq_key;

create unique index if not exists warehouse_boxes_receipt_seq_live_key
  on public.warehouse_boxes (receipt_id, seq)
  where deleted_at is null;

comment on index public.warehouse_boxes_receipt_seq_live_key is
  'SDD-0152 · fix 0243: seq único entre cajas VIVAS de un receipt. Parcial a propósito — al bajar y volver a subir `boxes`, los seq de las soft-borradas se reciclan. El code (tenant_id, code) sigue siendo global y jamás se reusa.';
