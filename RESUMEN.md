# SDD-0114 · Dashboard configurable — Lane PRAGMÁTICO (forja3)

Slices **A + B + C** implementados. Slice D (dashboards por rol) fuera de alcance.
`node scripts/verify.mjs` → **TODO VERDE** (lint · rsc-boundary · typecheck · test · docs:check · e2e).

## Slice A — Persistencia + catálogo
- **Migración** `supabase/migrations/0233_user_dashboard_prefs.sql` (NO aplicada — la aplica el founder):
  tabla `user_dashboard_prefs` (jsonb `config`, `unique(tenant_id,user_id)`), RLS `for all` por
  **dueño + tenant** (`user_id = auth.uid()` ∧ tenant ∈ `user_tenants`), trigger `touch_updated_at`,
  grants a `authenticated`. Sin DDL destructivo, sin tabla polimórfica.
- **Catálogo** `lib/studio/dashboard/dashboard-catalog.ts`: `KPI_CATALOG` (18 KPIs) + `WIDGET_CATALOG`
  (7 widgets) + `DEFAULT_CONFIG` + `MAX_KPIS=12` + `CHART_PERIODS`. Cada KPI trae `module` (RBAC),
  `source` (bundle de datos) y `status` (`ready`|`wip`). `onTime`/`avgTransit` = `wip` → muestran `—` (D-7).
- **Tipos + validación** `lib/studio/dashboard/dashboard-types.ts`: `DashboardConfig` +
  `validateDashboardConfigInput(raw, canAccess)` (manual, **sin Zod**): descarta ids fuera del catálogo,
  descarta ids de módulos no accesibles (RBAC como predicado inyectado), deduplica preservando orden,
  capa a `MAX_KPIS`, normaliza `chartPeriod`. + `defaultConfigForAccess`, `accessibleCatalog`, `isEmptyConfig`.
- **Query** `lib/studio/dashboard/dashboard-prefs-queries.ts`: `getDashboardConfig(supabase, userId)`
  devuelve el jsonb crudo o null (nunca lanza).
- **Server Actions** `app/studio/(app)/dashboard/actions.ts`: `saveDashboardConfigAction` (upsert
  `onConflict tenant_id,user_id`, re-valida con RBAC antes de persistir) + `resetDashboardConfigAction`
  (borra la fila → vuelve al default filtrado).

## Slice B — Render configurable + editor
- `app/studio/(app)/dashboard/page.tsx` reescrito: resuelve rol+tenant, lee la config (DB manda),
  fetchea **en paralelo solo los bundles de módulos accesibles**, arma `kpiValues` + data de widgets,
  y delega al cliente. Mantiene el header (saludo VE por hora).
- `_components/DashboardClient.tsx` (`"use client"`): estado optimista (localStorage write-through +
  autosave DEBOUNCED 650 ms vía `useActionState`), grid de KPIs (`KpiCard`), grid de widgets 2fr/1fr con
  colapso cuando una columna queda vacía, indicador "Guardando…/Guardado ✓", empty state, editor.
- `_components/DashboardEditorDrawer.tsx`: sobre `DrawerShell`, 2 tabs (KPIs con **drag-to-reorder** +
  agregar/quitar por categoría; Widgets con switches por columna), **Restaurar defaults con confirmación
  inline** (sin `window.confirm`), tope de 12 KPIs con aviso. Solo ofrece catálogo accesible (RBAC).
- `_components/DashboardWidgets.tsx`: `ChartWidget` (SVG de CBM/mes con selector de período persistente),
  `ActiveShipmentsWidget`, `UpcomingEtaWidget`, `AlertsWidget`, `QuickActionsWidget`, `NominaResumenWidget`.
  Reusa `RecentActivityCard` existente para el widget de actividad.

## Slice C — KPIs financieros / nómina cableados
- `lib/studio/dashboard/dashboard-kpi-queries.ts`:
  - `financeInvoiceKpis` (1 pasada sobre `invoices`) → `monthRevenue`, `invoicesDue`, `pendingCollect`, `avgTicket`.
  - `marginKpi` → `costingRows` + `costingTotals().avgMarginPct`.
  - `nominaKpis` → empleados activos, saldo de préstamos, neto del corte vivo, ausencias del mes.
  - `leadsKpi` → conteo de `kommo_leads`.
- `lib/studio/dashboard/dashboard-widget-queries.ts`: `getActiveShipmentsPreview` + `getMonthlyVolume`
  (CBM real por mes, 12 buckets).
- Gating por RBAC: un usuario sin Finanzas/Nómina no dispara esas queries **ni** ve esos KPIs/widget (D-5, D-8).

## Tests
- `lib/studio/dashboard/dashboard-types.test.ts` (13 casos): descarte de ids inválidos, filtro RBAC,
  tope MAX_KPIS, dedupe, normalización de período, entrada corrupta sin romper, default/catálogo filtrados,
  `money()`. Cubren los criterios de aceptación de la spec (config corrupta, RBAC, tope).

## Tests ajustados (re-anclaje, NO debilitados)
- `lib/studio/rbac-actions-guard.test.ts`: agregada `dashboard/actions.ts` a la ALLOWLIST (mecanismo
  previsto por el propio test) — el usuario edita SU config (RLS por dueño), no datos de negocio; además
  la action filtra ids con `canAccessModule` antes de persistir.
- `app/studio/(app)/cotizador/__tests__/fase-c-rename.test.ts` (SDD-0061): el KPI "Estimados" dejó de ser
  literal en `page.tsx` (ahora vive en el catálogo). Se re-ancló el invariante al catálogo + la card,
  con la MISMA garantía (usar "Estimados", nunca "Cotizaciones"). No se debilitó ningún assert.

## Cómo lo verifiqué
- `node scripts/verify.mjs` → TODO VERDE. Typecheck, 3490 tests, e2e (reusa dev server del worktree).

## Pendientes / notas
- La migración 0233 **no está aplicada** (la aplica el founder).
- Secciones del dashboard viejo que ya NO se renderizan por diseño (layout fijo → configurable):
  "Tu día" (Bitácora), "Adopción del portal", "Inteligencia" (AgenticHealthCard). Candidatas a sumarse
  como KPIs/widgets del catálogo en una iteración futura (los componentes `AgenticHealthCard`,
  `RecentQuotesCard` siguen en el repo, sin uso desde la page).
- `cbmInTransit` se cablea al CBM suelto en Almacén CN (`navieraKpis.looseCbm`); un "CBM realmente en
  tránsito marítimo" requeriría timestamps de hito por embarque (mismo motivo que `avgTransit` = wip).
- Decisiones D-1..D-8 respetadas según el brief (tabla dedicada, 100% por usuario, tope 12, RBAC Finanzas,
  sin modo ocultar-valores, wip = `—`, nómina gated).
