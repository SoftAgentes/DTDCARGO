# MEJORAS — SDD-0114 (lane PRAGMÁTICO · dashboard configurable)

Mejoras de UX/patrones **dentro de las convenciones del Studio** (sin Zod, sin
arquitectura nueva, sin romper la frontera público↔ERP, solo tokens `var(--*)`).
El founder decide cuáles cherry-pickea.

## 1. Autosave optimista con debounce (LS write-through + sync diferido a DB)
- **Qué:** al reordenar/togglear, la config se aplica en pantalla al instante, se
  escribe en `localStorage` (write-through) y se sincroniza a la DB con un
  **debounce de 650 ms** vía `useActionState`. El drag no dispara un guardado por
  cada pixel; se guarda una sola vez al soltar.
- **Por qué:** el operador de DTD trabaja desde varios equipos (spec §2.5). La DB
  manda al cargar (el server inyecta `initialConfig`), el LS es solo cache
  optimista y se re-alinea con la DB en mount → nunca diverge (spec §6).
- **Dónde:** `DashboardClient.tsx` (efecto de config → LS + `setTimeout` → `saveAction`).

## 2. Prefetch de valores para TODO el catálogo accesible → "agregar KPI" instantáneo
- **Qué:** el server resuelve `kpiValues` para todos los KPIs **accesibles** (no
  solo los activos). Al agregar un KPI desde el editor, su valor aparece al toque,
  sin round-trip ni `revalidatePath`.
- **Por qué / tradeoff:** la spec §6 sugería fetchear solo los activos. Elegí
  fetchear los accesibles porque **las queries se comparten por bundle** (finanzas
  = 1 pasada da 4 KPIs) y el RBAC ya evita correr nómina/finanzas para quien no las
  ve. El costo extra es marginal y la UX de edición gana mucho.
- **Dónde:** `page.tsx` (flags `need*` derivan de `accessibleSources`, no de la config activa).

## 3. `revalidatePath` OMITIDO en el autosave
- **Qué:** las actions de guardar/reset NO revalidan la página.
- **Por qué:** la config es estado optimista del cliente (ya la aplicó) y los
  valores de KPI no cambian al reordenar/togglear. Revalidar en cada auto-guardado
  del drag pagaría un ciclo completo de queries en vano.
- **Dónde:** `actions.ts` (documentado en el doc-comment).

## 4. Confirmación INLINE en "Restaurar defaults" (mata `window.confirm`)
- **Qué:** el reset pide confirmación con un mini-toggle "¿Restaurar? · No / Sí,
  restaurar" en el footer del drawer, en vez de `window.confirm` (deuda técnica
  registrada del Studio — `window.prompt/confirm` hack).
- **Dónde:** `DashboardEditorDrawer.tsx` (`confirmingReset`).

## 5. RBAC como PREDICADO inyectado (validación pura y testeable)
- **Qué:** `validateDashboardConfigInput(raw, canAccess)` recibe el gate RBAC como
  función `(module) => boolean` en vez de importar `rbac.ts` adentro.
- **Por qué:** la validación queda 100% pura → se testea sin DB ni mocks (ver
  `dashboard-types.test.ts`), y el caller inyecta `canAccessModule(role, …)`.
  Mismo espíritu que `rbac.ts` (data pura, sin React/server-only).

## 6. Gráfico con datos REALES (el Norte tenía mock)
- **Qué:** `getMonthlyVolume` suma `volume_m3` real por mes (12 buckets, rellena
  meses vacíos con 0) en vez de las barras hardcodeadas del Norte. El selector de
  período (`1M/3M/1A/YTD`) recorta sobre datos reales y persiste en la config.
- **Dónde:** `dashboard-widget-queries.ts` + `ChartWidget`.

## 7. Defensa-en-profundidad: la action re-filtra por RBAC antes de persistir
- **Qué:** aunque el cliente mande un KPI de un módulo que no ve, la Server Action
  lo descarta con `canAccessModule` antes del upsert (además de la RLS de la tabla).
- **Por qué:** las actions son invocables como endpoint; no confiar en la UI.
- **Dónde:** `saveDashboardConfigAction`.

## 8. Tope de 12 KPIs con feedback (no corta en silencio)
- **Qué:** al llegar a `MAX_KPIS`, los KPIs disponibles se deshabilitan con un aviso
  "Quita alguno para agregar otro" en vez de ignorar el click sin explicación.
- **Dónde:** `DashboardEditorDrawer.tsx` (`atMax`).
