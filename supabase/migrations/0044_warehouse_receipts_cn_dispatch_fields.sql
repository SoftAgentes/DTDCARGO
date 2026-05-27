-- ─────────────────────────────────────────────────────────────
-- Opción A · Migración aditiva para que el scoring del módulo Despacho
-- pueda usar data real de ciudad destino + payment status por paquete.
--
-- Decisión 2026-05-27 (founder): drift hacia SDD-0029 spec original.
-- Capturar destination_city al consolidar (bodeguero CN, paso wizard
-- nuevo en Fase 3 próxima sesión). Payment se mantiene mock 'pendiente'
-- por default · admin update manual hasta módulo cobranza futuro.
--
-- Pattern: text + CHECK constraint en vez de enum (consistente con
-- dispatch_order_packages.pay que ya usa este pattern).
-- ─────────────────────────────────────────────────────────────

alter table public.warehouse_receipts_cn
  add column if not exists destination_city text,
  add column if not exists payment_status text not null default 'pendiente'
    check (payment_status in ('pagado', 'parcial', 'pendiente'));

comment on column public.warehouse_receipts_cn.destination_city is
  'Ciudad VE de entrega final. Capturada por bodeguero CN al consolidar (paso wizard /m/cn/nueva). NULL hasta consolidar. Validar contra dispatch_city_catalog del tenant.';

comment on column public.warehouse_receipts_cn.payment_status is
  'Estado de pago del paquete · pagado/parcial/pendiente. Default pendiente. Actualizado por admin manual o módulo cobranza futuro.';

create index if not exists warehouse_receipts_cn_dest_city_idx
  on public.warehouse_receipts_cn (destination_city)
  where deleted_at is null and destination_city is not null;
