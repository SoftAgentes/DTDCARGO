-- ─────────────────────────────────────────────────────────────
-- SDD-0047 · Naviera & Consolidación — Slice A (foundation)
--
-- Cierra el único ❌ del cruce entidad↔tabla: la entidad `Container`
-- no existía. Modela la naviera como objeto propio:
--   carriers            · navieras (COSCO/Maersk/MSC/Evergreen)
--   ports               · puertos CN/VE (PK por tenant: tenant_id+code)
--   container_types     · catálogo 20GP/40GP/40HC (cbm/kg útil)
--   sailings            · itinerarios (vessel/voyage/POL/POD/ETD/ETA/cutoff)
--   bookings            · reservas de espacio (BKG-YYYY-NNNN) + bl_number
--   consolidations      · = el `Container` del blueprint (DTD-CONSOL-NNNN)
--   consolidation_items · piezas LCL asignadas (FK opcional → shipments)
--
-- + RPCs next_booking_code (BKG-YYYY-NNNN) + next_consolidation_ref
--   (DTD-CONSOL-NNNN), patrón next_quote_code (0007) / next_supplier_code (0088).
-- + RLS fail-closed por tenant_id (patrón get_user_tenant_id, 0090/0088).
-- + Seed idempotente: ports (6 del Norte) + container_types (3) tenant dtd.
--
-- Aditiva: NO toca tablas existentes. La única FK saliente es
-- consolidation_items.shipment_id → shipments(id) (nullable, on delete set null).
-- Reusa get_user_tenant_id() (0001) + touch_updated_at() (0002).
--
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder).
-- Número de migración: 0096 (siguiente libre tras 0095).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. CARRIERS · navieras                                    ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.carriers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,                          -- 'COSCO Shipping Lines'
  name_cn     text,                                   -- '中远海运'
  scac        text,                                   -- 'COSU' (standard carrier alpha code)
  tone        text not null default 'neutral',        -- badge tone (wine/info/success/neutral…)
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

comment on table public.carriers is
  'SDD-0047: navieras (carriers). Entidad operativa de itinerarios; el pago del flete va por suppliers/supplier_bills de Tesorería (cruce por nombre en V1). Soft delete via deleted_at. RLS por tenant_id.';

create index carriers_tenant_active_idx
  on public.carriers (tenant_id, active) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. PORTS · puertos (PK por tenant: tenant_id + code)      ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.ports (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  code        text not null,                          -- 'NGB' (UN/LOCODE corto)
  name        text not null,                          -- 'Ningbo'
  name_cn     text,                                   -- '宁波'
  country     text not null default 'CN',             -- CN/VE
  created_at  timestamptz not null default now(),
  unique (tenant_id, code)
);

comment on table public.ports is
  'SDD-0047: puertos CN/VE, tenant-scoped (PK lógica tenant_id+code). Seed con los 6 del Norte (NGB/YTN/SHA/NSA/PBL/LGU). RLS por tenant_id.';

create index ports_tenant_country_idx
  on public.ports (tenant_id, country);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. CONTAINER_TYPES · catálogo de capacidad útil           ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Tenant-scoped con seed default (multi-tenant ready). `code` es la clave
-- de negocio (20GP/40GP/40HC) → unique por tenant.
create table public.container_types (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  code          text not null,                        -- '20GP' / '40GP' / '40HC'
  label         text not null,                        -- "20' GP"
  cbm_capacity  numeric(10,3) not null,               -- 33 / 67 / 76
  kg_capacity   numeric(12,2) not null,               -- 28000 / 26500
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  unique (tenant_id, code)
);

comment on table public.container_types is
  'SDD-0047: catálogo de tipos de contenedor (capacidad útil cbm/kg). Tenant-scoped con seed default 20GP/40GP/40HC. RLS por tenant_id.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. SAILINGS · itinerarios                                 ║
-- ╚═══════════════════════════════════════════════════════════╝
-- status según fecha (abierto/cutoff/zarpado/transito/arribado).
-- space = disponibilidad de espacio reportada (alta/media/baja/cerrada).
-- pol/pod son códigos de puerto (texto, no FK dura: tolera puertos ad-hoc).
create table public.sailings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  carrier_id    uuid references public.carriers(id) on delete set null,
  vessel        text not null,                        -- 'COSCO FORTUNE'
  voyage        text,                                 -- '048W'
  pol           text not null,                        -- 'NGB' (port of loading)
  pod           text not null,                        -- 'PBL' (port of discharge)
  etd           date,                                 -- estimated time of departure
  eta           date,                                 -- estimated time of arrival
  cutoff        date,                                 -- cargo cut-off
  transit_days  int,
  status        text not null default 'abierto',      -- abierto/cutoff/zarpado/transito/arribado
  space         text not null default 'alta',         -- alta/media/baja/cerrada
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table public.sailings is
  'SDD-0047: itinerarios (zarpes). status/space según fecha y disponibilidad. pol/pod = códigos de puerto (texto). V1 manuales (scraping = Slice C). RLS por tenant_id.';

create index sailings_tenant_status_idx
  on public.sailings (tenant_id, status) where deleted_at is null;

create index sailings_tenant_carrier_idx
  on public.sailings (tenant_id, carrier_id) where deleted_at is null;

create index sailings_tenant_etd_idx
  on public.sailings (tenant_id, etd) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. BOOKINGS · reservas de espacio                         ║
-- ╚═══════════════════════════════════════════════════════════╝
-- code BKG-YYYY-NNNN (RPC next_booking_code). bl_number nullable (se captura
-- manual cuando la naviera lo emite, Slice B). mode FCL/LCL.
create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  code           text not null,                       -- 'BKG-2026-0001'
  carrier_id     uuid references public.carriers(id) on delete set null,
  sailing_id     uuid references public.sailings(id) on delete set null,
  bl_number      text,                                -- 'COSU6620041X' (nullable)
  container_type text,                                -- '40HC' (code de container_types)
  mode           text not null default 'LCL',         -- FCL/LCL
  shipper        text,                                -- 'DTD-Cargo Consol'
  commodity      text,                                -- 'Carga consolidada'
  status         text not null default 'abierto',     -- abierto/solicitado/confirmado/cerrado/zarpado/transito
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (tenant_id, code)
);

comment on table public.bookings is
  'SDD-0047: reservas de espacio (BKG-YYYY-NNNN). bl_number se captura manual cuando la naviera lo emite (BL como PDF = Slice C). RLS por tenant_id.';

create index bookings_tenant_status_idx
  on public.bookings (tenant_id, status) where deleted_at is null;

create index bookings_tenant_sailing_idx
  on public.bookings (tenant_id, sailing_id) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. CONSOLIDATIONS · el `Container` del blueprint          ║
-- ╚═══════════════════════════════════════════════════════════╝
-- ref DTD-CONSOL-NNNN (RPC next_consolidation_ref). Un contenedor que agrupa
-- carga LCL. status consolidando/cerrado/zarpado/arribado.
create table public.consolidations (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  ref            text not null,                       -- 'DTD-CONSOL-0502'
  booking_id     uuid references public.bookings(id) on delete set null,
  sailing_id     uuid references public.sailings(id) on delete set null,
  container_type text,                                -- '40HC' (code de container_types)
  status         text not null default 'consolidando', -- consolidando/cerrado/zarpado/arribado
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (tenant_id, ref)
);

comment on table public.consolidations is
  'SDD-0047: contenedor de consolidación (= entidad Container del blueprint, DTD-CONSOL-NNNN). Agrupa N piezas LCL (consolidation_items). status consolidando→cerrado→zarpado→arribado. RLS por tenant_id.';

create index consolidations_tenant_status_idx
  on public.consolidations (tenant_id, status) where deleted_at is null;

create index consolidations_tenant_booking_idx
  on public.consolidations (tenant_id, booking_id) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. CONSOLIDATION_ITEMS · piezas LCL asignadas             ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Una fila = un embarque LCL asignado a un contenedor. shipment_id FK opcional
-- (nullable on delete set null) → el embarque suelto que se metió. cbm/weight/
-- pieces son los valores con los que se midió el aporte de ese embarque.
-- Snapshot legible (markbox/client) para la barra de utilización sin join.
create table public.consolidation_items (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  consolidation_id  uuid not null references public.consolidations(id) on delete cascade,
  shipment_id       uuid references public.shipments(id) on delete set null,
  client_markbox    text,                             -- 'DTD-5418' (snapshot)
  client_name       text,                             -- snapshot legible
  supplier_name     text,                             -- snapshot
  cbm               numeric(10,3) not null default 0,
  weight_kg         numeric(12,2) not null default 0,
  pieces            int not null default 0,
  created_at        timestamptz not null default now()
);

comment on table public.consolidation_items is
  'SDD-0047: piezas LCL asignadas a un contenedor. Una fila = un embarque suelto. shipment_id FK opcional. cbm/weight_kg/pieces alimentan la utilización (containerStats). RLS por tenant_id.';

create index consolidation_items_consolidation_idx
  on public.consolidation_items (consolidation_id);

create index consolidation_items_shipment_idx
  on public.consolidation_items (shipment_id) where shipment_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 8. RPCs · next_booking_code + next_consolidation_ref      ║
-- ╚═══════════════════════════════════════════════════════════╝

-- BKG-YYYY-NNNN: counter por año + tenant (patrón next_quote_code).
create or replace function public.next_booking_code(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(code, '^BKG-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.bookings
  where tenant_id = p_tenant_id
    and code like 'BKG-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'BKG-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_booking_code is
  'SDD-0047: genera el próximo code BKG-YYYY-NNNN para el tenant del año actual.';

-- DTD-CONSOL-NNNN: counter plano (sin año) por tenant (patrón next_supplier_code).
create or replace function public.next_consolidation_ref(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(ref, '^DTD-CONSOL-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.consolidations
  where tenant_id = p_tenant_id;

  v_padded := lpad(v_max::text, 4, '0');
  return 'DTD-CONSOL-' || v_padded;
end;
$$;

comment on function public.next_consolidation_ref is
  'SDD-0047: genera el próximo ref DTD-CONSOL-NNNN (correlativo plano, padding 4) para el tenant.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 9. GRANTS EXPLÍCITOS (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.carriers            to authenticated;
grant select, insert, update, delete on public.ports               to authenticated;
grant select, insert, update, delete on public.container_types     to authenticated;
grant select, insert, update, delete on public.sailings            to authenticated;
grant select, insert, update, delete on public.bookings            to authenticated;
grant select, insert, update, delete on public.consolidations      to authenticated;
grant select, insert, update, delete on public.consolidation_items to authenticated;

grant all on public.carriers            to service_role;
grant all on public.ports               to service_role;
grant all on public.container_types     to service_role;
grant all on public.sailings            to service_role;
grant all on public.bookings            to service_role;
grant all on public.consolidations      to service_role;
grant all on public.consolidation_items to service_role;

grant execute on function public.next_booking_code(uuid)       to authenticated;
grant execute on function public.next_consolidation_ref(uuid)  to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 10. RLS · fail-closed por tenant_id (patrón 0090/0088)    ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.carriers            enable row level security;
alter table public.ports               enable row level security;
alter table public.container_types     enable row level security;
alter table public.sailings            enable row level security;
alter table public.bookings            enable row level security;
alter table public.consolidations      enable row level security;
alter table public.consolidation_items enable row level security;

-- carriers
create policy "carriers by tenant"
  on public.carriers for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "carriers service_role all"
  on public.carriers for all to service_role using (true) with check (true);

-- ports (catálogo tenant-scoped, sin soft-delete)
create policy "ports by tenant"
  on public.ports for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "ports service_role all"
  on public.ports for all to service_role using (true) with check (true);

-- container_types (catálogo tenant-scoped, sin soft-delete)
create policy "container_types by tenant"
  on public.container_types for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "container_types service_role all"
  on public.container_types for all to service_role using (true) with check (true);

-- sailings
create policy "sailings by tenant"
  on public.sailings for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "sailings service_role all"
  on public.sailings for all to service_role using (true) with check (true);

-- bookings
create policy "bookings by tenant"
  on public.bookings for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "bookings service_role all"
  on public.bookings for all to service_role using (true) with check (true);

-- consolidations
create policy "consolidations by tenant"
  on public.consolidations for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "consolidations service_role all"
  on public.consolidations for all to service_role using (true) with check (true);

-- consolidation_items
create policy "consolidation_items by tenant"
  on public.consolidation_items for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "consolidation_items service_role all"
  on public.consolidation_items for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 11. TRIGGERS updated_at (reusa touch_updated_at de 0002)  ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger carriers_touch
  before update on public.carriers
  for each row execute function public.touch_updated_at();

create trigger sailings_touch
  before update on public.sailings
  for each row execute function public.touch_updated_at();

create trigger bookings_touch
  before update on public.bookings
  for each row execute function public.touch_updated_at();

create trigger consolidations_touch
  before update on public.consolidations
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 12. SEED · ports (6 del Norte) + container_types (3)      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Tenant-scoped al tenant dtd (resolución por slug, patrón 0005/0006/0011).
-- Idempotente vía on conflict (tenant_id, code) do nothing.

insert into public.ports (tenant_id, code, name, name_cn, country)
select t.id, x.code, x.name, x.name_cn, x.country
from (values
  ('NGB', 'Ningbo',         '宁波', 'CN'),
  ('YTN', 'Yantian',        '盐田', 'CN'),
  ('SHA', 'Shanghai',       '上海', 'CN'),
  ('NSA', 'Nansha',         '南沙', 'CN'),
  ('PBL', 'Puerto Cabello', null,   'VE'),
  ('LGU', 'La Guaira',      null,   'VE')
) as x(code, name, name_cn, country)
cross join public.tenants t
where t.slug = 'dtd'
on conflict (tenant_id, code) do nothing;

insert into public.container_types (tenant_id, code, label, cbm_capacity, kg_capacity, display_order)
select t.id, x.code, x.label, x.cbm_capacity, x.kg_capacity, x.display_order
from (values
  ('20GP', '20'' GP', 33::numeric, 28000::numeric, 10),
  ('40GP', '40'' GP', 67::numeric, 26500::numeric, 20),
  ('40HC', '40'' HC', 76::numeric, 26500::numeric, 30)
) as x(code, label, cbm_capacity, kg_capacity, display_order)
cross join public.tenants t
where t.slug = 'dtd'
on conflict (tenant_id, code) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0096_naviera_consolidacion.sql
-- Aplicar con: supabase migration apply 0096 · o MCP apply_migration
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
