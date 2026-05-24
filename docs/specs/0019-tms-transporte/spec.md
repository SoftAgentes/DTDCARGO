---
sdd: "0019"
title: "DoorTuDoor — TMS · Transporte interno VE"
status: approved
author: "founder"
created: 2026-05-25
updated: 2026-05-25
supersedes: null
superseded_by: null
related: ["0005", "0017", "0018"]
---

# DTD-0019 — TMS · Transporte interno VE

> **Sistema de gestión de transporte para la última milla DDP.** Flota +
> choferes + rutas + incidencias. Cierra Sprint 3 (Operación profunda)
> integrándose con SDD-0017 VE (refactor de "Asignar reparto") y
> SDD-0018 SENIAT (rutas solo para shipments liberados).

---

## 1. Resumen en una línea

`/studio/tms` muestra 5 tabs (GPS Live · Flota · Choferes · Rutas ·
Incidencias) con CRUD básico de las 4 entidades, integración con shipments
liberados de aduana, y refactor del flow VE "Asignar reparto" que hoy usa
`window.prompt()`.

---

## 2. Scope

### Incluye

#### Schema (migración 0011)

- 4 enums:
  - `truck_status`: `disponible` / `cargando` / `en_ruta` / `mantenimiento`
  - `driver_status`: `disponible` / `cargando` / `en_ruta` / `descanso`
  - `tms_route_status`: `planificado` / `en_ruta` / `completado` / `cancelado`
  - `tms_incident_type`: `mantenimiento` / `multa` / `combustible` / `accidente`
- 4 tablas:
  - **`tms_trucks`** (flota, RLS por tenant):
    id, tenant_id, plate text, brand, vehicle_type text, hub_code (PBL/LGU/MAR/PFI),
    owned bool, capacity_cbm numeric, capacity_kg numeric, driver_id FK nullable,
    km int, fuel_type text, consumption_km_l numeric, next_service_at date,
    status truck_status, notes, deleted_at, created_at, updated_at
  - **`tms_drivers`** (choferes, RLS por tenant):
    id, tenant_id, name, cedula text unique-per-tenant, phone, email,
    license_class text ('A·B·C', 'A·B·C·D', etc.), license_expires date,
    hub_code, exp_years int, rating numeric(2,1), trips_30d int (denorm),
    last_trip date, address, emergency_contact, safety_certified bool,
    status driver_status, notes, deleted_at, created_at, updated_at
  - **`tms_routes`** (rutas RLS por tenant, FK 1:N con shipment_id):
    id, tenant_id, route_code text (R-YYYY-NNNN), shipment_id FK NOT NULL,
    truck_id FK, driver_id FK, stops jsonb (array de strings), distance_km int,
    progress_pct int (0-100), eta_at timestamptz, status tms_route_status,
    started_at, completed_at, notes, deleted_at, created_at, updated_at
  - **`tms_incidents`** (incidencias, RLS por tenant):
    id, tenant_id, incident_code text (I-YYYY-NNNN), truck_id FK, route_id FK nullable,
    incident_type tms_incident_type, occurred_at date, description, cost_usd numeric(10,2),
    status text ('pendiente'/'pagado'/'resuelto'), created_at, updated_at
- Funciones:
  - `next_route_code(tenant_id)` → R-YYYY-NNNN
  - `next_incident_code(tenant_id)` → I-YYYY-NNNN
- Triggers:
  - Auto-sync `tms_routes.started_at = now()` cuando status pasa a `en_ruta`
  - Auto-sync `tms_routes.completed_at = now()` cuando pasa a `completado`
- Seed: 3 trucks + 3 drivers + 0 routes + 0 incidents (mock data baseline para testear)
- RLS por tenant en las 4 tablas

#### Lib

- `lib/studio/tms-types.ts`:
  - Types de las 4 entidades + Row types con joins (RouteRow con truck+driver+shipment join)
  - LABELS + TONES de cada status enum
  - `VE_HUBS` const reusado (de SDD-0018 customs-types)
  - Helpers: `truckMileageColor(km)` (warning si >180K), `driverRatingLabel`, validate inputs (sin zod)

- `lib/studio/tms-queries.ts`:
  - `listTrucks(supabase, filters)` — filters por hub, status, owned
  - `listDrivers(supabase, filters)` — filters por hub, status
  - `listRoutes(supabase, filters)` — join con truck/driver/shipment, filters por status
  - `listActiveRoutes(supabase)` — status=en_ruta para GPS Live tab
  - `listIncidents(supabase, filters)` — filters por truck, type, last 30d
  - `listEligibleShipmentsForRoute(supabase)` — status IN (arrived_destination) sin route activa
  - `listAvailableTrucks(supabase)` y `listAvailableDrivers(supabase)` para form de Route
  - `computeTmsKpis(supabase)` — totales + en ruta + disponibles + mantenimiento
  - `computeIncidentsKpis(supabase)` — total mes + breakdown por type

#### Componentes (`app/studio/(app)/tms/_components/`)

- `TmsKpis.tsx` (server) — 4 KPI cards
- `TmsClient.tsx` (client) — orquestador con 5 tabs URL-state + drawers
- `TmsHeaderActions.tsx` (client) — botón "+ Nuevo {entidad}" contextual al tab activo
- `GpsLiveTab.tsx` (server, recibe routes y trucks) — V1 SIN mapa SVG:
  - Lista de rutas activas como cards (igual JSX, sin mapa)
  - Sub-card "Alertas de flota" (V1 mock: 3 alertas hardcoded del JSX o computadas simples)
- `FleetTab.tsx` (server) — tabla con columnas: plate / brand+type / hub badge / owned (badge) / capacity / driver avatar / km / status badge
- `DriversTab.tsx` (server) — grid de cards (auto-fill 320px) con avatar + name + rating + status + license + hub + trips30d + phone
- `RoutesTab.tsx` (server) — lista con grid: route_code / shipment / stops chips → / distance / progress bar / status badge
- `IncidentsTab.tsx` (server) — 4 sub-KPIs + lista de incidencias
- `TruckDrawer.tsx` (client) — form de Truck (igual JSX TruckForm)
- `DriverDrawer.tsx` (client) — form de Driver
- `RouteDrawer.tsx` (client) — form de Route con stops builder dinámico + integración shipment (lee `?shipment=<id>` si viene del refactor VE)
- `TruckStatusBadge`, `DriverStatusBadge`, `RouteStatusBadge` (server, puro)

#### Page

- `app/studio/(app)/tms/page.tsx` (reemplaza placeholder):
  - Server, fetchea en paralelo según tab activo
  - Renderiza header + KPIs + TmsClient

#### Server actions

- `app/studio/(app)/tms/actions.ts`:
  - `createTruckAction(formData)` — valida + insert
  - `createDriverAction(formData)` — valida + insert
  - `createRouteAction(formData)` — valida + insert route + sync `shipment.status = out_for_delivery` + insert shipment_event + update truck.status + driver.status a `en_ruta`
  - `markRouteCompletedAction(routeId)` — status=completado + sync shipment.status=last_mile (o delivered si está cerca) + truck/driver vuelven a `disponible` + completed_at trigger
  - `markRouteStartedAction(routeId)` — status=en_ruta + started_at
  - `addIncidentAction(formData)` — insert incident, opcionalmente cambia truck.status a `mantenimiento`
  - `updateTruckStatusAction(truckId, status)` — cambio simple inline

#### Refactor VE (SDD-0017)

- `app/studio/(app)/ve/_components/VeRowActions.tsx`:
  - Acción `assign_delivery`: en lugar de `window.prompt()`, navegar a
    `/studio/tms?view=create&shipment=<id>` (RouteDrawer del TMS pre-llena el shipment).
  - Mantenemos `assignDeliveryAction` en VE para casos de assign manual sin TMS,
    pero el flow principal va por TMS.

### NO incluye (diferidos)

- **Mapa GPS real con AIS/GPS tracker** → SDD-0019.1
- **WhatsApp notification al chofer** al crear ruta (con stops + Google Maps link)
  → SDD-0019.2 (Twilio/WhatsApp Business API)
- **Alertas dinámicas computadas** (mantenimiento programado por km, license_expires
  warning, etc.) → SDD-0019.3
- **Optimización de rutas** (algoritmo que minimiza distancia con N stops) → SDD-0019.4
- **Mobile app del chofer** (POD + tracking en tiempo real) → SDD-0019.5
- **Edit de truck/driver/route existentes** → V1 solo create + status change. Edit completo SDD futuro
- **Multi-shipment por ruta** (route que entrega N shipments en 1 viaje) → V1
  1 route = 1 shipment. Multi en SDD-0019.6
- **Cálculo automático de combustible/costos por ruta** → V1 incidents manuales
- **Histórico de servicios / mantenimientos planificados** → V1 solo next_service_at
  como flag visual. Tabla `tms_maintenance_log` en SDD-0019.7

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0019-tms-transporte/spec.md
supabase/migrations/0011_tms_schema.sql
lib/studio/tms-types.ts
lib/studio/tms-queries.ts
app/studio/(app)/tms/
├── page.tsx
├── actions.ts
└── _components/
    ├── TmsClient.tsx
    ├── TmsHeaderActions.tsx
    ├── TmsKpis.tsx
    ├── GpsLiveTab.tsx
    ├── FleetTab.tsx
    ├── DriversTab.tsx
    ├── RoutesTab.tsx
    ├── IncidentsTab.tsx
    ├── TruckDrawer.tsx
    ├── DriverDrawer.tsx
    ├── RouteDrawer.tsx
    ├── TruckStatusBadge.tsx
    ├── DriverStatusBadge.tsx
    └── RouteStatusBadge.tsx
```

### Editados

```
app/studio/(app)/tms/page.tsx                            ← era placeholder
app/studio/(app)/ve/_components/VeRowActions.tsx        ← assign_delivery → link TMS
docs/design/v1-studio/module-map.md                      ← marcar TMS ✅ + cerrar Sprint 3
```

---

## 4. Decisiones de diseño

### 4.1 4 tablas separadas (truck / driver / route / incident)

**Por qué:** cada entidad tiene CRUD propio, queries independientes, filters
distintos. JSONBs en `trucks` perderían reportes ("total gastado en
mantenimientos por truck"), forecasting, etc.

Trade-off aceptado: 4 migrations RLS, 4 grants, 4 indexes core. Costo pagado
1 vez, beneficio multiplicado.

### 4.2 Sin mapa SVG GPS V1 — diferir a SDD-0019.1

**Por qué:** el mapa del JSX tiene posiciones HARDCODED en `positions = {...}`.
No es GPS real. Implementarlo V1:
- Cosmético: posiciones fake siempre
- Confunde al operador: "¿es realtime o mock?"
- Refactor obligado cuando llegue AIS

V1: tab "GPS Live" muestra la **lista de rutas activas** + alertas de flota.
Es la información operativa real que el operario necesita ("DTDU-0009 va a
55% camino a Valencia, ETA 14:30"). Cuando llegue integración AIS
(Marine Traffic / GPS tracker de los camiones), SDD-0019.1 agrega el mapa.

### 4.3 Drivers como cards (no tabla)

**Por qué:** match exacto JSX. La info por chofer (avatar + nombre + rating
estrella + status + license + hub + trips30d + phone) es densa pero PERSONAL.
Card 320px ancho transmite "este es un humano que maneja un camión".

Tabla densa perdería el avatar y el rating estrella (visualmente importante).

### 4.4 Integración VE → TMS (refactor + link)

**Por qué:** `assignDeliveryAction` en VE usa `window.prompt()` para pedir
dirección. Es la deuda técnica #1 que el agente flageó en SDD-0017 y SDD-0018.

TMS es el lugar natural para asignar reparto real:
- Operario en VE ve shipment "Listo retiro" → click "Asignar reparto"
- En vez de prompt(), navegar a `/studio/tms?view=create&shipment=<id>`
- RouteDrawer del TMS abre pre-llenado con el shipment + auto-suggest truck disponible + driver del hub correspondiente
- Al crear la ruta, `shipment.status = out_for_delivery` (sync)
- Truck y driver pasan a `en_ruta`

Mantenemos `assignDeliveryAction` en VE existente para edge cases (operario
quiere marcar manualmente sin TMS), pero el flow principal va por el módulo
correcto.

### 4.5 Códigos auto-generados R-YYYY-NNNN y I-YYYY-NNNN

**Por qué:** consistente con WR / DUA / Q / WV de otros módulos. Año + counter
por tenant.

### 4.6 Auto-sync de estados truck/driver al crear/completar ruta

**Por qué:** estado distribuido sería pesadilla mantener manual:
- Crear ruta → truck=`en_ruta`, driver=`en_ruta`, shipment=`out_for_delivery`
- Completar ruta → truck=`disponible`, driver=`disponible`, shipment=`last_mile` o `delivered`

Server action `createRouteAction` y `markRouteCompletedAction` orquestan
los 3 updates en sequencia. Si alguno falla, log error pero no rollback
(las actualizaciones son idempotentes — el operario puede corregir manualmente).

### 4.7 V1 sin edit de entidades, solo create + status change

**Por qué:** el JSX no muestra forms de edit. Foco V1 = registrar + cambiar
estado. Edit complejo (truck cambió de hub, driver actualizó cédula) es
suficientemente raro para diferir.

Excepción: `updateTruckStatusAction` para cambios manuales de mantenimiento /
disponible es V1 (común y bloqueador).

### 4.8 Incidents tab con 4 sub-KPIs + lista simple

**Por qué:** el JSX muestra 4 sub-KPIs específicos del tab (Total mes /
Combustible / Mantenimientos count / Multas count). V1 igual. Cuando se
necesite analytics más fino (gráfico mes a mes, breakdown por chofer),
SDD-0019.7 lo agrega.

---

## 5. Criterios de aceptación

### Funcional

- [ ] `/studio/tms` muestra 4 KPIs + 5 tabs
- [ ] Tab "GPS Live" muestra rutas activas con progress bar + 3 alertas mock
- [ ] Tab "Flota" lista trucks seedeados con todos los campos
- [ ] Tab "Choferes" muestra cards con avatar + datos completos
- [ ] Tab "Rutas" lista routes con stops chips + progress bar
- [ ] Tab "Incidencias" muestra 4 sub-KPIs + lista
- [ ] "+ Nuevo camión/chofer/ruta" cambia label según tab activo
- [ ] CreateRouteDrawer pre-llena shipment si `?shipment=<id>`
- [ ] Crear ruta sync shipment.status → out_for_delivery + truck/driver → en_ruta
- [ ] Marcar ruta completada sync truck/driver → disponible
- [ ] VE: click "Asignar reparto" navega a TMS create con shipment pre-seleccionado
- [ ] Códigos R-YYYY-NNNN y I-YYYY-NNNN auto-generados

### Sistema

- [ ] `pnpm typecheck` pasa
- [ ] Migration 0011 corre limpia
- [ ] RLS funciona en 4 tablas
- [ ] Sidebar marca "TMS · Transporte" como active
- [ ] Componentes pasan ui-ux-designer review

---

## 6. Out of scope / open questions

### Out V1 (cubierto en sección 2)

Mapa GPS real, WhatsApp notification, alertas dinámicas, optimización de
rutas, mobile app chofer, edit completo, multi-shipment por ruta, cálculo
combustible auto, histórico mantenimiento.

### Open questions resueltas

- ✅ **Schema** → 4 tablas separadas
- ✅ **Mapa SVG GPS** → diferir a SDD-0019.1
- ✅ **Drivers display** → cards (match JSX)
- ✅ **Integración VE** → refactor + link

### Open questions diferidas

- **¿Multi-driver por ruta?** Raro pero posible (ruta de 2 días con cambio
  de turno). V1 1 driver fijo. Si aparece necesidad, columna nullable
  `co_driver_id`.
- **¿Routes históricos > 30 días deben archivarse?** V1 query no pone límite
  temporal. Si la tabla crece, paginate o archive.
- **¿Cancellation reason en routes?** V1 sí, columna `cancellation_reason`
  nullable (mismo patrón shipments).
