---
sdd: "0081"
title: "Inventario de Consolidación (WMS) — stock real CN/VE por Shipping Mark + ocupación de contenedor + cola de consolidación"
status: approved
author: "Claude Code (carril feat/norte-v42 · Norte v4.2)"
created: 2026-06-14
updated: 2026-06-14
supersedes: null
superseded_by: null
related: ["0047", "0016", "0067", "0030", "0029"]
confidencialidad: interno
---

# DTD-0081 — Inventario de Consolidación (WMS)

> **Origen:** Norte v4.2 (`_norte/inventario/inventario.jsx` + `Inventario de Consolidación · DTD-Cargo.html`).
> Módulo nuevo del grupo **Operación**. Esta spec lo lleva a Supabase nativo **reusando** el modelo de
> recepciones de bodega (SDD-0016 CN / SDD-0067 VE) y de consolidación (SDD-0047) — es principalmente una
> **capa de lectura/derivación**, sin tablas core nuevas.
>
> **Aprobado por el founder el 2026-06-14** con 4 decisiones de alcance (ver §6).

## 1. Resumen en una línea

Una **torre de stock read-only** que unifica la bodega CN (**modo consolidación**, por Shipping Mark) y la
bodega VE (**modo despacho**), deriva el estado de cada partida y muestra la **ocupación del próximo
contenedor** + la **cola de carga lista para consolidar** — alimentando, sin reemplazar, el flujo de
Naviera (SDD-0047). Solo **CBM/kg** (sin valor USD).

## 2. Por qué (grounding)

- **El dato ya existe, falta la vista unificada.** El bodeguero CN escanea a `warehouse_receipts_cn`
  (SDD-0016) y el de VE a `warehouse_receipts_ve` (SDD-0067); Naviera (SDD-0047) agrupa en
  `consolidations` / `consolidation_items`. Pero **no hay una sola pantalla** que responda *"¿qué tiene
  cada cliente en bodega, en cuál bodega, y está listo para embarcar/despachar?"*.
- **Producto core.** Consolidar carga LCL chica de China en un FCL es 1 de los 4 productos DTD. El operador
  necesita ver, por Shipping Mark, cuánto CBM hay **listo** y cuánto falta para llenar el contenedor
  (capacidad de `container_types`, 40'HC ≈ 68 CBM) — esa decisión hoy se toma de cabeza.
- **Cierra el loop con Naviera.** SDD-0047 dejó la consolidación operable; el WMS es el **front que prioriza
  y alimenta** (qué partidas listas conviene meter al próximo `consolidation`). **El "armar" el contenedor
  sigue en Naviera** — el WMS no lo duplica (decisión founder §6.1).

## 3. Modelo de datos — REUSO (sin tablas core nuevas)

El WMS es **derivación sobre tablas existentes**:

| Concepto WMS | Fuente existente |
|---|---|
| Stock CN (caja física) | `warehouse_receipts_cn` — `client_markbox`, `boxes`, `total_cbm`, `total_weight_kg`, `status`, `shipment_id`, `warehouse_id` |
| Stock VE (despacho) | `warehouse_receipts_ve` + `warehouse_receipt_ve_boxes` (SDD-0067) |
| Contenido (multi-HS) | `warehouse_receipt_items` |
| Pertenencia a contenedor | `consolidation_items.shipment_id` ↔ `warehouse_receipts_*.shipment_id` |
| Estado del contenedor | `consolidations.status` (consolidando/cerrado/zarpado/arribado) |
| Capacidad / ocupación | `container_types.cbm_capacity` |
| Despacho VE (tránsito/aduana/entrega) | `shipments` + dispatch (SDD-0029/0030) |

**Derivación de estado CN — `listo` auto-derivado con override (decisión §6.3):**

- **Auto (Slice A, read-only):** `warehouse_receipt_status = pendiente_consolidacion` **y** `shipment_id IS NULL`
  **y** `received_at + N días ≤ hoy` (**N configurable, sugerido 3–5**) → **Listo p/ consolidar** (antes de N días = **Recibido**);
  `shipment_id` en un `consolidation` con `status = consolidando`
  → **Consolidando**; `consolidations.status ∈ {zarpado, transito}` → **En tránsito**.
- **Override (Slice B):** un marcador manual de "listo/no-listo" que el operador fija **en el flujo de
  recepción** (no en la torre read-only). El WMS lee `override ?? auto`. Requiere un campo/estado explícito
  → migración aditiva en Slice B (no toca Slice A).

**Modo despacho VE (decisión §6.4):** la pestaña VE NO usa la semántica de consolidación sino de **despacho**
(recibido en Valencia → aduana → listo para entrega → en entrega → entregado), derivada de
`warehouse_receipts_ve` + el estado de despacho (SDD-0029/0030). Mismo módulo, otro modo.

**Migración:** **Slice A = cero schema.** La única migración (Slice B, aditiva, **0081**) es el campo de
override de "listo" + opcionalmente una view de lectura `inventory_by_mark`. **Cero tablas core nuevas,
cero cambios destructivos.** RLS heredada de las tablas base (fail-closed por `tenant_id`).

## 4. Approach — staged (3 slices)

### Slice A — Torre de stock **read-only** (SIN migración) ← arranca acá

- Ruta `app/studio/(app)/inventario/` (Studio ERP). Permiso por rol (dirección / operación).
- Queries `lib/studio/inventory/queries.ts` (funciones puras sobre `SupabaseClient`):
  `getStockByWarehouse('CN' | 'VE')` agrupado por `client_markbox`, con totales CBM/kg/cajas + **estado
  derivado** (CN = consolidación; VE = despacho).
- UI espejo del mockup: tabs **Bodega China · Yiwu** (modo consolidación) / **Bodega Venezuela · Valencia**
  (modo despacho), 4 KPIs (Shipping Marks, cajas, CBM, kg), tabla con `<Badge>` por estado. Reusa
  primitivas de `app/studio/_components/ui/`. **Solo CBM/kg — sin columna de valor USD** (decisión §6.2).
- **100% read-only, sin migración** — lee `warehouse_receipts_cn` / `warehouse_receipts_ve` existentes.

### Slice B — Override de "listo" + ocupación + cola (migración aditiva)

- **Override de "listo"** (la única escritura del módulo): marcador manual que ajusta el auto-derivado.
  Migración **0081** aditiva (campo/estado), fijado desde el flujo de recepción.
- Tarjeta **"Próximo contenedor a consolidar"** = Σ CBM (listo + consolidando en CN) /
  `container_types.cbm_capacity` (40'HC) con semáforo (>85% rojo, >60% dorado, resto verde).
- Cola **"Listo para consolidar"** = **display read-only** de los receipts CN listos sin `shipment_id`,
  con **enlace a Naviera** para armar el contenedor (el WMS muestra; **Naviera arma** — decisión §6.1).
- View/RPC de lectura `inventory_by_mark` si el join pesa.

### Slice C — diferido

- Feed de recepción en **tiempo real** (escaneo en bodega → stock vía Supabase Realtime).
- **Bin-packing**: sugerir qué Shipping Marks llenan mejor el contenedor (SDD-0047 difirió esto).
- ~~Valor en USD del stock~~ → **descartado** (decisión §6.2: solo CBM/kg).

## 5. No-goals

- **No reemplaza Naviera (SDD-0047):** el WMS prioriza y alimenta; **armar** consolidación / booking / BL
  siguen en Naviera. El WMS **no escribe** `consolidation_items`.
- **No mueve la recepción:** sigue en las apps de operario (`/m/cn`, `/m/ve/bodeguero`); el override de
  "listo" se fija ahí, no en la torre.
- **No muestra valor en USD** (decisión §6.2) ni toca facturación / costos / contabilidad.

## 6. Decisiones (founder · 2026-06-14)

> Registradas por Cloud Design (fuente de verdad) en `_norte/inventario/DECISIONES-WMS-SDD-0081.md`.

1. **Alcance:** el módulo es **solo-lectura (torre)** en Slice A. Armar la consolidación **no** se hace acá
   — sigue en Naviera; el WMS solo muestra la cola y enlaza.
2. **Sin USD:** se muestra **solo CBM/kg**, nunca valor en USD (dato sensible). El valor de mercancía aparece
   **solo en el contexto de reclamos/seguro** (atado a la orden), no en la torre de inventario.
3. **"Listo p/ consolidar":** **auto-derivado con override** manual. Auto = `recibido` + **N días en bodega**
   (N configurable, **sugerido 3–5**); el bodeguero puede marcar/desmarcar a mano (a veces el cliente pide
   esperar más carga). El override (escritura) entra en Slice B, fijado desde el flujo de recepción.
4. **Bodega VE:** **modo despacho dentro del mismo módulo** (pestaña con semántica de despacho, no de
   consolidación). Se cose con Despacho (SDD-0029/0030).

## 7. Verificación (cuando se construya)

- `node scripts/verify.mjs` verde (incluye `rsc-boundary` — módulo server component + queries puras).
- Tests de `getStockByWarehouse` con fixtures de receipts CN/VE (estado derivado correcto: CN consolidación
  + VE despacho).
- `pnpm build` (turbopack) verde antes de cualquier push.
