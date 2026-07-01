---
sdd: "0135"
title: "Buscador global ⌘K del Studio — permission-aware, gating por faceta"
status: done
author: "Director (materializa handoff ventana cambio-esteticos) + founder"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0085", "0108", "0078", "0056", "0049"]
confidencialidad: interno
---

# SDD-0135 · Buscador global ⌘K del Studio — permission-aware

> Materializa el handoff de la ventana `cambio-esteticos` (Sprint 6.4). El ⌘K de la
> topbar hoy abre `SearchPlaceholderModal` (placeholder). Esta spec lo reemplaza por un
> buscador global real, con **gating por faceta derivado de la matriz RBAC** — nunca de
> tablas financieras. **NO construido**: rama propia `feat/buscador-global`.

## 1. Problema

El Studio no tiene búsqueda transversal: para ubicar un cliente, embarque, cotización,
factura o pago hay que navegar módulo por módulo. El hotkey ⌘K existe pero abre un
placeholder. Falta un buscador que:
- cruce todas las entidades del ERP,
- respete permisos por rol **sin filtrar por rol en la DB** (la RLS de Supabase filtra por
  `tenant_id`, no por rol → el gate debe vivir en el server action),
- distinga término tipo monto / fecha / cédula-RIF / código / texto libre.

## 2. Decisiones del founder (tomadas)

1. **Faceta restringida → "candado con nota"** (transparente). El candado se deriva
   **solo de la matriz RBAC** (`canAccessModule`), **nunca** consultando tablas financieras
   → no revela si el cliente tiene o no movimientos. Copy genérico:
   _"Facturas, pagos y cobranzas las gestiona Contabilidad."_
2. **Alcance v1 = todas las entidades**, gated por faceta (fan-out completo).
3. **Buscar por monto y fecha en v1** — solo roles con módulos de dinero.
4. **Rol `marketing` SÍ puede ubicar un contacto** (nombre / Shipping Mark), **sin ver
   dinero** → se le abre la **faceta Cliente en modo read-only** (solo identidad/contacto,
   nunca facturas/pagos/cobranzas). Requiere ajustar la matriz RBAC para darle a `marketing`
   acceso de lectura a la faceta Cliente del buscador (no al módulo `clients` completo).

## 3. El corazón: gating por faceta

Cada resultado pertenece a un **módulo**. Antes de consultar nada, se filtran las facetas
por `canAccessModule(role, facet.module)` — **solo se ejecutan las queries permitidas**.

| Rol | Facetas que ve | Candado |
|---|---|---|
| `accounting` / `admin` | Cliente, Embarques, Cotizaciones, **Facturas, Pagos, Cobranzas** | — |
| `commercial` / `operations` | Cliente, Embarques, Cotizaciones | "…las ve Contabilidad" |
| `warehouse` | Cliente, Embarques | idem |
| `support` | Cliente, Embarques, Cotizaciones (read-only) | idem |
| `marketing` | **Cliente (read-only: identidad/contacto)** + módulos de marketing | dinero con candado |

**Hallazgo de seguridad crítico:** la RLS filtra por `tenant_id`, no por rol
(`get_user_tenant_id()`). La DB NO impide que un rol operativo lea `payment_receipts` si
arma el query → **el gate del server action del buscador es la única defensa real** (igual
que `moduleEditDenial` para mutaciones). Todo el permiso vive en el servidor.

## 4. Arquitectura (reutiliza lo existente)

- **Server action único** `lib/studio/global-search/search-action.ts` →
  `searchGlobalAction(q, scope?)`: resolver rol (`getStudioRole`) → clasificar término
  (monto `/^\s*[$]?\d[\d.,]*\s*$/`, fecha `dd/mm`, cédula/RIF `looksLikeCedula`, código
  `DTD-/S-/Q-/F-`, texto libre) → armar FACETS filtradas por `canAccessModule` → fan-out
  `Promise.all` reusando las `list*` queries con `ilike` + LIMIT≈5 por faceta →
  `lockedFacets` **desde la matriz** → audit log opcional.
  Reusa el patrón probado de `lib/studio/client-search-action.ts`.
- **Tipos** `lib/studio/global-search/types.ts` (`GlobalSearchHit` con `href` vía
  `modules.ts` slug).
- **Modal** `app/studio/_components/wiring/GlobalSearchModal.tsx` (reemplaza
  `SearchPlaceholderModal`): resultados agrupados por faceta (operativo → dinero → candado
  al final), chips de scope, teclado (reusar `ClientCombobox`), vacío = recientes. Solo
  tokens `var(--*)` + pasar por `ui-ux-designer`.
- **Cableado**: `StudioTopbar.tsx` (swap del placeholder; hotkey ⌘K/Ctrl-K ya existe vía
  `usePlatformMod`) + `chrome.ts` (i18n).
- **Migración (Director/prod):** probablemente **ninguna funcional**; opcional índices
  trigram `pg_trgm` para rendimiento del `ilike` + tabla `search_audit` si se activa el log.

## 5. Reutiliza sin tocar

`rbac.ts` (`canAccessModule`), `rbac-guard.ts` (`getStudioRole`), `modules.ts` (slugs),
`client-search-action.ts` (patrón), `usePlatformMod.ts` (hotkey Mac/Win, SDD cambio-esteticos),
y las `list*` queries de cada entidad.

## 6. Seguridad

- El gate es **server-side** y se deriva de la matriz RBAC; jamás se consulta una tabla
  financiera para decidir el candado.
- Los roles sin módulo de dinero **no invocan** `invoices`/`payment_receipts` (verificable
  con spy en el test).
- La apertura de faceta Cliente a `marketing` es **read-only de identidad/contacto** — no
  expone dinero ni habilita mutación.

## 7. Aceptación

- [ ] ⌘K (Mac) / Ctrl-K (Win) abre el buscador global real (no el placeholder).
- [ ] `accounting` ve Facturas/Pagos; `commercial` ve el candado con la nota genérica.
- [ ] `marketing` ubica un contacto por nombre/cédula/Shipping Mark, **sin** ninguna faceta
      de dinero.
- [ ] Término monto → solo facturas y solo para roles con dinero; fecha, cédula/RIF y código
      rutean a la faceta correcta.
- [ ] Unit (espejo de `rbac.test.ts`): por rol, qué facetas se ejecutan; que roles sin dinero
      no invocan `invoices`/`payment_receipts` (spy); que `lockedFacets` sale de la matriz.
- [ ] `node scripts/verify.mjs` + `pnpm typecheck` + `pnpm build` verdes.

## 8. Notas de integración

- Rama propia **`feat/buscador-global`** (esta spec ya vive en `main` como draft para
  reservar el correlativo 0135). Plan de sesión completo: `~/.claude/plans/el-buscador-*.md`
  (ventana `cambio-esteticos`).
- Si se activan índices `pg_trgm` o `search_audit`, la migración la aplica el **Director**
  a prod (dry-run tx primero). v1 puede shipear sin migración.
