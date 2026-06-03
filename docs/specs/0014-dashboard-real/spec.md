---
sdd: "0014"
title: "DoorTuDoor — Dashboard real (KPIs operativos + comerciales)"
status: done
author: "founder"
created: 2026-05-24
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0005", "0008", "0010", "0011"]
confidencialidad: interno
---

# DTD-0014 — Dashboard real

> **KPIs en vivo del Studio.** Reemplaza el dashboard placeholder con
> métricas reales de los 4 módulos comerciales del Sprint 1 + los
> operativos del Tracking. Sin charts (diferidos), solo números grandes
> con jerarquía visual.

---

## 1. Resumen en una línea

Dashboard con 8 KPIs (4 operativos + 4 comerciales del mes), card de
operación activa y card de cotizaciones recientes. Todo server-fetched
sin auto-refresh ni charts.

---

## 2. Scope

### Incluye

#### Lib
- `lib/studio/dashboard-queries.ts`:
  - `getOperationalCounts(supabase)` — counts shipments por categoría
    (en tránsito, en aduana, entregados, con alerta)
  - `getClientCount(supabase)` — total clients activos (no soft-deleted)
  - `getActiveRateCount(supabase)` — count rates con `valid_until >= today`
  - `getQuoteStatsThisMonth(supabase)` —
    `{ countSent, countAccepted, totalSentAndAccepted }` para quotes
    `created_at >= primer_día_mes_actual` con status en (sent, accepted)
  - `getRecentQuotes(supabase, limit=5)` — top N por `created_at DESC`

#### Componentes
- `app/studio/_components/ui/KpiCard.tsx`:
  - Value grande (Archivo Black 30px) con color condicional
  - Label uppercase tracked debajo
  - Sub opcional (línea más chica con detalle)
  - Border-top wine-soft 2px cuando value > 0 (matchea actual)
  - Reusa tokens del sistema
- `app/studio/(app)/dashboard/_components/RecentQuotesCard.tsx`:
  - Card con header "Cotizaciones recientes" + count
  - Lista compacta: code (mono) · cliente · status badge · total $
  - Click row → `/cotizador/[code]`
  - Empty state si no hay quotes

#### Page
- `app/studio/(app)/dashboard/page.tsx`:
  - Header con eyebrow + h1 "Hola, DoorTuDoor."
  - Subtítulo con tenant + currency (igual que actual)
  - **Sección 1 (Operativo):**
    - Eyebrow "Operativo"
    - Grid 4 KPIs: En tránsito · En aduana · Entregados · Con alerta
  - **Sección 2 (Comercial · este mes):**
    - Eyebrow "Comercial · este mes"
    - Grid 4 KPIs: Clientes · Cotizaciones del mes · Total cotizado $ · Tarifas vigentes
    - El KPI "Total cotizado" muestra sub-line: "X enviadas · Y aceptadas ($Z)"
  - **Grid inferior 2 cols:**
    - Card "Operación activa" (igual que actual, ahora con tokens)
    - Card "Cotizaciones recientes" (top 5)
  - Empty states si counts son 0

### NO incluye (diferidos)

- **Gráficos / charts** — requieren library (recharts, victory, etc.).
  SDD futuro si se necesitan.
- **Filtros de período** (últimos 7d / 30d / mes / trimestre) — asume
  "mes calendario actual" fijo.
- **Auto-refresh** — data del momento del page load.
- **Personalización del operador** (editor de widgets, drag-drop) — el
  handoff lo tiene en el dashboard.jsx pero es trabajo aparte (SDD futuro).
- **KPI "Margen / ganancia"** — requiere Costing (SDD-0022).
- **Comparativa vs mes anterior** — sin trend arrows V1.
- **Drill-down** desde KPIs a listas filtradas — los cards no son
  clickables todavía (excepto "Operación activa" y "Cotizaciones
  recientes" que sí).

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0014-dashboard-real/
└── spec.md                                              ← este

lib/studio/
└── dashboard-queries.ts                                 ← agregaciones

app/studio/_components/ui/
└── KpiCard.tsx                                          ← primitive reusable

app/studio/(app)/dashboard/_components/
└── RecentQuotesCard.tsx                                 ← lista compact
```

### Editados

```
app/studio/(app)/dashboard/page.tsx                      ← refactor completo
docs/design/v1-studio/module-map.md                      ← marcar Dashboard ✅
```

---

## 4. Decisiones de diseño

### 4.1 "Total cotizado este mes" = sent + accepted

**Por qué:** filtra drafts (experimentos del operador) y rejected
(no facturable). Captura el pipeline real comprometido con el cliente.

**Sub-line:** desglose "X enviadas · Y aceptadas ($Z)" para ver ambas
métricas sin saturar la fila.

### 4.2 "Este mes" = mes calendario actual

Desde el primer día del mes en curso (`date_trunc('month', now())`)
hasta ahora. NO "últimos 30 días rolling" — el mes calendario es más
intuitivo para reporting comercial.

### 4.3 Sin charts/gráficos

Charts requieren library aparte (~30KB JS) y diseño cuidadoso. Los
números grandes con buen typography hierarchy comunican el 80% del
valor con 20% del trabajo. SDD futuro si Sam pide.

### 4.4 Sub-line opcional en KpiCard

El primitive acepta `sub?: string` o `subline?: ReactNode` para casos
como el split de "Total cotizado". Default sin sub (los operativos no
necesitan).

### 4.5 Border-top wine-soft = "hay actividad"

Convención visual del dashboard actual: si `value > 0`, border-top
2px wine-soft. Si value = 0, border-top normal 1px border. Mantiene
la convención y refuerza qué KPIs necesitan atención.

### 4.6 Card "Cotizaciones recientes" en grid 2 cols con "Operación activa"

El layout inferior queda:
- Col izq: Card "Operación activa" con count total + CTA "VER TRACKING →"
- Col der: Card "Cotizaciones recientes" con top 5

Si el viewport es chico (<900px), stack vertical. Si grande, lado a
lado en proporción.

---

## 5. Criterios de aceptación

### Funcional
- [ ] `/studio/dashboard` muestra los 8 KPIs con valores correctos
- [ ] KPI "Clientes" coincide con `select count(*) from clients where deleted_at is null`
- [ ] KPI "Tarifas vigentes" coincide con `count where valid_until >= today and deleted_at is null`
- [ ] KPI "Total cotizado mes" suma `total_usd` de quotes (sent + accepted)
      con `created_at >= primer_día_mes`
- [ ] Sub-line muestra "X enviadas · Y aceptadas ($Z)" correcto
- [ ] Card "Cotizaciones recientes" muestra top 5 ordenados por created_at DESC
- [ ] Click en row de quote navega a `/studio/cotizador/[code]`
- [ ] Card "Operación activa" mantiene funcionalidad actual

### Sistema
- [ ] `pnpm typecheck` pasa
- [ ] Cero hex literales nuevos
- [ ] Light + dark themes funcionan
- [ ] Sidebar marca "Dashboard" como active
- [ ] Performance: ≤ 6 queries totales (las queries en paralelo)

---

## 6. Out of scope / open questions

- **¿Modos comparativos** (este mes vs anterior, week-over-week)? No
  V1. Si se pide, agregamos columna sub con delta.
- **¿KPI por usuario** (cuánto cotizó cada operador)? No V1. Cuando
  exista RBAC + filtros, agregamos.
- **¿Notificaciones en dashboard** (quotes vencidas, alertas operativas)?
  No. La banda de alertas vendrá cuando exista el módulo Notifications.
