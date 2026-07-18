-- ─────────────────────────────────────────────────────────────
-- SDD-0152 · Fase 1b — la orden de impresión sabe de qué recepción vino
--
-- Para que la etiqueta del hub pueda llevar el código ÚNICO de cada caja
-- (warehouse_boxes.code, migr 0240) hay que saber QUÉ cajas imprimir. Hoy
-- qr_print_orders guarda `markbox` + `bultos` (un conteo) y nada más: no hay
-- forma de resolver los códigos.
--
-- Por qué importa: conviven dos etiquetas físicas y solo una puede identificar
-- la caja.
--   · La del proveedor (/studio/etiquetas, SDD-0031) se imprime ANTES de que la
--     caja llegue → codifica ?c=<markbox>&n=<caja>/<total>. Identifica al
--     CLIENTE, no a la caja: dos envíos del mismo cliente tienen ambos una
--     "caja 1/12". Sirve para que el proveedor rotule; no sirve para estibar.
--   · La del HUB (esta) se imprime DESPUÉS de recibir, cuando warehouse_boxes ya
--     existe → puede llevar el DTD-B-NNNNNN único. Es la que se escanea.
--
-- Decisión del founder (2026-07-16): en Yiwu se le pega etiqueta nueva a cada
-- caja al recibirla. Esta columna es lo que hace posible imprimirla.
--
-- Aditiva: columna nullable, sin default → no reescribe la tabla. Las órdenes
-- viejas quedan con receipt_id null y la vista de impresión cae al modo legacy
-- (markbox + conteo), sin romperse.
--
-- ⚠️ NO aplicar a prod desde acá (lo hace el founder, runbook
--    docs/runbooks/aplicar-migraciones-prod.md).
-- ─────────────────────────────────────────────────────────────

alter table public.qr_print_orders
  add column if not exists receipt_id uuid
    references public.warehouse_receipts_cn(id) on delete set null;

comment on column public.qr_print_orders.receipt_id is
  'SDD-0152: recepción CN de la que salió la orden. Permite resolver warehouse_boxes y que el QR impreso lleve el code único por caja. Nullable: las órdenes previas a 0152 no lo tienen y la impresión cae al modo legacy.';

-- FK index (el patrón del repo: toda FK con su índice)
create index if not exists qr_print_orders_receipt_idx
  on public.qr_print_orders (receipt_id)
  where receipt_id is not null;
