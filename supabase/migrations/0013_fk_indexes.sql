-- ─────────────────────────────────────────────────────────────
-- DTD-ERPv1-DIA3 audit fix continuation
--   FINDING-004 (MEDIUM) — 19 FK columns sin covering index
--
-- Postgres no auto-indexea FK columns. Cada FK sin index:
--   1. Hace seq scan en JOIN (10-100x mas lento)
--   2. Bloquea la tabla padre en ON DELETE CASCADE / SET NULL
--
-- Estrategia:
--   - `if not exists` para idempotencia
--   - Partial `where deleted_at is null` en tablas con soft delete
--   - Partial `where X is not null` en FKs nullable para ahorrar espacio
--   - Nombres: <table>_<column>_fk_idx
--
-- Drop-in. No toca data. Reversible con `drop index if exists ...`.
-- ─────────────────────────────────────────────────────────────

-- shipment_events: soft delete + tenant_id + created_by (FK auth.users nullable)
create index if not exists shipment_events_tenant_id_fk_idx
  on public.shipment_events (tenant_id) where deleted_at is null;
create index if not exists shipment_events_created_by_fk_idx
  on public.shipment_events (created_by) where deleted_at is null and created_by is not null;

-- quotes: soft delete + FK rate_used_id (nullable) + converted_to_shipment_id (nullable)
create index if not exists quotes_rate_used_id_fk_idx
  on public.quotes (rate_used_id) where deleted_at is null and rate_used_id is not null;
create index if not exists quotes_converted_to_shipment_id_fk_idx
  on public.quotes (converted_to_shipment_id) where deleted_at is null and converted_to_shipment_id is not null;

-- customs_filings: soft delete + agent_id (nullable) + shipment_id (not null)
create index if not exists customs_filings_agent_id_fk_idx
  on public.customs_filings (agent_id) where deleted_at is null and agent_id is not null;
create index if not exists customs_filings_shipment_id_fk_idx
  on public.customs_filings (shipment_id) where deleted_at is null;

-- customs_documents: NO soft delete + tenant_id + uploaded_by (nullable)
create index if not exists customs_documents_tenant_id_fk_idx
  on public.customs_documents (tenant_id);
create index if not exists customs_documents_uploaded_by_fk_idx
  on public.customs_documents (uploaded_by) where uploaded_by is not null;

-- warehouse_receipts_cn: soft delete + shipment_id (nullable) + warehouse_id (not null)
create index if not exists warehouse_receipts_cn_shipment_id_fk_idx
  on public.warehouse_receipts_cn (shipment_id) where deleted_at is null and shipment_id is not null;
create index if not exists warehouse_receipts_cn_warehouse_id_fk_idx
  on public.warehouse_receipts_cn (warehouse_id) where deleted_at is null;

-- warehouse_receipt_items: NO soft delete + tenant_id
create index if not exists warehouse_receipt_items_tenant_id_fk_idx
  on public.warehouse_receipt_items (tenant_id);

-- warehouse_receipt_events: soft delete + tenant_id + created_by (nullable)
create index if not exists warehouse_receipt_events_tenant_id_fk_idx
  on public.warehouse_receipt_events (tenant_id) where deleted_at is null;
create index if not exists warehouse_receipt_events_created_by_fk_idx
  on public.warehouse_receipt_events (created_by) where deleted_at is null and created_by is not null;

-- tms_trucks: soft delete + driver_id (nullable)
create index if not exists tms_trucks_driver_id_fk_idx
  on public.tms_trucks (driver_id) where deleted_at is null and driver_id is not null;

-- tms_routes: soft delete + driver_id (nullable) + shipment_id + truck_id
-- Los composite (tenant_id, shipment_id|truck_id) NO sirven para FK lookup standalone
-- porque tenant_id es la primera columna del index.
create index if not exists tms_routes_driver_id_fk_idx
  on public.tms_routes (driver_id) where deleted_at is null and driver_id is not null;
create index if not exists tms_routes_shipment_id_fk_idx
  on public.tms_routes (shipment_id) where deleted_at is null;
create index if not exists tms_routes_truck_id_fk_idx
  on public.tms_routes (truck_id) where deleted_at is null and truck_id is not null;

-- tms_incidents: NO soft delete + route_id (nullable)
create index if not exists tms_incidents_route_id_fk_idx
  on public.tms_incidents (route_id) where route_id is not null;

-- user_tenants: NO soft delete + tenant_id (CASCADE delete del tenant)
create index if not exists user_tenants_tenant_id_fk_idx
  on public.user_tenants (tenant_id);

comment on index public.shipment_events_tenant_id_fk_idx is
  'Covering index para FK shipment_events.tenant_id (DIA3 audit FINDING-004)';
comment on index public.shipment_events_created_by_fk_idx is
  'Covering index para FK shipment_events.created_by';
comment on index public.quotes_rate_used_id_fk_idx is
  'Covering index para FK quotes.rate_used_id';
comment on index public.quotes_converted_to_shipment_id_fk_idx is
  'Covering index para FK quotes.converted_to_shipment_id';
comment on index public.customs_filings_agent_id_fk_idx is
  'Covering index para FK customs_filings.agent_id';
comment on index public.customs_filings_shipment_id_fk_idx is
  'Covering index para FK customs_filings.shipment_id';
comment on index public.customs_documents_tenant_id_fk_idx is
  'Covering index para FK customs_documents.tenant_id';
comment on index public.customs_documents_uploaded_by_fk_idx is
  'Covering index para FK customs_documents.uploaded_by';
comment on index public.warehouse_receipts_cn_shipment_id_fk_idx is
  'Covering index para FK warehouse_receipts_cn.shipment_id';
comment on index public.warehouse_receipts_cn_warehouse_id_fk_idx is
  'Covering index para FK warehouse_receipts_cn.warehouse_id';
comment on index public.warehouse_receipt_items_tenant_id_fk_idx is
  'Covering index para FK warehouse_receipt_items.tenant_id';
comment on index public.warehouse_receipt_events_tenant_id_fk_idx is
  'Covering index para FK warehouse_receipt_events.tenant_id';
comment on index public.warehouse_receipt_events_created_by_fk_idx is
  'Covering index para FK warehouse_receipt_events.created_by';
comment on index public.tms_trucks_driver_id_fk_idx is
  'Covering index para FK tms_trucks.driver_id';
comment on index public.tms_routes_driver_id_fk_idx is
  'Covering index para FK tms_routes.driver_id';
comment on index public.tms_routes_shipment_id_fk_idx is
  'Covering index para FK tms_routes.shipment_id (composite (tenant_id, shipment_id) no califica como FK index porque tenant_id va primero)';
comment on index public.tms_routes_truck_id_fk_idx is
  'Covering index para FK tms_routes.truck_id (composite (tenant_id, truck_id) no califica)';
comment on index public.tms_incidents_route_id_fk_idx is
  'Covering index para FK tms_incidents.route_id';
comment on index public.user_tenants_tenant_id_fk_idx is
  'Covering index para FK user_tenants.tenant_id (necesario para CASCADE delete del tenant)';
