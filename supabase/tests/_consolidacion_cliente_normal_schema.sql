-- SDD-0578: fixture sintético mínimo. NO EJECUTADO en P1.
-- Sin BEGIN/COMMIT: el contrato consumidor gobierna la transacción.
-- Base estructural/RLS/AUD real reutilizada del contrato0477, anterior a semilla.
do $fixture_guard$
begin
  if to_regclass('public.tenants') is not null or to_regclass('public.consolidations') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0477: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema auth, extensions to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.tenants (id uuid primary key);
-- Columnas de 0001/0019/0202 y el CHECK de roles de 0189.
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, warehouse_scope text not null default 'all',
  primary key (user_id, tenant_id),
  constraint user_tenants_role_check
  check (role in (
    'admin', 'commercial', 'operations',
    'accounting', 'warehouse', 'support', 'marketing'
  ))
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants"
  on public.user_tenants for select to authenticated
  using (user_id = (select auth.uid()) and disabled_at is null);

-- get_user_tenant_id() de 0453.
create or replace function public.get_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;

-- ── Envíos: enums de 0002 con los nombres de 0256 ───────────
create type public.shipment_service as enum (
  'consolidado_lcl', 'puerta_a_puerta_DDP', 'fcl_directo', 'transporte_terrestre', 'fcl_bodega'
);
create type public.shipment_status as enum (
  'draft', 'in_warehouse', 'consolidating', 'shipped', 'in_transit', 'in_customs',
  'arrived_destination', 'delayed_warehouse', 'out_for_delivery', 'last_mile',
  'delivered', 'exception', 'cancelled'
);
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  client_name text,
  client_markbox text,
  shipment_service public.shipment_service not null,
  status public.shipment_status not null default 'draft',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status public.shipment_status not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.shipments, public.shipment_events to authenticated;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
create policy "shipments by tenant" on public.shipments for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "shipment_events by tenant" on public.shipment_events for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- ── Contenedores: 0096 con ref nullable y las columnas de 0157/0322 ──
create table public.consolidations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ref text,
  container_type text,
  status text not null default 'consolidando',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, ref)
);
create table public.consolidation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  consolidation_id uuid not null references public.consolidations(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete set null,
  client_markbox text,
  client_name text,
  cbm numeric(10,3) not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.consolidations, public.consolidation_items to authenticated;
alter table public.consolidations enable row level security;
alter table public.consolidation_items enable row level security;
create policy "consolidations by tenant" on public.consolidations for all to authenticated
  using (tenant_id = public.get_user_tenant_id()) with check (tenant_id = public.get_user_tenant_id());
create policy "consolidation_items by tenant" on public.consolidation_items for all to authenticated
  using (tenant_id = public.get_user_tenant_id()) with check (tenant_id = public.get_user_tenant_id());

-- La matriz editable real (0357).
\ir ../migrations/0357_role_module_overrides.sql

-- Plataforma legacy mínima de 0267; esquema/constraints/writer v1 se instalan
-- desde las migraciones reales, no de una función de auditoría simulada.
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_actor_type_check check (actor_type in ('user', 'operario', 'system')),
  constraint entity_audit_log_entity_type_check check (entity_type in ('shipment'))
);
alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy entity_audit_log_service_role_all on public.entity_audit_log for all to service_role
  using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

-- Fundamentos de tipos/tabla; columnas adicionales sólo del contrato vigente.

-- Copia literal: supabase/migrations/0002_shipments.sql · function touch_updated_at · desde línea103
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;


\ir ../migrations/0008_warehouses_cn.sql

alter table public.user_tenants add column region text;
alter table public.shipments add column origin text, add column destination text, add column notes text,
  add column volume_m3 numeric(10,3), add column weight_kg numeric(10,2), add column arrived_destination_at timestamptz,
  add column cancellation_reason text;
\ir ../migrations/0009_shipment_delivery_pod.sql
-- El catálogo de contenedores es compartido con el motor vigente.
create table public.container_types(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
  code text not null,label text,cbm_capacity numeric(10,3),cbm_alert_ceiling numeric(10,3),usable_factor numeric(8,4) not null default 1,
  deleted_at timestamptz,unique(tenant_id,code));
alter table public.consolidations add column container_no text, add column requested_by_operario_id uuid,
  add column authorized_at timestamptz,add column authorized_by uuid;
alter table public.consolidation_items add column weight_kg numeric(10,2),add column pieces integer;
create type public.operario_region as enum ('cn','ve');
create table public.operario_pins(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
  region text not null,role text not null default 'bodeguero',roles text[] not null default array['bodeguero'],active boolean not null default true,
  warehouse_id uuid references public.warehouses_cn(id),display_name text,driver_id uuid);
alter table public.warehouse_receipts_cn add column created_by_operario_id uuid references public.operario_pins(id),
  add column prealerta_id uuid, add column description text,add column sales_order_id uuid;

-- Copia literal: supabase/tests/_0496_tarifa_congelada_schema.sql · table aliados · desde línea81
create table public.aliados (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_aliado_id uuid references public.aliados(id), deleted_at timestamptz
);


-- Copia literal: supabase/tests/_0496_tarifa_congelada_schema.sql · table clients · desde línea85
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  markbox text not null, name text not null, aliado_id uuid references public.aliados(id),
  deleted_at timestamptz, unique (tenant_id, markbox)
);


-- Copia literal: supabase/tests/_0496_tarifa_congelada_schema.sql · table price_books · desde línea94
create table public.price_books (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  aliado_id uuid references public.aliados(id), name text not null,
  is_house boolean not null default false, discount_pct numeric(5,2), base_per_cbm numeric(10,2),
  deleted_at timestamptz
);


-- Copia literal: supabase/tests/_0496_tarifa_congelada_schema.sql · table rates · desde línea100
create table public.rates (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  service public.shipment_service not null, origin text not null default 'Yiwu',
  destination text not null, per_cbm numeric(10,2), flat_rate numeric(10,2), min_charge numeric(10,2),
  valid_until date,
  price_book_id uuid references public.price_books(id) on delete restrict, deleted_at timestamptz
);


create type public.quote_status as enum ('draft','sent','accepted','rejected','expired');

-- Copia literal: supabase/tests/_0496_tarifa_congelada_schema.sql · table quotes · desde línea107
create table public.quotes (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  quote_code text not null, client_markbox text, service public.shipment_service not null,
  rate_per_cbm numeric(10,2), rate_used_id uuid references public.rates(id) on delete set null,
  status public.quote_status not null default 'draft', deleted_at timestamptz
);


-- Copia literal: supabase/tests/_0496_tarifa_congelada_schema.sql · function current_studio_role · desde línea61
create or replace function public.current_studio_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_tenants
  where user_id = (select auth.uid())
    and disabled_at is null
  limit 1
$$;


-- Copia literal: supabase/tests/_0496_tarifa_congelada_schema.sql · function resolve_price_book · desde línea121
create or replace function public.resolve_price_book(p_client_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  with recursive cliente as (
    select c.tenant_id, c.aliado_id
      from public.clients c
     where c.id = p_client_id
  ),
  cadena as (
    select a.id, a.parent_aliado_id, 1 as nivel
      from public.aliados a
      join cliente cl on cl.aliado_id = a.id
     where a.deleted_at is null
    union all
    select p.id, p.parent_aliado_id, c.nivel + 1
      from public.aliados p
      join cadena c on p.id = c.parent_aliado_id
     where p.deleted_at is null
       -- Tope de seguridad: el trigger anti-ciclo de la 0362 lo impide, pero una
       -- recursión sin freno en una función `stable` cuelga la sesión entera.
       and c.nivel < 10
  )
  select coalesce(
    (select pb.id
       from public.price_books pb
      where pb.deleted_at is null
        and pb.aliado_id in (select id from cadena where parent_aliado_id is null)
      limit 1),
    (select pb.id
       from public.price_books pb, cliente cl
      where pb.tenant_id = cl.tenant_id
        and pb.is_house
        and pb.deleted_at is null
      limit 1)
  );
$$;


create table public.suppliers_cn(id uuid primary key default gen_random_uuid(),name text);
create table public.prealertas(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
  code text,client_markbox text,supplier_id uuid references public.suppliers_cn(id),boxes integer not null default 0,
  status text not null default 'anunciada',received_at timestamptz,deleted_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.packing_list_submissions(id uuid primary key default gen_random_uuid(),tenant_id uuid,prealerta_id uuid,total_ctns numeric,
  is_current boolean,deleted_at timestamptz);
\ir ../migrations/0240_warehouse_boxes.sql
\ir ../migrations/0241_estiba_por_zonas.sql
\ir ../migrations/0243_warehouse_boxes_seq_partial_unique.sql
\ir ../migrations/0244_warehouse_boxes_predeclaradas.sql
\ir ../migrations/0246_estiba_por_lotes.sql
\ir ../migrations/0298_consolidation_plans.sql
\ir ../migrations/0299_estiba_plan_vs_real.sql
\ir ../migrations/0469_recepcion_codigo_wr.sql

create type customs_status as enum (
  'en_revision',
  'observacion',
  'liberacion',
  'pagado',
  'liberado'
);

create type customs_doc_type as enum (
  'commercial',
  'packing',
  'bl',
  'cert_origin',
  'sanitary',
  'dua',
  'payment'
);

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

create type dispatch_order_status as enum (
  'creada',
  'cargando',
  'lista',
  'en_ruta',
  'entregada',
  'cerrada',
  'cancelada'
);

create type dispatch_hub as enum (
  'valencia',
  'la_guaira',
  'punto_fijo',
  'maracaibo'
);

create type dispatch_payment_policy as enum (
  'estricto',
  'hold',
  'credito_whitelist'
);

create type dispatch_route_type as enum (
  'directa',
  'intermedias'
);

create type dispatch_split_reason as enum (
  'falta_volumen',
  'cliente_pidio_esperar',
  'dano_caja',
  'documentacion_pendiente',
  'otro'
);

create type dispatch_incident_severity as enum (
  'baja',
  'media',
  'alta',
  'critica'
);

-- Copia literal: supabase/migrations/0010_customs_seniat.sql · table customs_agents · desde línea31
create table public.customs_agents (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,            -- 'a-001' del JSX, legible
  name            text not null,
  rif             text,
  port_code       text,                            -- 'PBL', 'LGU', 'MAR', 'PFI'
  contact_name    text,
  phone           text,
  email           text,
  rating          numeric(2,1),                    -- 0.0 a 5.0
  shipments_count int not null default 0,          -- denorm, futura
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now()
);


-- Copia literal: supabase/migrations/0010_customs_seniat.sql · table customs_filings · desde línea56
create table public.customs_filings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  shipment_id     uuid not null references public.shipments(id) on delete cascade,
  dua_code        text not null,                              -- 'DUA-VE-2026-088421'
  port_code       text not null,                              -- snapshot
  agent_id        uuid references public.customs_agents(id) on delete set null,
  status          customs_status not null default 'en_revision',
  hs_codes        text[] not null default '{}',
  total_duty      numeric(12,2) not null default 0,
  igtf            numeric(12,2) not null default 0,
  iva             numeric(12,2) not null default 0,
  agent_fee       numeric(12,2) not null default 0,
  observations    text,
  alert           text,                                       -- nullable, si null no hay alerta
  arrived_at      date not null default current_date,
  cleared_at      date,                                       -- se setea al liberar
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, shipment_id),                            -- 1 filing por shipment
  unique (tenant_id, dua_code)
);


-- Copia literal: supabase/migrations/0010_customs_seniat.sql · table customs_documents · desde línea98
create table public.customs_documents (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  filing_id       uuid not null references public.customs_filings(id) on delete cascade,
  doc_type        customs_doc_type not null,
  uploaded        boolean not null default false,
  uploaded_at     timestamptz,
  uploaded_by     uuid references auth.users(id),
  file_url        text,                                       -- nullable hasta SDD Storage
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (filing_id, doc_type)
);


-- Copia literal: supabase/migrations/0011_tms_schema.sql · table tms_drivers · desde línea38
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


-- Copia literal: supabase/migrations/0011_tms_schema.sql · table tms_trucks · desde línea74
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


-- Copia literal: supabase/migrations/0011_tms_schema.sql · table tms_routes · desde línea108
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


-- Copia literal: supabase/migrations/0024_dispatch_core.sql · table dispatch_routes · desde línea258
create table public.dispatch_routes (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  route_code            text not null,                          -- 'R-002'
  name                  text not null,
  route_type            dispatch_route_type not null default 'directa',
  hub                   dispatch_hub not null,
  origin_city           text not null,
  destination_city      text not null,
  intermediate_cities   jsonb not null default '[]'::jsonb,     -- [{city, radius_km, order}]
  sla_hours             numeric not null check (sla_hours > 0),
  active                boolean not null default true,
  notes                 text,
  created_by            uuid,
  updated_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  unique (tenant_id, route_code)
);


-- Copia literal: supabase/migrations/0024_dispatch_core.sql · table dispatch_city_catalog · desde línea294
create table public.dispatch_city_catalog (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  state_code          text not null,
  state_name          text not null,
  municipio           text not null,
  city                text not null,
  postal_code         text,
  default_radius_km   numeric not null default 5,
  is_hq               boolean not null default false,
  active              boolean not null default true,
  usage_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, state_code, city)
);


-- Copia literal: supabase/migrations/0024_dispatch_core.sql · table dispatch_rules · desde línea322
create table public.dispatch_rules (
  tenant_id              uuid primary key references public.tenants (id) on delete cascade,
  payment_policy         dispatch_payment_policy not null default 'estricto',
  whitelist_markboxes    text[] not null default '{}',
  weights                jsonb not null default jsonb_build_object(
                           'valencia', 40,
                           'full_pay', 30,
                           'partial_pay', 15,
                           'fifo', 15,
                           'vip', 10,
                           'route_proximity', 5
                         ),
  optional_rules         jsonb not null default jsonb_build_object(
                           'tier', false,
                           'routes', true
                         ),
  vip_markboxes          text[] not null default '{}',
  updated_by             uuid,
  updated_at             timestamptz not null default now()
);


-- Copia literal: supabase/migrations/0024_dispatch_core.sql · table dispatch_orders · desde línea350
create table public.dispatch_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants (id) on delete cascade,
  order_code               text not null,                                   -- 'OD-2026-0142'
  status                   dispatch_order_status not null default 'creada',
  hub                      dispatch_hub not null,

  -- Assignment (todos required al crear)
  route_id                 uuid references public.dispatch_routes (id),
  truck_id                 uuid references public.tms_trucks (id),
  driver_id                uuid references public.tms_drivers (id),

  -- Capacity snapshots (al crear · auditable post-cambio en TMS)
  capacity_kg_snapshot     numeric,
  capacity_cbm_snapshot    numeric,

  -- Totals (aggregate del junction)
  total_kg                 numeric not null default 0,
  total_cbm                numeric not null default 0,
  package_count            int not null default 0,

  -- Cities visit order
  cities_ordered           text[] not null default '{}',

  -- Lifecycle
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  departed_at              timestamptz,
  completed_at             timestamptz,
  closed_at                timestamptz,
  cancelled_at             timestamptz,
  reassigned_at            timestamptz,

  -- Progress runtime (lo escribe el camionero en SDD-0030)
  progress_pct             int not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  current_city             text,

  -- Cancel + Splits
  cancel_reason            text,
  parent_od_id             uuid references public.dispatch_orders (id),     -- si es P2

  -- Audit
  created_by               uuid,
  updated_by               uuid,
  cancelled_by             uuid,

  unique (tenant_id, order_code)
);


-- Copia literal: supabase/migrations/0024_dispatch_core.sql · table dispatch_order_packages · desde línea421
create table public.dispatch_order_packages (
  od_id              uuid not null references public.dispatch_orders (id) on delete cascade,
  package_kind       text not null check (package_kind in ('warehouse_receipt_cn', 'warehouse_receipt_ve')),
  package_id         uuid not null,                                         -- FK polimórfico (FK explícito en SDD-0030)
  markbox            text not null,
  client_name        text not null,
  city               text not null,
  pay                text not null check (pay in ('pagado', 'parcial', 'pendiente')),
  description        text,
  boxes_total        int not null check (boxes_total > 0),
  boxes_shipped      int not null check (boxes_shipped > 0 and boxes_shipped <= boxes_total),
  weight_kg          numeric not null,
  cbm                numeric not null,
  hs_code            text,
  aes_code           text,
  split_reason       dispatch_split_reason,
  split_reason_text  text,                                                  -- texto libre si reason = 'otro'
  added_at           timestamptz not null default now(),
  primary key (od_id, package_id),

  -- Si está fraccionado (boxes_shipped < boxes_total), motivo es obligatorio
  constraint dispatch_order_packages_split_requires_reason
    check (boxes_shipped = boxes_total or split_reason is not null)
);


-- Copia literal: supabase/migrations/0025_operario_roles_extend.sql · table dispatch_pods · desde línea40
create table public.dispatch_pods (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  od_id                    uuid not null references public.dispatch_orders(id) on delete cascade,
  package_id               uuid,                                  -- nullable: POD por paquete (V2)
  photo_path               text,                                  -- 'pod/<tenant>/<od>/<ts>.jpg'
  signature_path           text,                                  -- 'firma/<tenant>/<od>/<ts>.png'
  received_by              text not null,
  received_doc             text,                                  -- cédula opcional
  notes                    text,
  created_by_operario_id   uuid references public.operario_pins(id) on delete set null,
  created_at               timestamptz not null default now()
);


-- Copia literal: supabase/migrations/0080_portal_cliente.sql · table client_users · desde línea13
create table public.client_users (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  email         text not null,
  auth_user_id  uuid references auth.users(id) on delete set null,
  token         text unique,
  status        text not null default 'invited'
                  check (status in ('invited','active','revoked')),
  invited_by    uuid references auth.users(id),
  invited_at    timestamptz not null default now(),
  bound_at      timestamptz,
  revoked_at    timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, client_id),   -- 1 acceso de portal por cliente (V1)
  unique (auth_user_id)            -- 1 cliente por auth.user
);


alter table public.dispatch_order_packages add column delivery_status text not null default 'pendiente',add column delivery_reason text;
alter table public.dispatch_pods add column pod_lat numeric(9,6),add column pod_lng numeric(9,6),add column pod_accuracy_m numeric(7,2),add column pod_gps_status text;
alter table public.dispatch_pods add constraint dispatch_pods_gps_status_check
  check (pod_gps_status is null or pod_gps_status in ('on','off','denied','unavailable'));
alter table public.dispatch_order_packages add constraint dispatch_order_packages_delivery_status_check
  check (delivery_status in ('pendiente','entregado','rechazado','retornado'));
create schema storage;
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null,metadata jsonb,unique(bucket_id,name));
create table public.warehouse_receipts_ve(id uuid primary key,tenant_id uuid,shipment_id uuid,client_markbox text,status text);
-- Enum exacto0067; no estado nuevo inferido por la fixture.
create type public.warehouse_receipt_ve_status as enum ('en_muelle','recibiendo','sellado','con_incidencia');
create table public.expense_alerts(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
  shipment_id uuid not null references public.shipments(id),created_at timestamptz default now(),resolved_at timestamptz);
create unique index expense_alerts_one_unresolved on public.expense_alerts(shipment_id) where resolved_at is null;
create table public.shipment_documents(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
  shipment_id uuid not null references public.shipments(id),client_markbox text,doc_type text,storage_path text,file_name text,content_type text,
  size_bytes bigint,created_at timestamptz not null default now(),deleted_at timestamptz);
alter table public.shipment_documents enable row level security;
grant select,insert,update,delete on public.shipment_documents to authenticated;

-- Copia literal: supabase/migrations/0444_unlinked_document_entity_rbac.sql · function document_entity_module_contract · desde línea72
create or replace function public.document_entity_module_contract(p_entity_type text)
returns table(module_id text, default_roles text[])
language sql
immutable
security invoker
set search_path = ''
as $$
  select v.module_id, v.default_roles
  from (values
    ('expense', 'expenses', array['accounting', 'operations', 'warehouse']::text[]),
    ('shipment', 'tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[]),
    ('client', 'clients', array['commercial', 'operations', 'accounting', 'support']::text[]),
    ('supplier', 'suppliers', array['commercial', 'operations']::text[]),
    ('consolidation', 'naviera', array['operations', 'accounting']::text[]),
    ('booking', 'naviera', array['operations', 'accounting']::text[]),
    ('bitacora_task', 'bitacora', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('none', 'documents', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('', 'documents', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[])
  ) as v(entity_type, module_id, default_roles)
  where v.entity_type = pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_entity_type, ''))
  )
$$;


-- Copia literal: supabase/migrations/0444_unlinked_document_entity_rbac.sql · function document_entity_authorized · desde línea102
create or replace function public.document_entity_authorized(
  p_entity_type text,
  p_tenant_id uuid,
  p_access text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) as entity_type,
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, ''))) as access
  ), membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id
      and ut.disabled_at is null
    limit 1
  ), decision as (
    select
      n.entity_type,
      n.access,
      m.role,
      c.module_id,
      c.default_roles,
      o.can_view,
      o.can_edit
    from normalized n
    cross join membership m
    left join lateral public.document_entity_module_contract(n.entity_type) c
      on true
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = c.module_id
  )
  select coalesce((
    select case
      when d.access not in ('view', 'edit') then false
      when d.entity_type in (
        'invoice',
        'supplier_bill',
        'supplier_payment',
        'journal_entry'
      ) then d.role in ('accounting', 'admin')
      when d.module_id is not null and d.role = 'admin' then true
      when d.module_id is not null and d.access = 'view' then
        coalesce(d.can_view, d.role = any(d.default_roles))
      when d.module_id is not null and d.access = 'edit' then
        d.role <> 'support'
        and coalesce(d.can_edit, d.role = any(d.default_roles))
      else false
    end
    from decision d
  ), false)
$$;


revoke all on function public.document_entity_module_contract(text) from public,anon,authenticated,service_role;
revoke all on function public.document_entity_authorized(text,uuid,text) from public,anon;
grant execute on function public.document_entity_authorized(text,uuid,text) to authenticated,service_role;

drop policy if exists "shipments portal self read" on public.shipments;
create policy "shipments portal self read"
  on public.shipments for select to authenticated
  using (
    deleted_at is null and client_markbox is not null
    and exists (
      select 1 from public.client_users as cu
      join public.clients as c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = shipments.tenant_id
        and c.markbox = shipments.client_markbox
    )
  );

drop policy if exists "shipment_documents portal self read" on public.shipment_documents;
create policy "shipment_documents portal self read"
  on public.shipment_documents for select to authenticated
  using (
    deleted_at is null and client_markbox is not null
    and exists (
      select 1 from public.client_users as cu
      join public.clients as c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      join public.shipments as s
        on s.tenant_id = cu.tenant_id and s.client_markbox = c.markbox
          and s.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and s.id = shipment_documents.shipment_id
        and s.tenant_id = shipment_documents.tenant_id
        and s.client_markbox = shipment_documents.client_markbox
    )
  );

drop policy if exists "shipment_events portal self read" on public.shipment_events;
create policy "shipment_events portal self read"
  on public.shipment_events for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.client_users as cu
      join public.clients as c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      join public.shipments as s
        on s.tenant_id = cu.tenant_id and s.client_markbox = c.markbox
          and s.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and s.id = shipment_events.shipment_id
        and s.tenant_id = shipment_events.tenant_id
    )
  );

do $postflight$
declare v_table text;
begin
  foreach v_table in array array['shipments', 'shipment_documents', 'shipment_events'] loop
    if not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = v_table
        and policyname = v_table || ' portal self read' and cmd = 'SELECT'
        and roles = array['authenticated']::name[]
        and qual like '%client_users%' and qual like '%auth.uid()%'
        and qual like '%tenant_id%' and qual not like '%get_portal_client_markbox%'
    ) then
      raise exception '0416: policy Portal final inválida: %', v_table;
    end if;
  end loop;
end;
$postflight$;


create policy "shipment_documents by tenant read"
  on public.shipment_documents for select to authenticated
  using (
    deleted_at is null
    and tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized('shipment', tenant_id, 'view')
  );
create policy "shipment_documents by tenant insert"
  on public.shipment_documents for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized('shipment', tenant_id, 'edit')
  );
create policy "shipment_documents by tenant update"
  on public.shipment_documents for update to authenticated
  using (
    deleted_at is null
    and tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized('shipment', tenant_id, 'edit')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized('shipment', tenant_id, 'edit')
  );
create policy "shipment_documents by tenant delete"
  on public.shipment_documents for delete to authenticated
  using (
    deleted_at is null
    and tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized('shipment', tenant_id, 'edit')
  );



\ir ../migrations/0300_pod_seal.sql
\ir ../migrations/0318_customs_clearance_governance.sql
\ir ../migrations/0320_tms_route_completion_governance.sql
\ir ../migrations/0321_warehouse_ve_delivery_governance.sql
\ir ../migrations/0477_naviera_zarpe_avanza_envios.sql
\ir ../migrations/0484_seniat_liberar_correlation_id.sql
\ir ../migrations/0486_tms_completar_ruta_correlation_id.sql
\ir ../migrations/0487_ve_confirmar_entrega_correlation_id.sql

-- Copia literal: supabase/migrations/0045_create_receipt_as_operario_destination_city.sql · function create_receipt_as_operario · desde línea17
create or replace function public.create_receipt_as_operario(
  p_operario_id        uuid,
  p_warehouse_id       uuid,
  p_is_orphan          boolean,
  p_client_markbox     text,
  p_client_name        text,
  p_orphan_marks       text,
  p_orphan_brought_by  text,
  p_supplier_name      text,
  p_supplier_translated text,
  p_boxes              integer,
  p_total_cbm          numeric,
  p_total_weight_kg    numeric,
  p_received_at        date,
  p_notes              text,
  p_items              jsonb,
  p_incident           boolean,
  p_incident_note      text,
  p_destination_city   text default null
)
returns table(receipt_id uuid, receipt_code text)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_tenant_id    uuid;
  v_active       boolean;
  v_code         text;
  v_year         int := extract(year from current_date);
  v_max          int;
  v_receipt_id   uuid;
  v_item         jsonb;
  v_pos          int := 0;
begin
  select op.tenant_id, op.active
    into v_tenant_id, v_active
    from public.operario_pins op
   where op.id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado (id=%)', p_operario_id using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if p_boxes is null or p_boxes <= 0 then
    raise exception 'boxes debe ser > 0' using errcode = 'P0003';
  end if;

  if p_is_orphan then
    select coalesce(max((regexp_match(wr.receipt_code, '^SIN-CODIGO-(\d+)$'))[1]::int), 0) + 1
      into v_max
      from public.warehouse_receipts_cn wr
     where wr.tenant_id = v_tenant_id
       and wr.receipt_code like 'SIN-CODIGO-%';
    v_code := 'SIN-CODIGO-' || lpad(v_max::text, 4, '0');
  else
    if p_client_markbox is null or length(trim(p_client_markbox)) = 0 then
      raise exception 'client_markbox requerido cuando no es huérfana' using errcode = 'P0004';
    end if;
    select coalesce(max((regexp_match(wr.receipt_code, '^WR-\d{4}-(\d+)$'))[1]::int), 0) + 1
      into v_max
      from public.warehouse_receipts_cn wr
     where wr.tenant_id = v_tenant_id
       and wr.receipt_code like 'WR-' || v_year || '-%';
    v_code := 'WR-' || v_year || '-' || lpad(v_max::text, 4, '0');
  end if;

  insert into public.warehouse_receipts_cn (
    tenant_id, receipt_code, warehouse_id,
    client_markbox, client_name,
    is_orphan, orphan_marks, orphan_brought_by,
    supplier_name, supplier_name_translated,
    boxes, total_cbm, total_weight_kg,
    status, received_at, notes,
    created_by_operario_id,
    destination_city
  ) values (
    v_tenant_id, v_code, p_warehouse_id,
    case when p_is_orphan then null else p_client_markbox end,
    case when p_is_orphan then null else p_client_name end,
    p_is_orphan, p_orphan_marks, p_orphan_brought_by,
    p_supplier_name, p_supplier_translated,
    p_boxes, p_total_cbm, p_total_weight_kg,
    case when p_incident then 'incidencia'::warehouse_receipt_status
         else 'pendiente_consolidacion'::warehouse_receipt_status end,
    coalesce(p_received_at, current_date),
    p_notes,
    p_operario_id,
    nullif(trim(p_destination_city), '')
  )
  returning id into v_receipt_id;

  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      insert into public.warehouse_receipt_items (
        tenant_id, receipt_id, description, description_translated,
        hs_code, quantity, unit_value_usd, notes, position
      ) values (
        v_tenant_id, v_receipt_id,
        coalesce(v_item->>'description', ''),
        v_item->>'description_translated',
        v_item->>'hs_code',
        nullif(v_item->>'quantity', '')::int,
        nullif(v_item->>'unit_value_usd', '')::numeric,
        v_item->>'notes',
        v_pos
      );
      v_pos := v_pos + 1;
    end loop;
  end if;

  insert into public.warehouse_receipt_events (
    tenant_id, receipt_id, event_type, description, occurred_at
  ) values (
    v_tenant_id, v_receipt_id,
    'received'::warehouse_receipt_event_type,
    'Recibida en hub por operario · PWA mobile'
      || case when p_destination_city is not null and length(trim(p_destination_city)) > 0
              then ' · destino: ' || trim(p_destination_city)
              else '' end,
    now()
  );

  if p_incident then
    insert into public.warehouse_receipt_events (
      tenant_id, receipt_id, event_type, description, occurred_at
    ) values (
      v_tenant_id, v_receipt_id,
      'incident'::warehouse_receipt_event_type,
      coalesce(nullif(trim(p_incident_note), ''), 'Incidencia reportada sin nota'),
      now()
    );
  end if;

  receipt_id := v_receipt_id;
  receipt_code := v_code;
  return next;
end;
$function$;


-- Copia literal: supabase/migrations/0072_fix_audit_entity_type.sql · function operario_action · desde línea21
create or replace function public.operario_action(
  p_operario_id  uuid,
  p_action_type  text,
  p_payload      jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operario       record;
  v_result         jsonb := '{}'::jsonb;
  v_receipt_id     uuid;
  v_box_code       text;
  v_box            record;
  v_receipt        record;
  v_force          boolean;
  v_scanned_count  int;
  v_expected_count int;
  v_od_id          uuid;
  v_package_id     uuid;
  v_new_status     text;
  v_reason         text;
  v_od             record;
  v_pkg            record;
  v_new_truck_id   uuid;
  v_new_driver_id  uuid;
  v_new_truck      record;
  v_new_driver     record;
  v_old_truck_id   uuid;
  v_old_driver_id  uuid;
  v_edit_receipt_id uuid;
  v_edit_receipt   record;
  v_edit_items     jsonb;
  v_edit_item      jsonb;
  v_edit_pos       int;
  v_before         jsonb;
begin
  select id, tenant_id, role, roles, region, active
    into v_operario
    from public.operario_pins
   where id = p_operario_id;

  if v_operario.id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_operario.active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;

  case p_action_type
    when 'edit_receipt' then
      if v_operario.region <> 'cn' then
        raise exception 'Solo operarios CN pueden editar recepciones CN' using errcode = 'P0003';
      end if;

      v_edit_receipt_id := (p_payload->>'receipt_id')::uuid;
      if v_edit_receipt_id is null then
        raise exception 'Falta receipt_id' using errcode = 'P0110';
      end if;

      select id, tenant_id, status, created_by_operario_id, is_orphan,
             client_markbox, client_name, supplier_name, supplier_name_translated,
             boxes, total_cbm, total_weight_kg, notes,
             orphan_marks, orphan_brought_by, destination_city
        into v_edit_receipt
        from public.warehouse_receipts_cn
       where id = v_edit_receipt_id
         and deleted_at is null;
      if v_edit_receipt.id is null then
        raise exception 'Receipt no encontrado' using errcode = 'P0140';
      end if;
      if v_edit_receipt.tenant_id <> v_operario.tenant_id then
        raise exception 'Receipt de otro tenant' using errcode = 'P0141';
      end if;
      if v_edit_receipt.created_by_operario_id is distinct from p_operario_id and
         not ('supervisor' = any(v_operario.roles)) then
        raise exception 'Solo podés editar tus propias recepciones' using errcode = 'P0142';
      end if;
      if v_edit_receipt.status <> 'pendiente_consolidacion' then
        raise exception 'Receipt en status % · no se puede editar', v_edit_receipt.status using errcode = 'P0143';
      end if;

      if (p_payload->>'boxes') is null or (p_payload->>'boxes')::int <= 0 then
        raise exception 'boxes debe ser > 0' using errcode = 'P0144';
      end if;

      v_before := to_jsonb(v_edit_receipt);

      update public.warehouse_receipts_cn
         set client_markbox            = case when v_edit_receipt.is_orphan then null else nullif(trim(coalesce(p_payload->>'client_markbox', '')), '') end,
             client_name               = case when v_edit_receipt.is_orphan then null else nullif(trim(coalesce(p_payload->>'client_name', '')), '') end,
             orphan_marks              = case when v_edit_receipt.is_orphan then nullif(trim(coalesce(p_payload->>'orphan_marks', '')), '') else null end,
             orphan_brought_by         = case when v_edit_receipt.is_orphan then nullif(trim(coalesce(p_payload->>'orphan_brought_by', '')), '') else null end,
             supplier_name             = nullif(trim(coalesce(p_payload->>'supplier_name', '')), ''),
             supplier_name_translated  = nullif(trim(coalesce(p_payload->>'supplier_name_translated', '')), ''),
             boxes                     = (p_payload->>'boxes')::int,
             total_cbm                 = nullif(p_payload->>'total_cbm', '')::numeric,
             total_weight_kg           = nullif(p_payload->>'total_weight_kg', '')::numeric,
             notes                     = nullif(trim(coalesce(p_payload->>'notes', '')), ''),
             destination_city          = nullif(trim(coalesce(p_payload->>'destination_city', '')), ''),
             updated_at                = now()
       where id = v_edit_receipt_id;

      v_edit_items := p_payload->'items';
      if v_edit_items is not null and jsonb_typeof(v_edit_items) = 'array' then
        delete from public.warehouse_receipt_items where receipt_id = v_edit_receipt_id;
        v_edit_pos := 0;
        for v_edit_item in select * from jsonb_array_elements(v_edit_items)
        loop
          insert into public.warehouse_receipt_items (
            tenant_id, receipt_id, description, description_translated,
            hs_code, quantity, unit_value_usd, notes, position
          ) values (
            v_operario.tenant_id, v_edit_receipt_id,
            coalesce(v_edit_item->>'description', ''),
            v_edit_item->>'description_translated',
            v_edit_item->>'hs_code',
            nullif(v_edit_item->>'quantity', '')::int,
            nullif(v_edit_item->>'unit_value_usd', '')::numeric,
            v_edit_item->>'notes',
            v_edit_pos
          );
          v_edit_pos := v_edit_pos + 1;
        end loop;
      end if;

      insert into public.warehouse_receipt_events (
        tenant_id, receipt_id, event_type, description, occurred_at
      ) values (
        v_operario.tenant_id, v_edit_receipt_id,
        'note'::warehouse_receipt_event_type,
        'Recepción editada por operario · PWA mobile',
        now()
      );

      -- FIX: warehouse_receipt_cn (era 'warehouse_receipt' · CHECK violation)
      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'warehouse_receipt_cn', v_edit_receipt_id, 'operario', p_operario_id,
         'edited',
         jsonb_build_object('before', v_before, 'after', p_payload));

      v_result := jsonb_build_object('ok', true, 'receipt_id', v_edit_receipt_id);

    when 'reassign_od' then
      if v_operario.region <> 've' then
        raise exception 'Solo operarios VE pueden reasignar' using errcode = 'P0003';
      end if;
      if not (
        'bodeguero' = any(v_operario.roles) or
        'supervisor' = any(v_operario.roles)
      ) then
        raise exception 'Tu rol no permite reasignar' using errcode = 'P0004';
      end if;

      v_od_id         := (p_payload->>'od_id')::uuid;
      v_new_truck_id  := nullif(p_payload->>'truck_id', '')::uuid;
      v_new_driver_id := nullif(p_payload->>'driver_id', '')::uuid;
      v_reason        := nullif(trim(coalesce(p_payload->>'reason', '')), '');

      if v_od_id is null then
        raise exception 'Falta od_id' using errcode = 'P0110';
      end if;
      if v_new_truck_id is null and v_new_driver_id is null then
        raise exception 'Indicá al menos truck_id o driver_id' using errcode = 'P0130';
      end if;

      select id, tenant_id, status, truck_id, driver_id, hub
        into v_od
        from public.dispatch_orders
       where id = v_od_id;
      if v_od.id is null then
        raise exception 'OD no encontrada' using errcode = 'P0005';
      end if;
      if v_od.tenant_id <> v_operario.tenant_id then
        raise exception 'OD de otro tenant' using errcode = 'P0006';
      end if;
      if v_od.status not in ('creada','cargando') then
        raise exception 'OD en status % · no se puede reasignar', v_od.status using errcode = 'P0131';
      end if;

      v_old_truck_id  := v_od.truck_id;
      v_old_driver_id := v_od.driver_id;

      if v_new_truck_id is not null and v_new_truck_id is distinct from v_old_truck_id then
        select id, tenant_id, capacity_cbm, capacity_kg, status, hub_code
          into v_new_truck
          from public.tms_trucks
         where id = v_new_truck_id;
        if v_new_truck.id is null then
          raise exception 'Truck no encontrado' using errcode = 'P0132';
        end if;
        if v_new_truck.tenant_id <> v_operario.tenant_id then
          raise exception 'Truck de otro tenant' using errcode = 'P0133';
        end if;
        if v_new_truck.status <> 'disponible' then
          raise exception 'Truck no está disponible (status=%)', v_new_truck.status using errcode = 'P0134';
        end if;
      end if;

      if v_new_driver_id is not null and v_new_driver_id is distinct from v_old_driver_id then
        select id, tenant_id, hub_code
          into v_new_driver
          from public.tms_drivers
         where id = v_new_driver_id;
        if v_new_driver.id is null then
          raise exception 'Driver no encontrado' using errcode = 'P0135';
        end if;
        if v_new_driver.tenant_id <> v_operario.tenant_id then
          raise exception 'Driver de otro tenant' using errcode = 'P0136';
        end if;
      end if;

      update public.dispatch_orders
         set truck_id              = coalesce(v_new_truck_id, truck_id),
             driver_id             = coalesce(v_new_driver_id, driver_id),
             reassigned_at         = now(),
             capacity_kg_snapshot  = case
                                       when v_new_truck_id is not null
                                            and v_new_truck_id is distinct from v_old_truck_id
                                       then v_new_truck.capacity_kg
                                       else capacity_kg_snapshot
                                     end,
             capacity_cbm_snapshot = case
                                       when v_new_truck_id is not null
                                            and v_new_truck_id is distinct from v_old_truck_id
                                       then v_new_truck.capacity_cbm
                                       else capacity_cbm_snapshot
                                     end
       where id = v_od_id;

      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'dispatch_order', v_od_id, 'operario', p_operario_id,
         'reassigned',
         jsonb_build_object(
           'old_truck_id', v_old_truck_id,
           'new_truck_id', coalesce(v_new_truck_id, v_old_truck_id),
           'old_driver_id', v_old_driver_id,
           'new_driver_id', coalesce(v_new_driver_id, v_old_driver_id),
           'reason', v_reason
         ));

      v_result := jsonb_build_object(
        'ok', true,
        'od_id', v_od_id,
        'new_truck_id', coalesce(v_new_truck_id, v_old_truck_id),
        'new_driver_id', coalesce(v_new_driver_id, v_old_driver_id)
      );

    when 'partial_delivery' then
      if v_operario.region <> 've' then
        raise exception 'Solo operarios VE pueden marcar entregas' using errcode = 'P0003';
      end if;
      if not (
        'camionero' = any(v_operario.roles) or
        'supervisor' = any(v_operario.roles)
      ) then
        raise exception 'Tu rol no permite marcar entregas' using errcode = 'P0004';
      end if;

      v_od_id      := (p_payload->>'od_id')::uuid;
      v_package_id := (p_payload->>'package_id')::uuid;
      v_new_status := nullif(trim(p_payload->>'status'), '');
      v_reason     := nullif(trim(coalesce(p_payload->>'reason', '')), '');

      if v_od_id is null or v_package_id is null or v_new_status is null then
        raise exception 'Falta od_id / package_id / status' using errcode = 'P0110';
      end if;
      if v_new_status not in ('entregado','rechazado','retornado') then
        raise exception 'status inválido (entregado|rechazado|retornado)' using errcode = 'P0120';
      end if;
      if v_new_status in ('rechazado','retornado') and v_reason is null then
        raise exception 'reason es obligatorio para %', v_new_status using errcode = 'P0121';
      end if;

      select id, tenant_id, status
        into v_od
        from public.dispatch_orders
       where id = v_od_id;
      if v_od.id is null then
        raise exception 'OD no encontrada' using errcode = 'P0005';
      end if;
      if v_od.tenant_id <> v_operario.tenant_id then
        raise exception 'OD de otro tenant' using errcode = 'P0006';
      end if;
      if v_od.status not in ('en_ruta','entregada') then
        raise exception 'OD debe estar en_ruta para marcar entregas (status=%)', v_od.status using errcode = 'P0007';
      end if;

      select od_id, package_id, delivery_status
        into v_pkg
        from public.dispatch_order_packages
       where od_id = v_od_id and package_id = v_package_id;
      if v_pkg.package_id is null then
        raise exception 'Paquete no encontrado en la OD' using errcode = 'P0008';
      end if;
      if v_pkg.delivery_status <> 'pendiente' then
        raise exception 'Paquete ya marcado como %', v_pkg.delivery_status using errcode = 'P0122';
      end if;

      update public.dispatch_order_packages
         set delivery_status = v_new_status
       where od_id = v_od_id and package_id = v_package_id;

      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'dispatch_order', v_od_id, 'operario', p_operario_id,
         'package_' || v_new_status,
         jsonb_build_object('package_id', v_package_id, 'reason', v_reason));

      v_result := jsonb_build_object(
        'ok', true,
        'package_id', v_package_id,
        'new_status', v_new_status
      );

    when 'scan_box' then
      if v_operario.region <> 've' then
        raise exception 'Solo operarios VE pueden escanear cajas' using errcode = 'P0003';
      end if;
      if not (
        'bodeguero' = any(v_operario.roles) or
        'supervisor' = any(v_operario.roles)
      ) then
        raise exception 'Tu rol no permite escanear cajas' using errcode = 'P0004';
      end if;

      v_receipt_id := (p_payload->>'receipt_id')::uuid;
      v_box_code := nullif(trim(p_payload->>'code'), '');
      if v_receipt_id is null or v_box_code is null then
        raise exception 'Falta receipt_id o code' using errcode = 'P0110';
      end if;

      select id, tenant_id, status, started_at
        into v_receipt
        from public.warehouse_receipts_ve
       where id = v_receipt_id
         and tenant_id = v_operario.tenant_id
         and deleted_at is null;
      if v_receipt.id is null then
        raise exception 'Receipt no encontrado' using errcode = 'P0111';
      end if;
      if v_receipt.status = 'sellado' then
        raise exception 'Receipt ya está sellado · no admite más escaneos' using errcode = 'P0112';
      end if;

      select id, scanned_at
        into v_box
        from public.warehouse_receipt_ve_boxes
       where receipt_id = v_receipt_id
         and code = v_box_code;
      if v_box.id is null then
        raise exception 'Caja % no figura en este receipt', v_box_code using errcode = 'P0113';
      end if;
      if v_box.scanned_at is not null then
        raise exception 'Caja % ya estaba escaneada', v_box_code using errcode = 'P0114';
      end if;

      update public.warehouse_receipt_ve_boxes
         set scanned_at             = now(),
             scanned_by_operario_id = p_operario_id,
             scanned_manual         = coalesce((p_payload->>'manual')::boolean, false)
       where id = v_box.id;

      if v_receipt.status = 'en_muelle' then
        update public.warehouse_receipts_ve
           set status      = 'recibiendo',
               started_at  = coalesce(started_at, now()),
               received_by_operario_id = coalesce(received_by_operario_id, p_operario_id)
         where id = v_receipt_id;
      end if;

      -- FIX: warehouse_receipt_ve (era 'warehouse_receipt' · CHECK violation)
      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'warehouse_receipt_ve', v_receipt_id, 'operario', p_operario_id,
         'box_scanned',
         jsonb_build_object('code', v_box_code, 'manual', coalesce((p_payload->>'manual')::boolean, false)));

      select count(*) filter (where scanned_at is not null),
             count(*)
        into v_scanned_count, v_expected_count
        from public.warehouse_receipt_ve_boxes
       where receipt_id = v_receipt_id;

      v_result := jsonb_build_object(
        'ok', true,
        'box_id', v_box.id,
        'scanned_count', v_scanned_count,
        'expected_count', v_expected_count
      );

    when 'seal_reception' then
      if v_operario.region <> 've' then
        raise exception 'Solo operarios VE pueden sellar receipts' using errcode = 'P0003';
      end if;
      if not (
        'bodeguero' = any(v_operario.roles) or
        'supervisor' = any(v_operario.roles)
      ) then
        raise exception 'Tu rol no permite sellar receipts' using errcode = 'P0004';
      end if;

      v_receipt_id := (p_payload->>'receipt_id')::uuid;
      v_force := coalesce((p_payload->>'force')::boolean, false);
      if v_receipt_id is null then
        raise exception 'Falta receipt_id' using errcode = 'P0110';
      end if;

      select id, tenant_id, status
        into v_receipt
        from public.warehouse_receipts_ve
       where id = v_receipt_id
         and tenant_id = v_operario.tenant_id
         and deleted_at is null;
      if v_receipt.id is null then
        raise exception 'Receipt no encontrado' using errcode = 'P0111';
      end if;
      if v_receipt.status = 'sellado' then
        raise exception 'Receipt ya estaba sellado' using errcode = 'P0112';
      end if;

      select count(*) filter (where scanned_at is not null),
             count(*)
        into v_scanned_count, v_expected_count
        from public.warehouse_receipt_ve_boxes
       where receipt_id = v_receipt_id;

      if v_scanned_count < v_expected_count and not v_force then
        raise exception 'Faltan % cajas por escanear · usá force=true si querés sellar con incidencia',
          (v_expected_count - v_scanned_count) using errcode = 'P0115';
      end if;

      update public.warehouse_receipts_ve
         set status                = (case
                                       when v_scanned_count < v_expected_count then 'con_incidencia'
                                       else 'sellado'
                                     end)::warehouse_receipt_ve_status,
             sealed_at             = now(),
             sealed_by_operario_id = p_operario_id,
             incident_note         = nullif(trim(coalesce(p_payload->>'incident_note', '')), '')
       where id = v_receipt_id;

      -- FIX: warehouse_receipt_ve (era 'warehouse_receipt' · CHECK violation)
      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'warehouse_receipt_ve', v_receipt_id, 'operario', p_operario_id,
         'sealed',
         jsonb_build_object(
           'scanned', v_scanned_count,
           'expected', v_expected_count,
           'force', v_force,
           'incident_note', p_payload->>'incident_note'
         ));

      v_result := jsonb_build_object(
        'ok', true,
        'scanned_count', v_scanned_count,
        'expected_count', v_expected_count,
        'status', case
                    when v_scanned_count < v_expected_count then 'con_incidencia'
                    else 'sellado'
                  end
      );

    else
      raise exception 'action_type % desconocido', p_action_type using errcode = 'P0105';
  end case;

  return v_result;
end;
$$;


-- Copia literal: supabase/migrations/0449_prealerta_exact_box_reception.sql · function receive_prealerta_boxes_as_operario · desde línea5
create or replace function public.receive_prealerta_boxes_as_operario(
  p_operario_id     uuid,
  p_code            text,               -- DTD-B-NNNNNN escaneado (o el `b` del QR)
  p_box_codes text[]                   -- exact boxes confirmed on the phone
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op         record;
  v_box        record;
  v_p          record;
  v_esperadas  int;
  v_receive    int;
  v_year       text;
  v_max        int;
  v_code       text;
  v_receipt_id uuid;
  v_adopted    int;
  v_selected text[];
  v_remaining  int;
begin
  -- 1. Operario CN activo → tenant + warehouse
  select id, tenant_id, region, active, warehouse_id
    into v_op
    from public.operario_pins
   where id = p_operario_id;

  if v_op.id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_op.active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if v_op.region <> 'cn' then
    raise exception 'Solo operarios CN reciben en China' using errcode = 'P0003';
  end if;
  if v_op.warehouse_id is null then
    raise exception 'Operario sin almacén asignado' using errcode = 'P0135';
  end if;

  -- Serialize the short allocation/adoption transaction before locking purchase/boxes.
  lock table public.warehouse_receipts_cn in share row exclusive mode;

  -- 2. La caja escaneada
  select id, tenant_id, prealerta_id, receipt_id, status, code, markbox
    into v_box
    from public.warehouse_boxes
   where tenant_id = v_op.tenant_id
     and code = upper(trim(p_code))
     and deleted_at is null;

  if v_box.id is null then
    raise exception 'La caja % no existe · revisa la etiqueta', p_code using errcode = 'P0130';
  end if;

  if v_box.prealerta_id is null then
    -- No debería pasar con una etiqueta pre-declarada (DTD-B siempre nace de una
    -- prealerta). Defensa: una caja esperada sin prealerta es un estado imposible.
    raise exception 'La caja % no viene de una compra anunciada', v_box.code using errcode = 'P0132';
  end if;

  -- 3. La compra (prealerta) de la caja
  select pr.id, pr.tenant_id, pr.code, pr.client_markbox, pr.supplier_id, pr.status, pr.deleted_at
    into v_p from public.prealertas pr
    where pr.id = v_box.prealerta_id and pr.tenant_id = v_op.tenant_id
    for update;

  if v_p.id is null or v_p.deleted_at is not null or v_p.status = 'cancelada' then
    raise exception 'La compra de la caja % no está activa', v_box.code using errcode = 'P0133';
  end if;

  -- 4. Cuántas esperadas hay y cuántas se reciben
  select count(*) into v_esperadas
    from public.warehouse_boxes
   where prealerta_id = v_p.id
     and status = 'esperada'
     and receipt_id is null
     and deleted_at is null;

  select array_agg(distinct upper(trim(x))) into v_selected from unnest(p_box_codes) x;
  v_receive := coalesce(cardinality(v_selected), 0);
  if v_receive < 1 or v_receive > 5000 or not (v_box.code = any(v_selected)) then
    raise exception 'Selecciona las cajas presentes, incluida la escaneada' using errcode = 'P0136';
  end if;
  perform id from public.warehouse_boxes where tenant_id = v_op.tenant_id
    and prealerta_id = v_p.id and code = any(v_selected) for update;
  select count(*) into v_adopted from public.warehouse_boxes
    where tenant_id = v_op.tenant_id and prealerta_id = v_p.id
    and code = any(v_selected) and status = 'esperada' and receipt_id is null and deleted_at is null;
  if v_adopted <> v_receive then
    raise exception 'Las cajas cambiaron o ya fueron recibidas. Escanea otra vez.' using errcode = 'P0137';
  end if;

  -- 5. Crear la recepción (boxes=0 → el trigger de sync es no-op; adoptamos a mano)
  v_year := to_char(current_date, 'YYYY');
  select coalesce(max((regexp_match(wr.receipt_code, '^WR-\d{4}-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.warehouse_receipts_cn wr
   where wr.tenant_id = v_op.tenant_id
     and wr.receipt_code like 'WR-' || v_year || '-%';
  v_code := 'WR-' || v_year || '-' || lpad(v_max::text, 4, '0');

  insert into public.warehouse_receipts_cn (
    tenant_id, receipt_code, warehouse_id,
    client_markbox, client_name,
    supplier_name,
    boxes, status, received_at,
    created_by_operario_id, prealerta_id,
    notes
  ) values (
    v_op.tenant_id, v_code, v_op.warehouse_id,
    v_p.client_markbox, null,
    (select s.name from public.suppliers_cn s where s.id = v_p.supplier_id),
    0, 'pendiente_consolidacion'::warehouse_receipt_status, current_date,
    p_operario_id, v_p.id,
    'Recibida por escaneo · compra ' || v_p.code
  )
  returning id into v_receipt_id;

  -- Adopt exactly the physical boxes selected; never infer their identity from a quantity.
  update public.warehouse_boxes set receipt_id = v_receipt_id, status = 'recibida'
   where tenant_id = v_op.tenant_id and prealerta_id = v_p.id
     and code = any(v_selected) and status = 'esperada' and receipt_id is null and deleted_at is null;
  get diagnostics v_adopted = row_count;
  if v_adopted <> v_receive then raise exception 'Recepción concurrente' using errcode = 'P0137'; end if;

  -- 7. Subir boxes al conteo real. Si v_receive > esperadas (llegó MÁS de lo
  --    anunciado), el trigger de 0241 crea las extras como recibidas. Si es igual,
  --    v_have == boxes → no-op.
  update public.warehouse_receipts_cn
     set boxes = v_receive
   where id = v_receipt_id;

  -- 8. Evento de recepción (misma semántica que 0045)
  insert into public.warehouse_receipt_events (
    tenant_id, receipt_id, event_type, description, occurred_at
  ) values (
    v_op.tenant_id, v_receipt_id,
    'received'::warehouse_receipt_event_type,
    'Recibida por escaneo de etiqueta · compra ' || v_p.code
      || ' · ' || v_receive || ' de ' || v_esperadas || ' anunciadas',
    now()
  );

  -- 9. ¿Se recibió TODA la compra? Entonces la prealerta pasa a 'recibida'.
  --    (No dispara prealertas_sync_boxes: su WHEN solo mira boxes y 'cancelada'.)
  select count(*) into v_remaining
    from public.warehouse_boxes
   where prealerta_id = v_p.id
     and status = 'esperada'
     and receipt_id is null
     and deleted_at is null;

  if v_remaining = 0 then
    update public.prealertas
       set status = 'recibida', received_at = now()
     where id = v_p.id
       and status <> 'recibida';
  end if;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', v_receipt_id,
    'receipt_code', v_code,
    'prealerta_code', v_p.code,
    'client_markbox', v_p.client_markbox,
    'received', v_receive,
    'expected', v_esperadas,
    'remaining', v_remaining,
    'scanned_code', v_box.code
  );
end;
$$;


-- Copia literal efectiva: supabase/migrations/0068_pod_partial_and_gps_addons.sql · function camionero_pod · desde línea71
create or replace function public.camionero_pod(
  p_operario_id      uuid,
  p_od_id            uuid,
  p_package_id       uuid,                    -- nullable: POD por paquete
  p_photo_path       text,
  p_signature_path   text,
  p_received_by      text,
  p_received_doc     text,
  p_notes            text,
  p_pod_lat          numeric default null,
  p_pod_lng          numeric default null,
  p_pod_accuracy_m   numeric default null,
  p_pod_gps_status   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
  v_pod_id     uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede confirmar POD' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_received_by is null or length(trim(p_received_by)) = 0 then
    raise exception 'Receptor obligatorio' using errcode = 'P0010';
  end if;
  if p_photo_path is null or length(trim(p_photo_path)) = 0 then
    raise exception 'Foto del POD obligatoria' using errcode = 'P0011';
  end if;
  if p_signature_path is null or length(trim(p_signature_path)) = 0 then
    raise exception 'Firma del POD obligatoria' using errcode = 'P0012';
  end if;
  if p_pod_gps_status is not null and p_pod_gps_status not in ('on','off','denied','unavailable') then
    raise exception 'pod_gps_status inválido' using errcode = 'P0013';
  end if;

  insert into public.dispatch_pods (
    tenant_id, od_id, package_id, photo_path, signature_path,
    received_by, received_doc, notes, created_by_operario_id,
    pod_lat, pod_lng, pod_accuracy_m, pod_gps_status
  ) values (
    v_tenant_id, p_od_id, p_package_id, p_photo_path, p_signature_path,
    trim(p_received_by), nullif(trim(coalesce(p_received_doc, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_operario_id,
    p_pod_lat, p_pod_lng, p_pod_accuracy_m, p_pod_gps_status
  )
  returning id into v_pod_id;

  return v_pod_id;
end;
$$;


-- ACL service_role-only de0045/0068/0072/0449;0296 conserva cuerpos físicos y califica enums.
revoke all on function public.create_receipt_as_operario(uuid,uuid,boolean,text,text,text,text,text,text,integer,numeric,numeric,date,text,jsonb,boolean,text,text),
  public.operario_action(uuid,text,jsonb),public.receive_prealerta_boxes_as_operario(uuid,text,text[]),
  public.camionero_pod(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.create_receipt_as_operario(uuid,uuid,boolean,text,text,text,text,text,text,integer,numeric,numeric,date,text,jsonb,boolean,text,text),
  public.operario_action(uuid,text,jsonb),public.receive_prealerta_boxes_as_operario(uuid,text,text[]),
  public.camionero_pod(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,text) to service_role;
-- Estado efectivo de path de la reparación0288 anterior a0296, sin cambiar cuerpos.
alter function public.operario_action(uuid,text,jsonb) set search_path=pg_catalog,public;
alter function public.stuff_box_as_operario(uuid,uuid,text,integer,integer,integer,boolean) set search_path=pg_catalog,public;
alter function public.unstuff_box_as_operario(uuid,text) set search_path=pg_catalog,public;
alter function public.stuff_lot_as_operario(uuid,uuid,text,integer,integer) set search_path=pg_catalog,public;
alter function public.unstuff_lot_as_operario(uuid,uuid) set search_path=pg_catalog,public;
\ir ../migrations/0296_audit_d4_empty_search_path.sql
-- Effective split writer0184 is exercised unchanged in the two-session tests.
\ir ../migrations/0184_bodeguero_split_idempotent.sql
-- 0241 was included after the fixture's audit prefix. Restore effective0267:
-- its obsolete entity-type CHECK was removed, while real AUD guards remain.
alter table public.entity_audit_log drop constraint if exists entity_audit_log_entity_type_check;
\ir ../migrations/0336_pod_closes_shipment.sql
\ir ../migrations/0496_tarifa_congelada_por_embarque.sql
grant all on all tables in schema public to service_role;
-- La fixture no simula un autorizador: usa los cuerpos y guards reales.
-- Ningún dato de negocio/PII productivo ni flagPODv2/caller se carga aquí.
