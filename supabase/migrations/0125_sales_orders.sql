-- ─────────────────────────────────────────────────────────────
-- SDD-0072 · Orden de venta (Sales Order · modelo QuickBooks)
--
-- Sub-SDD de 0061 Fase D (lado VENTAS · gemela de 0071 Orden de compra).
-- La OV es el estimado CONFIRMADO y formal (distinto del estimado, que es
-- intención descartable): nodo de trazabilidad del QB y disparador (Fase 2) de
-- la facturación cuando la mercancía llega y Warehouse confirma.
-- Cierra la simetría QB: ventas (Estimado → Orden de venta → Factura) ↔ compras
-- (Orden de compra → Bill).
--
-- Tablas nuevas:
--   sales_orders · OV-YYYY-NNNN · snapshot editable del estimado + status + quote_id
--
-- + RPC next_sales_order_code (OV-YYYY-NNNN, cuenta solo 'OV-%', padding 4,
--   patrón next_quote_code 0007 / next_purchase_order_code 0124).
-- + RLS fail-closed por tenant_id (patrón get_user_tenant_id, 0124).
-- + GRANTS explícitos (auto-expose OFF) + FK indexes (patrón 0013).
--
-- Aditiva: NO toca tablas existentes salvo dos columnas aditivas nullable y la
-- extensión del CHECK de entity_audit_log. Sin DDL destructivo. Sin seed (las OV
-- son data operativa real).
--   · quote_id          → FK a quotes(id) on delete set null (el estimado que la
--     originó · NULLABLE: la OV puede nacer manual sin estimado · B2B/otros).
--   · client_markbox    → MARKBOX del cliente (lookup textual, sin FK · patrón quotes).
--   · snapshot editable → copia de los datos del estimado (cliente, totales USD,
--     origen/destino, servicio, notas) que el operador PUEDE editar tras convertir
--     (entre estimado y OV puede haber cambios · decisión §3.2).
--   · prealertas.sales_order_id → FK SUAVE aditiva nullable: una OV se cumple con
--     1+ prealertas físicas (§3.4). El escaneo de la caja en CN resuelve la OV.
--   · quotes.sales_order_id → columna aditiva nullable (uuid, SIN constraint FK
--     para no acoplar el orden de las migraciones): cierra el link BIDIRECCIONAL
--     OV↔estimado y marca el estimado como convertido. La OV→estimado va con FK
--     real (quote_id); el reverso queda como uuid suave (idéntico criterio que
--     0124 usó para purchase_orders.sales_order_id antes de que existiera la OV).
--
-- ⚠️ Número de migración: 0125 (primer libre tras 0124). NO se aplica a prod
--    desde acá (lo hace el founder). Reusa get_user_tenant_id() (0001),
--    touch_updated_at() (0002).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. sales_orders · OV de DTD (OV-YYYY-NNNN)                ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.sales_orders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  sales_order_code  text not null,                                      -- "OV-2026-0001"
  quote_id          uuid references public.quotes(id) on delete set null, -- estimado que la originó (nullable: OV manual)
  client_markbox    text,                                               -- MARKBOX del cliente (lookup textual, nullable)
  -- ── snapshot editable del estimado (copia al convertir · §3.2) ──
  client_name       text not null default '',                          -- nombre del cliente al momento
  service           shipment_service not null default 'consolidacion', -- reusa enum existente (0002)
  origin            text not null default '',
  destination       text not null default '',
  subtotal_usd      numeric(14,2) not null default 0,                  -- subtotal del estimado (snapshot, editable)
  total_usd         numeric(14,2) not null default 0,                  -- total del estimado (snapshot, editable)
  status            text not null default 'confirmada'
    check (status in ('confirmada','parcial','facturada','cerrada','cancelada')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (tenant_id, sales_order_code)
);

comment on table public.sales_orders is
  'SDD-0072: Orden de venta (OV-YYYY-NNNN). El estimado CONFIRMADO y formal (gemela de la OC 0124, lado ventas). quote_id → estimado que la originó (nullable: la OV puede ser manual sin estimado, B2B/otros). Snapshot editable de los datos del estimado (cliente, totales USD, origen/destino, servicio, notas): entre estimado y OV puede haber cambios. status confirmada→parcial→facturada→cerrada · cancelada. (Fase 2) la recepción de Warehouse con datos reales genera la Factura (0021, parcial por defecto). Soft delete via deleted_at. RLS por tenant_id.';

comment on column public.sales_orders.quote_id is
  'SDD-0072: estimado (quotes, EST-) que originó la OV. on delete set null para no romper la OV si se borra el estimado. Nullable: la OV puede nacer manual (B2B / otros servicios, sin estimado previo). Link bidireccional: el estimado apunta de vuelta vía quotes.sales_order_id.';

comment on column public.sales_orders.status is
  'SDD-0072: confirmada (recién creada/convertida) → parcial (facturada por lo recibido, 1 OV : N facturas) → facturada (completa) → cerrada · cancelada. parcial/facturada las pone el motor de facturación (Fase 2); manual: confirmada→cerrada/cancelada.';

create index sales_orders_tenant_status_idx
  on public.sales_orders (tenant_id, status) where deleted_at is null;

-- ── FK indexes (patrón 0013: Postgres no auto-indexea FK columns) ──
create index sales_orders_tenant_id_fk_idx
  on public.sales_orders (tenant_id) where deleted_at is null;
create index sales_orders_quote_id_fk_idx
  on public.sales_orders (quote_id) where quote_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. RPC next_sales_order_code · OV-YYYY-NNNN              ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Counter por año + tenant (patrón next_quote_code 0007 / next_purchase_order_code 0124).
-- Cuenta SOLO los códigos 'OV-' del año. Padding 4; se extiende solo > 9999.
create or replace function public.next_sales_order_code(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(sales_order_code, '^OV-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.sales_orders
  where tenant_id = p_tenant_id
    and sales_order_code like 'OV-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'OV-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_sales_order_code is
  'SDD-0072: genera el próximo sales_order_code OV-YYYY-NNNN para el tenant del año actual (solo cuenta códigos OV-).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Columnas aditivas en tablas existentes                ║
-- ╚═══════════════════════════════════════════════════════════╝
-- prealertas.sales_order_id · una OV se cumple con 1+ prealertas físicas (§3.4).
-- FK real a sales_orders(id) (la entidad ya existe en esta misma migración).
-- Nullable: una prealerta puede existir sin OV asociada (flujo de portal directo).
-- Idempotente (add column if not exists) por si un env la corrió a medias.
alter table public.prealertas
  add column if not exists sales_order_id uuid references public.sales_orders(id) on delete set null;

comment on column public.prealertas.sales_order_id is
  'SDD-0072: Orden de venta (OV-) que esta prealerta (caja física) cumple. Nullable: la prealerta puede nacer sin OV (portal directo). on delete set null para no romper la prealerta si se cancela la OV. El escaneo de la caja en CN resuelve la OV (query inversa getSalesOrderForPrealerta).';

create index if not exists prealertas_sales_order_id_fk_idx
  on public.prealertas (sales_order_id) where sales_order_id is not null;

-- quotes.sales_order_id · reverso del link bidireccional + marca de "convertido".
-- uuid SUAVE (sin constraint FK): evita acoplar el orden con sales_orders y replica
-- el criterio que 0124 usó para purchase_orders.sales_order_id. on delete: n/a (sin FK).
-- Nullable: la mayoría de los estimados nunca se convierten (intención descartable).
alter table public.quotes
  add column if not exists sales_order_id uuid;

comment on column public.quotes.sales_order_id is
  'SDD-0072: Orden de venta (OV-) en la que se convirtió este estimado (reverso del link sales_orders.quote_id). FK SUAVE (uuid sin constraint) para no acoplar el orden de migraciones, mismo criterio que purchase_orders.sales_order_id (0124). Nullable: la mayoría de estimados no se convierten (intención descartable); != null = ya convertido.';

create index if not exists quotes_sales_order_id_idx
  on public.quotes (sales_order_id) where deleted_at is null and sales_order_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. entity_audit_log · + 'sales_order' al CHECK           ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Las acciones sensibles de la OV (crear/convertir/editar/cambiar estado/
-- asignar prealerta) escriben en el audit genérico con actor_type='user'.
-- Aditivo: re-arma el CHECK con el nuevo entity_type (patrón 0124). Idempotente.
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
      'purchase_order',
      'sales_order'
    ));
end $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. GRANTS EXPLÍCITOS (auto-expose new tables OFF)        ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.sales_orders to authenticated;
grant all on public.sales_orders to service_role;

grant execute on function public.next_sales_order_code(uuid) to authenticated;
grant execute on function public.next_sales_order_code(uuid) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RLS · fail-closed por tenant_id (patrón 0124)         ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.sales_orders enable row level security;

create policy "sales_orders by tenant"
  on public.sales_orders for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "sales_orders service_role all"
  on public.sales_orders for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. Triggers updated_at                                   ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger sales_orders_touch
  before update on public.sales_orders
  for each row execute function public.touch_updated_at();
