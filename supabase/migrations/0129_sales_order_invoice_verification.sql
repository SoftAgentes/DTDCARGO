-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0129 · SDD-0072 Fase 3 — Flag HUMANO de verificación para auto-facturar ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Decisión founder (2026-06-13): la auto-factura de la OV (Fase 2, RPC 0128) NO
-- debe dispararse por SOLA inferencia de packing list / medición en almacén. Exige
-- que un operador marque EXPLÍCITAMENTE la recepción como "verificada para facturar".
--
-- Esta migración solo agrega el rastro del flag (cuándo / quién). El gate vive en la
-- capa pura `canAutoInvoice` (lib/studio/sales-orders/invoicing.ts) + el lector en
-- `autoInvoiceForReceipt`. La cadena de auto-factura corre SERVER-SIDE (admin client
-- en el hook → RPC 0128); el cliente no puede forjarla, así que el flag se valida
-- app-side sin tocar la RPC transaccional.
--
-- Aditiva · sin DDL destructivo · idempotente (add column if not exists). SIN función
-- nueva → cero deuda RPC anon-execute (ver memoria rpc-anon-execute-debt).

alter table public.warehouse_receipts_cn
  add column if not exists invoice_verified_at timestamptz,
  add column if not exists invoice_verified_by uuid;

comment on column public.warehouse_receipts_cn.invoice_verified_at is
  'SDD-0072 Fase 3: instante en que un operador marcó esta recepción VERIFICADA para auto-facturar. NULL ⇒ no verificada ⇒ el gate canAutoInvoice NO factura aunque CBM/peso/adjuntos estén OK. Flag humano explícito (decisión founder 2026-06-13): la auto-factura exige confirmación humana, no solo inferencia de packing/medición.';

comment on column public.warehouse_receipts_cn.invoice_verified_by is
  'SDD-0072 Fase 3: user/operario que marcó la verificación (auditoría de quién autorizó facturar). Se setea junto con invoice_verified_at; se limpia (NULL) al desmarcar.';

-- Índice parcial: las consultas operativas filtran "verificadas pendientes de facturar".
create index if not exists warehouse_receipts_cn_invoice_verified_idx
  on public.warehouse_receipts_cn (invoice_verified_at)
  where invoice_verified_at is not null;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ Cierre de deuda anon-execute (espejo de 0124b para la Orden de compra) ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- next_sales_order_code (0125) es SECURITY DEFINER y quedó ejecutable por anon por
-- el default EXECUTE→PUBLIC de Postgres (ver memoria rpc-anon-execute-debt). Se cierra
-- acá, en la misma tanda que va a prod, igual que 0124b cerró next_purchase_order_code.
revoke execute on function public.next_sales_order_code(uuid) from public, anon;
