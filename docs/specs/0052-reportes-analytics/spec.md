---
sdd: "0052"
title: "Reportes & Analytics — capa de presentación sobre agregados existentes (Bloque 5); Slice A = Operacionales + Overview"
status: approved
author: "Claude Code (carril Bloque 5 · Norte v2.4)"
created: 2026-06-03
updated: 2026-06-04
supersedes: null
superseded_by: null
related: ["0048", "0021", "0041", "0044", "0047", "0051", "0002"]
confidencialidad: interno
---

# DTD-0052 — Reportes & Analytics

> **Bloque 5.** Reemplaza el stub `/studio/reportes` por el módulo de analytics del Norte
> (`erp/modules/reports.jsx`): 5 categorías (Operacionales · Comerciales · Contables/financieros ·
> Combinados · Constructor) navegables en 2 niveles + selector de período + export. Como **Dirección
> (0048)**, es **capa de presentación que COMPONE agregados que ya existen** — **sin migración**.
> Esta spec entrega **Slice A = Operacionales + Overview** (decisión founder).

## 1. Resumen en una línea

Dashboard de reportes en 2 niveles (categoría → reporte) sobre datos reales del ERP, **sin tablas
nuevas**: Slice A cubre la categoría **Operacionales** (Overview · Rutas · Navieras · Servicios)
anclada a `shipments` + `invoices` + naviera.

## 2. Por qué (grounding)

- **Hueco:** `/studio/reportes` es un stub (`EmptyState`, 13 líneas). El Norte ya diseñó el módulo
  completo (`reports.jsx`, 1134 líneas) — 14 reportes en 5 categorías con charts.
- **Casi todo es reuse:** los agregados que los reportes necesitan **ya están construidos y testeados**:
  `profitAndLoss` (Contabilidad 0040), `collectionKpis` (Cobranzas 0041), `treasuryKpis` (Tesorería
  0044), `navieraKpis` (Naviera 0047), `clientsWithTier`/`clientAnnualBilling` (Fidelización 0051),
  `invoiceKpis` (Facturación 0021), `getOperationalCounts` (dashboard). Reportes es presentación, no
  cálculo nuevo — mismo patrón que **Dirección (0048)**: **0 tablas, 0 migración**.
- **Simetría:** cierra la capa analítica transversal del ERP; toda la operación/finanza/comercial ya
  produce datos, faltaba el lugar para verlos cruzados y exportables.

## 3. Decisiones ancladas

1. **Sin migración.** Capa de presentación pura sobre tablas existentes (patrón Dirección 0048).
2. **Anclar a datos reales, omitir lo que no tiene fuente.** El Norte tiene mucho mock hardcodeado;
   esta spec **solo** muestra lo que sale de la DB:
   - **Revenue por ruta/servicio** = cruce con `invoices` (tienen `shipment_id`/`shipment_code`),
     no un campo de `shipments`.
   - **On-time %** se **OMITE en V1** (no hay campo ETA/SLA en `shipments`). Se reemplaza por métricas
     reales (embarques, CBM movido, activos, entregados). On-time = V2 (necesita ETA/SLA).
   - **"Por naviera"** = agregado de `bookings`/`sailings` (0096) por carrier (real pero **limitado**
     hasta que haya volumen de bookings; `EmptyState` honesto si no hay datos).
3. **Período server-side:** selector `1M | 3M | 1A | YTD` (default `1A`), resuelto en el server como
   rango `{from, to}` y pasado por `?period=`. Filtra por `created_at` del embarque (y `issued_at`/
   `created_at` de la factura para revenue).
4. **Export CSV y mapa SVG del corredor → diferidos.** El export va con el **Constructor (Slice C)**;
   el mapa del corredor es nice-to-have (Slice A usa charts simples tokenizados, no el SVG-map).
5. **Slices:**
   - **A (esta corrida)** = foundation `lib/studio/reports/` + UI: nav de categorías (Operacionales
     activa; las otras 4 visibles pero deshabilitadas con "Próximamente · Slice B/C") + nivel-2
     (Overview · Rutas · Navieras · Servicios) + selector de período.
   - **B** = categorías **Comerciales** (Por cliente / Por agente) + **Contables/financieros**
     (Estado de resultados / Aging / Cashflow) + **Combinados** (rentab. ruta / margen cliente /
     costo CBM) — casi todo reuse de los agregados existentes.
   - **C** = **Constructor** (report builder: fuente→agrupar→métrica→filtro) + **export CSV/PDF**.

## 4. Approach — Slice A (Operacionales + Overview)

### `lib/studio/reports/types.ts` (puro, sin Zod)
- `ReportPeriod = '1M' | '3M' | '1A' | 'YTD'` + `PERIOD_OPTIONS` (label) + `periodRange(period, today)`
  → `{ from, to }` (YYYY-MM-DD; `1A` = trailing 12m, `YTD` = 1° de enero del año).
- Tipos de salida: `OperationalOverview`, `RouteRow`, `ServiceRow`, `CarrierRow`, `MonthlyVolumePoint`,
  `PortSplitRow`.
- Helpers puros (testeables): `transitDays(shipment)` (`delivered_at ?? arrived_destination_at` −
  `created_at`, null si falta), `ratePerCbm(revenueUsd, cbm)` (0 si cbm≤0), `routeKey(origin,
  destination)` + label, `monthlyBuckets(rows, range)` (cuenta embarques/CBM por mes), `serviceLabel`
  (reusa `SERVICE_LABELS` de `lib/shared/shipment-public`).
- `groupByRoute(shipments, revenueByCode)` / `groupByService(shipments, revenueByCode)` → arrays
  ordenados desc por revenue (y count como desempate), con count/cbm/avgTransit/revenue/rate.

### `lib/studio/reports/queries.ts` (puras, reciben `SupabaseClient`; RLS por tenant)
- `operationalOverview(supabase, period, today?)` → `{ shipments, cbm, revenueUsd, active, monthly[],
  portSplit[], transitByPort[] }`. Lee `shipments` del rango + `invoices` del rango (revenue
  USD-normalizado reusando `invoiceUsdAmount` de `lib/studio/fidelizacion/types` o un helper local);
  `active` reusa estados en tránsito/aduana.
- `reportByRoute(supabase, period, today?)` → `RouteRow[]` (group por `origin→destination`).
- `reportByService(supabase, period, today?)` → `ServiceRow[]` (group por `shipment_service`).
- `reportByCarrier(supabase, period, today?)` → `CarrierRow[]` desde `bookings`/`sailings` (0096):
  count de bookings por carrier + sailings asociados. `EmptyState` si no hay bookings.
- Revenue join: una sola query de `invoices` del período → `Map<shipment_code, usd>` → se pasa a los
  `groupBy*` puros (sin N+1).

### UI — `app/studio/(app)/reportes/`
- `page.tsx` (server, **reemplaza el stub**): lee `?period=` (default `1A`) + `?cat=`/`?rep=`; carga en
  paralelo los 4 agregados operacionales; pasa a `ReportesClient`.
- `_components/ReportesClient.tsx` (`"use client"`): **nivel 1** = chips de categoría (Operacionales
  activa; Comerciales/Contables/Combinados/Constructor deshabilitadas con tooltip "Próximamente");
  **nivel 2** = tabs Overview/Rutas/Navieras/Servicios; selector de período en el header (navega por
  URL). 4 vistas: Overview (KpiCards + volumen mensual + split por puerto/destino + tránsito por
  puerto), Rutas (tabla origen→destino con barras), Navieras (tabla desde bookings o EmptyState),
  Servicios (mix por `shipment_service` + revenue). Charts SVG **simples y tokenizados** (barras de
  volumen, donut de servicios) o `KpiCard`+barras de progreso. Solo `var(--*)`, primitivas del sistema.
- `_components/charts.tsx` (opcional): mini-charts SVG tokenizados reutilizables (bar, donut) si ayuda.

### Tests Vitest (`lib/studio/reports/__tests__/`)
- `types.test.ts`: `periodRange` (1M/3M/1A/YTD bordes de año), `transitDays` (delivered/arrived/null),
  `ratePerCbm` (cbm 0 → 0), `groupByRoute`/`groupByService` (agrupación + orden + revenue join +
  count desempate), `monthlyBuckets`.
- `queries.test.ts`: stub `SupabaseClient` que registra filtros → asserta rango por período aplicado
  a `shipments` e `invoices`, revenue mapeado por `shipment_code`, carrier desde bookings.

## 5. Acceptance

### Slice A
- [ ] `/studio/reportes` deja de ser stub: nav de 5 categorías (Operacionales operable, 4 deshabilitadas
      con rótulo de slice) + nivel-2 con Overview/Rutas/Navieras/Servicios + selector de período.
- [ ] Overview muestra métricas **reales** (embarques, CBM, revenue desde invoices, activos) + volumen
      mensual + split por puerto/destino; **sin** on-time (omitido V1, documentado).
- [ ] Rutas agrupa por `origin→destination` con CBM/tránsito/revenue/rate; Servicios por
      `shipment_service`; Navieras desde `bookings`/`sailings` o EmptyState honesto.
- [ ] `lib/studio/reports/{types,queries}.ts` puros + tests verdes (period range, grouping, transit,
      rate, revenue join).
- [ ] Período filtra server-side por `?period=`; revenue normalizado a USD.
- [ ] `node scripts/verify.mjs` 🟢. **Sin migración** (no hay DDL en este módulo). `ui-ux-designer` OK.

### Slice B / C
- [ ] B: Comerciales + Contables + Combinados (reuse de profitAndLoss/collections/treasury/
      clientsWithTier). · C: Constructor + export CSV.

## 6. Fuera de alcance (respetar)

- **NO migración / NO tablas nuevas** (capa de presentación).
- **NO** Comerciales / Contables / Combinados / Constructor (Slices B/C).
- **NO** export CSV/PDF (Slice C) ni mapa SVG del corredor (nice-to-have).
- **NO** métrica on-time (sin fuente; V2 necesita ETA/SLA).
- **NO** recalcular cálculo financiero — Slice B reusa `profitAndLoss` etc. tal cual.
- **NO** tocar la frontera público↔ERP. Todo Studio (`@/lib/db/server`). El reuse de
  `SERVICE_LABELS` viene de `@/lib/shared/shipment-public` (puente permitido).

## 7. Notas de implementación

### Slice A — implementado (2026-06-04, vía harness)

**Archivos:**
- `lib/studio/reports/types.ts` — puro, server-safe (sin `"use client"`, sin Supabase, sin Zod).
  `ReportPeriod` + `PERIOD_OPTIONS` + `asPeriod()` (normaliza el `?period=` del URL) +
  `periodRange(period, today)`. Tipos de salida (`OperationalOverview`, `RouteRow`, `ServiceRow`,
  `CarrierRow`, `MonthlyVolumePoint`, `PortSplitRow`, `TransitByPortRow`). Helpers puros:
  `transitDays`, `ratePerCbm`, `routeKey`/`routeLabel`, `serviceLabel` (reusa `SERVICE_LABELS`),
  `monthlyBuckets`, `groupByRoute`/`groupByService`.
- `lib/studio/reports/queries.ts` — `operationalOverview` / `reportByRoute` / `reportByService` /
  `reportByCarrier`. Revenue join = UNA query de `invoices` del período → `Map<shipment_code, usd>`
  (reusa `invoiceUsdAmount` de `fidelizacion/types`), sin N+1.
- `app/studio/(app)/reportes/page.tsx` (server, reemplaza el stub) + `_components/ReportesClient.tsx`
  (`"use client"`) + `_components/charts.tsx` (SVG tokenizado: `VolumeBars`, `Donut`, `Progress`).
- Tests: `lib/studio/reports/__tests__/{types,queries}.test.ts` (34 tests).

**Descubrimientos / decisiones de schema (vs. lo que la spec asumía):**
- **CBM vive en `shipments.volume_m3`**, no en una columna `cbm`. Las queries leen `volume_m3` y lo
  normalizan a `cbm` en `ReportShipment`. Los helpers puros trabajan sobre `cbm`.
- **`shipments.delivered_at` SÍ existe** (migración 0009) además de `arrived_destination_at` (0002),
  así que `transitDays` usa `delivered_at ?? arrived_destination_at − created_at` tal como la spec.
  Devuelve `null` si falta el hito de cierre **o si el delta es negativo** (datos inconsistentes).
- **`invoices` cruza por `shipment_code`** (texto snapshot, 0077), no por `shipment_id`. El revenue
  join excluye `status='anulada'` y exige `shipment_code` no nulo. Normalización a USD vía
  `invoiceUsdAmount` (USD/USDT 1:1, VES/fx_rate, CNY→0).
- **Período**: `periodRange` resuelve en UTC (estable e independiente del huso del server). `1A` =
  trailing 12 meses, `YTD` = 1° de enero del año. El filtro `.lte` usa `${to}T23:59:59.999Z` para
  incluir el día completo de `to`.
- **`active`** (KPI Overview) = embarques en estados en curso (in_warehouse … last_mile); excluye
  draft, delivered, exception, cancelled.
- **on-time OMITIDO** (sin fuente ETA/SLA, §3.2). La vista Overview incluye una nota de honestidad.
- **Navieras (`reportByCarrier`)** agrega `bookings` + `sailings` del período por `carrier_id`
  (migración 0096), resuelve el nombre vía `carriers`, y es **defensivo**: si 0096 no está aplicada
  en un env, devuelve `[]` (la UI muestra `EmptyState` honesto en vez de romper).
- **Frontera RSC**: `page.tsx` (server) importa de `ReportesClient` SOLO el componente; los
  tipos/helpers compartidos viven en `types.ts` (server-safe). El paso `rsc-boundary` del gate pasa.
- El selector de período y los tabs nivel-2 navegan por URL (`?period=` / `?rep=`), linkeables y
  resistentes a refresh. Categorías nivel-1: Operacionales activa; las otras 4 deshabilitadas con
  Badge "Slice B"/"Slice C".

**Pendiente:** Slices B (Comerciales/Contables/Combinados) y C (Constructor + export CSV).

_(Slices B/C: las completa el implementer al cerrarlos.)_
