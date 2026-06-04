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
   - **A (hecha)** = foundation `lib/studio/reports/` + UI: nav de categorías (Operacionales
     activa; las otras 4 deshabilitadas) + nivel-2 (Overview · Rutas · Navieras · Servicios) +
     selector de período.
   - **B** = SOLO los reportes con **fuente real** (verificado por barrido de schema): **Comerciales
     → Por cliente** (ranking por facturación + por tier; reusa `clientsWithTier`/`clientAnnualBilling`
     de 0051) + **Contables/financieros → Estado de resultados** (`profitAndLoss` 0040) **· Aging
     CxC/CxP** (`collectionKpis`/`receivablesQueue` 0041 + treasury 0044) **· Cashflow facturado vs
     cobrado** (`invoiceKpis` 0021 + cobros). Capa de presentación pura, **sin migración**.
   - **C (diferido)** = lo que **hoy no tiene fuente real**, con su bloqueo documentado:
     **Constructor** (report builder + export CSV/PDF) · **Combinados** (rentab. ruta / margen
     cliente / costo-CBM) — **necesita costo directo por embarque**: el Norte lo *fabrica*
     (`_ROUTE_COST=0.70`+jitter) y **NO lo replicamos**; existe un link parcial (`expenses.shipment_id`,
     opcional/sparse) pero no alcanza para márgenes honestos · **Por agente** (`quotes` no tiene
     campo de agente/owner; NPS sin fuente) · **Posición IVA** (depende de Fiscal/Bloque 3, no
     construido).

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

## 4b. Approach — Slice B (Por cliente + Contables/financieros)

> Capa de presentación pura: **reusa** los agregados ya construidos y testeados; **no recalcula
> finanzas ni fabrica costos**. Sin migración. Solo se muestran reportes con fuente real.

### `lib/studio/reports/queries.ts` (extender) + `types.ts`
- **Por cliente** (`commercialByClient`): reusa `clientsWithTier(supabase, today)` (0051) → ranking
  por `billedUsd` desc + distribución por tier. **NO "por segmento"** (la tabla `clients` no tiene
  columna `segment`).
- **Estado de resultados** (`incomeStatement`): reusa `profitAndLoss(supabase, range)` de
  `lib/studio/accounting/reports.ts` (0040) **tal cual**; la vista solo formatea filas (ingresos,
  CGS, utilidad bruta/operativa/neta + %). **No recalcular.**
- **Aging CxC/CxP** (`agingReport`): CxC desde `receivablesQueue`/`collectionKpis`
  (`lib/studio/payment-queries.ts`, 0041) → buckets (corriente / 1-30 / 31-60 / 60+); CxP desde
  treasury (`lib/studio/treasury/bill-queries.ts` + `treasuryKpis`, 0044). EmptyState honesto si vacío.
- **Cashflow facturado vs cobrado** (`cashflowReport`): serie mensual de facturado (invoices del
  rango, USD-normalizado vía `invoiceUsdAmount`) vs cobrado (`payment_receipts`/`collectionKpis`),
  + KPIs facturado/cobrado/por-cobrar/vencido (reusa `invoiceKpis` 0021 / `collectionKpis` 0041).
- Período server-side por `?period=` (reusa `periodRange`). Confiar en RLS por tenant. Verificar
  contra los tipos reales de cada agregado (no asumir el shape del Norte mock).

### UI — `_components/ReportesClient.tsx` (extender)
- Habilitar **Comerciales** y **Contables/financieros** (chips dejan de estar "Pronto");
  **Combinados** y **Constructor** siguen "Pronto". Nivel-2: Comerciales → solo **Por cliente**
  (NO "Por agente"); Contables → **Estado de resultados / Aging / Cashflow** (NO "Posición IVA").
- Vistas tokenizadas con primitivas del sistema (tablas con barras, `KpiCard`, charts de
  `charts.tsx`). Solo `var(--*)`. `page.tsx` carga el agregado del `?cat=`/`?rep=` activo.

### Tests
- Extender `queries.test.ts`/`types.test.ts`: aging buckets (bordes 0/30/60), cashflow mensual
  (facturado vs cobrado + normalización), ranking por cliente (orden + tier), reuse correcto de los
  agregados (mock de sus retornos). Gate verde.

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

### Slice B
- [x] Categorías **Comerciales** y **Contables/financieros** habilitadas; **Combinados** +
      **Constructor** siguen "Pronto".
- [x] **Por cliente**: ranking por facturación + distribución por tier (reusa `clientsWithTier`).
      SIN "por segmento" (no hay columna) ni "Por agente" (no hay campo de agente) → omitidos.
- [x] **Estado de resultados** reusa `profitAndLoss` (0040) sin recalcular; **Aging CxC/CxP** con
      buckets desde `receivablesQueue`/`payablesQueue` (0041/0044); **Cashflow** facturado-vs-cobrado mensual.
- [x] Período server-side; montos USD-normalizados; **EmptyState honesto** donde no hay datos.
- [x] `node scripts/verify.mjs` 🟢. **Sin migración.** `ui-ux-designer` OK.

### Slice C (parcial)
- [x] **Constructor** (builder fuente→agrupar→métrica→filtro + export CSV) — **V1 implementado** 2026-06-04
      (rama `feat/reportes-c`): 2 fuentes (Embarques, Facturas) sobre datos reales, agregación pura, export CSV
      client-side, guardar reportes en localStorage. Categoría "Constructor" habilitada en `ReportesClient`.
- [x] **Combinados** (rentab. ruta / margen cliente / costo-CBM) — **implementado** 2026-06-04 (rama `feat/reportes-c`):
      3 vistas reusando `costingRows`/`costingTotals`/`marginByRoute` de Costing (0053) + nuevos `marginByClient`/costo-CBM
      puros. **Costo REAL de `shipment_costs`** (cero `_ROUTE_COST` fabricado); `EmptyState` honesto si no hay costos. Sin migración.
- [ ] **Por agente** (requiere atribución de agente en `quotes`, inexistente) · **Posición IVA** (requiere Fiscal/Bloque 3) · **export PDF**.

## 6. Fuera de alcance (respetar)

- **NO migración / NO tablas nuevas** (capa de presentación).
- **Slice B NO hace:** Combinados (rentab/margen/costo-CBM) ni Constructor → **Slice C** · "Por
  agente" (sin campo de agente en `quotes`) · "por segmento" de clientes (sin columna `segment`) ·
  Posición IVA (Fiscal/Bloque 3 inexistente). Se muestran deshabilitados o se omiten — **nunca con
  datos fabricados** (regla §3.2: anclar a datos reales).
- **NUNCA fabricar costo/margen** (el Norte usa `_ROUTE_COST=0.70`+jitter; **prohibido replicarlo**).
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

### Slice B — implementado (2026-06-04, vía harness)

**Archivos (EXTIENDE Slice A, no reescribe la lógica existente):**
- `lib/studio/reports/types.ts` — tipos de salida Slice B (`ClientRankRow`, `TierDistRow`,
  `CommercialByClient`, `IncomeRow`, `IncomeStatement`, `AgingBucket`/`AgingSide`/`AgingItem`/
  `AgingReport`, `CashflowPoint`/`CashflowReport`, `FlowItem`) + helpers puros testeables
  (`classifyAging` bordes 0/30/60, `buildAgingSide`, `incomeStatementRows`, `monthlyCashflow`,
  `AGING_BUCKETS`). Sigue server-safe.
- `lib/studio/reports/queries.ts` — 4 funciones nuevas: `commercialByClient`, `incomeStatement`,
  `agingReport`, `cashflowReport`. Solo COMPONEN agregados existentes (patrón Dirección 0048).
- `app/studio/(app)/reportes/page.tsx` — ahora rutea por `?cat=` (op | com | con) y carga SOLO los
  agregados de la categoría activa (menos round-trips por vista).
- `app/studio/(app)/reportes/_components/ReportesClient.tsx` — chips nivel-1 ahora navegan por
  `?cat=`; Comerciales + Contables operables; Combinados/Constructor "Pronto" (re-rotulados Slice C).
  Tabs nivel-2 por categoría. Vistas nuevas: `ByClientView`, `IncomeStatementView`, `AgingView`,
  `CashflowView` (+ `CashflowChart` barras agrupadas tokenizadas). Solo `var(--*)`, primitivas del
  sistema (`KpiCard`, `Badge`, `EmptyState`, `Progress`, `Card`).
- Tests: `__tests__/types.test.ts` (+10 casos: classifyAging, buildAgingSide, incomeStatementRows,
  monthlyCashflow) + `__tests__/queries.test.ts` (+8 casos: commercialByClient, incomeStatement,
  agingReport, cashflowReport). Total módulo: 809 tests verdes.

**Descubrimientos de shape (verificados leyendo la firma REAL de cada agregado, no el mock del Norte):**
- **`profitAndLoss(accounts, balances)` NO recibe un rango** — es una función PURA sobre el plan de
  cuentas + saldos. `incomeStatement` lo compone EXACTAMENTE como Dirección (0048):
  `listAccounts(supabase)` + `accountBalances(supabase, {fromDate: range.from, upToDate: range.to})`
  → `profitAndLoss(...)`. El rango del período se aplica vía `accountBalances` (filtra
  `journal_entries.entry_date`). `incomeStatementRows` solo arma las filas con % sobre ingresos —
  NO recalcula nada.
- **Aging: los buckets NO vienen dados** por `collectionKpis`/`treasuryKpis` (esos solo dan
  `porCobrar`/`vencido` agregados). Se computan de `receivablesQueue` (CxC, 0041) y `payablesQueue`
  (CxP, 0044), que SÍ exponen `{balance, daysOverdue}` por documento. `buildAgingSide` (puro) los
  clasifica en corriente/1-30/31-60/60+. Por eso terminé reusando `receivablesQueue`/`payablesQueue`
  (no los `*Kpis`); el spec mencionaba los KPIs pero las colas son la fuente correcta de los tramos.
  El `balance` está en moneda de operación, igual que Dirección lo trata directo (criterio consistente).
- **Cashflow:** facturado = `invoices` del rango por `created_at`, USD-normalizado vía
  `invoiceUsdAmount` (mismo helper que Slice A · VES/fx, CNY→0), excluyendo `anulada`/`borrador`
  (filtro en la query `.neq` + guard in-memory por robustez); cobrado = `payment_receipts` del rango
  por `received_at`, misma normalización (su `currency` es `InvoiceCurrency`). `monthlyCashflow`
  (puro) arma la serie continua de meses. KPIs `outstanding`/`overdue` = saldos VIVOS de `invoiceKpis`
  (0021) — no del rango (son posición actual, documentado en la nota de la vista).
- **Por cliente:** `clientsWithTier(supabase, now)` ya devuelve el ranking ordenado desc por
  `billedUsd` (trailing-12m USD) + tier derivado. `commercialByClient` solo lo mapea a filas de UI +
  arma la distribución por tier. La UI muestra el top-15 con barra de progreso + chips de nivel.

**Qué se OMITIÓ y por qué (regla §3.2 / §6 · nunca datos fabricados):**
- **"Por agente"** — `quotes` no tiene campo de agente/owner (verificado); NPS sin fuente.
- **"Por segmento"** — `clients` no tiene columna `segment` (verificado).
- **"Posición IVA"** — depende de Fiscal/Bloque 3, que no está construido.
- **Combinados (rentab/margen/costo-CBM)** y **Constructor** quedan en Slice C: necesitan costo
  directo por embarque REAL. El Norte lo fabrica (`_ROUTE_COST=0.70`+jitter) — **prohibido replicarlo**.
- Donde no hay datos, cada vista cae a `EmptyState` honesto (Por cliente / Aging / Cashflow /
  Estado de resultados).

**Frontera RSC:** las 4 nuevas vistas viven dentro de `ReportesClient.tsx` (`"use client"`);
`page.tsx` (server) sigue importando SOLO el componente. Tipos/helpers compartidos en `types.ts`
(server-safe). El paso `rsc-boundary` del gate pasa (626 módulos escaneados, sin cruces).

**Pendiente:** Slice C (Constructor + export CSV/PDF · Combinados · Por agente · Posición IVA),
todos con bloqueo documentado (sin fuente real / depende de Bloque 3).

### Fixes menores 2026-06-04 (post-shipping · rama `feat/reportes-fix`, vía harness + auditoría adversarial)

1. **`periodRange` desbordaba de mes en días 29-31** (`lib/studio/reports/types.ts`): los períodos
   trailing (1M/3M/1A) hacían `Date.UTC(y, m − N, día)` con día 29-31 → JS rotaba al mes siguiente
   (ej. 31-mar − 1M daba ~3-mar en vez de 28-feb). Fix: clamp del día al último día del mes destino
   (`Math.min(día, lastDayOfTarget)`). YTD intacto. +5 tests de borde (bisiesto, transición de año).
2. **KPI revenue del Overview no cuadraba con la suma de las filas** (`operationalOverview`): el KPI
   sumaba TODO `revenueByCode` (incluía facturas **huérfanas** sin embarque en el rango); ahora usa
   `revenueOf(shipments, revenueByCode)` (exportada de `types.ts`) → KPI = revenue atribuible a los
   embarques del período = Σ filas. El revenue huérfano (factura emitida tarde, embarque de otro
   período) no desaparece: aparece en las vistas Contables (`incomeStatement`/`cashflowReport`).
   **Refinamiento (auditoría adversarial):** `fetchRevenueByCode` ahora redondea cada total por code a
   2 decimales → KPI (Σ embarques) y filas (Σ por grupo) cuadran **al centavo** con facturas VES
   sub-centavo (antes divergían ~centavos por redondeo total-vs-serie; misma norma que `cashflowReport`).
   Test VES dedicado verifica el invariante.
3. **Chips "sin asignar" en el Overview** (decisión founder: que el valor que no entra al KPI no quede
   oculto, sin inflar el KPI): `operationalOverview` expone 2 campos **aditivos** (el KPI de revenue sigue
   limpio = Σ filas): **`orphanRevenueUsd`** = `(Σ todo revenueByCode) − revenueUsd` (revenue facturado
   cuyo embarque cae fuera del rango; 0 si no hay), y **`unassigned: {count, cbm}`** = embarques del rango
   **sin cliente** (`client_name` null/vacío — la "caja sin dueño" que se despacha igual; requirió sumar
   `client_name` a `SHIPMENT_COLUMNS`/`ReportShipment`/`coerceShipment`). En `ReportesClient` se muestran
   como 2 chips informativos sutiles (`Badge` neutral → quitado por ui-ux, solo texto; tono `--ink-soft`,
   visibles solo si > 0). Aclaración de modelo: **toda factura tiene cliente** (`invoices.client_name NOT
   NULL`) → "factura huérfana" = sin embarque-en-rango (desfase de fecha), distinto de "embarque sin cliente".

### Slice C · Constructor — V1 (2026-06-04 · rama `feat/reportes-c`, vía harness)

- **`lib/studio/reports/builder-types.ts`** (puro, server-safe): `REPORT_SOURCES` (2 fuentes — Embarques + Facturas —
  cada una con `dims`/`metrics {agg: count|sum|avg, money?}`/`filters`, todas ancladas a campos REALES, cero fabricado),
  `buildReport(rows, {dimKey, metric, filter})` → `{rows:[{label,value,count}], total}` (agrupa+agrega, ordena desc,
  sin NaN), `buildReportCsv` (escapa comas/comillas). **`queries.ts`**: query del builder que trae la fuente del período
  (reusa `fetchShipments`+`revenueByCode` para enriquecer revenue; facturas USD-norm). **`BuilderView.tsx`** (`"use client"`):
  selectores fuente→dim→métrica→filtro + tabla agrupada con barras tokenizadas + export CSV (Blob client-side) + guardar
  reportes en `localStorage` (SSR-safe). Categoría **Constructor** habilitada en `ReportesClient` (dejó de estar "Pronto").
- **Sin migración** (presentación pura). Reviewer APPROVED + ui-ux OK. Fix aplicado: contraste AA del conteo (`--ink-mute`→`--ink-soft`).
- **Nits ui-ux dejados (no bloqueantes, pulido de coherencia futura):** la tabla de resultado no usa el `HeaderRow` del
  módulo (sin rótulos de columna en pantalla; el CSV sí los lleva) · `EmptyState` primitivo para "fuente vacía" vs
  "filtro dejó 0 grupos" · target+hover del `×` en los chips guardados.
- **Pendiente de Slice C:** Combinados (desbloqueado por Costing) · Por-agente (bloqueado) · Posición IVA (Bloque 3) · export PDF.
