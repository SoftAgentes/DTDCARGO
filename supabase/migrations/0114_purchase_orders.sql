-- ─────────────────────────────────────────────────────────────
-- SDD-0063 · Orden de compra de DTD (Purchase Order · compra asistida)
--
-- Sub-SDD de 0061 Fase D (lado COMPRAS). Construye la OC de DTD: cuando DTD
-- COMPRA la mercancía POR el cliente (agente de compra · "compra asistida"),
-- registra qué le compra al proveedor → al recibir genera el Bill (0044).
-- Cierra la simetría QB: ventas (Orden de venta → Factura) ↔ compras
-- (Orden de compra → Bill).
--
-- Tablas nuevas:
--   purchase_orders       · OC-YYYY-NNNN · proveedor + costo + status + bill_id
--   purchase_order_items  · líneas de la OC (descripción + qty + costo unit)
--
-- + RPC next_purchase_order_code (OC-YYYY-NNNN, cuenta solo 'OC-%', padding 4,
--   patrón next_estimate_code 0113 / next_bill_code 0088).
-- + RLS fail-closed por tenant_id (patrón get_user_tenant_id, 0088/0096).
-- + GRANTS explícitos (auto-expose OFF) + FK indexes (patrón 0013).
--
-- Aditiva: NO toca tablas existentes. Sin seed (las OC son data operativa real).
--   · supplier_id  → suppliers_cn (0105, proveedores chinos del cliente). NULLABLE.
--     OJO: suppliers_cn ≠ suppliers (PRV-, 0088, vendors que DTD paga). El Bill
--     se atará a un suppliers (Tesorería) que la action resuelve al recibir.
--   · supplier_name → texto libre (proveedor sin ficha en suppliers_cn).
--   · sales_order_id → FK SUAVE (uuid sin FK): la entidad Orden de venta NO existe
--     aún (sub-SDD hermano). Queda nullable y sin constraint hasta entonces.
--   · bill_id → FK a supplier_bills(id) on delete set null (link al Bill generado).
--
-- ⚠️ Número de migración: 0114 (verificado libre tras 0113). NO se aplica a prod
--    desde acá (lo hace el founder). Reusa get_user_tenant_id() (0001),
--    touch_updated_at() (0002).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. purchase_orders · OC de DTD (OC-YYYY-NNNN)             ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.purchase_orders (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  purchase_order_code text not null,                                       -- "OC-2026-0001"
  client_markbox      text,                                                -- MARKBOX del cliente por cuya cuenta se compra (nullable)
  supplier_id         uuid references public.suppliers_cn(id) on delete set null,  -- proveedor chino del cliente (0105, nullable)
  supplier_name       text,                                                -- proveedor libre cuando no hay ficha (nullable)
  sales_order_id      uuid,                                                -- FK FUTURA → orden de venta (entidad no existe aún; sin constraint)
  status              text not null default 'borrador'
    check (status in ('borrador','confirmada','recibida','facturada','cerrada','cancelada')),
  total_cost_usd      numeric(14,2) not null default 0,                    -- costo total en USD (suma de ítems)
  bill_id             uuid references public.supplier_bills(id) on delete set null,  -- Bill (0044) que generó al recibir
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (tenant_id, purchase_order_code)
);

comment on table public.purchase_orders is
  'SDD-0063: Orden de compra de DTD (OC-YYYY-NNNN). DTD compra mercancía POR el cliente (compra asistida) → al recibir genera el Bill (0044, bill_id). supplier_id → suppliers_cn (proveedor chino del cliente, NO el suppliers PRV- de Tesorería). sales_order_id = FK suave (la Orden de venta no existe aún). status borrador→confirmada→recibida→facturada→cerrada · cancelada. Soft delete via deleted_at. RLS por tenant_id.';

comment on column public.purchase_orders.sales_order_id is
  'SDD-0063: FK FUTURA a la Orden de venta que la originó (drop-ship). Sin constraint porque la entidad no existe todavía (sub-SDD hermano). Nullable: una OC puede nacer standalone (lead "Compra asistida" de Kommo).';

comment on column public.purchase_orders.bill_id is
  'SDD-0063: Bill (supplier_bills, 0044) generado al recibir la OC. Link bidireccional: la OC apunta al Bill que generó. on delete set null para no romper la OC si se anula el Bill.';

create index purchase_orders_tenant_status_idx
  on public.purchase_orders (tenant_id, status) where deleted_at is null;

-- ── FK indexes (patrón 0013: Postgres no auto-indexea FK columns) ──
create index purchase_orders_tenant_id_fk_idx
  on public.purchase_orders (tenant_id) where deleted_at is null;
create index purchase_orders_supplier_id_fk_idx
  on public.purchase_orders (supplier_id) where deleted_at is null and supplier_id is not null;
create index purchase_orders_bill_id_fk_idx
  on public.purchase_orders (bill_id) where bill_id is not null;
create index purchase_orders_sales_order_id_idx
  on public.purchase_orders (sales_order_id) where sales_order_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. purchase_order_items · líneas de la OC                 ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  purchase_order_id  uuid not null references public.purchase_orders(id) on delete cascade,
  description        text not null,
  qty                numeric(12,3) not null default 1,
  unit_cost_usd      numeric(14,2) not null default 0,
  position           int not null default 0,                              -- orden de la línea en la OC
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.purchase_order_items is
  'SDD-0063: líneas de una Orden de compra de DTD. qty * unit_cost_usd = costo de la línea; la suma alimenta purchase_orders.total_cost_usd. on delete cascade (se van con la OC). RLS por tenant_id.';

create index purchase_order_items_po_id_fk_idx
  on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_tenant_id_fk_idx
  on public.purchase_order_items (tenant_id);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. RPC next_purchase_order_code · OC-YYYY-NNNN            ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Counter por año + tenant (patrón next_estimate_code 0113 / next_bill_code 0088).
-- Cuenta SOLO los códigos 'OC-' del año. Padding 4; se extiende solo > 9999.
create or replace function public.next_purchase_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year   int := extract(year from current_date);
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(purchase_order_code, '^OC-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.purchase_orders
  where tenant_id = p_tenant_id
    and purchase_order_code like 'OC-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'OC-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_purchase_order_code is
  'SDD-0063: genera el próximo purchase_order_code OC-YYYY-NNNN para el tenant del año actual (solo cuenta códigos OC-).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3b. entity_audit_log · + 'purchase_order' al CHECK        ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Las acciones sensibles de la OC (crear/editar/cambiar estado/recibir→Bill)
-- escriben en el audit genérico con actor_type='user'. Aditivo: re-arma el
-- CHECK con el nuevo entity_type (patrón 0088). Idempotente.
do $$
begin
  alter table public.entity_audit_log drop constraint if exists entity_audit_log_entity_type_check;
  alter table public.entity_audit_log
    add constraint entity_audit_log_entity_type_check
    check (entity_type in (
      'shipment',
      'dispatch_order',
      'dispatch_order_package',
      'warehouse_receipt_cn',
      'warehouse_receipt_ve',
      'invoice',
      'journal_entry',
      'account',
      'payment_receipt',
      'supplier',
      'supplier_bill',
      'supplier_payment',
      'purchase_order'
    ));
end $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. GRANTS EXPLÍCITOS (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.purchase_orders      to authenticated;
grant select, insert, update, delete on public.purchase_order_items to authenticated;

grant all on public.purchase_orders      to service_role;
grant all on public.purchase_order_items to service_role;

grant execute on function public.next_purchase_order_code(uuid) to authenticated;
grant execute on function public.next_purchase_order_code(uuid) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. RLS · fail-closed por tenant_id (patrón 0088/0096)     ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_items enable row level security;

-- purchase_orders
create policy "purchase_orders by tenant"
  on public.purchase_orders for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "purchase_orders service_role all"
  on public.purchase_orders for all to service_role using (true) with check (true);

-- purchase_order_items
create policy "purchase_order_items by tenant"
  on public.purchase_order_items for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "purchase_order_items service_role all"
  on public.purchase_order_items for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. Triggers updated_at                                    ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger purchase_orders_touch
  before update on public.purchase_orders
  for each row execute function public.touch_updated_at();

create trigger purchase_order_items_touch
  before update on public.purchase_order_items
  for each row execute function public.touch_updated_at();
