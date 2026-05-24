-- ─────────────────────────────────────────────────────────────
-- SDD-0019: TMS · Transporte interno VE
-- 4 tablas (trucks, drivers, routes, incidents) + 4 enums + RLS + seed
-- Integración con shipments via routes.shipment_id FK
-- ─────────────────────────────────────────────────────────────

create type truck_status as enum (
  'disponible',
  'cargando',
  'en_ruta',
  'mantenimiento'
);

create type driver_status as enum (
  'disponible',
  'cargando',
  'en_ruta',
  'descanso'
);

create type tms_route_status as enum (
  'planificado',
  'en_ruta',
  'completado',
  'cancelado'
);

create type tms_incident_type as enum (
  'mantenimiento',
  'multa',
  'combustible',
  'accidente'
);

-- ─────────────────────────────────────────────────────────────
-- Drivers (creado primero porque trucks tiene FK driver_id)
-- ─────────────────────────────────────────────────────────────
create table public.tms_drivers (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  name                    text not null,
  cedula                  text,                                  -- 'V-12.345.678'
  phone                   text,
  email                   text,
  license_class           text,                                  -- 'A·B·C·D'
  license_expires         date,
  hub_code                text,                                  -- PBL/LGU/MAR/PFI
  exp_years               int default 0,
  rating                  numeric(2,1),                          -- 0.0 a 5.0
  trips_30d               int not null default 0,                -- denorm
  last_trip               date,
  address                 text,
  emergency_contact       text,
  safety_certified        boolean not null default false,
  status                  driver_status not null default 'disponible',
  notes                   text,
  deleted_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (tenant_id, cedula)
);

comment on table public.tms_drivers is
  'Choferes del TMS. RLS por tenant. Cédula única por tenant.';

create index tms_drivers_tenant_status_idx
  on public.tms_drivers (tenant_id, status) where deleted_at is null;
create index tms_drivers_tenant_hub_idx
  on public.tms_drivers (tenant_id, hub_code) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- Trucks
-- ─────────────────────────────────────────────────────────────
create table public.tms_trucks (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  plate               text not null,
  brand               text,
  vehicle_type        text,                                      -- "Semi 40'", "Furgón 24'"
  hub_code            text,                                      -- PBL/LGU/MAR/PFI
  owned               boolean not null default true,
  capacity_cbm        numeric(10,2),
  capacity_kg         numeric(10,2),
  driver_id           uuid references public.tms_drivers(id) on delete set null,
  km                  int not null default 0,
  fuel_type           text,
  consumption_km_l    numeric(5,2),
  next_service_at     date,
  status              truck_status not null default 'disponible',
  notes               text,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, plate)
);

comment on table public.tms_trucks is
  'Flota de camiones del tenant. driver_id puede ser null cuando está disponible sin asignar.';

create index tms_trucks_tenant_status_idx
  on public.tms_trucks (tenant_id, status) where deleted_at is null;
create index tms_trucks_tenant_hub_idx
  on public.tms_trucks (tenant_id, hub_code) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- Routes (1 ruta = 1 shipment, FK shipment_id NOT NULL)
-- ─────────────────────────────────────────────────────────────
create table public.tms_routes (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  route_code          text not null,                              -- R-YYYY-NNNN
  shipment_id         uuid not null references public.shipments(id) on delete cascade,
  truck_id            uuid references public.tms_trucks(id) on delete set null,
  driver_id           uuid references public.tms_drivers(id) on delete set null,
  stops               jsonb not null default '[]'::jsonb,
  distance_km         int,
  progress_pct        int not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  eta_at              timestamptz,
  status              tms_route_status not null default 'planificado',
  started_at          timestamptz,
  completed_at        timestamptz,
  cancellation_reason text,
  notes               text,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, route_code)
);

comment on table public.tms_routes is
  'Rutas de entrega del TMS. 1 ruta = 1 shipment. stops como JSONB para flexibilidad.';

create index tms_routes_tenant_status_idx
  on public.tms_routes (tenant_id, status) where deleted_at is null;
create index tms_routes_tenant_shipment_idx
  on public.tms_routes (tenant_id, shipment_id) where deleted_at is null;
create index tms_routes_tenant_truck_idx
  on public.tms_routes (tenant_id, truck_id) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- Incidents
-- ─────────────────────────────────────────────────────────────
create table public.tms_incidents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  incident_code       text not null,                              -- I-YYYY-NNNN
  truck_id            uuid references public.tms_trucks(id) on delete set null,
  route_id            uuid references public.tms_routes(id) on delete set null,
  incident_type       tms_incident_type not null,
  occurred_at         date not null default current_date,
  description         text,
  cost_usd            numeric(10,2) not null default 0,
  status              text not null default 'pendiente',          -- pendiente/pagado/resuelto
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, incident_code)
);

comment on table public.tms_incidents is
  'Incidencias y costos de la flota (mantenimientos, multas, combustible, accidentes).';

create index tms_incidents_tenant_type_idx
  on public.tms_incidents (tenant_id, incident_type);
create index tms_incidents_tenant_occurred_idx
  on public.tms_incidents (tenant_id, occurred_at desc);
create index tms_incidents_truck_idx
  on public.tms_incidents (truck_id);

-- ─────────────────────────────────────────────────────────────
-- Funciones de generación de códigos
-- ─────────────────────────────────────────────────────────────
create or replace function public.next_route_code(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(route_code, '^R-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.tms_routes
  where tenant_id = p_tenant_id
    and route_code like 'R-' || v_year || '-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'R-' || v_year || '-' || v_padded;
end;
$$;

create or replace function public.next_incident_code(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(incident_code, '^I-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.tms_incidents
  where tenant_id = p_tenant_id
    and incident_code like 'I-' || v_year || '-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'I-' || v_year || '-' || v_padded;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Triggers de timestamps de ruta
-- ─────────────────────────────────────────────────────────────
create or replace function public.tms_route_status_timestamps()
returns trigger language plpgsql as $$
begin
  -- Auto-set started_at cuando pasa a en_ruta
  if new.status = 'en_ruta' and (old.status is null or old.status <> 'en_ruta')
     and new.started_at is null then
    new.started_at = now();
  end if;
  -- Auto-set completed_at cuando pasa a completado
  if new.status = 'completado' and (old.status is null or old.status <> 'completado')
     and new.completed_at is null then
    new.completed_at = now();
  end if;
  return new;
end; $$;

create trigger tms_routes_timestamps
  before insert or update on public.tms_routes
  for each row execute function public.tms_route_status_timestamps();

-- ─────────────────────────────────────────────────────────────
-- GRANTS
-- ─────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.tms_drivers to authenticated;
grant select, insert, update, delete on public.tms_trucks to authenticated;
grant select, insert, update, delete on public.tms_routes to authenticated;
grant select, insert, update, delete on public.tms_incidents to authenticated;
grant execute on function public.next_route_code(uuid) to authenticated;
grant execute on function public.next_incident_code(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.tms_drivers enable row level security;
alter table public.tms_trucks enable row level security;
alter table public.tms_routes enable row level security;
alter table public.tms_incidents enable row level security;

create policy "tms_drivers by tenant"
  on public.tms_drivers for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "tms_trucks by tenant"
  on public.tms_trucks for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "tms_routes by tenant"
  on public.tms_routes for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "tms_incidents by tenant"
  on public.tms_incidents for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- ─────────────────────────────────────────────────────────────
-- Triggers updated_at (reusan touch_updated_at)
-- ─────────────────────────────────────────────────────────────
create trigger tms_drivers_touch
  before update on public.tms_drivers
  for each row execute function public.touch_updated_at();

create trigger tms_trucks_touch
  before update on public.tms_trucks
  for each row execute function public.touch_updated_at();

create trigger tms_routes_touch
  before update on public.tms_routes
  for each row execute function public.touch_updated_at();

create trigger tms_incidents_touch
  before update on public.tms_incidents
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Seed: 3 drivers + 3 trucks (mock baseline para testear)
-- Asociado al tenant DTD (slug 'dtd')
-- ─────────────────────────────────────────────────────────────
insert into public.tms_drivers
  (tenant_id, name, cedula, phone, license_class, license_expires, hub_code, exp_years, rating, trips_30d, last_trip, safety_certified, status)
select t.id, x.name, x.cedula, x.phone, x.license_class, x.license_expires::date, x.hub_code, x.exp_years, x.rating, x.trips_30d, x.last_trip::date, x.safety_certified, x.status::driver_status
from public.tenants t
cross join (values
  ('Carlos Ramírez Mendoza',  'V-15.342.881', '+58 412 884 5521', 'A·B·C·D',   '2028-04-15', 'PBL', 12, 4.9, 18, '2026-05-22', true, 'disponible'),
  ('Mariela Suárez Pérez',    'V-18.557.412', '+58 414 555 8821', 'A·B·C·D·E', '2027-09-30', 'LGU', 8,  4.7, 14, '2026-05-21', true, 'disponible'),
  ('José Fernández Castro',   'V-12.998.341', '+58 416 778 2233', 'A·B·C',     '2026-12-10', 'MAR', 15, 4.8, 22, '2026-05-23', true, 'descanso')
) as x(name, cedula, phone, license_class, license_expires, hub_code, exp_years, rating, trips_30d, last_trip, safety_certified, status)
where t.slug = 'dtd'
on conflict (tenant_id, cedula) do nothing;

insert into public.tms_trucks
  (tenant_id, plate, brand, vehicle_type, hub_code, owned, capacity_cbm, capacity_kg, km, fuel_type, consumption_km_l, next_service_at, status)
select t.id, x.plate, x.brand, x.vehicle_type, x.hub_code, x.owned, x.capacity_cbm, x.capacity_kg, x.km, x.fuel_type, x.consumption_km_l, x.next_service_at::date, x.status::truck_status
from public.tenants t
cross join (values
  ('AB123CD', 'Volvo FH 460',      'Semi 40''',    'PBL', true,  76.0, 30000.0, 124500, 'Diesel',     8.5, '2026-08-15', 'disponible'),
  ('XY789ZW', 'Mercedes Atego',    'Furgón 24''',  'LGU', true,  42.0, 14000.0, 87300,  'Diesel',     10.2,'2026-09-22', 'disponible'),
  ('TR456PQ', 'Iveco Daily 70C',   'Camión 350',   'MAR', false, 18.0, 6500.0,  192400, 'Diesel',     11.5,'2026-06-10', 'mantenimiento')
) as x(plate, brand, vehicle_type, hub_code, owned, capacity_cbm, capacity_kg, km, fuel_type, consumption_km_l, next_service_at, status)
where t.slug = 'dtd'
on conflict (tenant_id, plate) do nothing;
