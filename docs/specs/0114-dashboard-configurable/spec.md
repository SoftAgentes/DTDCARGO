---
sdd: "0114"
title: "Dashboard configurable + persistencia de preferencias por usuario"
status: draft
author: "Claude Code (redactor · ventana secundaria) + founder"
created: 2026-06-26
updated: 2026-06-26
supersedes: null
superseded_by: null
related: ["0014", "0020", "0047", "0052", "0085", "0103", "0104", "0105"]
confidencialidad: interno
---

# SDD-0114 · Dashboard configurable + persistencia de preferencias por usuario

> **Hueco del audit v4.5.** El dashboard en producción
> (`app/studio/(app)/dashboard/page.tsx`) tiene un **layout fijo hardcodeado**:
> 4 secciones de KPIs en orden inamovible (Operativo · Naviera · Comercial ·
> Inteligencia) + un grid inferior de 3 cards. El **Norte v4.5**
> (`docs/design/studio/_norte/erp/modules/dashboard.jsx`) ya diseñó un dashboard
> **configurable** alrededor de `useDashboardConfig` + `DashboardEditorDrawer`:
> catálogo de ~18 KPIs y 8 widgets, editor con drag-to-reorder, selector de
> período del gráfico, y reset a defaults. Esta spec lleva ese diseño a producción
> y agrega lo que el Norte no resuelve: **dónde persisten las preferencias** (hoy
> el Norte usa `localStorage`, que no viaja entre dispositivos) y el **wiring de
> los KPIs financieros / nómina** que el dashboard de prod todavía no expone.

## 0. Por qué — y qué NO es

**Objetivo:** que cada usuario del Studio arme su propio dashboard (qué KPIs ve,
en qué orden, qué widgets, con qué período) y que esa configuración **persista por
usuario en la base de datos** (RLS por tenant), no solo en el navegador. De paso,
**exponer los KPIs financieros y de nómina** que ya tienen queries en
`lib/studio/` pero que el dashboard de prod nunca llegó a mostrar.

**Lo que SÍ entra:**
- Persistencia de la config del dashboard **por usuario** (no por tenant global).
- Catálogo de KPIs y widgets como **fuente de verdad en código** (no en DB).
- Editor en drawer: activar/desactivar KPIs, reordenar (drag), activar/desactivar
  widgets por columna, elegir período del gráfico, reset a defaults.
- Wiring de los KPIs que hoy NO se exponen pero ya tienen query
  (`monthRevenue`, `invoicesDue`, `marginYTD`, `pendingCollect`, nómina).

**Lo que NO entra (fuera de alcance, diferido):**
- ❌ Dashboards **compartidos por rol** o plantillas que el admin empuja a su
  equipo (eso es una Fase 4 si el founder lo pide).
- ❌ Constructor de KPIs **ad-hoc** desde la UI (eso ya existe parcial en
  Reportes · SDD-0052; el dashboard solo consume KPIs del catálogo predefinido).
- ❌ Widgets **drag-and-drop entre columnas** con grid libre (el Norte fija
  `side: 'left' | 'right'` por widget; lo respetamos).
- ❌ "Hide values" / modo privacidad global (el Norte lo tiene como `useHideValues`;
  se puede traer pero es opcional — ver Decisión D-6).
- ❌ Tocar el RBAC por módulo (SDD-0085): el dashboard **respeta** los módulos a
  los que el usuario tiene acceso (un KPI de Nómina no se ofrece si el usuario no
  ve Nómina), pero no redefine permisos.

## 1. Estado actual (lo que hay en prod)

`app/studio/(app)/dashboard/page.tsx` es un **server component** que:

1. Fetcha en paralelo: `getOperationalCounts`, `getClientCount`,
   `getActiveRateCount`, `getQuoteStatsThisMonth`, `getRecentQuotes`,
   `getRecentActivity`, `computeAgentKpis`, `navieraKpis`.
2. Renderiza un layout **fijo**: secciones Operativo (4 KPIs) · Naviera (4) ·
   Comercial (4) · grid inferior (3 cards) · Inteligencia (1 card).
3. Cero personalización. Todos los usuarios del tenant ven exactamente lo mismo.

**Queries que YA existen pero el dashboard NO consume** (huecos a cablear):
- `lib/studio/invoice-queries.ts` → ingresos del mes, facturas vencidas, por cobrar.
- `lib/studio/costing/` → margen sobre embarques (YTD).
- `lib/studio/nomina/` → neto del corte, saldo de préstamos, ausencias, empleados.
- `lib/studio/fiscal/`, `lib/studio/conciliacion` (SDD-0104/0105) → KPIs fiscales
  candidatos (ver catálogo, marcados como opcionales).

## 2. Alcance funcional

### 2.1 Catálogo de KPIs (fuente de verdad en código)

Igual al Norte: un array `KPI_CATALOG` en `lib/studio/dashboard/dashboard-catalog.ts`.
Cada entrada: `{ id, label, icon, tone, cat, module }`. El campo `module` es nuevo
respecto al Norte y sirve para **filtrar por RBAC** (SDD-0085): si el usuario no
tiene acceso al módulo, el KPI no se ofrece en el editor.

Categorías y KPIs (heredados del Norte, ~18):

| Cat | KPIs | Query / fuente | Estado |
|---|---|---|---|
| **Operación** | `shipmentsActive`, `onTime`, `cbmInTransit`, `avgTransit`, `openIncidents`, `cnStock` | `getOperationalCounts`, `navieraKpis` | parcial (faltan onTime/avgTransit reales) |
| **Finanzas** | `monthRevenue`, `invoicesDue`, `marginYTD`, `pendingCollect` | `invoice-queries`, `costing/` | **a cablear** |
| **Comercial** | `newLeads`, `wonEstimados`, `activeClients`, `avgTicket` | `getQuoteStatsThisMonth`, `getClientCount`, Kommo | parcial |
| **Nómina** | `nominaNeto`, `nominaPrestamos`, `nominaAusencias`, `nominaEmpleados` | `nomina/` queries | **a cablear** |

> Los KPIs sin query real todavía (`onTime`, `avgTransit`) se marcan
> `status: 'wip'` en el catálogo y muestran `—` hasta que exista la query — el
> dashboard no se bloquea por eso.

### 2.2 Catálogo de widgets

Array `WIDGET_CATALOG` (heredado del Norte): `{ id, label, side, desc }`. 8 widgets:
`chart`, `activeShipments` (left) · `alerts`, `recentActivity`, `quickActions`,
`tmsStatus`, `upcomingEta`, `nominaResumen` (right). El `side` es fijo por widget.

### 2.3 Config por defecto

```ts
const DEFAULT_CONFIG = {
  kpis: ['shipmentsActive', 'onTime', 'monthRevenue', 'newLeads', 'invoicesDue', 'cbmInTransit'],
  widgets: ['chart', 'activeShipments', 'alerts', 'recentActivity', 'quickActions'],
  chartPeriod: '1A', // '1M' | '3M' | '1A' | 'YTD'
};
```

> ⚠️ El default del Norte incluye `nominaResumen` en widgets. En prod el default
> **no** debe incluir KPIs/widgets de módulos que el usuario no ve (RBAC). El
> default efectivo se **filtra** contra el catálogo accesible antes de renderizar.

### 2.4 Editor (drawer)

Reusa `DrawerShell` (no el `<U.Drawer>` del Norte). Dos tabs: **KPIs** y **Widgets**.
- Tab KPIs: lista "en el dashboard" (drag-to-reorder + quitar) + "disponibles"
  agrupados por categoría (agregar). El drag es client-side; al soltar se persiste.
- Tab Widgets: switches por columna (principal 2/3 · lateral 1/3).
- Footer: **Restaurar defaults** (ghost, confirm inline) + **Listo** (primary).
- Selector de período vive en el `ChartWidget`, no en el editor (igual al Norte).

### 2.5 Persistencia

El cambio clave respecto al Norte: la config persiste **en la base de datos por
usuario**, no en `localStorage`. Razones: el operador de DTD trabaja desde varios
dispositivos (PC de oficina + laptop + a veces tablet), y queremos que su dashboard
lo siga. `localStorage` se mantiene **solo como cache optimista** (escritura
inmediata + sync diferido a DB vía server action).

## 3. Modelo de datos propuesto

### Opción elegida (a confirmar founder · D-1): tabla dedicada `user_dashboard_prefs`

Una fila por (usuario, tenant). La config va en una columna `jsonb` validada en la
server action (NO en la DB con CHECK pesado — seguimos la convención del Studio:
validar en la action con `validate*Input` propio, defender lo mínimo en DB).

```sql
-- migración NNNN (la asigna el Director)
create table public.user_dashboard_prefs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

alter table public.user_dashboard_prefs enable row level security;
```

**RLS por tenant + dueño:** el usuario solo lee/escribe SU fila dentro de SU tenant.
Política basada en `user_tenants` (patrón del Studio: admin client + filtro por
`tenant_id`, no `maybeSingle` ingenuo — ver memoria `rls-policies-maybesingle-anti-pattern`).

```sql
create policy user_dashboard_prefs_owner on public.user_dashboard_prefs
  for all
  using (
    user_id = auth.uid()
    and tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );
```

> Esta tabla NO es polimórfica → no requiere helper `*_in_tenant()` ni trigger
> same-tenant. La defensa-en-DB se reduce al `unique(tenant_id, user_id)` + RLS por
> dueño. (El patrón polimórfico de SDD-0045/0102 aplica a tablas que referencian
> entidades de tipos distintos; acá no es el caso.)

### Forma del `config` jsonb (validada en la action, no en DB)

```ts
type DashboardConfig = {
  kpis: string[];        // ids del KPI_CATALOG, en orden de aparición
  widgets: string[];     // ids del WIDGET_CATALOG
  chartPeriod: '1M' | '3M' | '1A' | 'YTD';
};
```

`validateDashboardConfigInput()` (en `lib/studio/dashboard/dashboard-types.ts`):
- descarta ids que NO estén en el catálogo (defensa contra basura / catálogo viejo);
- descarta ids de módulos a los que el usuario no tiene acceso (RBAC);
- limita `kpis` a un máximo razonable (ej. 12) y `widgets` al universo válido;
- normaliza `chartPeriod` a uno de los 4 valores, default `'1A'`.

### Alternativa (D-1, opción B): columna jsonb en una tabla de prefs existente

Si más adelante hay un "sistema de preferencias del usuario" general (SDD-0037 lo
menciona como futuro: formato VE/US, idioma, etc.), el dashboard podría ser una
**clave** dentro de un `user_prefs.settings jsonb` en vez de tabla propia. Ver D-1.

## 4. Slices / fases

### Slice A — Persistencia + catálogo (sin UI nueva todavía)
1. Migración `user_dashboard_prefs` (o columna, según D-1) + RLS.
2. `lib/studio/dashboard/dashboard-catalog.ts` (KPI_CATALOG + WIDGET_CATALOG + DEFAULT_CONFIG).
3. `lib/studio/dashboard/dashboard-types.ts` (`DashboardConfig` + `validateDashboardConfigInput`).
4. `lib/studio/dashboard/dashboard-prefs-queries.ts` (`getDashboardConfig(supabase, userId)` puro).
5. `app/studio/(app)/dashboard/actions.ts` → `saveDashboardConfigAction` (upsert) +
   `resetDashboardConfigAction` (delete fila → vuelve a default).

### Slice B — Render configurable + editor
1. `page.tsx` lee `getDashboardConfig` y renderiza KPIs/widgets según la config
   (en vez del layout fijo). Filtra por RBAC (módulos accesibles).
2. `DashboardClient.tsx` (`"use client"`) orquesta el estado optimista
   (localStorage cache + `useActionState` para sync a DB).
3. `DashboardEditorDrawer.tsx` (drag-reorder de KPIs + switches de widgets + reset),
   sobre `DrawerShell`.
4. `ChartWidget` con selector de período (persiste `chartPeriod`).

### Slice C — Cablear los KPIs financieros / nómina que faltan
1. Conectar `monthRevenue`, `invoicesDue`, `pendingCollect` a `invoice-queries`.
2. Conectar `marginYTD` a `costing/`.
3. Conectar `nominaNeto`, `nominaPrestamos`, `nominaAusencias`, `nominaEmpleados`
   a `nomina/` queries.
4. KPIs sin query (`onTime`, `avgTransit`) quedan `wip` → muestran `—`.

### Slice D — (diferido, solo si el founder lo pide) dashboards por rol
Plantillas que el admin define y empuja como default a un rol. Fuera de esta spec.

## 5. Criterios de aceptación

- [ ] Un usuario activa/desactiva KPIs y widgets desde el editor; al recargar la
      página **en otro dispositivo** ve su misma config (persistió en DB, no solo LS).
- [ ] El drag-to-reorder de KPIs cambia el orden y persiste.
- [ ] "Restaurar defaults" borra la fila del usuario y vuelve al `DEFAULT_CONFIG`
      filtrado por RBAC.
- [ ] Un usuario SIN acceso al módulo Nómina **no ve** los KPIs/widget de Nómina ni
      en el dashboard ni en el editor (catálogo filtrado por RBAC).
- [ ] El selector de período del gráfico (`1M/3M/1A/YTD`) persiste.
- [ ] Los KPIs financieros (`monthRevenue`, `invoicesDue`, `pendingCollect`,
      `marginYTD`) muestran datos reales del tenant (RLS).
- [ ] Config corrupta / ids viejos en el jsonb → la action los descarta sin romper
      el render (degrada al default para esas claves).
- [ ] RLS verificada: el usuario A no puede leer ni escribir la fila del usuario B,
      ni siquiera dentro del mismo tenant.
- [ ] Solo tokens `var(--*)`; terminología "Shipping Mark" donde aplique; cero rgba
      inline; botones según el estándar de 8 reglas del Studio.
- [ ] UI/UX review del agente `ui-ux-designer` antes del commit.

## 6. Riesgos y notas

- **RBAC ↔ default:** el `DEFAULT_CONFIG` del Norte incluye widgets de módulos que
  un usuario podría no tener. Hay que filtrar el default contra los módulos
  accesibles **antes** de renderizar, o el usuario verá huecos.
- **Cache LS vs DB:** si el LS y la DB divergen (ej. el usuario editó en otro
  dispositivo), la DB gana al cargar; el LS se sobre-escribe con lo de la DB.
- **KPIs `wip`:** `onTime` y `avgTransit` no tienen query real. Mostrar `—` y no
  ofrecerlos como default evita expectativas falsas. (Candidatos a SDD propio.)
- **Performance:** el dashboard ya fetcha en paralelo; agregar 4-8 queries más
  (finanzas/nómina) debe seguir en `Promise.all`, y **solo** fetchear los KPIs que
  el usuario tiene activos (no todo el catálogo) para no pagar queries de más.

## Decisiones pendientes (founder)

- **D-1 · ¿Tabla dedicada o columna en prefs generales?** Propongo tabla
  `user_dashboard_prefs` (simple, aislada). Alternativa: meterlo como una clave de
  un futuro `user_prefs.settings jsonb` general (SDD-0037). ¿Arrancamos con tabla
  dedicada y migramos si algún día hay prefs generales, o ya armamos la tabla
  general de prefs?
- **D-2 · ¿La config es por-usuario o el admin puede fijar un default del tenant?**
  Esta spec asume **100% por usuario**. ¿Querés que el admin pueda definir el
  dashboard inicial que ve un empleado nuevo (plantilla del tenant) antes de que lo
  personalice? Eso es el Slice D y cambia el modelo (fila de tenant + fila de override).
- **D-3 · ¿Tope de KPIs visibles?** Propongo máximo 12 (3 filas de 4). ¿Te sirve ese
  techo o lo dejás libre?
- **D-4 · Período del gráfico — ¿"YTD" arranca en enero o en el inicio del año fiscal?**
  El Norte trata YTD como "últimos ~5 meses" (mock). En prod hay que definir el ancla
  real (año calendario vs período fiscal de SDD-0104).
- **D-5 · KPIs financieros sensibles en el dashboard.** `monthRevenue`, `marginYTD`,
  `pendingCollect` exponen plata. ¿Cualquier rol con acceso a Finanzas los ve, o
  querés un gate extra (solo admin/dirección)? Hoy lo amarro a RBAC del módulo
  Finanzas; decime si necesitás un nivel más fino.
- **D-6 · ¿Traemos el modo "ocultar valores" (`useHideValues`) del Norte?** Enmascara
  montos con `•••••` para mostrar la pantalla sin exponer cifras (útil en reuniones /
  pantalla compartida). Es opcional. ¿Lo incluimos en esta spec o lo dejamos para otra?
- **D-7 · KPIs `wip` (`onTime`, `avgTransit`).** No tienen query real. ¿Los dejamos
  visibles mostrando `—` (señal de "viene pronto"), los escondemos del catálogo hasta
  tener la query, o abrimos un SDD para calcularlos (necesita timestamps de hitos por
  embarque)?
- **D-8 · ¿Nómina en el dashboard general?** El neto del corte y ausencias son datos
  delicados de RRHH. ¿Van en el dashboard configurable (gated por RBAC Nómina) o
  preferís que vivan solo dentro del módulo Nómina?
