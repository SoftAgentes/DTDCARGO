---
sdd: "0080"
title: "Inventario de Consolidación (WMS) — stock real CN/VE por Shipping Mark + ocupación de contenedor + cola de consolidación"
status: proposed
author: "Claude Code (carril feat/norte-v42 · Norte v4.2)"
created: 2026-06-14
updated: 2026-06-14
supersedes: null
superseded_by: null
related: ["0047", "0016", "0067", "0030", "0029"]
confidencialidad: interno
---

# DTD-0080 — Inventario de Consolidación (WMS)

> **Origen:** Norte v4.2 (`_norte/inventario/inventario.jsx` + `Inventario de Consolidación · DTD-Cargo.html`).
> Módulo nuevo del grupo **Operación**. Esta spec lo lleva a Supabase nativo **reusando** el modelo de
> recepciones de bodega (SDD-0016 CN / SDD-0067 VE) y de consolidación (SDD-0047) — es principalmente una
> **capa de lectura/derivación**, sin tablas core nuevas.

## 1. Resumen en una línea

Una **torre de stock** que unifica las recepciones de bodega CN y VE agrupadas por **Shipping Mark**,
deriva el estado de cada partida (recibido → listo → consolidando → tránsito → aduana → entrega) y muestra
la **ocupación del próximo contenedor** + la **cola de carga lista para consolidar**, alimentando el flujo
de Naviera (SDD-0047).

## 2. Por qué (grounding)

- **El dato ya existe, falta la vista unificada.** El bodeguero CN escanea a `warehouse_receipts_cn`
  (SDD-0016) y el de VE a `warehouse_receipts_ve` (SDD-0067); Naviera (SDD-0047) agrupa en
  `consolidations` / `consolidation_items`. Pero **no hay una sola pantalla** que responda *"¿qué tiene
  cada cliente en bodega, en cuál bodega, y está listo para embarcar?"*. Hoy esa lectura es por módulo suelto.
- **Producto core.** Consolidar carga LCL chica de China en un FCL es 1 de los 4 productos DTD. El operador
  necesita ver, por Shipping Mark, cuánto CBM hay **listo** y cuánto falta para llenar el contenedor
  (capacidad de `container_types`, 40'HC ≈ 68 CBM) — esa decisión hoy se toma de cabeza.
- **Cierra el loop con Naviera.** SDD-0047 dejó la consolidación operable, pero **qué partidas meter** al
  contenedor es manual; el WMS es el front que **prioriza y alimenta** el próximo `consolidation`.

## 3. Modelo de datos — REUSO (sin tablas core nuevas)

El WMS es **derivación sobre tablas existentes**:

| Concepto WMS | Fuente existente |
|---|---|
| Stock CN (caja física) | `warehouse_receipts_cn` — `client_markbox`, `boxes`, `total_cbm`, `total_weight_kg`, `status`, `shipment_id`, `warehouse_id` |
| Stock VE | `warehouse_receipts_ve` + `warehouse_receipt_ve_boxes` (SDD-0067) |
| Contenido (multi-HS) | `warehouse_receipt_items` |
| Pertenencia a contenedor | `consolidation_items.shipment_id` ↔ `warehouse_receipts_*.shipment_id` |
| Estado del contenedor | `consolidations.status` (consolidando/cerrado/zarpado/arribado) |
| Capacidad / ocupación | `container_types.cbm_capacity` |
| Tránsito / aduana / entrega | `shipments` + tracking (SDD-0014/0029) |

**Derivación de estado** (sin columna nueva — función/CASE de lectura):

- `warehouse_receipt_status = pendiente_consolidacion` **y** `shipment_id IS NULL` → **Recibido / Listo p/ consolidar**.
- `shipment_id` ligado a un `consolidation` con `status = consolidando` → **Consolidando**.
- `consolidations.status ∈ {zarpado, transito}` → **En tránsito**; **aduana** / **entrega** ← estado del shipment/tracking.

**Lo único que podría requerir migración (Slice B, mínima y aditiva):** una **view** o RPC de lectura
`inventory_by_mark` (agregación `group by client_markbox, warehouse`) para no rearmar el join en cada
request, y a lo sumo un índice de apoyo. **Cero tablas nuevas, cero cambios destructivos.** RLS heredada de
las tablas base (fail-closed por `tenant_id`).

## 4. Approach — staged (3 slices)

El valor operativo (ver el stock real + saber qué está listo + cuánto llena el contenedor) ships en **Slice A**
sin tocar el schema. La automatización (feed en vivo, bin-packing) se difiere igual que en SDD-0047.

### Slice A — Torre de stock read-only (SIN migración) ← arranca acá

- Ruta `app/studio/(app)/inventario/` (superficie Studio ERP). Permiso por rol (dirección / operación).
- Queries `lib/studio/inventory/queries.ts` (funciones puras sobre `SupabaseClient`):
  `getStockByWarehouse('CN' | 'VE')` agrupado por `client_markbox`, con totales CBM/kg/cajas + **estado derivado**.
- UI espejo del mockup: tabs **Bodega China · Yiwu** / **Bodega Venezuela · Valencia**, 4 KPIs
  (Shipping Marks, cajas, CBM, kg), tabla (Shipping Mark · cliente · contenido · cajas · CBM · peso · días ·
  estado) con `<Badge>` por estado. Reusa primitivas de `app/studio/_components/ui/`.
- **Sin migración** — lee `warehouse_receipts_cn` / `warehouse_receipts_ve` existentes.

### Slice B — Ocupación + cola de consolidación (migración aditiva opcional)

- Tarjeta **"Próximo contenedor a consolidar"** = Σ CBM (listo + consolidando en CN) / `container_types.cbm_capacity`
  (40'HC) con semáforo (>85% rojo, >60% dorado, resto verde) — patrón `Occupancy` del mockup.
- Cola **"Listo para consolidar"** = receipts CN `pendiente_consolidacion` sin `shipment_id` → botón
  **"Agregar al contenedor"** que crea/añade `consolidation_items` **reusando la server action de Naviera**
  (SDD-0047) — no se duplica la lógica de consolidación.
- Si el join pesa: view/RPC de lectura `inventory_by_mark` (migración **0080**, aditiva, solo SELECT).

### Slice C — diferido

- Feed de recepción en **tiempo real** (escaneo en bodega → stock vía Supabase Realtime).
- **Bin-packing**: sugerir qué Shipping Marks llenan mejor el contenedor (SDD-0047 difirió esto explícitamente).
- **Valor en USD** del stock por partida desde `warehouse_receipt_items.unit_value_usd` (dato sensible → gated).

## 5. No-goals

- **No reemplaza Naviera (SDD-0047):** el WMS prioriza y alimenta; consolidación / booking / BL siguen en Naviera.
- **No mueve la recepción:** sigue en las apps de operario (`/m/cn`, `/m/ve/bodeguero`).
- **No toca** facturación, costos ni contabilidad.

## 6. Preguntas abiertas (founder)

1. ¿El WMS es **solo torre (lectura)** o desde acá se **arma** la consolidación (botón "agregar al contenedor")?
   Slice B asume que sí, reusando Naviera; si preferís solo-lectura, Slice B se recorta.
2. ¿Mostramos **valor en USD** del stock (sensible) o solo volumen/peso? El mockup muestra solo CBM/kg.
3. **"Listo para consolidar":** ¿lo marca el bodeguero (estado manual) o se deriva (recibido + N días)? Hoy
   `warehouse_receipt_status` tiene `pendiente_consolidacion` — ¿alcanza o querés un estado `listo` explícito?
4. **VE:** el inventario de Valencia es de **salida** (lo que llegó para despacho), no de consolidación.
   ¿Mismo tablero con la pestaña VE, o pestaña con otra semántica (cola de despacho)?

## 7. Verificación (cuando se construya)

- `node scripts/verify.mjs` verde (incluye `rsc-boundary` — el módulo es server component + queries puras).
- Tests de `getStockByWarehouse` con fixtures de receipts CN/VE (estado derivado correcto en los 6 casos).
- `pnpm build` (turbopack) verde antes de cualquier push.
