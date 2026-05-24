---
sdd: "0015"
title: "DoorTuDoor — Calendario operativo (vista mes + feriados CN/VE)"
status: approved
author: "founder"
created: 2026-05-24
updated: 2026-05-24
supersedes: null
superseded_by: null
related: ["0013"]
---

# DTD-0015 — Calendario operativo

> **Planificador de feriados.** Calendario vista mes con feriados CN
> (Año Nuevo Chino, Golden Week, etc.) + feriados VE pintados sobre el
> grid. Sidebar con próximos feriados + warning permanente de CN.
> El valor V1 es planificar zarpes con anticipación cuando paran las
> fábricas chinas — no es un agendamiento general.

---

## 1. Resumen en una línea

`/studio/calendario` muestra un grid 7×N del mes actual con feriados
CN + VE pintados, navegación mes anterior/siguiente/hoy, y sidebar con
próximos feriados + warning CN crítico.

---

## 2. Scope

### Incluye

#### Lib
- `lib/studio/calendar-data.ts`:
  - `CN_HOLIDAYS_2026: Holiday[]` — 7 feriados (Año Nuevo, CNY 春节,
    Qingming, Día Trabajador, Dragon Boat, Mid-Autumn, Golden Week)
  - `VE_HOLIDAYS_2026: Holiday[]` — 7 feriados (Año Nuevo, Semana
    Santa, Declaración Independencia, Día Trabajador, Independencia,
    Natalicio Bolívar, Navidad)
  - Tipo `Holiday`: `{ id, country: "CN"|"VE", startDate, endDate, name, shortName, critical? }`
- `lib/studio/calendar-helpers.ts`:
  - `buildMonthGrid(year, month)` — devuelve `Date[]` con offsets en
    blanco al inicio + fin para completar la grilla 7×N
  - `parseMonthParam(raw)` — convierte `"2026-05"` a `{year, month}`,
    fallback a mes actual si inválido
  - `holidaysForDate(date, all)` — devuelve `Holiday[]` que incluyen
    esa fecha (rangos contemplados)
  - `upcomingHolidays(today, all, limit)` — top N por fecha futura
  - `formatMonthLabel(year, month)` — `"mayo 2026"` (capitalizado)

#### Componentes (todos en `app/studio/(app)/calendario/_components/`)
- `CalendarHeader.tsx` (client):
  - Botón `<` mes anterior · label mes + año · botón "HOY" · botón `>`
    siguiente
  - View switch (Mes / Semana / Agenda) — solo "Mes" activo. Semana
    y Agenda con `disabled` + tooltip "próximamente".
  - Navegación cambia `?month=YYYY-MM` via `router.replace`
- `MonthGrid.tsx` (server):
  - Grid 7 columnas, header LUN/MAR/MIÉ/JUE/VIE/SÁB/DOM
  - Cada celda: número del día (círculo wine si es hoy), feriado label
    en esquina sup. derecha si aplica
  - Fondo tinted: rojo wine-light para feriados CN (más opaco si critical),
    verde success-light para feriados VE, gris ultra-light para weekends
  - Celdas de offset (días del mes anterior/siguiente) en fondo elevated
- `UpcomingHolidaysCard.tsx` (server):
  - Eyebrow wine "PRÓXIMOS FERIADOS"
  - Lista compact de los próximos N=8 feriados desde hoy
  - Cada item: badge CN/VE · short name · fecha corta `dd may`
- `CNHolidayWarning.tsx` (server):
  - Card permanente con tono warning
  - Texto: "Atención feriados CN — Año Nuevo Chino (16-24 feb) y
    Golden Week (1-7 oct) paralizan Yiwu y Shenzhen. Planificá zarpes
    con 3 semanas de anticipación."
- `CalendarLegend.tsx` (server):
  - Chips de leyenda al final del grid: "Feriado CN" + "Feriado VE" +
    "Hoy"

#### Page
- `app/studio/(app)/calendario/page.tsx` (refactor del placeholder):
  - Server component lee `?month` → calcula year/month
  - Header (`<CalendarHeader>`) con month/year actual
  - Grid 2 col: izq = `<MonthGrid>` + `<CalendarLegend>`, der = `<UpcomingHolidaysCard>` + `<CNHolidayWarning>`
  - En viewport <1100px stack vertical (sidebar abajo del grid)

### NO incluye (diferidos)

- **Vista Semana** — placeholder en el switch, disabled. SDD futuro.
- **Vista Agenda** — placeholder, disabled. SDD futuro.
- **Drawer de día con detalle de eventos** — V1 sin click en celda.
- **Eventos de shipments (ETD / ETA / POD)** — requiere columnas
  `etd`, `eta` en `shipments` que NO existen. SDD futuro cuando se
  agreguen (o cuando exista AIS real).
- **Filtros** (puerto destino, tipo evento) — V1 sin filtros, mostramos
  todo.
- **Holiday impact analysis** (lista de shipments afectados por feriado)
  — diferido junto con eventos de shipments.
- **Eventos custom del operador** (agregar / editar manualmente) —
  requiere tabla BD + RLS + form CRUD. SDD futuro.
- **Exportar ICS** — out V1.
- **Año diferente a 2026** — los seeds son hardcoded 2026. Para 2027
  cuando arranque el próximo año, se agregan los seeds (otro SDD o
  PR pequeño).
- **Feriados internacionales o de otros países** — out V1.

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0015-calendario-operativo/
└── spec.md                                              ← este

lib/studio/
├── calendar-data.ts                                     ← const feriados
└── calendar-helpers.ts                                  ← date helpers

app/studio/(app)/calendario/_components/
├── CalendarHeader.tsx                                   ← client nav
├── MonthGrid.tsx                                        ← grid 7×N
├── UpcomingHolidaysCard.tsx                             ← sidebar lista
├── CNHolidayWarning.tsx                                 ← warning card
└── CalendarLegend.tsx                                   ← chips leyenda
```

### Editados

```
app/studio/(app)/calendario/page.tsx                    ← refactor del placeholder
app/studio/studio.css                                   ← + .studio-calendar-grid layout
docs/design/v1-studio/module-map.md                     ← marcar Calendario ✅
```

---

## 4. Decisiones de diseño

### 4.1 Feriados como `const`, no BD

**Por qué:** los feriados oficiales son fijos por año y no son
tenant-specific. Para V1, una lista en TypeScript es:
- Cero setup (no migración, no RLS, no seed script)
- Importable desde server components sin query
- Tipados directo desde el array

Cuando se necesite UI de "agregar feriado custom" o "marcar día como
no operativo solo para mi tenant", se migra a tabla `calendar_events`
con RLS por tenant. Mientras tanto, hardcode es honest design.

### 4.2 Año 2026 hardcoded

**Por qué:** dijimos V1, no system. Los feriados 2026 son los que
necesita Sam **ahora**. Para 2027, se agregan a `calendar-data.ts` en
un PR de 15 minutos. No es complicación que valga la pena resolver hoy.

Si el usuario navega a un mes 2027 sin seeds, el grid sale vacío pero
funciona (sin error). Aceptable V1.

### 4.3 Estado en URL `?month=YYYY-MM`

**Por qué:** linkable, refresh-safe, back/forward funcionan. Sin
`?month` → mes actual (`new Date()`).

### 4.4 Solo vista Mes funciona V1

**Por qué:** Mes cubre el 80% del valor (planificar zarpes anticipados,
ver feriados de los próximos 4-6 semanas de un vistazo). Semana y
Agenda son nice-to-have y cada uno requiere su propio render layout +
testing. Mejor cerrar Mes bien que tener 3 vistas mediocres.

El switch se muestra con las 3 opciones pero las 2 inactivas tienen
`disabled` + tooltip "próximamente". Esto comunica al usuario que la
funcionalidad existirá sin engañarlo.

### 4.5 Feriados CN críticos = más opacos

**Por qué:** CNY y Golden Week paralizan operación entera. Los otros
feriados CN (Qingming, Dragon Boat) reducen pero no detienen.

Visual: `rgba(wine, 0.14)` para crítico, `rgba(wine, 0.07)` para
no-crítico. Coherente con el diseño de referencia.

### 4.6 Warning CN permanente en sidebar

**Por qué:** los 2 feriados críticos (CNY + Golden Week) requieren
3 semanas de planificación. Aunque el operador ya los vea en el grid,
tener un recordatorio permanente con la regla de las 3 semanas evita
sorpresas. Es información estratégica, no decorativa.

### 4.7 Lunes como primer día (es-VE)

**Por qué:** convención europea/sudamericana. ISO 8601. El operador
piensa en "semana laboral lunes-viernes".

Implementación: `(date.getDay() + 6) % 7` para que el lunes sea 0.

---

## 5. Criterios de aceptación

### Funcional
- [ ] `/studio/calendario` muestra grid del mes actual con feriados
      pintados
- [ ] Hoy (24-may-2026) está marcado con círculo wine en su celda
- [ ] CNY (16-24 feb) y Golden Week (1-7 oct) tienen tinte CN más
      opaco que otros feriados CN
- [ ] Feriados VE pintados en tinte verde-tinted
- [ ] Botones `<` `HOY` `>` navegan via `?month=YYYY-MM`
- [ ] "HOY" vuelve al mes actual real (no a 2026-05 hardcoded)
- [ ] View switch muestra Mes activo + Semana/Agenda disabled
- [ ] Sidebar muestra próximos 8 feriados desde hoy (cualquier país)
- [ ] Sidebar muestra warning permanente CN con regla 3 semanas
- [ ] Legend al final del grid con CN/VE/Hoy

### Sistema
- [ ] `pnpm typecheck` pasa
- [ ] Cero hex literales nuevos fuera de tokens (rgba con CSS vars OK
      donde necesario)
- [ ] Light + dark themes funcionan
- [ ] Sidebar marca "Calendario" como active
- [ ] Layout 1fr 320px desktop, stack mobile <1100px

---

## 6. Out of scope / open questions

- **¿Tabla `calendar_events` con eventos custom?** Out V1. Migrar
  cuando sea evidente que el operador necesita más allá de feriados
  oficiales.
- **¿Sincronizar con Google Calendar / Outlook?** Out V1. Requiere
  OAuth + sync logic.
- **¿Notificaciones push antes de un feriado crítico?** Out V1. Va
  con el módulo Notifications futuro.
- **¿Vista año (overview 12 meses)?** Out V1. Quizás cuando exista
  más data que solo feriados.
- **¿Eventos recurrentes (ej: cierre fin de mes, pago de salarios)?**
  Out V1. Cuando exista CRUD.
