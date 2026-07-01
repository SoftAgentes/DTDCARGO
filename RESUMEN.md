# RESUMEN — SDD-0135 · Buscador global ⌘K permission-aware

**Ventana secundaria (Modo Forja).** No mergea, no pushea, no aplica migrations.

- **Rama:** `feat/buscador-global`
- **Worktree:** `../DTD-worktrees/buscador-global`
- **Spec:** `docs/specs/0135-buscador-global/spec.md`
- **Estado:** ✅ construido y verde. Listo para que el Director integre.

## Qué se construyó

Reemplaza el `SearchPlaceholderModal` (placeholder) de la topbar del Studio por
un buscador global real, fan-out a todas las entidades, **permission-aware con
gate server-side derivado SOLO de la matriz RBAC** (fail-closed).

### Archivos nuevos
- `lib/studio/global-search/types.ts` — formas (`GlobalSearchHit`, grupos, locked).
- `lib/studio/global-search/classify.ts` — clasificador de término (monto/fecha/
  cédula-RIF/código/texto) + `parseAmount` + `facetForCode`. PURO.
- `lib/studio/global-search/facets.ts` — **matriz de facetas** (corazón de
  seguridad): cada faceta → módulo real; `canRunFacet` = `canAccessModule` +
  `viewerRoles` read-only. Fail-closed. Nunca consulta tablas financieras.
- `lib/studio/global-search/search-action.ts` — `searchGlobalAction(q, scope?)`:
  resuelve rol → clasifica → arma scope → filtra por permiso → fan-out
  `Promise.all` con LIMIT 5 → `locked` desde la matriz. Reusa el patrón de
  `client-search-action.ts`.
- `app/studio/_components/wiring/GlobalSearchModal.tsx` — modal ⌘K: agrupado
  operativo→dinero→candado, chips de scope, teclado ↑/↓/Enter/Esc, vacío =
  recientes (localStorage). Solo tokens `var(--*)`.
  **Ajustes de esta sesión** (post-review `ui-ux-designer`): (1) `aria-activedescendant`
  en el input combobox — hueco de a11y real, ahora espeja al `ClientCombobox`;
  (2) `scrollIntoView({block:"nearest"})` al recorrer con ↑/↓; (3) scrim
  `rgba(15,30,61,0.4)` literal → `var(--scrim-soft)` (token real).
- `lib/studio/global-search/global-search.test.ts` — clasificador + matriz de
  facetas (anti-drift con modules/roles; espejo de `rbac.test.ts`).
- `lib/studio/global-search/search-action.test.ts` — **spies de seguridad**:
  roles sin dinero NO invocan `listInvoices`/`searchReceipts`; `locked` sale de
  la matriz; marketing solo corre Cliente; monto/código rutean correcto.
- `e2e/global-search.spec.ts` — Tier 1 (corre sin seed: ⌘K gated por auth) +
  Tier 3 journey gated por `STUDIO_E2E_EMAIL/PASSWORD` (branch+seed, pendiente
  como el resto de los Tier-3 del repo).

### Archivos modificados
- `app/studio/(app)/_components/StudioTopbar.tsx` — swap del placeholder por
  `GlobalSearchModal`; se eliminó la función `SearchPlaceholderModal` muerta. El
  hotkey ⌘K/Ctrl-K ya existía.
- `lib/studio/payment-queries.ts` — nueva `searchReceipts(supabase,{q|amount})`
  reutilizable (faceta Pagos). Solo la invoca el buscador con permiso de dinero.
- `lib/i18n/es-VE/chrome.ts` + `lib/i18n/zh-CN/chrome.ts` — claves
  `chrome.search.*` (placeholder, facetas, candado, hints de teclado).

## Decisiones de seguridad (lo no negociable)
- **Gate 100% server-side, derivado de la matriz RBAC.** La RLS filtra por
  `tenant_id`, no por rol → el server action es la única defensa. Si el rol no
  puede correr una faceta, la query **nunca se ejecuta** (verificado con spy).
- **Candado desde la matriz, jamás de tablas financieras** — no revela si el
  cliente tiene movimientos. Copy genérico.
- **marketing** ubica contacto (faceta Cliente read-only) vía `viewerRoles`,
  **sin abrirle el módulo `clients` completo** (no se tocó
  `ROLE_MODULE_ACCESS.clients`; sidebar/página siguen vedados).
- **warehouse**: la tabla §3 de la spec le lista "Cliente" aunque la matriz de
  módulo no le da `clients` → se resolvió con el mismo mecanismo `viewerRoles`
  (read-only), sin abrir el módulo. **Punto a confirmar por el Director/founder**
  si se prefiere NO darle a bodega la búsqueda de clientes.

## Verificación (toda verde)
- `node scripts/verify.mjs` → **TODO VERDE** (lint 0 errores, rsc-boundary,
  typecheck, **2959 tests**, docs:check).
- `node node_modules/typescript/bin/tsc --noEmit` → 0 errores.
- `node node_modules/next/dist/bin/next build` → OK.
- Tests nuevos: 35 (clasificador + matriz de facetas + spies del action).

## Migración
**NINGUNA.** v1 shipea sin migración (todas las tablas y queries ya existen).
Opcional a futuro (Director, si hace falta rendimiento del `ilike`): índices
`pg_trgm` sobre las columnas buscadas y/o tabla `search_audit`. No incluido.

## Nota de entorno (para el Director)
El worktree arranca sin `node_modules`. El primer `pnpm install` aborta en el
preflight `ERR_PNPM_IGNORED_BUILDS` (esbuild) **antes de terminar el linking** →
`next` queda sin enlazar y `next build` explota con `TurbopackInternalError`
("Symlink node_modules … points out of the filesystem root"). **Se resuelve con
`CI=true pnpm install`** (completa el linking; solo queda el warning de esbuild al
final, inofensivo). Con eso, `next build` pasa limpio (exit 0). Para correr tools
sin gatillar el preflight: invocar el bin directo (`node node_modules/<bin>`).

## Pendientes / para el Director
- Integrar `feat/buscador-global` a main (merge/cherry-pick selectivo).
- Confirmar el criterio warehouse→faceta Cliente (arriba).
- (Opcional) seed-e2e para activar el Tier 3 del spec Playwright.
- NO se hizo push. NO se aplicó ninguna migración.
