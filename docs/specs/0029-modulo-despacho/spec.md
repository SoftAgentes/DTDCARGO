---
sdd: "0029"
title: "DTD Studio — Módulo de Despacho · cola priorizada + motor de reglas + pipeline 3-actor"
status: done
author: "founder"
created: 2026-05-25
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0008", "0012", "0017", "0019", "0023", "0024", "0030"]
---

# DTD-0029 — Módulo de Despacho · cola priorizada + motor de reglas + pipeline 3-actor

> **Coordinación de salida de mercancía desde bodega VE hasta entrega final
> puerta-a-puerta.** Conecta 3 roles (Admin/Oficina · Bodeguero VE ·
> Transportista VE) sobre un pipeline compartido de Órdenes de Despacho
> (ODs) con state machine cerrada, motor de scoring configurable, capacity
> bar peso/volumen en vivo, carga fraccionada P1/P2 y POD con foto+firma.

---

## 1. Resumen en una línea

`/studio/despacho` muestra una cola priorizada de paquetes en bodega VE
listos para entrega (score 0-100 configurable por reglas), permite armar
Órdenes de Despacho (ODs) asignando ruta + camión + chofer con capacity
bar en vivo, y mantiene un panel de ODs activas que se sincroniza con las
PWAs del bodeguero y del transportista (Fase 2, SDD-0030).

---

## 2. Scope

### Incluye (Fase 1 · este SDD)

#### Schema (migración 0024)

- **6 enums nuevos**:
  - `dispatch_order_status`: `creada` / `cargando` / `lista` / `en_ruta` / `entregada` / `cerrada` / `cancelada`
  - `dispatch_hub`: `valencia` / `la_guaira` / `punto_fijo` / `maracaibo`
  - `dispatch_payment_policy`: `estricto` / `hold` / `credito_whitelist`
  - `dispatch_route_type`: `directa` / `intermedias`
  - `dispatch_split_reason`: `falta_volumen` / `cliente_pidio_esperar` / `dano_caja` / `documentacion_pendiente` / `otro`
  - `dispatch_incident_severity`: `baja` / `media` / `alta` / `critica`

- **5 tablas nuevas** (todas con RLS por `tenant_id`):
  - **`dispatch_orders`** — entidad central · code `OD-YYYY-NNNN` · state machine + assignment + capacity snapshot + lifecycle timestamps
  - **`dispatch_order_packages`** — junction OD ↔ paquetes (`warehouse_receipts_cn.id` por ahora; en Fase 2 referenciará `warehouse_receipts_ve`)
  - **`dispatch_rules`** — JSONB per-tenant (pesos del scoring + política pago + VIP markboxes) · 1 row por tenant via RPC `upsert_dispatch_rules`
  - **`dispatch_routes`** — catálogo rutas (origin/destination/intermediateCities + slaHours + active) · code `R-NNN`
  - **`dispatch_city_catalog`** — catálogo ciudades per-tenant (Estado + Municipio + Ciudad + CP IPOSTEL) · seed inicial desde `ve_locality_catalog` público

- **1 tabla pública** (sin RLS, global):
  - **`ve_locality_catalog`** — referencia 24 estados VE + ~95 ciudades + CP IPOSTEL + parroquias[] + barrios[]. Solo lectura para todos los tenants.

- **Extensión aditiva** (no rompe nada):
  - `warehouse_receipts_cn` agrega columna `description text NULL` (mercancía SENIAT, nullable en Fase 1 — el operario CN sigue funcionando idéntico). Una fase posterior decidirá hacerla NOT NULL con 5to step opcional en el wizard.

- **3 RPCs**:
  - `next_dispatch_order_code(p_tenant_id uuid) returns text` — secuencial `OD-YYYY-NNNN`
  - `next_route_code(p_tenant_id uuid) returns text` — secuencial `R-NNN`
  - `upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) returns dispatch_rules` — upsert idempotente

#### Server-side (lib/studio)

- `lib/studio/dispatch-types.ts` — types + enums + labels + tones + `validateDispatchOrderInput` + `validateDispatchAssignmentInput` + `validateCancelInput` + `validateSplitInput`
- `lib/studio/dispatch-rules-types.ts` — types + `validateDispatchRulesInput` + defaults
- `lib/studio/dispatch-routes-types.ts` — types + `validateRouteInput` + `validateCityInput`
- `lib/studio/dispatch-scoring.ts` — algoritmo de scoring 0-100 puro TS (`scorePackage(pkg, rules, today): number`)
- `lib/studio/dispatch-queries.ts` — `listDispatchOrders` + `listOrdersByStatus` + `listEligiblePackages` + `getDispatchOrder` + `computeDispatchKpis` + `parseDispatchFilters`
- `lib/studio/dispatch-rules-queries.ts` — `getDispatchRules` (devuelve defaults si no existe row)
- `lib/studio/dispatch-routes-queries.ts` — `listRoutes` + `listCities` + `listVeStateCatalog`

#### Server actions

- `createDispatchOrderAction` — crea OD `status='creada'`, asigna ruta+camión+chofer, snapshot de capacity, inserta packages al junction
- `cancelDispatchOrderAction` — `status='cancelada'` con motivo obligatorio. Si había packages, los devuelve al estado anterior (rollback al inbox).
- `assignTruckDriverAction` — re-asigna camión y/o chofer (solo si `status in ('creada','cargando')`)
- `updateDispatchRulesAction` — upsert rules via RPC + audit entry
- `createRouteAction` / `updateRouteAction` / `softDeleteRouteAction`
- `createCityAction` / `updateCityAction` / `softDeleteCityAction`
- `seedTenantCitiesFromVeCatalogAction` — primer setup: copia las 95 ciudades del catálogo público a `dispatch_city_catalog` del tenant

#### UI (4 páginas nuevas)

- **`/studio/despacho`** · Vista 1 Admin
  - Header con KPIs (paquetes en cola · ODs activas · capacity utilization promedio · alertas)
  - Cola priorizada (tabla con scoring) + filtros (hub · ciudad · pago · cliente)
  - Bottom drawer "Crear OD" con selección múltiple + asignación (ruta + camión + chofer) + capacity bar en vivo
  - Panel lateral "Órdenes activas hoy" (read-only feed con status badges)
  - Drawer detalle OD con timeline + acción "Cancelar OD" con motivo
- **`/studio/despacho/reglas`** · Vista 2 Reglas
  - Cards plegables (política pago anclada arriba + secciones expandibles para cada peso)
  - Sliders 0-50 por peso (Valencia/Caracas, Pago completo, Pago parcial, FIFO antigüedad, VIP, Cercanía ruta)
  - Toggles secundarios (Tier, Routes)
  - Presets botón "Equilibrado" + botón "FIFO" + "Personalizado"
  - Persiste via `updateDispatchRulesAction`
- **`/studio/despacho/dashboard`** · Reportes
  - 5 KPIs (Total ODs / Completadas / On-time % / Tarde+Canceladas / Tiempo prom)
  - Tabla "Ranking de rutas · eficiencia"
  - Card "Top ciudades por volumen" con barras
  - Selector de periodo (7d / 30d / 90d)
- **`/studio/admin/rutas`** · CRUD rutas + ciudades
  - Tab "Rutas" — tabla rutas + drawer crear/editar (origen, destino, ciudades intermedias con radius, SLA horas)
  - Tab "Ciudades" — tabla ciudades del tenant + drawer crear/editar (cascada Estado → Municipio → Ciudad → CP) leyendo de `ve_locality_catalog`
  - Botón "Seedear desde catálogo VE" (one-time setup que copia ~95 ciudades del catálogo público al tenant)

#### Sidebar entries (4 nuevas, grupo OPERACIÓN)

```
{ id: "despacho", label: "Despacho", icon: "truck", slug: "/studio/despacho" }
{ id: "despacho-rules", label: "Reglas despacho", icon: "shield", slug: "/studio/despacho/reglas" }
{ id: "despacho-dashboard", label: "Dashboard despacho", icon: "chart", slug: "/studio/despacho/dashboard" }
{ id: "admin-rutas", label: "Rutas y ciudades", icon: "radar", slug: "/studio/admin/rutas" }
```

Ubicación: después de `tms` en OPERACIÓN. Por discusión futura: si conviene
agruparlos bajo una sub-sección colapsable.

### Fuera de scope (Fase 1)

Estos features del bundle v1.6 viven en SDDs futuros:

- **SDD-0030** · Apps móviles bodeguero VE + camionero VE (`/m/ve/bodeguero` + `/m/ve/camionero`)
- **SDD-0031** · Etiquetas suppliers CN (label-generator)
- **SDD-0032** · MARKBOX validation + email bienvenida + cross-links cliente
- **SDD-0033** · QR queue real-time sync (Supabase Realtime)
- **SDD-0034** · Wiring 9 conexiones rotas · modals globales
- **SDD-0035** · RecentActivity clickeable + CodesSync persistente

### Out of V1 (Fase 1) · explícito

- **No tocamos** `warehouse_receipts_cn.description` como NOT NULL (queda nullable).
- **No tocamos** `operario_pins` enum de roles (no se introducen `bodeguero`/`camionero` todavía — viene con SDD-0030).
- **No agregamos** Supabase Realtime subscriptions (la Fase 1 es server-rendered con `revalidatePath` después de cada mutación; el realtime entre actores llega con SDD-0030 cuando hay apps móviles).
- **No agregamos** bucket de fotos POD / firma / fachada (viene con SDD-0030).
- **No agregamos** WhatsApp/SMS hooks al cancelar OD (queda en SDD-0026 mailing rule).
- **No agregamos** facturación automática al entregar OD (viene cuando se implemente contabilidad portada del sandbox).

---

## 3. Decisiones de diseño

### D1 · State machine cerrada, transiciones validadas en DB

```
creada → cargando → lista → en_ruta → entregada → cerrada (terminal)
   │
   └→ cancelada (terminal, desde cualquier estado ≠ entregada/cerrada)
```

Implementación: trigger `dispatch_orders_status_transition_guard` en DB +
constants `ALLOWED_TRANSITIONS` en `dispatch-types.ts` para validación
client-side antes de la action.

**Prohibido**: `lista → cargando` · `cancelada → *` · `cerrada → *` ·
`entregada → cancelada`.

### D2 · Scoring corre en TypeScript, no en SQL

El motor de scoring (0-100, mezcla pago + FIFO + ciudad + VIP + ruta) vive
en `lib/studio/dispatch-scoring.ts` y se calcula en el server component
de `/studio/despacho` al renderizar la cola. Razones:

- Reglas cambian frecuentemente (UI editor en Vista 2) → SQL sería rígido
- Validación + tipos en TS más expresivos que `case when` en SQL
- Tests unitarios triviales (función pura)
- El N de paquetes en cola raramente supera 200 (procesamiento O(N log N) es trivial)

Si en el futuro el N crece >5K, evaluamos migrar a una vista materializada
con refresh on-demand.

### D3 · Catálogo VE público + per-tenant copy on first use

`ve_locality_catalog` es **público** (sin RLS, accesible por todos los
tenants). Sirve como referencia inmutable (Estado → Municipio → Ciudad →
CP IPOSTEL + parroquias[] + barrios[]).

`dispatch_city_catalog` es **per-tenant**, se popula la primera vez con
`seedTenantCitiesFromVeCatalogAction`. El tenant puede:
- Agregar ciudades custom (ej: barrios que no están en IPOSTEL pero ellos
  operan ahí)
- Marcar ciudades como `is_hq` (hub principal del tenant)
- Editar `default_radius_km` (radio operativo desde el centro)

Costo de copia inicial: ~95 inserts. Razonable.

### D4 · Capacity snapshot en la OD al crearla

Cuando se crea una OD, copiamos `truck.capacity_kg` y `truck.capacity_cbm`
a `dispatch_orders.capacity_kg_snapshot` y `capacity_cbm_snapshot`.
Razones:

- El truck puede ser modificado/reemplazado mientras la OD existe
- El reporte de utilización debe mostrar % vs capacidad **al momento del despacho**, no al hoy
- Si el truck es eliminado, la OD sigue siendo auditable

### D5 · Carga fraccionada P1/P2 es OD nueva, no flag

Cuando un paquete no entra y se fracciona:
- **P1** (sale): queda en la OD actual con `boxes_shipped` < `boxes_total`
- **P2** (queda): se crea una **OD nueva** con status `creada`, sin camión/chofer, con `parent_od_id` apuntando a la P1 y el paquete con `boxes_total = boxes_original - boxes_shipped`

Razones:
- Mantiene state machine limpia (no hay estado "parcial" mixto)
- Auditable: cada movimiento físico es 1 OD
- Permite reasignar P2 a otra ruta/camión sin acoplar a la P1

### D6 · "Pago primero" es regla anclada, no slider

3 modos exclusivos seleccionables:
- `estricto` — solo paquetes `pagado` aparecen en la cola
- `hold` — no-pagados aparecen greyed-out, no se pueden crear OD con ellos
- `credito_whitelist` — clientes en `vip_markboxes[]` pueden despacharse sin pago

Esto es la política maestra del negocio. No se le da slider porque no es
un "peso más" — es un filtro estructural. Vista 2 la pone arriba con UI
explícita (radio buttons + whitelist editor).

### D7 · Rutas pueden ser "directas" o "intermedias" pero el modelo es uno

Una ruta directa es simplemente una ruta de tipo `intermedias` con array
`intermediate_cities = []`. No hay 2 tablas. El campo `type` es semántico
para la UI (cards visuales distintas) pero el storage es uniforme.

---

## 4. Schema (migración 0024_dispatch_core.sql)

### 4.1 · Enums

```sql
create type dispatch_order_status as enum (
  'creada', 'cargando', 'lista', 'en_ruta', 'entregada', 'cerrada', 'cancelada'
);

create type dispatch_hub as enum (
  'valencia', 'la_guaira', 'punto_fijo', 'maracaibo'
);

create type dispatch_payment_policy as enum (
  'estricto', 'hold', 'credito_whitelist'
);

create type dispatch_route_type as enum (
  'directa', 'intermedias'
);

create type dispatch_split_reason as enum (
  'falta_volumen', 'cliente_pidio_esperar', 'dano_caja',
  'documentacion_pendiente', 'otro'
);

create type dispatch_incident_severity as enum (
  'baja', 'media', 'alta', 'critica'
);
```

### 4.2 · Tabla `ve_locality_catalog` (público, seed)

```sql
create table public.ve_locality_catalog (
  state_code text not null,           -- 'CAR'
  state_name text not null,           -- 'Carabobo'
  state_region text not null,         -- 'Centro'
  state_capital text not null,
  municipio text not null,            -- 'Valencia'
  city text not null,                 -- 'Valencia'
  postal_code text not null,          -- '2001'
  parroquias text[] not null default '{}',
  barrios text[] not null default '{}',
  primary key (state_code, city)
);

comment on table public.ve_locality_catalog is
  'Catálogo público inmutable de localidades VE (24 estados + ~95 ciudades + CP IPOSTEL). Referencia para dispatch_city_catalog per-tenant.';

grant select on public.ve_locality_catalog to anon, authenticated;

-- Seed 95 filas (24 estados, ver dispatch_seed_ve_catalog.sql aparte si crece)
insert into public.ve_locality_catalog (state_code, state_name, ...) values
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Valencia', 'Valencia', '2001', ARRAY[...], ARRAY[...]),
  ...;
```

### 4.3 · Tabla `dispatch_routes`

```sql
create table public.dispatch_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  route_code text not null,                        -- 'R-002'
  name text not null,
  route_type dispatch_route_type not null default 'directa',
  hub dispatch_hub not null,
  origin_city text not null,
  destination_city text not null,
  intermediate_cities jsonb not null default '[]', -- [{city, radius_km, order}]
  sla_hours numeric not null check (sla_hours > 0),
  active boolean not null default true,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, route_code)
);

create index dispatch_routes_tenant_hub_idx
  on public.dispatch_routes (tenant_id, hub) where deleted_at is null and active = true;
```

### 4.4 · Tabla `dispatch_city_catalog`

```sql
create table public.dispatch_city_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  state_code text not null,
  state_name text not null,
  municipio text not null,
  city text not null,
  postal_code text,
  default_radius_km numeric not null default 5,
  is_hq boolean not null default false,
  active boolean not null default true,
  usage_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, state_code, city)
);

create index dispatch_city_catalog_tenant_idx
  on public.dispatch_city_catalog (tenant_id) where active = true;
```

### 4.5 · Tabla `dispatch_rules`

```sql
create table public.dispatch_rules (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  payment_policy dispatch_payment_policy not null default 'estricto',
  whitelist_markboxes text[] not null default '{}',  -- solo si policy = credito_whitelist
  weights jsonb not null default jsonb_build_object(
    'valencia', 40,
    'full_pay', 30,
    'partial_pay', 15,
    'fifo', 15,
    'vip', 10,
    'route_proximity', 5
  ),
  optional_rules jsonb not null default jsonb_build_object(
    'tier', false,
    'routes', true
  ),
  vip_markboxes text[] not null default '{}',
  updated_by uuid,
  updated_at timestamptz not null default now()
);

comment on table public.dispatch_rules is
  'Configuración del motor de scoring de despacho por tenant. 1 row por tenant. Editable via /studio/despacho/reglas.';
```

### 4.6 · Tabla `dispatch_orders` (entidad central)

```sql
create table public.dispatch_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_code text not null,                              -- 'OD-2026-0142'
  status dispatch_order_status not null default 'creada',
  hub dispatch_hub not null,

  -- Assignment (todos nullable hasta crear · luego required)
  route_id uuid references public.dispatch_routes (id),
  truck_id uuid references public.tms_trucks (id),
  driver_id uuid references public.tms_drivers (id),

  -- Capacity snapshots (al crear · auditable)
  capacity_kg_snapshot numeric,
  capacity_cbm_snapshot numeric,

  -- Totals (aggregate de los packages en el junction)
  total_kg numeric not null default 0,
  total_cbm numeric not null default 0,
  package_count int not null default 0,

  -- Cities ordered for visiting
  cities_ordered text[] not null default '{}',

  -- Lifecycle timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  departed_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  reassigned_at timestamptz,

  -- Progress runtime
  progress_pct int not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  current_city text,

  -- Cancel + Splits
  cancel_reason text,
  parent_od_id uuid references public.dispatch_orders (id),    -- si es P2 generada por split

  -- Audit
  created_by uuid,
  updated_by uuid,
  cancelled_by uuid,

  unique (tenant_id, order_code)
);

create index dispatch_orders_tenant_status_idx
  on public.dispatch_orders (tenant_id, status) where status not in ('cerrada', 'cancelada');

create index dispatch_orders_hub_status_idx
  on public.dispatch_orders (tenant_id, hub, status);

create index dispatch_orders_driver_idx
  on public.dispatch_orders (tenant_id, driver_id) where status = 'lista';
```

### 4.7 · Tabla `dispatch_order_packages`

```sql
create table public.dispatch_order_packages (
  od_id uuid not null references public.dispatch_orders (id) on delete cascade,
  package_kind text not null check (package_kind in ('warehouse_receipt_cn', 'warehouse_receipt_ve')),
  package_id uuid not null,                       -- FK polimórfico (FK explícito en Fase 2)
  markbox text not null,
  client_name text not null,
  city text not null,
  pay text not null check (pay in ('pagado', 'parcial', 'pendiente')),
  description text,
  boxes_total int not null,
  boxes_shipped int not null,                     -- = boxes_total si P1 sale completa, < si parcial
  weight_kg numeric not null,
  cbm numeric not null,
  hs_code text,
  aes_code text,
  split_reason dispatch_split_reason,             -- requerido si boxes_shipped < boxes_total
  split_reason_text text,                         -- texto libre si reason = 'otro'
  added_at timestamptz not null default now(),
  primary key (od_id, package_id)
);

create index dispatch_order_packages_markbox_idx
  on public.dispatch_order_packages (markbox);
```

### 4.8 · Extensión `warehouse_receipts_cn`

```sql
alter table public.warehouse_receipts_cn
  add column description text;

comment on column public.warehouse_receipts_cn.description is
  'Descripción de mercancía requerida por SENIAT (Aduana VE). NULLABLE en Fase 1 SDD-0029 para no romper el wizard /m/cn/nueva del operario CN existente. Una fase posterior decidirá hacerlo NOT NULL con 5to step opcional.';
```

### 4.9 · RPCs

```sql
create or replace function public.next_dispatch_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max int;
  v_next text;
begin
  select coalesce(max(substring(order_code from 'OD-' || v_year || '-(\d+)$')::int), 0)
    into v_max
  from public.dispatch_orders
  where tenant_id = p_tenant_id
    and order_code like 'OD-' || v_year || '-%';

  v_next := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  return v_next;
end;
$$;

grant execute on function public.next_dispatch_order_code(uuid) to authenticated;
```

Idéntico patrón para `next_route_code`.

`upsert_dispatch_rules`:

```sql
create or replace function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb)
returns public.dispatch_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.dispatch_rules;
begin
  insert into public.dispatch_rules (tenant_id, payment_policy, whitelist_markboxes, weights, optional_rules, vip_markboxes, updated_by, updated_at)
  values (
    p_tenant_id,
    coalesce((p_payload->>'payment_policy')::dispatch_payment_policy, 'estricto'),
    coalesce(array(select jsonb_array_elements_text(p_payload->'whitelist_markboxes')), '{}'),
    coalesce(p_payload->'weights', jsonb_build_object(...)),
    coalesce(p_payload->'optional_rules', jsonb_build_object('tier', false, 'routes', true)),
    coalesce(array(select jsonb_array_elements_text(p_payload->'vip_markboxes')), '{}'),
    auth.uid(),
    now()
  )
  on conflict (tenant_id) do update set
    payment_policy = excluded.payment_policy,
    whitelist_markboxes = excluded.whitelist_markboxes,
    weights = excluded.weights,
    optional_rules = excluded.optional_rules,
    vip_markboxes = excluded.vip_markboxes,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;
```

### 4.10 · RLS

```sql
alter table public.dispatch_orders enable row level security;
alter table public.dispatch_order_packages enable row level security;
alter table public.dispatch_routes enable row level security;
alter table public.dispatch_city_catalog enable row level security;
alter table public.dispatch_rules enable row level security;

-- Policies: el usuario debe estar en user_tenants con el mismo tenant_id
create policy dispatch_orders_tenant_isolation on public.dispatch_orders
  using (tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid()));
-- (idéntico para los 4 restantes; junction usa join al OD)
```

### 4.11 · Trigger guard de transición

```sql
create or replace function public.dispatch_orders_status_transition_guard()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido cualquier transición desde 'cerrada', 'cancelada'
    if old.status in ('cerrada', 'cancelada') then
      raise exception 'No se puede modificar status desde %', old.status;
    end if;
    -- 'entregada' solo puede ir a 'cerrada'
    if old.status = 'entregada' and new.status <> 'cerrada' then
      raise exception 'Desde entregada solo se puede ir a cerrada';
    end if;
    -- 'lista' no puede volver a 'cargando'
    if old.status = 'lista' and new.status = 'cargando' then
      raise exception 'No se puede retroceder de lista a cargando';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger dispatch_orders_status_guard
  before update on public.dispatch_orders
  for each row execute function public.dispatch_orders_status_transition_guard();
```

---

## 5. Algoritmo de scoring (`dispatch-scoring.ts`)

Función pura `scorePackage(pkg, rules, today)`:

```typescript
export function scorePackage(
  pkg: EligiblePackage,
  rules: DispatchRules,
  today: Date,
): number {
  const w = rules.weights;
  let score = 0;

  // Pago (mutuamente exclusivo)
  if (pkg.pay === "pagado") score += w.full_pay;
  else if (pkg.pay === "parcial") score += w.partial_pay;

  // FIFO antigüedad (lineal saturado a 21 días)
  const days = daysSince(pkg.received_at, today);
  score += Math.min(days / 21, 1) * w.fifo;

  // Ciudad principal
  if (pkg.city === "Valencia" || pkg.city === "Caracas") score += w.valencia;

  // VIP markbox
  if (rules.vip_markboxes.includes(pkg.markbox)) score += w.vip;

  // Cercanía a ruta del día (precalculado en la query)
  if (pkg.route_proximity != null) {
    score += (pkg.route_proximity / 5) * w.route_proximity;
  }

  return Math.min(100, Math.round(score));
}

export function scoreLevel(score: number): "critico" | "alto" | "medio" | "bajo" {
  if (score >= 80) return "critico";
  if (score >= 65) return "alto";
  if (score >= 45) return "medio";
  return "bajo";
}
```

Tests en `lib/studio/__tests__/dispatch-scoring.test.ts` cubren:
- Paquete pagado + Valencia + 21+ días → score ≥ 80 (crítico)
- Paquete pendiente + city externa + 1 día → score < 45 (bajo)
- Cliente VIP boost +10 en cualquier caso
- Route proximity 5 → full weight, 0 → nada

---

## 6. State machine completa

| De | A | Trigger | Quién | Validación |
|---|---|---|---|---|
| (init) | `creada` | `createDispatchOrderAction` | Admin | truck/driver/route required |
| `creada` | `cargando` | `bodegueroAdvanceOd('cargando')` | Bodeguero (SDD-0030) | bodeguero abre app |
| `cargando` | `lista` | `bodegueroAdvanceOd('lista')` | Bodeguero (SDD-0030) | "Cerrar carga" |
| `lista` | `en_ruta` | `camioneroAdvanceOd('en_ruta')` | Camionero (SDD-0030) | "Iniciar ruta" |
| `en_ruta` | `entregada` | `camioneroAdvanceOd('entregada')` | Camionero (SDD-0030) | última POD confirmada |
| `entregada` | `cerrada` | `closeDispatchOrderAction` | Admin | "Cerrar día" |
| `*` (no terminal) | `cancelada` | `cancelDispatchOrderAction` | Admin | motivo obligatorio |

**En Fase 1 solo se exponen 3 transiciones:** `(init)→creada`, `creada/cargando→cancelada`, `entregada→cerrada`. Las demás llegan con SDD-0030 cuando hay apps móviles.

---

## 7. Permisos por rol

| Acción | Admin tenant | Operario (cn/ve) | Cliente externo |
|---|---|---|---|
| Ver cola pendientes | ✓ | ✗ (Fase 1) | ✗ |
| Crear OD / Asignar camión | ✓ | ✗ | ✗ |
| Cancelar OD | ✓ | ✗ | ✗ |
| Cerrar día (entregada → cerrada) | ✓ | ✗ | ✗ |
| Configurar reglas (Vista 2) | ✓ | ✗ | ✗ |
| Editar rutas/ciudades | ✓ | ✗ | ✗ |
| Seedear ciudades del catálogo VE | ✓ | ✗ | ✗ |
| Ver dashboard | ✓ | ✗ | ✗ |

En Fase 1 todo el módulo Despacho es admin-only. Las apps móviles SDD-0030
agregan los permisos de bodeguero/camionero.

---

## 8. Casos borde

| Caso | Comportamiento |
|---|---|
| Crear OD sin paquetes seleccionados | Botón "Confirmar" disabled · banner "Seleccioná al menos 1 paquete" |
| Capacity excedida (kg o cbm > 100%) | Botón "Confirmar" disabled · banner rojo "Excede capacidad" con valores |
| Camión sin chofer asignado en TMS | Selector chofer aparece con opciones disponibles del hub del camión |
| Cancelar OD con paquetes ya en `cargando` | Confirm dialog "Los paquetes vuelven a la cola" + motivo obligatorio · rollback automático |
| Cancelar OD `lista` (bodeguero ya cerró) | Same flow, pero warning extra: "El bodeguero será notificado" (futuro push) |
| Ruta editada después de tener ODs activas | OK · cambios afectan solo ODs futuras (las activas tienen snapshot del nombre de ruta en el render) |
| Reglas guardadas con todos los pesos = 0 | Permitido · score = 0 para todos · cola muestra orden de llegada (FIFO puro) |
| `payment_policy = credito_whitelist` con whitelist vacía | Permitido · equivale a `estricto` (nadie hace match) |
| Ciudad agregada por tenant duplica una del catálogo público | OK · `dispatch_city_catalog` tiene `unique(tenant_id, state_code, city)` · si choca el insert falla con error claro |
| Catálogo VE no seedeado (tenant nuevo) | Banner amarillo en `/studio/admin/rutas` con CTA "Seedear desde catálogo VE" |
| Concurrent edit de rules (dos admins) | `upsert_dispatch_rules` es last-write-wins · sin lock optimista en Fase 1 |
| Trigger guard rechaza transición | Server action devuelve `{ error: 'Transición no permitida: X → Y' }` |

---

## 9. Riesgos y mitigación

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | El campo `description` nullable en Fase 1 deja recepciones CN sin descripción · operario olvida llenarla post-fact | Media | Reporte "Recepciones sin descripción" en Almacén CN. Decisión NOT NULL queda en SDD futuro post-bodeguero. |
| R2 | Scoring runtime en TS no escala >5K paquetes | Baja (improbable) | Materialized view si llega ese N. Hoy improbable. |
| R3 | Junction polimórfico `dispatch_order_packages` no tiene FK explícito | Media | FK explícito en SDD-0030 cuando se decida si los packages quedan en `warehouse_receipts_ve` separado. Trade-off aceptable Fase 1. |
| R4 | Catálogo VE público mal seedeado (datos IPOSTEL desactualizados) | Baja | Re-run del seed regenera la tabla. Tenant que ya copió queda con su versión. |
| R5 | Trigger guard rompe migration retroactiva si hay rows inválidas | Baja | Migration es fresh; no hay rows previas. Trigger creado al final. |
| R6 | RLS de `dispatch_order_packages` por join al OD agrega latencia | Media | Index `dispatch_order_packages (od_id)` ya en PK compuesta. Si el plan lo justifica, política directa con tenant_id denormalizado. |
| R7 | El admin cancela OD pero ya hay POD parcial (caso edge SDD-0030) | Baja Fase 1 | No aplicable Fase 1 (no hay POD). Volver a evaluar en SDD-0030. |
| R8 | Concurrent assign (2 admins clic "Crear OD" para el mismo paquete) | Media | El paquete queda asignado al primero que escribe (junction PK compuesta evita duplicados). El segundo recibe error y se le actualiza la lista. |

---

## 10. Plan de fases del bundle v1.6

### Fase 1 (este SDD-0029)
Módulo Despacho admin web · sin apps móviles · `description` nullable.

### Fase 2 (SDD-0030)
PWAs bodeguero VE + camionero VE · enum `operario_role` extendido · bucket fotos reuso · Realtime para banners.

### Fase 3 (SDD-0031 + SDD-0032)
Etiquetas CN (label-generator + 4 formatos PDF) + cross-links + MARKBOX validation + email bienvenida.

### Fase 4 (SDD-0033 + SDD-0034)
QR queue realtime (Supabase Realtime) + DTDWiring 6 modals (Attach, Schedule, Profile, Shortcuts, GenerateBL, OAuth).

### Fase 5 (SDD-0035)
RecentActivity clickeable + CodesSync persistente + pulido cross-module.

---

## 11. Open questions

1. **¿Sub-sección colapsable de "Despacho" en sidebar?** Hoy las 4 entries quedan inline en OPERACIÓN. Si pesa visualmente, podemos colapsar en una sola entrada "Despacho" con sub-items. Pendiente del UI/UX review.
2. **¿Realtime ya en Fase 1 o esperamos SDD-0030?** Mi propuesta: esperamos. El admin no necesita ver el panel de ODs activas refrescándose cada 2s — `revalidatePath` después de mutaciones es suficiente en Fase 1.
3. **¿Permitir editar OD en estado `creada` o solo cancelar+recrear?** Mi propuesta: solo `assignTruckDriverAction` mientras está en `creada/cargando`. Cambiar paquetes requiere cancelar.
4. **¿Cómo se eligen los paquetes elegibles?** Hoy `listEligiblePackages` filtra `warehouse_receipts_cn` con `status='received'` y `not exists in dispatch_order_packages`. Cuando portemos `warehouse_receipts_ve`, ese será el origen real.
5. **¿Seed VE catalog en migration o en seed script separado?** Mi propuesta: 95 inserts inline en la migration. Si crece >500, mover a un script.

---

## 12. Origen y trazabilidad

- **Bundle origen:** `docs/design/studio/v1.6-claude-design/handoff/SDD-2026-05-25-sesion/`
- **Briefs leídos:** `BRIEFS/01-despacho.md`
- **Source JSX referencia:**
  - `source/erp/od-bridge.jsx` (pipeline localStorage · port a server actions)
  - `source/erp/modules/despacho.jsx` (Vista 1 · ~1500 líneas)
  - `source/erp/modules/despacho-rules.jsx` (Vista 2)
  - `source/erp/modules/despacho-dashboard.jsx` (Reportes)
  - `source/erp/modules/admin-routes.jsx` (CRUD)
  - `source/erp/modules/venezuela-catalog.jsx` (seed)
- **Mockups standalone (preview-only, NO se portan):** `source/_standalones/Despacho · Vista {1,2,3}.html`, `Admin · Rutas.html`, `Camionero.html`
- **Convención del repo aplicada:**
  - Pattern de módulo del Studio (page.tsx + _components/ + actions.ts) según `app/studio/CLAUDE.md`
  - Tokens-only · sentence case en CTAs · castellano rioplatense
  - Validación con `validate*Input()` propio · sin Zod
  - Multi-tenant con RLS por `tenant_id`
  - Soft delete vía `deleted_at = now()` en routes
  - Códigos correlativos vía RPCs `next_*_code`
