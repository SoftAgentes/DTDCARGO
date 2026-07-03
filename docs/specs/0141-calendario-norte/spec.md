---
sdd: "0141"
title: "Calendario al Norte — vistas + eventos operativos de embarques"
status: in-progress
author: "Claude Code (ventana secundaria · worktree calendario-norte) + founder"
created: 2026-07-03
updated: 2026-07-03
supersedes: null
superseded_by: null
related: ["0015"]
confidencialidad: interno
---

# SDD-0141 · Calendario al Norte

> Lleva `/studio/calendario` del "mes con feriados" (SDD-0015) al **calendario
> operativo** del Norte (`docs/design/studio/_norte/erp/modules/calendar.jsx`):
> tabs, 3 vistas, y **eventos reales derivados de embarques**. Elegido por
> auditoría de drift Norte↔prod (gap Alto, contenido, sin migración en Slice 1).

## Slice 1 (esta entrega · commit `3e4d5903`) — sin migración

- **Tabs:** Calendario · Ferias China · Ferias Venezuela.
- **Vistas** (dentro de Calendario): Mes · Semana · Agenda (Semana/Agenda
  eran placeholders disabled).
- **Eventos operativos** desde embarques (solo lectura, RLS por tenant):
  - zarpe → `shipment_events` con `status='shipped'` (`occurred_at`)
  - arribo → `shipments.arrived_destination_at`
  - entrega → `shipments.delivered_at`
  - *(no hay columna ETD/ETA en `shipments`; el timeline es la fuente real
    del zarpe.)*
- **Drawer de día** (DrawerShell): eventos + ferias + feriados del día,
  linkeados a `/studio/tracking/[id]`.
- **Filtros** por tipo (zarpe / arribo / entrega / feriado / feria).
- `listCalendarEvents(supabase, {from,to})` nueva query
  (`lib/studio/calendar-events-queries.ts`). `MonthGrid`/`CalendarHeader`
  estáticos → `MonthView` + nav en `CalendarClient`.

## Diferido a Slice 2 (necesita mutación / migración)
- Drag-to-reprogramar eventos (modal "Reprogramar") → `actions.ts` + posible
  columna de fecha operativa editable.
- Export ICS · HolidayImpact (embarques afectados por feriado) · FairDetect
  (candidatos de feria por IA con aprobación/auditoría).
- Filtro por puerto de destino.

## Cabos sueltos conocidos (V1)
- Off-by-one de zona horaria: el día del evento sale de `timestamptz` en UTC;
  un hito 00:00–04:00 UTC puede caer un día antes en hora VE (GMT-4). Advisory.
- Semana/Agenda reutilizan el set de datos del mes visible.
- Si la query de eventos falla (sin sesión/tenant), la página degrada a solo
  feriados + ferias (no rompe).

## Pendiente del Director
`node scripts/verify.mjs` + `pnpm build` + check `ui-ux-designer` de las vistas
nuevas + `pnpm docs:index`. Sin migración que aplicar en esta slice.

## Verificación (lane)
`tsc --noEmit` + `eslint` verdes. Sin push.
