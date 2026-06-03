-- ─────────────────────────────────────────────────────────────
-- SDD-0053 · Costing & Margen — Slice A (foundation)
--
-- Construye el lado COSTO del Bloque 5 (Finanzas), simétrico al revenue que
-- ya modela Facturación (0021). Dos piezas:
--   · shipment_costs       = costo editable por embarque, 1 fila × embarque,
--                            7 categorías USD (freight/customs/transport/
--                            handling/insurance/commission/other).
--   · route_cost_templates = defaults de costo por ruta + servicio
--                            (origin + destination + shipment_service) que
--                            pre-llenan el costeo de un embarque nuevo. El CRUD
--                            y el auto-prefill son Slice C; acá solo la tabla +
--                            helpers de match (en lib/studio/costing).
--
-- + RLS fail-closed por tenant_id (patrón get_user_tenant_id, 0096/0098).
-- + Validación de integridad cross-tenant en la DB (lección [[0045]] / 0093):
--   helper shipment_in_tenant() + trigger shipment_costs_validate_shipment
--   BEFORE INSERT OR UPDATE → un cliente PostgREST directo no puede adjuntar
--   un costo a un embarque de otro tenant / inexistente (la action no es la
--   única defensa).
--
-- Aditiva: NO toca tablas existentes. FK salientes: shipment_id → shipments(id)
-- (on delete cascade — el costo no sobrevive al embarque). Reusa
-- get_user_tenant_id() (0001) + touch_updated_at() (0002).
--
-- Costos en USD canónico; el toggle VES es solo display (lib/studio/costing),
-- NO se persiste en VES. Sin RPC (no hay correlativos). Sin seed.
--
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder).
-- Número de migración: 0100 (0099 lo tomó el carril de tarifas; este es el siguiente libre).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. SHIPMENT_COSTS · costo editable por embarque (1:1)     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- 1 fila por embarque (unique tenant_id + shipment_id). Las 7 columnas son el
-- desglose USD que el operador edita en el Cost Editor (Slice B). Sin fila → el
-- embarque se computa con costo 0 (lib/studio/costing).
create table public.shipment_costs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  shipment_id   uuid not null references public.shipments(id) on delete cascade,
  freight       numeric(14,2) not null default 0,   -- flete naviera
  customs       numeric(14,2) not null default 0,   -- aduana SENIAT
  transport     numeric(14,2) not null default 0,   -- transporte VE
  handling      numeric(14,2) not null default 0,   -- handling CN
  insurance     numeric(14,2) not null default 0,   -- seguro de carga
  commission    numeric(14,2) not null default 0,   -- comisión comercial
  other         numeric(14,2) not null default 0,   -- otros
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (tenant_id, shipment_id)
);

comment on table public.shipment_costs is
  'SDD-0053: costo editable por embarque (1 fila × embarque). 7 categorías USD canónico (VES es display, no se persiste). Sin fila → costo 0. Soft delete via deleted_at. RLS por tenant_id.';

create index shipment_costs_tenant_shipment_idx
  on public.shipment_costs (tenant_id, shipment_id) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. ROUTE_COST_TEMPLATES · defaults de costo por ruta      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- origin + destination + shipment_service (enum 0002) → 7 defaults USD que
-- pre-llenan el costeo de un embarque nuevo de esa combinación. Partial unique
-- por (tenant, origin, destination, service) entre los vivos.
create table public.route_cost_templates (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  name              text not null,
  origin            text,
  destination       text,
  shipment_service  shipment_service,
  freight           numeric(14,2) not null default 0,
  customs           numeric(14,2) not null default 0,
  transport         numeric(14,2) not null default 0,
  handling          numeric(14,2) not null default 0,
  insurance         numeric(14,2) not null default 0,
  commission        numeric(14,2) not null default 0,
  other             numeric(14,2) not null default 0,
  active            boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.route_cost_templates is
  'SDD-0053: defaults de costo por ruta (origin + destination + shipment_service) → 7 categorías USD. Pre-llenan el costeo de un embarque nuevo (auto-prefill = Slice C). Soft delete via deleted_at. RLS por tenant_id.';

create unique index route_cost_templates_route_uniq
  on public.route_cost_templates (tenant_id, origin, destination, shipment_service)
  where deleted_at is null;

create index route_cost_templates_tenant_active_idx
  on public.route_cost_templates (tenant_id, active) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. VALIDACIÓN cross-tenant en DB (lección [[0045]] / 0093)║
-- ╚═══════════════════════════════════════════════════════════╝
-- Helper: ¿el embarque existe y es del tenant? (null → true). SECURITY DEFINER
-- para no depender del grant SELECT de shipments al rol caller; el filtro por
-- tenant_id es explícito (el trigger pasa NEW.tenant_id, que RLS ya forzó =
-- tenant del caller) → no hay fuga cross-tenant.
create or replace function public.shipment_in_tenant(
  p_shipment uuid,
  p_tenant   uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_shipment is null then
    return true;
  end if;
  return exists (
    select 1 from public.shipments
    where id = p_shipment and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

-- Trigger: rechaza shipment_id de otro tenant o inexistente. Cubre PostgREST
-- directo, no sólo la server action (saveShipmentCosts de Slice B).
create or replace function public.shipment_costs_validate_shipment()
returns trigger
language plpgsql
as $$
begin
  if not public.shipment_in_tenant(new.shipment_id, new.tenant_id) then
    raise exception 'embarque inexistente o ajeno al tenant: %', new.shipment_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists shipment_costs_validate_shipment_trg on public.shipment_costs;
create trigger shipment_costs_validate_shipment_trg
  before insert or update on public.shipment_costs
  for each row execute function public.shipment_costs_validate_shipment();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. GRANTS EXPLÍCITOS (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.shipment_costs to authenticated;
grant all on public.shipment_costs to service_role;

grant select, insert, update, delete on public.route_cost_templates to authenticated;
grant all on public.route_cost_templates to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. RLS · fail-closed por tenant_id (patrón 0096/0098)     ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.shipment_costs enable row level security;

create policy "shipment_costs by tenant"
  on public.shipment_costs for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "shipment_costs service_role all"
  on public.shipment_costs for all to service_role using (true) with check (true);

alter table public.route_cost_templates enable row level security;

create policy "route_cost_templates by tenant"
  on public.route_cost_templates for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "route_cost_templates service_role all"
  on public.route_cost_templates for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. TRIGGERS updated_at (reusa touch_updated_at de 0002)   ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger shipment_costs_touch
  before update on public.shipment_costs
  for each row execute function public.touch_updated_at();

create trigger route_cost_templates_touch
  before update on public.route_cost_templates
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0100_costing.sql
-- Aplicar con: supabase migration apply 0100 · o MCP apply_migration
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
