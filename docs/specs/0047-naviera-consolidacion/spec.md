---
sdd: "0047"
title: "Naviera & Consolidación — carriers + itinerarios + bookings/BL + consolidación LCL→FCL (Bloque 4)"
status: approved
author: "Claude Code (carril Bloque 4 · Norte v2.4)"
created: 2026-06-03
updated: 2026-06-03
supersedes: null
superseded_by: null
related: ["0039", "0016", "0012", "0021", "0044", "0014"]
confidencialidad: interno
---

# DTD-0047 — Naviera & Consolidación

> **Bloque 4 del roadmap.** Cierra el único ❌ del cruce entidad↔tabla: **`Container` no existe
> como entidad**. Es la pieza que vuelve **simétrico** el ERP: el lado financiero (facturación,
> contabilidad, cobranzas, tesorería) ya está maduro y factura **contra envíos**, pero el producto
> que da nombre a la empresa — **consolidar carga LCL chica de China en un contenedor FCL** — todavía
> no se **opera** como objeto propio. Diseño completo en el Norte v2.4 (`erp/modules/naviera*.jsx`).

## 1. Resumen en una línea

Modelar la naviera como entidad: **navieras (carriers) · itinerarios (sailings) · reservas de
espacio (bookings + BL) · contenedores de consolidación (LCL→FCL)** con cálculo de utilización
CBM/peso, alimentando la carga suelta recibida en almacén CN.

## 2. Por qué (grounding)

- **Hueco confirmado:** hoy una "consolidación" es solo un `shipment` con `code` `C-YYYY-NNNN`
  (RPC `next_consolidation_code`, stopgap de SDD-0039) + `product_type ∈ {consolidacion, reserva_FCL}`.
  No hay forma de **agrupar** N envíos LCL en un contenedor, medir cuánto CBM/peso lleva, ni atarlo
  a un zarpe (sailing) y a una reserva de espacio (booking) con su BL.
- **Producto core:** "consolidación" es uno de los 4 productos comerciales de DTD. Sin esta entidad,
  el operador no sabe cuándo un contenedor está lleno para cerrarlo ni qué embarques viajan juntos.
- **Norte v2.4 ya lo diseñó completo** (`erp/modules/naviera-data.jsx` + `naviera.jsx`): carriers,
  ports, container_types, sailings, bookings, containers con items, loose_cargo + helper
  `containerStats` (utilización CBM%/kg%, espacio libre). Esta spec lo lleva a Supabase nativo.

## 3. Approach — staged (3 slices)

El **valor operativo** (agrupar carga suelta → contenedor → medir utilización → cerrar y atar a
un zarpe) ships en Slice A+B sin depender de integraciones frágiles. La **automatización de
itinerarios** (scraping a las navieras) y la **emisión de BL como documento** son frágiles/externas
→ se difieren igual que SENIAT en SDD-0046 (piso manual primero, swap-ready después).

### Slice A — Foundation: schema + entidades base (sin UI compleja) ← arranca acá

- **Migración** `0096_naviera_consolidacion.sql` (aditiva; no toca tablas existentes salvo FK
  opcional en `shipments`):
  - `carriers` (navieras) — `id`, `tenant_id`, `name`, `name_cn`, `scac`, `tone`, `active`.
  - `ports` (puertos) — `code` (PK por tenant), `tenant_id`, `name`, `name_cn`, `country` (CN/VE).
    Seed con los 6 del Norte (NGB/YTN/SHA/NSA/PBL/LGU).
  - `container_types` — **catálogo de referencia** (`20GP`/`40GP`/`40HC` con `cbm_capacity`,
    `kg_capacity`). Tabla chica seedeada (no por-tenant, o tenant-scoped con seed default).
  - `sailings` (itinerarios) — `id`, `tenant_id`, `carrier_id`, `vessel`, `voyage`, `pol`, `pod`,
    `etd`, `eta`, `cutoff`, `transit_days`, `status` (abierto/cutoff/zarpado/transito/arribado),
    `space` (alta/media/baja/cerrada).
  - `bookings` (reservas) — `id`, `tenant_id`, `code` (`BKG-YYYY-NNNN`), `carrier_id`, `sailing_id`,
    `bl_number` (nullable), `container_type`, `mode` (FCL/LCL), `shipper`, `commodity`, `status`.
  - `consolidations` (= la entidad **`Container`** del blueprint) — `id`, `tenant_id`, `ref`
    (`DTD-CONSOL-NNNN` vía RPC nuevo `next_consolidation_ref` · §4.2), `booking_id` (nullable),
    `sailing_id` (nullable), `container_type`, `status` (consolidando/cerrado/zarpado/arribado).
  - `consolidation_items` — `id`, `tenant_id`, `consolidation_id` (FK), `shipment_id` (FK a
    `shipments`), `cbm`, `weight_kg`, `pieces`. Una pieza = un embarque LCL asignado.
  - **RLS fail-closed** por `tenant_id` en todas (estándar del repo) + `next_booking_code` RPC
    (`BKG-YYYY-NNNN`) + `next_consolidation_ref` RPC (`DTD-CONSOL-NNNN`), ambos patrón
    `next_quote_code`, secuencial por tenant.
- **Tipos puros** `lib/studio/naviera/types.ts` — enums, labels, tones, `CONTAINER_TYPES`,
  `containerStats(items, type)` (calca el helper del Norte: `cbmPct`, `kgPct`, `freeCbm`, `freeKg`,
  `clients`), validadores `validate*Input()` (no Zod).
- **Queries** `lib/studio/naviera/queries.ts` — `listSailings`, `listBookings`, `listConsolidations`,
  `getConsolidation` (con items + utilización), `listLooseCargo(supabase, tenant)`.
- **NO** en Slice A: server actions de mutación, UI de drawer, asignación. Solo el cimiento + lectura.

### Slice B — Operable end-to-end (el valor) · NO en Slice A

- **Surface** `app/studio/(app)/naviera/` (Server Components contra Supabase):
  - **Itinerarios:** lista de sailings (abiertos/cut-off arriba) + alta/edición **manual** (drawer).
  - **Contenedores / consolidación** ⭐: vista de cada `consolidation` con **barra de utilización**
    CBM%/kg% (verde<80 / dorado 80-100 / wine >100 = sobre-capacidad), items asignados, espacio
    libre. Acción **"asignar carga suelta"** (de `loose_cargo` → `consolidation_items`) con **guard
    de capacidad** (avisa si supera CBM o kg del tipo; no bloquea — advisory como el Norte).
  - **Carga suelta** (`loose_cargo`): embarques `product_type=consolidacion` recibidos en almacén
    CN (`warehouse_receipt` cerrada) **sin** `consolidation_item` → candidatos a consolidar.
  - **Bookings:** alta de reserva + captura **manual** de `bl_number` cuando la naviera lo emite.
  - Cerrar contenedor (`consolidando→cerrado`), atar a booking/sailing, marcar zarpado.
- **Server Actions** `actions.ts` (`"use server"` + `useActionState` + FormData manual +
  `validate*Input()` + `revalidatePath`): crear/editar sailing, booking, consolidation; asignar/quitar
  item; cambiar estado.
- **Wire al Dashboard (SDD-0014):** KPI "contenedores consolidando" + "CBM suelto sin asignar".
- **`ui-ux-designer` pre-commit** (regla founder) — barras de utilización con tokens, sin AI slop.

### Slice C — Avanzado (gated) · futuro

- **Scraping de itinerarios** de las navieras (COSCO/Maersk/MSC tracking) → autopoblar sailings.
  Frágil (cada carrier distinto, auth, rate-limit) → **spike primero**, igual que SENIAT. V1 = manual.
- **Emisión de BL como documento** (PDF) + integración con Documentos Hub (DMS, Bloque 5). V1 =
  solo capturar el `bl_number` (texto).
- **Auto bin-packing optimizer** (sugerir qué piezas meter en qué contenedor para maximizar CBM).
  V1 = métricas de utilización + asignación manual con guard. El optimizer es un nice-to-have.

## 4. Decisiones de diseño

### 4.1 `consolidations` es la entidad `Container` del blueprint
El Norte la llama "container" / `CONTAINERS`; en el dominio DTD el registro es la **consolidación**
(un contenedor que agrupa carga). Nombre de tabla `consolidations` para no chocar con el lenguaje
("container" es el *tipo* físico 40HC). `consolidation_items` = las piezas LCL.

### 4.2 Code `DTD-CONSOL-NNNN` (decisión founder 2026-06-03)
El Norte mockea `DTD-CONSOL-0502` y el founder lo confirmó como **ref visible** del contenedor (más
legible que el `C-YYYY-NNNN` interno). Slice A crea un RPC nuevo `next_consolidation_ref` (patrón
`next_quote_code`, secuencial por tenant) → `DTD-CONSOL-NNNN`. El `C-YYYY-NNNN` de SDD-0039 (RPC
`next_consolidation_code`) queda para el shipment-stopgap legacy; **no se migra en V1, coexisten** —
el `ref` nuevo es el del contenedor como entidad de primera clase.

### 4.3 `loose_cargo` es **derivado**, no tabla
No se duplica: la carga suelta = `shipments` con `product_type=consolidacion` + recepción CN cerrada
+ sin `consolidation_item`. Una query, no una tabla nueva (evita drift con almacén CN, SDD-0016).

### 4.4 Utilización advisory, no bloqueo
El guard de capacidad **avisa** (barra wine si >100%) pero no impide asignar — el operador real a
veces sobre-llena y reacomoda. Mismo principio "advisory" que SDD-0046.

### 4.5 Carriers = navieras; relación con Tesorería (SDD-0044)
La naviera es un proveedor de flete. `carriers` es la entidad operativa (itinerarios); el pago del
flete va por `suppliers`/`supplier_bills` de Tesorería (type `naviera` ya existe). V1 **no** los
fusiona; se cruzan por nombre/ref (link explícito = futuro, Bloque 5 costing).

### 4.6 Itinerarios manuales en V1
Los sailings se cargan a mano (el operador conoce los zarpes de sus navieras). Scraping = Slice C.

## 5. Acceptance

### Slice A
- [ ] Migración `0096` aplica limpia + rollback-test; RLS aísla por tenant (probado con 2 tenants).
- [ ] Seed de ports (6) + container_types (3) presente.
- [ ] `containerStats` calcula CBM%/kg%/libre igual que el helper del Norte (test unit).
- [ ] `listLooseCargo` devuelve embarques LCL recibidos en CN sin contenedor (test).
- [ ] `typecheck` + `lint` (frontera pública↔ERP intacta) verdes.

### Slice B
- [ ] Crear sailing → booking → consolidation; asignar 3 embarques sueltos → la barra refleja CBM%.
- [ ] Guard de capacidad avisa al superar el CBM del tipo (sin bloquear).
- [ ] Cerrar contenedor + atar a sailing; KPI del dashboard refleja el conteo.
- [ ] `next_booking_code` genera `BKG-YYYY-NNNN` secuencial por tenant.
- [ ] `ui-ux-designer` sin hallazgos Alta.

## 6. Archivos a crear / editar (estimado)

```
supabase/migrations/0096_naviera_consolidacion.sql       ← Slice A (NEW)
lib/studio/naviera/{types,queries}.ts                    ← Slice A (NEW)
lib/studio/naviera/__tests__/*.test.ts                   ← Slice A (NEW)
app/studio/(app)/naviera/{page,actions}.tsx + _components ← Slice B (NEW)
app/studio/_components/shell sidebar                      ← Slice B (registrar módulo)
lib/studio/dashboard-queries.ts                          ← Slice B (KPIs)
docs/architecture/module-sdd-map.md                      ← al cerrar (fila Naviera)
docs/specs/README.md                                     ← reindex (docs:index)
```

## 7. Decisiones resueltas (founder · 2026-06-03)

1. **Code del contenedor:** `DTD-CONSOL-NNNN` (RPC nuevo `next_consolidation_ref`). ✅
2. **Carriers/ports:** tenant-scoped con seed default (multi-tenant ready). ✅
3. **Cadencia del harness:** **Slice A primero** (mergeable solo, testeable sin UI); B en 2ª corrida. ✅
4. **Carrier↔supplier (Tesorería):** por nombre en V1; link formal en Bloque 5 (costing/margen). ✅

## 8. Out of scope (V1) / Deferred

- Scraping de itinerarios (Slice C, spike-gated).
- Emisión de BL como PDF / Documentos Hub (Bloque 5 · DMS).
- Auto bin-packing optimizer (V1 = utilización + asignación manual).
- Costing & margen por contenedor (reparto de flete por CBM a cada cliente) → Bloque 5 / SDD Costing.
- Tracking marítimo en vivo del vessel (Slice C).
