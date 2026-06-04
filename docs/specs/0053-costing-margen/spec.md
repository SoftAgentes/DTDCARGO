---
sdd: "0053"
title: "Costing & Margen — costo editable por embarque (7 categorías) + templates por ruta + margen vs revenue (Bloque 5 · Finanzas); Slice A = foundation"
status: approved
author: "Claude Code (carril Bloque 5 · Norte v2.4)"
created: 2026-06-04
updated: 2026-06-04
supersedes: null
superseded_by: null
related: ["0021", "0048", "0051", "0052", "0002", "0074"]
confidencialidad: interno
---

# DTD-0053 — Costing & Margen

> **Bloque 5 (lado Finanzas).** Reemplaza el stub `/studio/costing` por la herramienta de
> rentabilidad por embarque del Norte (`erp/modules/costing.jsx`): costo editable por 7 categorías,
> margen vs revenue real, ranking, desglose, margen por ruta, templates por ruta y forecast de
> pipeline. Cierra el lado financiero del ERP (revenue ya existe vía Facturación; faltaba el COSTO).

## 1. Resumen en una línea

Modelar el **costo por embarque** como tabla editable de 7 categorías (`shipment_costs`) + **templates
por ruta** (`route_cost_templates`), cruzarlo con el **revenue real** de `invoices` → **margen por
embarque/ruta/cliente**, con su pantalla `/studio/costing`.

## 2. Por qué (grounding)

- **Hueco:** `/studio/costing` es un stub (`EmptyState`, 13 líneas). El revenue ya está maduro
  (Facturación 0021, `invoices`), pero **el costo por embarque no se modela** → no se puede calcular
  margen real. Hoy `expenses` (0074/0075) tiene `shipment_id` para gastos operativos sueltos, pero NO
  es el desglose de costeo por categorías que el negocio necesita para decidir tarifas.
- **Decisión founder:** modelo **Norte = tabla editable** (`SHIPMENT_COSTS` con 7 categorías) +
  `ROUTE_COST_TEMPLATES`, no derivar de gastos (incompletos, sin categorías). El operador es dueño del
  costeo; el pre-fill desde gastos reales linkeados queda como mejora futura.
- **Simetría:** completa el par revenue↔costo del ERP. Es la última pieza financiera del Bloque 5.
- **Norte v2.4 ya lo diseñó completo** (`costing.jsx`): 6 tabs (Overview · Ranking · Breakdown ·
  Routes · Templates · Forecast) + Cost Editor drawer + toggle USD/VES. Esta spec lo lleva a Supabase
  nativo, anclando revenue a `invoices` reales en vez del mock.

## 3. Decisiones ancladas

1. **Costo = tabla editable `shipment_costs`** (1 fila por embarque, 7 columnas USD:
   `freight, customs, transport, handling, insurance, commission, other`). El operador la edita en el
   Cost Editor. Costos en **USD canónico**; el toggle VES es **solo display** (tasa BCV de
   config/rates, no se persiste en VES).
2. **Templates por ruta = `route_cost_templates`** (`origin + destination + shipment_service` →
   7 defaults). Pre-llenan el costeo de un embarque nuevo de esa combinación. (El **auto-prefill** y el
   **CRUD de templates** son Slice C; Slice A solo crea la tabla + helpers de match.)
3. **Revenue = `invoices` reales, EXCLUYENDO `borrador`** (lección de la verificación de SDD-0052:
   el revenue join debe usar la whitelist `BILLABLE_STATUSES = [emitida, parcial, pagada, vencida]`,
   nunca solo `.neq('anulada')`, para cuadrar con Facturación/Dirección/Fidelización). USD-normalizado
   reusando `invoiceUsdAmount` (Fidelización 0051). Match factura↔embarque por `shipment_id` (preferido)
   o `shipment_code` (fallback).
4. **Margen** = revenue − `totalCost` (suma de las 7 categorías; 0 si el embarque no tiene fila de
   costos). `marginPct = margin / revenue` (0 si revenue 0, sin NaN/Infinity).
5. **Integridad cross-tenant en DB** (lección [[0045]]): `shipment_costs.shipment_id` y
   `route_cost_templates` con FK + trigger BEFORE INSERT/UPDATE que valida que el embarque sea del
   tenant (defiende PostgREST directo, no solo la action).
6. **Slices:**
   - **A (esta corrida)** = migración 0100 + `lib/studio/costing/{types,queries}.ts` + tests. **Sin UI.**
   - **B** = UI `/studio/costing`: tabs **Overview · Ranking · Breakdown · Routes** + **Cost Editor
     drawer** (guardar costos) + **toggle USD/VES**. Server action `saveShipmentCosts`.
   - **C** = **Templates** (CRUD + auto-prefill al crear embarque) + **Forecast** (pipeline + cotizaciones
     aceptadas) + export CSV.

## 4. Approach — Slice A (foundation)

### Migración `0100_costing.sql` (aditiva; no toca tablas existentes salvo FK a shipments)
- **`shipment_costs`**: `id`, `tenant_id → tenants on delete cascade`, `shipment_id → shipments(id) on
  delete cascade`, las 7 columnas `numeric(14,2) not null default 0`, `notes text`, `created_at`,
  `updated_at`, `deleted_at`. `unique (tenant_id, shipment_id)` (1:1 por embarque). RLS fail-closed por
  tenant (patrón 0096/0098) + grants + trigger `touch_updated_at` + índice `(tenant_id, shipment_id)`.
- **`route_cost_templates`**: `id`, `tenant_id`, `name text`, `origin text`, `destination text`,
  `shipment_service` (enum existente), las 7 columnas `numeric default 0`, `active bool default true`,
  `notes`, timestamps, `deleted_at`. `unique (tenant_id, origin, destination, shipment_service) where
  deleted_at is null` (partial). RLS + grants + touch.
- **Validación cross-tenant** (helper `shipment_in_tenant(p_shipment uuid, p_tenant uuid)` security
  definer + trigger `shipment_costs_validate_shipment` BEFORE INSERT/UPDATE) — rechaza `shipment_id`
  de otro tenant / inexistente. Calca el patrón de `referral_client_in_tenant` (0098) / `comment_*` (0093).
- Sin RPC (no hay correlativos). Sin seed. **NO se aplica a prod** desde acá (lo hace el founder).

### `lib/studio/costing/types.ts` (puro, sin Zod)
- `COST_CATEGORIES` (7, con `key/label/desc/colorToken`) — calca `costing.jsx` (flete/aduana/transporte/
  handling/seguro/comisión/otros), colores con tokens `var(--*)` (no los hex del mock).
- Tipos `ShipmentCosts` (fila), `RouteCostTemplate`, `ShipmentEconomics`.
- `emptyCosts()` (7 ceros), `totalCost(costs)`, `shipmentEconomics({ revenueUsd, costs })` →
  `{ revenue, freight…other, totalCost, margin, marginPct }` (espejo de `D.shipmentEconomics`).
- `marginTone(marginPct)` → `success | info | warning | danger` (umbrales del Norte: ≥30 success,
  ≥15 info, ≥0 warning, <0 danger).
- `convertUsd(usd, currency, rate)` + `fmtMoney(usd, currency, rate)` (toggle USD/VES, display-only).
- `templateKey(origin, destination, service)` + `matchTemplate(templates, shipment)`.
- `validateCostInput(raw)` / `validateTemplateInput(raw)` — 7 montos numéricos ≥ 0, devuelven
  `{ input } | { fieldErrors }`.
- Reusa `SERVICE_LABELS` de `@/lib/shared/shipment-public` (puente permitido) e `invoiceUsdAmount` de
  `@/lib/studio/fidelizacion/types`.

### `lib/studio/costing/queries.ts` (puras, reciben `SupabaseClient`; RLS por tenant)
- `listShipmentCosts(supabase)` → `Map<shipment_id, ShipmentCosts>`.
- `revenueByShipment(supabase, period?)` → `{ byId: Map, byCode: Map }` desde `invoices`,
  **excluyendo `borrador`** (BILLABLE_STATUSES), USD-normalizado, sin N+1.
- `costingRows(supabase, period?)` → `[{ shipment, costs, eco }]` cruzando `shipments` + costos +
  revenue (resuelve revenue por `shipment_id` y fallback `code`).
- `costingTotals(rows)` (pura) → `{ revenue, cost, margin, avgMarginPct, profitable, losing, catTotals }`.
- `marginByRoute(rows)` (pura) → filas agrupadas por `origin→destination` con revenue/cost/margin/pct.
- `listRouteCostTemplates(supabase)`.

### Tests Vitest (`lib/studio/costing/__tests__/`)
- `types.test.ts`: `totalCost`, `shipmentEconomics` (margen + marginPct, revenue 0 → pct 0 sin NaN),
  `marginTone` (los 4 umbrales + bordes 0/15/30), `convertUsd`/`fmtMoney` (USD passthrough, VES×rate),
  `matchTemplate` (match + miss), `validateCostInput`/`validateTemplateInput` (negativos/NaN rechazados).
- `queries.test.ts`: stub `SupabaseClient` → asserta que `revenueByShipment` **excluye borrador**
  (whitelist), normaliza USD, mapea por id+code; `costingTotals` (totales + profitable/losing +
  catTotals); `marginByRoute` (agrupación + orden + revenue 0).

## 5. Acceptance

### Slice A
- [x] Migración `0100` aplica limpio: `shipment_costs` (1:1 por embarque, 7 columnas) + `route_cost_templates`
      con RLS fail-closed + grants + triggers `touch` + trigger de validación cross-tenant sobre `shipment_id`.
- [x] `lib/studio/costing/types.ts`: economics/margin/tone/validators/currency/template-match puros y testeados.
- [x] `lib/studio/costing/queries.ts`: 6 funciones; `revenueByShipment` **excluye `borrador`** (no repite el
      bug de 0052) y normaliza USD; `costingTotals`/`marginByRoute` puras.
- [x] Tests Vitest verdes (economics, tone, validators, currency, revenue-excluye-borrador, route grouping).
- [x] `node scripts/verify.mjs` 🟢. Migración `0100` **NO** aplicada a prod en esta corrida (la aplica el founder).

### Slice B / C
- [x] B: `/studio/costing` tabs Overview/Ranking/Breakdown/Routes + Cost Editor + toggle USD/VES + `saveShipmentCosts`.
- [ ] C: Templates CRUD + auto-prefill + Forecast + export CSV.

## 6. Fuera de alcance (respetar)

- **NO UI / server actions / drawer / sidebar** en Slice A (eso es Slice B; el sidebar `costing` ya existe habilitado).
- **NO** Templates CRUD, auto-prefill, Forecast ni export (Slice C).
- **NO** derivar costo de `expenses` (decisión founder: tabla editable; pre-fill desde gastos = futuro).
- **NO** persistir costos en VES (USD canónico; VES es display).
- **NO** repetir el bug de revenue de 0052: excluir `borrador` siempre.
- **NO** tocar la frontera público↔ERP. Todo Studio (`@/lib/db/server`).

## 7. Notas de implementación

### Slice A — cerrado (gate 🟢, sin push, migración 0100 NO aplicada a prod)

- **Migración `supabase/migrations/0100_costing.sql`** (aditiva): `shipment_costs` (1:1 por embarque
  vía `unique(tenant_id, shipment_id)`, 7 columnas `numeric(14,2)` + `notes` + timestamps + `deleted_at`,
  índice `(tenant_id, shipment_id)`) y `route_cost_templates` (con `shipment_service` = enum existente de
  0002, `active`, partial unique `(tenant_id, origin, destination, shipment_service) where deleted_at is null`).
  RLS fail-closed por tenant + policy `service_role all` (patrón 0098) + grants explícitos + triggers `*_touch`.
  Validación cross-tenant en DB (lección 0045): helper `public.shipment_in_tenant(uuid, uuid)` security-definer
  + trigger `shipment_costs_validate_shipment_trg` BEFORE INSERT/UPDATE (raise `check_violation`). Sin RPC, sin seed.
- **`lib/studio/costing/types.ts`** (puro, sin Zod): `COST_CATEGORIES` con `colorToken` en tokens `var(--*)`
  del sistema (wine/danger/wine-soft/warning/info/success/ink-soft — NO los hex del mock); `ShipmentCosts`,
  `RouteCostTemplate`, `ShipmentEconomics`, `CostAmounts`; `emptyCosts`/`totalCost`/`shipmentEconomics`
  (marginPct 0 si revenue 0, sin NaN/Infinity); `marginTone` (≥30 success · ≥15 info · ≥0 warning · <0 danger;
  no-finito → danger); `convertUsd`/`fmtMoney` (USD passthrough, VES×rate, display-only); `templateKey`/
  `matchTemplate` (ignora inactivos/borrados); `validateCostInput`/`validateTemplateInput` (7 montos ≥ 0,
  negativos/NaN → fieldErrors). Reusa `SERVICE_LABELS`, `invoiceUsdAmount` (0051), tipos `Invoice`/`ShipmentService`.
- **`lib/studio/costing/queries.ts`** (puras, reciben `SupabaseClient`, RLS): `listShipmentCosts` → Map por
  shipment_id (numeric→number); `revenueByShipment` → `{ byId, byCode }` desde `invoices` **EXCLUYENDO `borrador`**
  vía whitelist `BILLABLE_STATUSES` (no `.neq('anulada')` solo — lección 0052), USD-normalizado, una query;
  `costingRows` cruza `shipments` (no borrados) + costos + revenue (id → fallback code) en un `Promise.all`;
  `costingTotals` (PURA) + `marginByRoute` (PURA, orden desc por marginPct con `tone`); `listRouteCostTemplates`.
- **Tests** `lib/studio/costing/__tests__/types.test.ts` + `queries.test.ts` (stub SupabaseClient chainable que
  enruta por tabla). Verde dentro de `node scripts/verify.mjs` (847 tests). Cubre revenue-excluye-borrador,
  USD-norm, mapeo id+code, totales/profitable/losing/catTotals, agrupación por ruta + revenue 0, los 4 umbrales
  de tone + bordes, validators con negativos/NaN.
- **Descubrimientos de shape:** el enum es `shipment_service` (0002). `D.shipmentEconomics` del Norte hace
  `marginPct = revenue>0 ? margin/revenue*100 : 0` → replicado exacto. `invoices` traen tanto `shipment_id`
  (FK, puede ser null) como `shipment_code` → revenue se acumula en ambos mapas y se resuelve id-primero.
  `BadgeTone` no tiene tono "danger-extra"; `marginTone` devuelve solo el subset `success/info/warning/danger`.

### Slice B — cerrado (gate 🟢, APPROVED por el reviewer + ui-ux OK, sin push)

- **`app/studio/(app)/costing/page.tsx`** — reemplaza el stub `EmptyState`. Server component `force-dynamic`:
  carga `costingRows` + `costingTotals` + `marginByRoute` (Slice A) + `latestVesFxRate`, pasa props al client.
  Frontera RSC limpia (importa solo el componente client; el gate `rsc-boundary` pasó).
- **`app/studio/(app)/costing/actions.ts`** — `"use server" saveShipmentCosts`: parsing manual de `FormData` →
  `validateCostInput` (Slice A, **no Zod**) → resuelve `tenant_id` desde `user_tenants` (patrón `createRate` de
  Tarifas) → **upsert** en `shipment_costs` `onConflict: tenant_id,shipment_id` → `revalidatePath`. Devuelve
  `CostActionState` (`ok`/`error`/`fieldErrors`). La defensa cross-tenant real ya está en el trigger de 0100.
- **`_components/CostingClient.tsx`** (`"use client"`) — orquestador: KPIs (`KpiCard`), toggle USD/VES
  (`SegmentedControl`, display-only), 4 tabs. Overview (composición + top/peores), Ranking (tabla + select de
  orden + lápiz por fila), Breakdown (barras por categoría con `colorToken`), Routes (`marginByRoute` + `Badge`
  por `marginTone`). Empty states diferenciados por tab. Hover en filas Ranking/Routes + botón editar (ajuste ui-ux).
- **`_components/CostEditorDrawer.tsx`** (`"use client"`) — `DrawerShell` + `DrawerFooter` (form HTML5 `id` +
  `<button form>`, sin `requestSubmit` hack). Header navy (`--ink-inv-mute`, no `rgba(255,…)`) con revenue/costo/
  margen **recalculados en vivo** (`shipmentEconomics` sobre estado controlado), 7 `NumericInput` (USD), notas,
  `useActionState(saveShipmentCosts)`; re-monta con `key={shipment.id}` (sin sync-via-efecto). Cierra + `router.refresh()` al `ok`.
- **`lib/studio/costing/ui.ts`** (helpers PUROS server-safe): `resolveDisplayRate`/`DEFAULT_VES_RATE` (36.45),
  `asRankingSort`/`RANKING_SORTS`/`sortRanking` (sin mutar), `topAndWorst` (sin solape, ignora rev 0),
  `breakdownRows` (% sobre costo, 0 si costo 0), `costPctOfRevenue` (clamp 0..100).
- **`lib/studio/costing/queries.ts`** — agregado `latestVesFxRate(supabase)`: `fx_rate` de la última factura en VES
  (real); null si no hay → la UI cae al `DEFAULT_VES_RATE`. Mejor fuente real hasta que exista la pantalla de Tasas (0030).
- **Tests** `lib/studio/costing/__tests__/ui.test.ts` (20 nuevos): rate-fallback, orden de ranking, top/worst,
  breakdown %, costPctOfRevenue, `latestVesFxRate`. Gate verde: **940 tests** (920 previos + 20).
- **Marca/UX:** solo tokens `var(--*)` (los hex del mock NO se copiaron — `colorToken` de `COST_CATEGORIES`);
  primitivas del sistema; cero AI slop (se removieron los emojis 🏆/⚠️ del mock). `ui-ux-designer` → OK para commit;
  sus 2 quick wins de hover + el texto del KPI en VES se incorporaron. Migración 0100 sigue **sin aplicar a prod**.
