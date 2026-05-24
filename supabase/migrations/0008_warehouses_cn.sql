-- ─────────────────────────────────────────────────────────────
-- SDD-0016: Almacén CN — recepción de mercadería en hubs chinos
-- 3 tablas + enum estado + enum tipo evento + RLS + seed 5 hubs
-- Reusa get_user_tenant_id() y touch_updated_at() de migrations previas
-- ─────────────────────────────────────────────────────────────

-- Estados operativos de una recepción
create type warehouse_receipt_status as enum (
  'pendiente_consolidacion',
  'consolidado',
  'incidencia'
);

-- Tipos de evento del timeline
create type warehouse_receipt_event_type as enum (
  'received',
  'consolidated',
  'incident',
  'note',
  'status_change'
);

-- ─────────────────────────────────────────────────────────────
-- Catálogo de hubs físicos en CN
-- NO tiene tenant_id — los hubs son ubicaciones físicas compartidas
-- a nivel sistema (hoy solo DTD; cuando llegue HailuWay multi-tenant,
-- los hubs siguen siendo globales).
-- ─────────────────────────────────────────────────────────────
create table public.warehouses_cn (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,              -- 'YIW-A1'
  hub_code        text not null,                     -- 'YIW' (para agrupar/prefix)
  hub_name_es     text not null,                     -- 'Yiwu'
  hub_name_cn     text not null,                     -- '义乌'
  warehouse_name  text,                              -- 'A1 · 义乌港二期 (directo)'
  city            text,                              -- 'Yiwu, Zhejiang'
  address         text,                              -- dirección completa
  active          boolean not null default true,
  display_order   int not null default 0,            -- orden en dropdowns
  created_at      timestamptz not null default now()
);

comment on table public.warehouses_cn is
  'Catálogo global de hubs CN (Yiwu, Guangzhou, Shenzhen, Shanghai). Sin tenant_id - son ubicaciones físicas compartidas.';

create index warehouses_cn_hub_active_idx
  on public.warehouses_cn (hub_code, display_order) where active = true;

-- ─────────────────────────────────────────────────────────────
-- Recepciones (1 row = 1 caja física que llegó al hub)
-- ─────────────────────────────────────────────────────────────
create table public.warehouse_receipts_cn (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  receipt_code                text not null,                    -- 'WR-2026-0001' o 'SIN-CODIGO-0042'
  warehouse_id                uuid not null references public.warehouses_cn(id) on delete restrict,
  -- Cliente (nullable cuando es huérfana)
  client_markbox              text,                             -- 'DTD-1001'
  client_name                 text,                             -- snapshot al momento
  -- Caja huérfana (cuando no se conoce el cliente)
  is_orphan                   boolean not null default false,
  orphan_marks                text,                             -- 'ACINDAR-VLN-04 · ⌂ rojo'
  orphan_brought_by           text,                             -- nombre chofer/courier
  orphan_suspected_client     text,                             -- sospecha
  -- Supplier (bilingüe con 2 campos planos)
  supplier_name               text,                             -- texto original (CN o ES)
  supplier_name_translated    text,                             -- traducción (nullable)
  -- Totales (manuales, no se derivan de items V1)
  boxes                       int not null default 0 check (boxes >= 0),
  total_cbm                   numeric(10,3),
  total_weight_kg             numeric(10,2),
  -- Estado
  status                      warehouse_receipt_status not null default 'pendiente_consolidacion',
  shipment_id                 uuid references public.shipments(id) on delete set null,  -- al consolidar
  -- Fechas y meta
  received_at                 date not null default current_date,
  notes                       text,
  deleted_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (tenant_id, receipt_code)
);

comment on table public.warehouse_receipts_cn is
  'Recepciones de mercadería en hubs CN. Cada row = 1 caja física que llegó. Soft delete via deleted_at. RLS por tenant_id.';

create index warehouse_receipts_cn_tenant_status_idx
  on public.warehouse_receipts_cn (tenant_id, status) where deleted_at is null;

create index warehouse_receipts_cn_tenant_warehouse_idx
  on public.warehouse_receipts_cn (tenant_id, warehouse_id) where deleted_at is null;

create index warehouse_receipts_cn_tenant_markbox_idx
  on public.warehouse_receipts_cn (tenant_id, client_markbox) where deleted_at is null and client_markbox is not null;

create index warehouse_receipts_cn_tenant_received_idx
  on public.warehouse_receipts_cn (tenant_id, received_at desc) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- Items (multi-HS code por recepción)
-- Soporta cajas mixtas con N productos distintos.
-- ─────────────────────────────────────────────────────────────
create table public.warehouse_receipt_items (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  receipt_id              uuid not null references public.warehouse_receipts_cn(id) on delete cascade,
  description             text not null,                        -- 'Cargadores USB-C'
  description_translated  text,                                 -- traducción CN/ES (nullable)
  hs_code                 text,                                 -- '8517.12.10'
  quantity                int check (quantity is null or quantity >= 0),
  unit_value_usd          numeric(10,2),
  notes                   text,
  position                int not null default 0,               -- orden de display
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.warehouse_receipt_items is
  'Items de una recepción (multi-HS code por caja). Cascade delete con el receipt padre.';

create index warehouse_receipt_items_receipt_idx
  on public.warehouse_receipt_items (receipt_id, position);

-- ─────────────────────────────────────────────────────────────
-- Eventos timeline
-- ─────────────────────────────────────────────────────────────
create table public.warehouse_receipt_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  receipt_id   uuid not null references public.warehouse_receipts_cn(id) on delete cascade,
  event_type   warehouse_receipt_event_type not null,
  description  text,
  occurred_at  timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.warehouse_receipt_events is
  'Timeline de eventos por recepción: recibido, consolidado, incidencia, nota, cambio de status.';

create index warehouse_receipt_events_receipt_idx
  on public.warehouse_receipt_events (receipt_id, occurred_at desc) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- Funciones de generación de códigos (patrón next_*_code)
-- ─────────────────────────────────────────────────────────────

-- Receipt code normal: WR-YYYY-NNNN (counter por año + tenant)
create or replace function public.next_receipt_code(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(receipt_code, '^WR-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.warehouse_receipts_cn
  where tenant_id = p_tenant_id
    and receipt_code like 'WR-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'WR-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_receipt_code is
  'Genera el próximo receipt_code WR-YYYY-NNNN para el tenant del año actual.';

-- Orphan code: SIN-CODIGO-NNNN (sin año, counter histórico por tenant)
create or replace function public.next_orphan_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(receipt_code, '^SIN-CODIGO-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.warehouse_receipts_cn
  where tenant_id = p_tenant_id
    and receipt_code like 'SIN-CODIGO-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'SIN-CODIGO-' || v_padded;
end;
$$;

comment on function public.next_orphan_code is
  'Genera el próximo código SIN-CODIGO-NNNN para cajas huérfanas (sin MARKBOX conocido) del tenant.';

-- ─────────────────────────────────────────────────────────────
-- GRANTS EXPLÍCITOS (auto-expose new tables OFF)
-- ─────────────────────────────────────────────────────────────
grant select on public.warehouses_cn to authenticated;
grant select, insert, update, delete on public.warehouse_receipts_cn to authenticated;
grant select, insert, update, delete on public.warehouse_receipt_items to authenticated;
grant select, insert, update, delete on public.warehouse_receipt_events to authenticated;
grant execute on function public.next_receipt_code(uuid) to authenticated;
grant execute on function public.next_orphan_code(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.warehouses_cn enable row level security;
alter table public.warehouse_receipts_cn enable row level security;
alter table public.warehouse_receipt_items enable row level security;
alter table public.warehouse_receipt_events enable row level security;

-- warehouses_cn: catálogo global, todos los autenticados ven los activos
create policy "warehouses_cn select to all authenticated"
  on public.warehouses_cn for select
  to authenticated
  using (active = true);

-- receipts: por tenant
create policy "warehouse_receipts_cn by tenant"
  on public.warehouse_receipts_cn for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- items: por tenant (cascade-like, mismo tenant que el receipt padre)
create policy "warehouse_receipt_items by tenant"
  on public.warehouse_receipt_items for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- events: por tenant
create policy "warehouse_receipt_events by tenant"
  on public.warehouse_receipt_events for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- ─────────────────────────────────────────────────────────────
-- Triggers updated_at (reusa touch_updated_at de SDD-0005)
-- ─────────────────────────────────────────────────────────────
create trigger warehouse_receipts_cn_touch
  before update on public.warehouse_receipts_cn
  for each row execute function public.touch_updated_at();

create trigger warehouse_receipt_items_touch
  before update on public.warehouse_receipt_items
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Seed: 5 hubs CN del Brand Book / JSX de referencia
-- ─────────────────────────────────────────────────────────────
insert into public.warehouses_cn
  (code, hub_code, hub_name_es, hub_name_cn, warehouse_name, city, address, display_order)
values
  ('YIW-A1', 'YIW', 'Yiwu',      '义乌', 'A1 · 义乌港二期 (directo)',        'Yiwu, Zhejiang',      '义乌港国际物流二期 A1, 浙江省义乌市',           10),
  ('YIW-A2', 'YIW', 'Yiwu',      '义乌', 'A2 · 义乌港二期 (transferencia)',  'Yiwu, Zhejiang',      '义乌港国际物流二期 A2, 浙江省义乌市',           20),
  ('CAN-C1', 'CAN', 'Guangzhou', '广州', 'C1 · 南沙',                         'Guangzhou, Guangdong','南沙保税仓 C1区, 广东省广州市南沙区',            30),
  ('SZX-A2', 'SZX', 'Shenzhen',  '深圳', 'A2 · 盐田',                         'Shenzhen, Guangdong', '盐田港综合保税区 A2号库, 广东省深圳市',         40),
  ('SHA-A1', 'SHA', 'Shanghai',  '上海', 'A1 · 浦东',                         'Shanghai',            '浦东外高桥物流园区 A1库, 上海市浦东新区',        50)
on conflict (code) do nothing;
