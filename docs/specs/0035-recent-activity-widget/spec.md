---
sdd: "0035"
title: "Dashboard · RecentActivity widget clickeable + CodesSync deferred"
status: done
author: "founder"
created: 2026-05-25
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0002", "0014"]
---

# DTD-0035 — RecentActivity widget en Dashboard

> **Último SDD del bundle Claude Design v1.6** (release v1.6 pulido).
> Card "Actividad reciente" en `/studio/dashboard` que muestra los
> últimos eventos del tenant (timeline de embarques + creaciones) con
> link directo al módulo correspondiente. Hover state + atajos
> intencionales.

---

## 1. Resumen en una línea

`/studio/dashboard` suma una card "Actividad reciente" como tercera
columna del grid inferior (debajo de KPIs comercial), con los últimos
6 eventos del `shipment_events` mapeados al embarque correspondiente
(`/studio/tracking/{id}`). Cada item es un `<Link>` con hover.

---

## 2. Scope

### Incluye

#### Query

- `lib/studio/dashboard-queries.ts`:
  - Función nueva `getRecentActivity(supabase, limit=6)`:
    - Lee últimos N `shipment_events` JOIN `shipments`
    - Devuelve shape `{ id, event_type, message, occurred_at, shipment_id, shipment_code, client_name }`

#### UI

- `dashboard/_components/RecentActivityCard.tsx`:
  - Client component (interactividad: hover + Link)
  - Lista de items con icono según `event_type` (created · departed · arrived · delivered · alert)
  - Cada item es `<Link href="/studio/tracking/{shipment_id}">` con hover state
  - Mostrar relative time ("hace 5 min", "hace 2h") con helper `fmtAgo`
  - Empty state cuando no hay eventos: "Sin actividad reciente. Los eventos de embarques van a aparecer acá."
- `dashboard/page.tsx`:
  - Fetch en paralelo del nuevo query
  - Reorganizar el grid inferior a 3 columnas: ActiveOperation + RecentQuotes + RecentActivity
  - **Fallback responsive**: <1200px → grid de 2 cols; <800px → 1 col

### Fuera de scope (deuda diferida con razón)

- **CodesSyncHeader persistente** del bundle (v1.6) · la sección "Master data → HS codes" en `/studio/admin` es un placeholder informativo (SDD-0030 futuro). No hay UI real de sync para wirear el `lastSync`. Cuando se implemente Master data, se agrega ahí con `localStorage` key `dtd_codes_lastsync_{source}` siguiendo el patrón del bundle.
- **Aggregator de múltiples fuentes**: V1 solo lee `shipment_events`. V2 puede mergear con `mail_logs`, `dispatch_orders`, `audit_log` ordenados por timestamp desc.

---

## 3. Mapeo evento → módulo

V1 todos los eventos van a `/studio/tracking/{shipment_id}` porque la
fuente es `shipment_events`. Cuando V2 expanda a múltiples fuentes:

| event_type / origen | Destino |
|---|---|
| `shipment_events.*` | `/studio/tracking/{id}` |
| `dispatch_orders` created | `/studio/despacho` |
| `mail_logs` queued/sent | `/studio/mailing` |
| `quotes.sent` | `/studio/cotizador/{code}` |
| `clients` created | `/studio/clientes/{markbox}` |

---

## 4. Decisiones

### D1 · Fuente única en V1, query simple

Solo `shipment_events`. Razón: es la tabla con más eventos por tenant
en operación real. Mergear N fuentes en server requiere UNION ALL +
sort por timestamp + dedup. Complica para V1 sin beneficio claro.

### D2 · CodesSync no se implementa hoy

El bundle pide `CodesSyncHeader` con `lastSync` persistente en
`/studio/admin`. Pero esa sección no existe como UI real (es
`PendingSectionPanel` placeholder). Wirearlo sin la sección
construida es deuda hueca. Cuando llegue SDD-0030 (Master data) se
agrega ahí.

### D3 · Card client component, no server

Necesita hover state + Links · sale más natural client. El parent
sigue fetcheando server-side.

---

## 5. Casos borde

| Caso | Comportamiento |
|---|---|
| Sin shipment_events en el tenant | Empty state con copy + CTA "Ver tracking" |
| Más de 6 eventos | Mostrar últimos 6 + link "Ver todo" abajo (V2 también) |
| Evento con shipment borrado (FK set null) | Skip · no muestra item huérfano |
| Reload manual | `revalidatePath('/studio/dashboard')` al volver |

---

## 6. Origen

- **Bundle:** `docs/design/studio/v1.6-claude-design/handoff/SDD-2026-05-25-sesion/`
- **Brief:** parte del release v1.6 (último ítem del bundle)
- **Source:** snippet en `source/nuevo/modules/dashboard.jsx` (RecentActivityWidget) + `erp/modules/admin.jsx` (CodesSyncHeader · deferred)
