-- ─────────────────────────────────────────────────────────────
-- SDD-0005 Fase 2: schema completo de envios + eventos
-- Productos comerciales DTD (4) + estados (13) + tablas + RLS + grants
-- ─────────────────────────────────────────────────────────────

-- Productos comerciales que DTD vende
create type shipment_service as enum (
  'consolidacion',          -- LCL tradicional: cliente paga aduana
  'puerta_a_puerta_DDP',    -- DDP prepago: DTD asume todo
  'reserva_FCL',            -- Container completo
  'transporte_terrestre'    -- Ground VE interno
);

-- Estados (13 totales, aplicabilidad por servicio en lib/studio/shipment-state-machine.ts)
create type shipment_status as enum (
  'draft',
  'in_warehouse',
  'consolidating',
  'shipped',
  'in_transit',
  'in_customs',
  'arrived_destination',
  'delayed_warehouse',
  'out_for_delivery',
  'last_mile',
  'delivered',
  'exception',
  'cancelled'
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  client_name text,
  client_markbox text,                          -- DTD-XXXX (futuro link a clients)
  origin text,
  destination text,
  shipment_service shipment_service not null,
  status shipment_status not null default 'draft',
  weight_kg numeric(10,2),
  volume_m3 numeric(10,3),
  vehicle_category text,                        -- 'contenedor_maritimo' | 'camion_chico' | etc.
  vehicle_model text,                           -- 'Ford 350', 'Gandola 40 ton', etc.
  arrived_destination_at timestamptz,           -- para calcular bodegaje
  cancellation_reason text,
  notes text,
  deleted_at timestamptz,                       -- soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

comment on table public.shipments is 'Envios del tenant. Soft delete via deleted_at. RLS por tenant_id.';

create index shipments_tenant_status_idx
  on public.shipments (tenant_id, status)
  where deleted_at is null;

create index shipments_tenant_service_idx
  on public.shipments (tenant_id, shipment_service)
  where deleted_at is null;

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status shipment_status not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.shipment_events is 'Timeline de eventos por envio. Cada cambio de status genera una fila.';

create index shipment_events_shipment_idx
  on public.shipment_events (shipment_id, occurred_at desc)
  where deleted_at is null;

-- GRANTS EXPLICITOS (leccion aprendida del SDD-0004 fix de 42501)
grant select, insert, update, delete on public.shipments to authenticated;
grant select, insert, update, delete on public.shipment_events to authenticated;

-- RLS por tenant
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;

create policy "shipments by tenant"
  on public.shipments for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "shipment_events by tenant"
  on public.shipment_events for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger shipments_touch
  before update on public.shipments
  for each row execute function public.touch_updated_at();

-- Trigger arrived_destination_at: dispara el reloj del bodegaje cuando el envio
-- entra al estado arrived_destination por primera vez
create or replace function public.set_arrived_destination_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'arrived_destination'
     and (old.status is null or old.status <> 'arrived_destination')
     and new.arrived_destination_at is null then
    new.arrived_destination_at = now();
  end if;
  return new;
end; $$;

create trigger shipments_arrived_at
  before insert or update on public.shipments
  for each row execute function public.set_arrived_destination_at();
