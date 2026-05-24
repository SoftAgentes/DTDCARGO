-- ─────────────────────────────────────────────────────────────
-- SDD-0008: catálogo de tarifas por servicio + ruta
-- Tabla rates + RLS por tenant + grants explícitos + seed con 6 rutas DTD
-- Reusa shipment_service enum (4 productos comerciales) y touch_updated_at()
-- ─────────────────────────────────────────────────────────────

create table public.rates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  service      shipment_service not null,    -- reusa enum de 0002_shipments.sql
  origin       text not null,
  destination  text not null,
  per_cbm      numeric(10,2),                -- LCL: precio por CBM
  flat_rate    numeric(10,2),                -- FCL: tarifa cerrada del contenedor
  min_charge   numeric(10,2),
  transit_days int,
  valid_until  date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  check (per_cbm is not null or flat_rate is not null)
);

comment on table public.rates is
  'Catálogo de tarifas por servicio + ruta. Soft delete via deleted_at. RLS por tenant_id.';

create index rates_tenant_service_idx
  on public.rates (tenant_id, service)
  where deleted_at is null;

create index rates_tenant_valid_idx
  on public.rates (tenant_id, valid_until)
  where deleted_at is null;

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF en este proyecto Supabase)
grant select, insert, update, delete on public.rates to authenticated;

-- RLS por tenant
alter table public.rates enable row level security;

create policy "rates by tenant"
  on public.rates for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at (reusa function existente de 0002_shipments.sql)
create trigger rates_touch
  before update on public.rates
  for each row execute function public.touch_updated_at();

-- Seed: 6 rutas DTD reales (Yiwu/Guangzhou/Shenzhen → VE + 1 terrestre VE)
insert into public.rates (tenant_id, service, origin, destination, per_cbm, flat_rate, min_charge, transit_days, valid_until, notes)
select t.id, x.service, x.origin, x.destination, x.per_cbm, x.flat_rate, x.min_charge, x.transit_days, x.valid_until, x.notes
from public.tenants t
cross join (values
  ('consolidacion'::shipment_service,        'Yiwu',      'Valencia',        480.00,  null,    380.00, 38, '2026-12-31'::date, 'LCL DDP estándar Yiwu-Valencia'),
  ('consolidacion'::shipment_service,        'Guangzhou', 'Valencia',        520.00,  null,    400.00, 42, '2026-12-31'::date, 'LCL DDP Guangzhou-Valencia'),
  ('puerta_a_puerta_DDP'::shipment_service,  'Yiwu',      'Caracas',         550.00,  null,    450.00, 40, '2026-12-31'::date, 'DDP prepago Yiwu-Caracas con last mile'),
  ('reserva_FCL'::shipment_service,          'Guangzhou', 'La Guaira',       null,    8500.00, null,   35, '2026-12-31'::date, 'FCL 40 HC Guangzhou-La Guaira'),
  ('reserva_FCL'::shipment_service,          'Shenzhen',  'Puerto Cabello',  null,    7800.00, null,   38, '2026-12-31'::date, 'FCL 40 estándar Shenzhen-Puerto Cabello'),
  ('transporte_terrestre'::shipment_service, 'Valencia',  'Maracaibo',       null,    650.00,  null,    2, '2026-12-31'::date, 'Camión chico Valencia-Maracaibo')
) as x(service, origin, destination, per_cbm, flat_rate, min_charge, transit_days, valid_until, notes)
where t.slug = 'dtd'
on conflict do nothing;
