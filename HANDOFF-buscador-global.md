# HANDOFF → Director · Buscador global permission-aware del Studio

**De:** agente secundario (worktree `cambio-esteticos`)
**Para:** Director
**Tipo:** propuesta de feature — **NO construida** (entregable = análisis + diseño)
**Plan completo (sesión):** `~/.claude/plans/el-buscador-cu-les-son-peaceful-pixel.md`

> Este NO es un cambio estético. Es la feature "Sprint 6.4" (buscador global ⌘K real).
> Requiere **SDD propia + rama propia + coordinación del Director** (posible migración de
> índices trigram toca prod). No va en `feat/Cambio-esteticos`.

---

## Qué necesita hacer el Director

1. **Asignar correlativo SDD** (siguiente libre ~0135+ — ojo: `0131` ya es Registro cliente
   (ex-0122, mergeado) y `0132`-`0134` son drafts) y crear `docs/specs/NNNN-buscador-global/spec.md`
   con el contenido de abajo.
2. **Abrir rama propia** (`feat/buscador-global` o similar) para implementarlo.
3. **Decisión de producto pendiente:** ¿el rol `marketing` debe poder ubicar un contacto
   (sin dinero) o queda fuera del buscador? Hoy `marketing` no tiene acceso a `clients`.

---

## Decisiones del founder (ya tomadas)

1. **Faceta restringida → "candado con nota"** (transparente). Implementación **segura**: el
   candado se deriva **solo de la matriz RBAC**, nunca consultando tablas financieras → no
   revela si el cliente tiene o no movimientos. Copy genérico: _"Facturas, pagos y cobranzas
   las gestiona Contabilidad."_
2. **Alcance v1 → todas las entidades, gated por faceta** (fan-out completo).
3. **Buscar por monto y fecha en v1** — solo roles con módulos de dinero.

---

## El corazón: gating por faceta (responde el caso del founder)

Cada resultado pertenece a un **módulo**. Antes de consultar nada, se filtran las facetas por
`canAccessModule(role, facet.module)` — solo se ejecutan las queries permitidas.

| Rol | Facetas que ve | Candado |
|---|---|---|
| `accounting` / `admin` | Cliente, Embarques, Cotizaciones, **Facturas, Pagos, Cobranzas** | — |
| `commercial` / `operations` | Cliente, Embarques, Cotizaciones | "…las ve Contabilidad" |
| `warehouse` | Cliente, Embarques | idem |
| `support` | Cliente, Embarques, Cotizaciones (read-only) | idem |
| `marketing` | módulos de marketing (hoy sin clientes — ver decisión) | según corresponda |

**Hallazgo de seguridad crítico:** la RLS de Supabase filtra **por `tenant_id`, no por rol**
(`get_user_tenant_id()`). La DB NO impide que un rol operativo lea `payment_receipts` si
obtiene el query → **el gate del server action del buscador es la única defensa real** (igual
que `moduleEditDenial` para mutaciones). Todo el permiso vive en el servidor.

---

## Arquitectura (reutiliza lo existente)

- **Server action único** `lib/studio/global-search/search-action.ts` → `searchGlobalAction(q, scope?)`:
  resolver rol (`getStudioRole`) → clasificar término (monto `/^\s*[$]?\d[\d.,]*\s*$/`, fecha
  `dd/mm`, cédula/RIF `looksLikeCedula`, código `DTD-/S-/Q-/F-`, texto libre) → armar FACETS
  filtradas por `canAccessModule` → fan-out `Promise.all` reusando `list*` queries con
  `ilike` + LIMIT≈5 por faceta → `lockedFacets` **desde la matriz** → audit log opcional.
  Reusa el patrón probado de `lib/studio/client-search-action.ts`.
- **Tipos** `lib/studio/global-search/types.ts` (`GlobalSearchHit` con `href` vía `modules.ts` slug).
- **Modal** `app/studio/_components/wiring/GlobalSearchModal.tsx` (reemplaza `SearchPlaceholderModal`):
  resultados agrupados por faceta (operativo → dinero → candado al final), chips de scope,
  teclado (reusar `ClientCombobox`), vacío = recientes. Solo tokens `var(--*)` + `ui-ux-designer`.
- **Cableado**: `StudioTopbar.tsx` (swap del placeholder; hotkey ya existe) + `chrome.ts` (i18n).
- **Migración (Director/prod):** probablemente ninguna funcional; opcional índices trigram
  `pg_trgm` para rendimiento del `ilike` + tabla `search_audit` si se activa el log.

## Reutiliza sin tocar

`rbac.ts` (`canAccessModule`), `rbac-guard.ts` (`getStudioRole`), `modules.ts` (slugs),
`client-search-action.ts` (patrón), y las `list*` queries de cada entidad.

## Verificación esperada

- Unit (espejo de `rbac.test.ts`): por rol, qué facetas se ejecutan; que roles sin dinero
  **no invocan** `invoices`/`payment_receipts` (spy) y que `lockedFacets` sale de la matriz.
- Clasificador de término (monto/fecha/cédula/código/texto).
- E2E Playwright: ⌘K abre; `accounting` ve Pagos, `commercial` ve candado; monto → facturas
  solo accounting.
- `node scripts/verify.mjs` + `pnpm typecheck` + `pnpm build`.
