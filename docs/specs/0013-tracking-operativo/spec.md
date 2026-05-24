---
sdd: "0013"
title: "DoorTuDoor — Tracking operativo (mapa + timeline)"
status: approved
author: "founder"
created: 2026-05-24
updated: 2026-05-24
supersedes: null
superseded_by: null
related: ["0005", "0006", "0012"]
---

# DTD-0013 — Tracking operativo

> **Refactor del módulo Tracking.** Pasa de "lista de envíos del tenant"
> a **vista operativa en vivo**: sidebar con embarques activos + mapa SVG
> con barco animado por % progreso + timeline operativa con steps
> done/active/pending. El listado plano que había antes se elimina porque
> Embarques (SDD-0012) ya cumple la vista comercial agrupada por cliente.

---

## 1. Resumen en una línea

`/studio/tracking` ahora muestra **dónde está cada embarque activo** con
mapa SVG estilizado + timeline. Sin listas planas. Sin Embarques
duplicado.

---

## 2. Scope

### Incluye

#### Lib
- `lib/studio/tracking-progress.ts`:
  - `STATUS_FLOW_ORDER: ShipmentStatus[]` — orden canónico de status que
    representa el avance operativo (excluye terminales y excepcionales).
  - `computeProgress(status): number` — devuelve 0-100 según posición
    del status en el flow (e.g. `in_transit` → 55%, `delivered` → 100%).
  - `nextMilestone(status, service): string` — string corto para el KPI
    "Próximo hito" (e.g. "Aduana VE", "Última milla").
  - `daysRemaining(status): number` — estimación rough basada en
    `100 - progress`. No es real, es heurístico (placeholder hasta
    SDD futuro con ETA real).

#### Queries
- `lib/studio/shipment-queries.ts`:
  - `listActiveShipments(supabase)` — filtra status NOT IN
    (delivered, cancelled, draft). Devuelve hasta 200 ordenados por
    `created_at DESC`. Reusa el SELECT de listShipments.

#### Componentes (todos en `app/studio/(app)/tracking/_components/`)
- `ActiveShipmentList.tsx` (client component):
  - Lista vertical de cards 320px de ancho.
  - Cada card: code (mono) · status badge · client_name · ruta origen→destino
    · progress bar · "{progress}%" + "ETA {arrived_destination_at?}".
  - Card seleccionada: border wine + fondo wine-tint.
  - Click → cambia `?id=<shipment.id>` en URL (shallow update).
  - Search input arriba (placeholder "Buscar embarque…"), filtra
    client-side por code/client/origin/destination.
- `TrackingMap.tsx` (server component, SVG sin animación de runtime → static):
  - Card padded={false}.
  - Header: "POSICIÓN ACTUAL" + "{code} · {vehicle_model || sin asignar}"
    + "ETA {destination}" + fecha si existe arrived_destination_at.
  - SVG 900×320 estilizado:
    - 3 paths de continentes (Asia + Europa + África simplificados).
    - Path ruta dasharray wine-soft (todo el recorrido).
    - Path ruta sólida wine (recorrido hasta el barco).
    - Círculo origen (ink) + label nombre origen + label CN (Noto Sans SC).
    - Círculo destino (wine) + label nombre destino + "Venezuela".
    - Barco animado: círculo wine con halo expandiéndose (SMIL
      `<animate>`). Label "{progress}%" arriba del barco.
  - Banda inferior 4 KPIs: Progreso · Días restantes · Velocidad · Próximo hito.
- `TrackingTimeline.tsx` (server component):
  - Card.
  - Eyebrow wine "EVENTOS DEL EMBARQUE".
  - Lista vertical de steps: cada step es `{status, state}` con
    `state ∈ {done, active, pending}`. Línea vertical conecta steps.
  - Step done: bullet wine con check ✓.
  - Step active: bullet wine con número + animación pop.
  - Step pending: bullet hueco con número.
- `TrackingDetailActions.tsx` (server component):
  - Botones "Ver cliente" (→ `/clientes` filtrado por markbox)
    y "Ver detalle completo" (→ `/tracking/{id}`).
- `TrackingEmptyOps.tsx`:
  - Empty state cuando no hay embarques activos.
  - Eyebrow "Operación" + "Sin envíos en curso." + CTA "+ ENVÍO".

#### Page
- `app/studio/(app)/tracking/page.tsx` (refactor completo):
  - Server component lee active shipments + el seleccionado desde
    `?id=...` (o el primero si no se pasa).
  - Layout grid `320px 1fr` desktop, stack mobile.
  - Columna izq: `<ActiveShipmentList />`.
  - Columna der: `<TrackingDetailActions />` + `<TrackingMap />`
    + `<TrackingTimeline />`.
  - Si lista vacía: `<TrackingEmptyOps />` ocupa todo el ancho.
  - Header eyebrow "Operación · en vivo" + h1 "Tracking en vivo" + sub
    "Posición estimada por status operativo. ETA real cuando exista
    AIS." + actions (Actualizar `<button form ...>` no-op por ahora,
    "Reporte diario" disabled con tooltip "próximamente").
  - El detalle individual `/tracking/[id]` y `/tracking/nuevo` se
    mantienen intactos (siguen siendo la vista de edición + create).

### NO incluye (diferidos)

- **Mapa real con geo-coordenadas** (Leaflet, MapLibre, Mapbox).
  Requiere AIS feed real, costo en runtime, y diseño de UX para zoom
  y trayectorias. SDD futuro cuando tengamos integración con un AIS.
- **ETA real desde AIS**. Hoy es heurística (`100 - progress`).
- **Auto-refresh** cada 15 min como dice el copy del diseño. El page
  load actualiza. Refresh manual con el botón "Actualizar" (no-op por
  ahora — pendiente router.refresh()).
- **Reporte diario** (botón visible pero disabled).
- **Velocidad real** (banda inferior muestra "17.4 kn" fijo como
  placeholder).
- **Reordenar la lista** (drag, pin favoritos). V1 = orden por
  created_at DESC.
- **Filtros avanzados** en la lista (servicio, alertas). V1 = solo
  search por texto.
- **Vista alternativa Kanban** (out of scope, va con SDD futuro).

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0013-tracking-operativo/
└── spec.md                                              ← este

lib/studio/
└── tracking-progress.ts                                 ← helpers de progreso

app/studio/(app)/tracking/_components/
├── ActiveShipmentList.tsx                               ← sidebar 320px
├── TrackingMap.tsx                                      ← SVG estilizado
├── TrackingTimeline.tsx                                 ← timeline operativa
├── TrackingDetailActions.tsx                            ← botones de acción
└── TrackingEmptyOps.tsx                                 ← empty state
```

### Editados

```
lib/studio/shipment-queries.ts                          ← + listActiveShipments
app/studio/(app)/tracking/page.tsx                      ← refactor completo
docs/design/v1-studio/module-map.md                     ← marcar Tracking ✅
```

### Eliminados

```
app/studio/(app)/tracking/_components/TrackingFilters.tsx   ← ya no se usa (lo absorbe Embarques)
```

> **Nota**: `ServiceBadge` y `StatusBadge` se mantienen — los reusa el
> sidebar y la timeline.

---

## 4. Decisiones de diseño

### 4.1 Mapa SVG estilizado, no library externa

**Por qué:** el diseño de referencia (`tracking.jsx`) usa SVG con
continentes simplificados a mano. No hay AIS real conectado. Una library
de mapas (Leaflet ~40KB + tiles + UX de zoom) es overkill para mostrar
un barco en una ruta CN→VE conocida.

Cuando exista integración AIS real (SDD futuro), se reemplaza el SVG
por un componente de mapa real. La interface (`<TrackingMap shipment=
{ship} />`) se mantiene.

### 4.2 Progress se calcula desde el status

**Por qué:** la tabla `shipments` no tiene columna `progress`. Agregar
una sería redundante (deriva del status). Mapeo determinístico:

| Status | Progress |
|---|---:|
| draft | 0% |
| in_warehouse | 10% |
| consolidating | 20% |
| shipped | 35% |
| in_transit | 55% |
| in_customs | 75% |
| arrived_destination | 85% |
| delayed_warehouse | 85% (mismo, con badge warning) |
| out_for_delivery | 95% |
| last_mile | 98% |
| delivered | 100% |
| exception | progress del status previo (no se almacena, se asume 50%) |
| cancelled | n/a — no aparece en activos |

Si en SDD futuro se necesita progreso más fino (por horas, por hitos),
agregamos columna `progress_override` opcional.

### 4.3 ETA = `arrived_destination_at` cuando entregó, sino heurístico

**Por qué:** no hay AIS ni cálculo real de ETA. Sí hay
`arrived_destination_at` (cuando un envío llega a destino se setea con
la action existente). Para envíos en curso, mostramos "~ X días" como
heurístico basado en `(100 - progress) * 0.3` (similar al diseño).

UX: el número va con tilde "≈" o "~" para indicar que no es exacto.

### 4.4 Sidebar es client component, page es server

**Por qué:** la sidebar tiene 2 cosas client: la búsqueda local
(useState) y el cambio de URL al click (useRouter). El resto del page
es server (lee Supabase, RLS). La sidebar recibe el array de shipments
ya filtrado por el server.

### 4.5 La selección se persiste en URL (`?id=...`)

**Por qué:** permite share del link, navegación back/forward, y refresh
sin perder el embarque que estabas viendo. Si `?id` apunta a un
shipment no activo (entregado/cancelado), fallback al primero de la
lista activa.

### 4.6 Listado actual desaparece, no se mueve

**Por qué:** Embarques (SDD-0012) ya cubre el listado comercial. El
Tracking previo era un listado plano de filas — esa función está
duplicada. La nueva pantalla es solo vista operativa.

Quien necesite "ver todos los envíos" usa `/embarques` (agrupado por
cliente). Quien necesite "ver UN envío específico" usa
`/tracking/[id]` (vista de edición completa que se mantiene).

### 4.7 Estilo: SVG con tokens, sin hex

**Por qué:** las regla de marca prohíbe hex literales fuera de
tokens.css. El SVG usa `var(--wine)`, `var(--ink)`, `var(--border)`,
etc. directamente en los atributos `fill`, `stroke`. Funciona en
runtime (CSS vars resuelven en SVG inline).

Para el barco animado uso SMIL `<animate>` nativo (sin librerías).

### 4.8 Timeline reusa el STATUS_FLOW del progress

**Por qué:** el orden de status en la timeline es el mismo que el
orden del progress. Definirlo dos veces sería duplicación. La timeline
muestra los steps en orden, marcando done para `index < currentIndex`,
active para el actual, pending para los posteriores.

Si el shipment está en exception → se muestra un step "Excepción
activa" entre el último done y el siguiente pending, con bullet rojo.

---

## 5. Criterios de aceptación

### Funcional
- [ ] `/studio/tracking` muestra sidebar de activos + map + timeline
      del seleccionado
- [ ] Sin embarques activos → empty state con CTA "+ ENVÍO"
- [ ] Click en una card de sidebar → cambia `?id=...` y se actualiza
      el detalle de la derecha
- [ ] Search en sidebar filtra por code / client / origen / destino
- [ ] Mapa muestra origen + destino + ruta + barco posicionado por
      progress correcto
- [ ] Timeline muestra steps done/active/pending coherente con status
- [ ] Banda inferior del mapa muestra Progreso / Días restantes /
      Velocidad / Próximo hito
- [ ] "Ver cliente" navega a `/clientes?markbox=...` (o `/clientes`
      sin filtro si no hay markbox)
- [ ] "Ver detalle completo" navega a `/tracking/[id]`
- [ ] `/tracking/[id]` y `/tracking/nuevo` siguen funcionando intactos

### Sistema
- [ ] `pnpm typecheck` pasa
- [ ] Cero hex literales nuevos fuera de tokens
- [ ] Light + dark themes funcionan en el mapa
- [ ] Sidebar marca "Tracking" como active
- [ ] La banda de KPIs y el mapa se ven bien en viewport <1100px
      (stack vertical en móvil)
- [ ] No hay JSX en imports rotos por el delete de TrackingFilters

---

## 6. Out of scope / open questions

- **¿Integración AIS real (Marine Traffic API, etc.)?** Out V1. Mapa
  estilizado es suficiente para reflejar avance operativo desde el
  status. SDD futuro cuando haya budget de data feed.
- **¿Auto-refresh cada N segundos?** Out V1. Botón manual + page
  reload con router.refresh() futuro.
- **¿Mostrar múltiples embarques simultáneos en el mapa?** Out V1. El
  mapa muestra el seleccionado. Una vista "todos los activos sobre
  un mapa" es interesante pero requiere otro layout.
- **¿Velocidad real?** Out V1. Placeholder "17.4 kn" en el KPI band.
- **¿"Reporte diario" como acción real?** Out V1 (botón visible
  disabled). Pendiente para cuando exista el módulo Reportes.
- **¿Filtros en sidebar (servicio / alertas)?** Out V1. Search por
  texto es suficiente para el volumen actual (~10-50 activos típico).
