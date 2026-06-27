# RESUMEN — SDD-0081 Slice A · WMS / Inventario (torre read-only)

## Lane
- **Rama:** `feat/sdd0081-wms`
- **Worktree:** `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\sdd0081-wms`
- **Base:** off `main`. SIN push, SIN merge, SIN migración aplicada (gate del founder).

## Qué se hizo
Slice A de SDD-0081: torre de stock **read-only** que unifica bodega CN (modo consolidación) y VE
(modo despacho), agrupada por Shipping Mark, con estado **derivado** (no inventado) sobre tablas que
ya están LIVE. **Cero migración** (100% derivación, como pide la spec). Solo CBM/kg, sin USD.

## Archivos tocados
Nuevos:
- `lib/studio/inventory/types.ts` — estados derivados CN/VE, helpers `statusMeta`/`kpisFromRows`/`occupancyFrom`, constantes (`READY_THRESHOLD_DAYS=3`, `DEFAULT_CONTAINER_CBM=68`).
- `lib/studio/inventory/queries.ts` — `getStockByWarehouse(supabase, 'CN'|'VE', now?)` puro; deriva CN (shipment_id → consolidations.status vía consolidation_items) y VE (agrega ve_boxes por receipt×markbox). `deriveCnStatus`, `deriveVeStatus`, `daysBetween` exportados para test.
- `app/studio/(app)/inventario/page.tsx` — server component, `requireModuleView("inventory")`, fetch CN+VE.
- `app/studio/(app)/inventario/_components/InventarioClient.tsx` — client; tabs CN/VE, 4 KPIs (Shipping Marks/Cajas/Volumen CBM/Peso kg), ocupación de contenedor + cola "listo" (CN), tabla con `<Badge>`.
- `lib/studio/inventory/__tests__/queries.test.ts` — 12 casos.

Modificados:
- `lib/studio/modules.ts` — módulo `inventory` (OPERACIÓN, slug `/studio/inventario`, icon warehouse).
- `lib/studio/rbac.ts` — RBAC `inventory: ["operations","warehouse","support"]` (+admin).
- `docs/specs/0081-inventario-consolidacion/spec.md` — `status: approved → in-progress`, `updated`, §8 estado de implementación.

## Qué verifiqué
- `node scripts/verify.mjs` → **VERDE** (lint 0 errores, rsc-boundary OK, typecheck OK, 2712 tests OK, docs:check OK).
- `next build` (turbopack) → **verde**, `/studio/inventario` en el manifest de rutas.
- Tests propios: 12/12. RBAC anti-drift: 13/13 (matriz ↔ registro de módulos sincronizados).
- `docs/specs/README.md` (compartido) **NO** tocado — lo regenera la ventana de integración.

## Decisiones de implementación (defensibles, dentro de §6)
- VE en Slice A deriva del ciclo de la recepción VE (`en_muelle`/`recibiendo`→tránsito; `sellado`/`con_incidencia`→aduana). El avance a entrega/entregado cosido con Despacho se difiere a Slice B (la spec lo permite).
- Una fila = un receipt CN (no colapsa partidas del mismo mark) — espejo del mockup.

## Pendientes (NO en este lane)
- Slice B: override de "listo" (migración aditiva 0081) + cola accionable + view `inventory_by_mark`.
- Slice C: realtime + bin-packing.
- Revisión `ui-ux-designer` (proceso UI/UX) antes del merge — pantalla nueva.
- Merge a main + push: los hace el Director con OK del founder.
