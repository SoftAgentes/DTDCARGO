-- ─────────────────────────────────────────────────────────────
-- SDD-0072 · Fase 2 · auto-Factura en la confirmación de Warehouse
--
-- La recepción CN con CBM/peso REALES dispara la Factura (0021) de la Orden de
-- venta — PARCIAL por defecto (1 OV : N facturas), GATED por requisitos, e
-- IDEMPOTENTE (nunca doble-facturar la misma caja). Decisiones §3.5/3.6 del spec.
--
-- 100% ADITIVA — NO crea tablas, NO toca funciones, NO hace DDL destructivo. Solo
-- agrega columnas nullable a tres tablas que YA tienen RLS habilitado (heredan sus
-- políticas: invoices 0077, prealertas 0105, warehouse_receipts_cn 0008/0044). Todas
-- las columnas son `add column if not exists` → idempotente si un env la corrió a
-- medias. No reabre el CHECK de entity_audit_log (la Fase 2 audita con entity_type
-- 'invoice' ya existente · ver actions). NO se aplica a prod desde acá (lo hace el founder).
--
-- ── Por qué este modelo de enlace (decisión de implementación) ──────────────
-- La OV se ata a las CAJAS FÍSICAS vía prealertas.sales_order_id (Fase 1, 0125).
-- Pero la recepción CN (warehouse_receipts_cn, 0016) NO tenía FK a prealertas: usa
-- client_markbox/supplier_name como identificadores textuales. Para resolver "qué
-- OV cumple la caja recibida" y para soportar parcial + idempotencia, esta
-- migración agrega DOS enlaces a la recepción y DOS marcas de facturación a la
-- prealerta:
--
--   1. warehouse_receipts_cn.prealerta_id  → caja física (prealerta) que esta
--      recepción materializa. Es el "escaneo de caja" que la Fase 1 dejó preparado
--      (getSalesOrderForPrealerta resuelve la OV desde la prealerta). FK SUAVE
--      nullable (on delete set null): una recepción puede no tener prealerta atada
--      (caja huérfana / recepción sin compra previa) → en ese caso NO se factura.
--   2. warehouse_receipts_cn.sales_order_id → OV resuelta (denormalizada al
--      confirmar). Redundante con prealerta→OV pero barata para queries de
--      provenance y para el guard. FK SUAVE nullable (on delete set null).
--   3. prealertas.invoice_id  → la factura que YA cubrió esta caja. != null ⇒ caja
--      facturada ⇒ NUNCA se vuelve a facturar (idempotencia por prealerta). El
--      guard anti-race reclama la caja con UPDATE ... WHERE invoice_id IS NULL
--      ANTES de postear la factura. FK SUAVE nullable (on delete set null: si se
--      borra la factura, la caja vuelve a ser facturable — caso anulación/borrado).
--   4. prealertas.invoiced_at → timestamp de cuándo se facturó (auditoría/visual).
--   5. invoices.sales_order_id → provenance: la factura sabe de qué OV viene. FK
--      SUAVE nullable (on delete set null), mismo criterio que Fase 1 (no acopla).
--
-- Las FK son "suaves" (constraint real pero on delete set null, sin cascade) =
-- mismo criterio que 0124/0125 para no romper documentos contables si se borra el
-- documento de origen. invoices.sales_order_id apunta a una tabla que YA existe
-- (sales_orders, 0125) → puede llevar constraint FK real.
--
-- ⚠️ Número de migración: 0126 (primer libre tras 0125). Reusa next_invoice_code
--    (0077) y postInvoiceJournalEntry (0040) desde la capa de aplicación — esta
--    migración NO los redefine.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. invoices.sales_order_id · provenance OV → Factura      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- La factura nace de una OV (Fase 2). FK real a sales_orders (la entidad existe en
-- 0125). on delete set null para no romper la factura si se borra la OV.
alter table public.invoices
  add column if not exists sales_order_id uuid references public.sales_orders(id) on delete set null;

comment on column public.invoices.sales_order_id is
  'SDD-0072 Fase 2: Orden de venta (OV-) que originó esta factura (auto-facturación en la confirmación de Warehouse). Nullable: la mayoría de las facturas no nacen de una OV (facturación manual / por embarque). on delete set null para no romper la factura si se borra la OV.';

create index if not exists invoices_sales_order_id_fk_idx
  on public.invoices (sales_order_id) where sales_order_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. warehouse_receipts_cn · puente recepción → caja → OV   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- prealerta_id: la caja física (prealerta, 0105) que esta recepción materializa.
-- FK suave nullable (on delete set null): recepción huérfana o sin compra previa.
alter table public.warehouse_receipts_cn
  add column if not exists prealerta_id uuid references public.prealertas(id) on delete set null;

comment on column public.warehouse_receipts_cn.prealerta_id is
  'SDD-0072 Fase 2: caja física (prealerta, 0105) que esta recepción materializa — el "escaneo de caja" que resuelve la Orden de venta (getSalesOrderForPrealerta). Nullable: recepción huérfana / sin compra previa → no dispara facturación. on delete set null.';

-- sales_order_id: OV resuelta, denormalizada al confirmar (provenance + queries).
alter table public.warehouse_receipts_cn
  add column if not exists sales_order_id uuid references public.sales_orders(id) on delete set null;

comment on column public.warehouse_receipts_cn.sales_order_id is
  'SDD-0072 Fase 2: Orden de venta (OV-) resuelta para esta recepción (denormalizada al confirmar desde prealerta→OV). Redundante con prealerta.sales_order_id pero barata para provenance/guard. Nullable. on delete set null.';

create index if not exists warehouse_receipts_cn_prealerta_id_fk_idx
  on public.warehouse_receipts_cn (prealerta_id) where prealerta_id is not null;
create index if not exists warehouse_receipts_cn_sales_order_id_fk_idx
  on public.warehouse_receipts_cn (sales_order_id) where sales_order_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. prealertas · marca de facturación (idempotencia)       ║
-- ╚═══════════════════════════════════════════════════════════╝
-- invoice_id: la factura que YA cubrió esta caja. != null ⇒ caja facturada ⇒ no se
-- re-factura. El guard reclama la caja con UPDATE ... WHERE invoice_id IS NULL antes
-- de postear. FK suave nullable (on delete set null: anular/borrar la factura
-- devuelve la caja al pool facturable).
alter table public.prealertas
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

comment on column public.prealertas.invoice_id is
  'SDD-0072 Fase 2: factura (0021) que YA cubrió esta caja física. != null ⇒ facturada ⇒ NUNCA se re-factura (idempotencia por caja). El guard anti-race reclama la caja con UPDATE ... WHERE invoice_id IS NULL antes de postear. on delete set null (anular la factura la devuelve al pool facturable).';

alter table public.prealertas
  add column if not exists invoiced_at timestamptz;

comment on column public.prealertas.invoiced_at is
  'SDD-0072 Fase 2: cuándo se facturó esta caja (auditoría/visual). Se setea junto con invoice_id.';

create index if not exists prealertas_invoice_id_fk_idx
  on public.prealertas (invoice_id) where invoice_id is not null;

-- ─────────────────────────────────────────────────────────────
-- Notas RLS/grants: las tres tablas (invoices, prealertas, warehouse_receipts_cn)
-- YA tienen RLS habilitado y políticas por tenant; las columnas aditivas heredan esa
-- protección (no se necesitan policies nuevas). Los grants de tabla (select/insert/
-- update/delete a authenticated + all a service_role) ya cubren las columnas nuevas.
-- El motor de facturación corre con admin client (service_role) igual que el asiento
-- contable y el audit log — la RLS por tenant la garantiza el filtro explícito por
-- tenant_id en la capa de aplicación.
-- ─────────────────────────────────────────────────────────────
-- Fin migración 0126_sales_order_invoicing.sql
-- Aplicar con: supabase migration apply 0126 · o MCP apply_migration
-- ─────────────────────────────────────────────────────────────
