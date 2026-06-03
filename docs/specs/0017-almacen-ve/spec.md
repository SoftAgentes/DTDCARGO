---
sdd: "0017"
title: "DoorTuDoor — Almacén VE (vista derivada + 4 acciones operativas)"
status: done
author: "founder"
created: 2026-05-25
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0005", "0012", "0013", "0016"]
confidencialidad: interno
---

# DTD-0017 — Almacén VE

> **Operación en Venezuela.** Container que arriba al puerto VE → trámites
> SENIAT → liberación → reparto DDP → entrega final. V1 modela las
> recepciones VE como **vista derivada de `shipments`** en estados
> VE-relevant (no tabla nueva). 4 acciones via cambio de status.

---

## 1. Resumen en una línea

`/studio/ve` muestra los shipments en estados VE (arrived_destination /
in_customs / out_for_delivery / last_mile / delivered / exception)
agrupados por puerto, con 4 KPIs + filtros + menú "···" con acciones
operativas (liberar aduana / asignar reparto / marcar entregado /
reportar incidencia).

---

## 2. Scope

### Incluye

#### Schema (migración 0009)

- Agregar 4 columnas a `shipments` (NULLABLE, no rompe nada existente):
  - `delivery_address text` — dirección final del cliente VE (Av. Bolívar,
    Edif X, Valencia). Distinta del `destination` que es el puerto (LGRA,
    PCBL). Editable al "Asignar reparto".
  - `delivered_at timestamptz` — POD timestamp (cuando se firmó la entrega).
    Hoy existe `arrived_destination_at` para llegada al puerto VE; ahora
    `delivered_at` para entrega final al cliente.
  - `pod_signed_by text` — nombre de quien firmó POD (cliente, recepcionista).
  - `pod_at timestamptz` — alias de `delivered_at` para legibilidad; setea
    igual al status `delivered`.
- **NOTA**: no creamos `pod_at` separado de `delivered_at`. Sería duplicación.
  Usamos solo `delivered_at` + `pod_signed_by`.
- Trigger: cuando `status` pasa a `delivered`, setear `delivered_at = now()`
  si está null (paralelo al trigger existente de `set_arrived_destination_at`).

#### Lib

- `lib/studio/warehouse-ve-types.ts`:
  - `VE_STATUSES: ShipmentStatus[]` — subset relevante a VE: `arrived_destination`,
    `in_customs`, `out_for_delivery`, `last_mile`, `delivered`, `exception`
  - `VE_STATUS_LABELS: Record<ShipmentStatus, string>` — etiquetas VE-friendly
    (e.g. `arrived_destination` → "Listo retiro", `in_customs` → "En aduana SENIAT")
  - `VE_STATUS_TONES: Record<ShipmentStatus, BadgeTone>` — tonos para badges
  - Helper `isVeStatus(s)` para validar params
  - Tipo `VeReceiptRow` (subset de shipment + delivery fields)
- `lib/studio/warehouse-ve-queries.ts`:
  - `listVeReceipts(supabase, filters)` — filtra shipments con status IN VE_STATUSES.
    Filters: `q` (search code/client/destination), `port` (substring ilike sobre
    destination), `status` (uno de VE_STATUSES o "all").
  - `computeVeKpis(supabase)` — 4 counts agregados:
    - inCustoms (in_customs)
    - readyForPickup (arrived_destination)
    - outForDelivery (out_for_delivery + last_mile)
    - deliveredThisMonth (delivered con delivered_at >= mes corriente)
  - `parseVeFiltersFromSearchParams(sp)`

#### Componentes (`app/studio/(app)/ve/_components/`)

- `VeKpis.tsx` (server):
  - 4 KPI cards horizontal reusando KpiCard
  - Tonos: warning / info / wine / success
- `VeStatusBadge.tsx` (server, puro):
  - Wrapper de Badge con tone + label según VE_STATUS_TONES/LABELS
- `AlmacenVeClient.tsx` (client orquestador):
  - Toolbar: search debounced + port filter (text input "Valencia", "La Guaira")
    + status filter (dropdown con opciones VE)
  - Tabla 9 columnas: `code` · `client` · `destination` (puerto) ·
    `delivery_address` (con — si null) · `boxes/cbm` · `received_at` (arrived)
    · `delivered_at` · `status` · `actions`
  - Click en fila → no-op V1 (detalle es responsabilidad de /tracking/[id])
  - Empty state cuando 0 rows
- `VeRowActions.tsx` (client):
  - Menú "···" con 4 acciones según status actual:
    - "Marcar liberado de aduana" (visible si status = in_customs)
    - "Asignar reparto" (visible si status = arrived_destination)
    - "Marcar entregado" (visible si status IN [out_for_delivery, last_mile])
    - "Reportar incidencia" (visible siempre excepto delivered/cancelled)
    - "Ver detalle completo →" (siempre, navega a /tracking/[id])
  - Cada acción llama server action correspondiente

#### Page

- `app/studio/(app)/ve/page.tsx` (reemplaza placeholder):
  - Server. Lee searchParams → llama queries en paralelo.
  - Layout: header + VeKpis + AlmacenVeClient

#### Server actions

- `app/studio/(app)/ve/actions.ts`:
  - `markCustomsReleasedAction(shipmentId)` — status: in_customs →
    arrived_destination + event note "Liberado de aduana SENIAT"
  - `assignDeliveryAction(shipmentId, { deliveryAddress?, note? })` —
    status: arrived_destination → out_for_delivery + updateNotes +
    update delivery_address + event note "Asignado para reparto"
  - `markDeliveredAction(shipmentId, { podSignedBy? })` —
    status: out_for_delivery/last_mile → delivered + setea
    delivered_at = now() + pod_signed_by + event note "Entregado · POD firmado"
  - `reportIncidentAction(shipmentId, { reason })` —
    status: → exception + cancellation_reason si aplica + event note
    "Incidencia: {reason}"

### NO incluye (diferidos a SDDs futuros)

- **Drawer detalle individual /ve/[id]** — el detalle del shipment ya existe en
  `/tracking/[id]`. No duplicamos. → eventual SDD-0017.1 si necesitamos
  vista VE-específica del detalle
- **Form completo "Asignar reparto"** con chofer + camión + dirección
  obligatoria + fecha estimada. V1 = prompt simple con dirección opcional +
  nota. Form completo → **SDD-0019 TMS**
- **Catálogo `ports_ve`** con tabla seedeada (LGRA, PCBL, MARA, GRNA, LCBA).
  V1 = text libre via `destination` del shipment. Formal catalog → **SDD-0018
  SENIAT** cuando necesitemos códigos aduanales por puerto
- **POD upload** (foto de la firma, scan del remito). Requiere Storage. →
  **SDD-0017.2 POD digital**
- **Mass actions** (seleccionar N rows + acción bulk). V1 = 1 row a la vez
- **Reordering / pin favoritos** en la tabla. V1 = orden por received_at DESC
- **Vista mapa** mostrando puertos VE + camiones en ruta. → **SDD-0019 TMS**
- **Customs broker dropdown** y management. → **SDD-0018 SENIAT**

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0017-almacen-ve/
└── spec.md                                              ← este

supabase/migrations/
└── 0009_shipment_delivery_pod.sql                      ← 4 columnas + trigger

lib/studio/
├── warehouse-ve-types.ts                                ← VE statuses + labels + tones
└── warehouse-ve-queries.ts                              ← queries + filters

app/studio/(app)/ve/
├── page.tsx                                             ← reemplaza placeholder
├── actions.ts                                           ← 4 server actions
└── _components/
    ├── AlmacenVeClient.tsx                              ← client orquestador
    ├── VeKpis.tsx                                       ← server, 4 KPI cards
    ├── VeStatusBadge.tsx                                ← server, puro
    └── VeRowActions.tsx                                 ← client, menú ···
```

### Editados

```
app/studio/(app)/ve/page.tsx                             ← era placeholder
docs/design/v1-studio/module-map.md                      ← marcar Almacén VE ✅
lib/studio/shipment-types.ts                             ← agregar delivery_address, delivered_at, pod_signed_by al type Shipment
```

---

## 4. Decisiones de diseño

### 4.1 Vista derivada de `shipments`, sin tabla nueva

**Por qué:** Cada "VE receipt" del JSX es **1 shipment en cierto estado**,
no una entidad nueva. Modelarlo como tabla separada sería duplicar info
que ya está en shipments y requeriría sync (status change → update VE
receipt → update shipment).

Las acciones VE (liberar / asignar / entregar / incidencia) son **cambios de
status del shipment**. Encajan perfecto con el state machine existente
(SDD-0005 Fase 2).

Si en el futuro necesitamos info VE-específica que NO encaje en shipments
(ej: customs broker assignment, multi-driver routing), creamos tabla
`ve_operations` con FK. Pero V1 honest: sin tabla.

### 4.2 Reuso enum `shipment_status`

**Por qué:** los 6 estados VE-relevant (`arrived_destination`, `in_customs`,
`out_for_delivery`, `last_mile`, `delivered`, `exception`) ya existen en el
enum desde SDD-0005. Crear un enum paralelo `ve_status` sería duplicación
semántica.

Mapeo a labels VE-friendly:

| shipment_status | VE label | Tone |
|---|---|---|
| `arrived_destination` | "Listo retiro" | info |
| `in_customs` | "En aduana SENIAT" | warning |
| `out_for_delivery` | "En reparto" | wine |
| `last_mile` | "Última milla" | wine |
| `delivered` | "Entregado · POD" | success |
| `exception` | "Incidencia" | danger |

### 4.3 4 columnas nuevas a `shipments` (delivery_address + POD)

**Por qué:**
- `delivery_address text` separado de `destination`: el `destination` es el
  puerto (LGRA, PCBL). La dirección final del cliente puede ser Av. Bolívar,
  Edif X — info distinta y útil para el chofer del reparto. Hoy no se guarda
  en ningún lado, lo cual es un gap.
- `delivered_at timestamptz`: hoy hay `arrived_destination_at` para llegada
  al puerto. Falta `delivered_at` para entrega final al cliente.
- `pod_signed_by text`: nombre de quien recibió y firmó. Útil para
  documentación + auditoría + responder reclamos.

NO agrego columnas que ya están cubiertas:
- `cancellation_reason` ya existe — sirve para incidencias también
- `notes` ya existe — sirve para nota libre de la acción
- `vehicle_*` ya existe — para el camión asignado (cuando TMS llegue)

### 4.4 4 acciones via menú "···", visibles por status

**Por qué:** UX consistente con CN (menú "···" en row). Las acciones se
filtran dinámicamente según `status` actual del shipment para no mostrar
opciones inválidas.

Server actions valida state machine: si alguien intenta marcar entregado un
shipment en `in_customs` (skip de estados), devuelve error.

### 4.5 "Asignar reparto" V1 = prompt simple, no drawer completo

**Por qué:** SDD-0019 TMS va a tener el form completo de asignación
(chofer + camión + fecha estimada + ruta). Anticiparlo acá es duplicar
trabajo.

V1: action recibe `delivery_address?` (opcional, para editar la dirección si
todavía no estaba seteada) + `note?` (opcional, va al event timeline).
Implementación: prompt inline en el row actions menu (no drawer separado).

Cuando llegue TMS, el menu cambia "Asignar reparto" → "Asignar reparto en
TMS →" y el flow se delega al módulo TMS.

### 4.6 Filtros: text search + port substring + status enum

**Por qué:** mismo patrón que SDD-0016 CN. `port` filter es substring (`ILIKE
%valencia%`) porque `destination` es texto libre en shipments. Cuando exista
catálogo (SDD-0018 SENIAT), se agrega dropdown de puertos formales.

### 4.7 Sin form de creación

**Por qué:** los VE receipts no se crean por operario VE. Se "auto-aparece"
en el listado cuando un shipment cambia a estado VE-relevant
(arrived_destination y siguientes). Esa transición ya la hacen otros
módulos (Tracking, Embarques) — Almacén VE solo opera sobre lo que ya
existe.

Si un día Sam necesita crear un VE receipt "from scratch" (raro, posible si
arribó algo no consolidado por DTD), usa el flow de "Nuevo envío" en
Tracking con status = arrived_destination directamente.

### 4.8 No tocar shipments existentes con backfill

**Por qué:** las 4 columnas nuevas son nullable. Shipments existentes
quedan con NULL en delivery_address / delivered_at / pod_signed_by, sin
problema.

Cuando un shipment ya entregado pase por la UI, se ve sin POD info
(esperado). Si Sam quiere backfillearlos, se hace via SQL manual o un
script de migration futuro.

---

## 5. Criterios de aceptación

### Funcional

- [ ] `/studio/ve` muestra shipments con status IN VE_STATUSES
- [ ] 4 KPIs calculados desde data real (no hardcoded)
- [ ] Filtros funcionan: search por code/client/destination · port substring
      · status enum
- [ ] Menú "···" muestra acciones según status actual del shipment
- [ ] "Marcar liberado de aduana" cambia status in_customs → arrived_destination
      + event insert
- [ ] "Asignar reparto" cambia status arrived_destination → out_for_delivery
      + opcionalmente actualiza delivery_address + event insert
- [ ] "Marcar entregado" cambia status → delivered + setea delivered_at +
      opcionalmente pod_signed_by + event insert
- [ ] "Reportar incidencia" cambia status → exception + event insert con razón
- [ ] "Ver detalle completo" navega a `/tracking/[id]`
- [ ] Empty state cuando 0 rows con CTA "Ver en Tracking →"

### Sistema

- [ ] `pnpm typecheck` pasa
- [ ] Migration 0009 corre limpia (idempotente — usa IF NOT EXISTS donde
      se necesite)
- [ ] Trigger `set_delivered_at` setea timestamp solo en transición a delivered
- [ ] RLS sigue funcionando (no tocamos policies de shipments)
- [ ] Sidebar marca "Almacén VE" como active
- [ ] Light + dark themes funcionan
- [ ] Componentes pasan ui-ux-designer review

---

## 6. Out of scope / open questions

### Out V1 (cubierto en sección 2)

Detalle individual VE, drawer completo asignar reparto, catálogo puertos,
POD upload (Storage), mass actions, vista mapa, customs broker dropdown.

### Open questions resueltas en kickoff

- ✅ **Schema** → vista derivada de shipments, sin tabla nueva
- ✅ **Estados** → reuso shipment_status enum
- ✅ **Mini migration** → sí, 4 columnas a shipments (delivery_address,
  delivered_at, pod_signed_by + trigger)

### Open questions diferidas

- **¿"En aduana SENIAT" debería tener sub-estados (declarado / inspeccionado
  / pagado / liberado)?** Out V1. SDD-0018 SENIAT lo va a definir.
- **¿"En reparto" debería distinguir entre out_for_delivery (en camión) y
  last_mile (a punto de entregar)?** Hoy el enum existe pero V1 los trata
  igual (mismo tone wine, mismo menu). Cuando TMS llegue, el distinguir
  va a tener sentido para mostrar GPS del camión.
- **¿"Ver detalle completo" debería abrir drawer inline o navegar?** V1
  navega a `/tracking/[id]` (consistente con módulo Embarques). Drawer
  inline sería duplicar UI.
