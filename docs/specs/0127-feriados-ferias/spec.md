---
sdd: "0127"
title: "Feriados & ferias — calendario operativo CN/VE (feriados + ferias comerciales)"
status: in-progress
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0103", "0125"]
confidencialidad: interno
---

# SDD-0127 · Feriados & ferias

> Octava sección real de Administración. La sección "Feriados CN/VE" del Norte,
> ampliada a **ferias comerciales** (Cantón/Yiwu) — ambos son eventos de
> calendario que afectan disponibilidad de fábricas y lead times / SLAs.

## Modelo de datos (migración 0192)

`operational_calendar` (1-a-N por tenant):

- `country` (CHECK `VE|CN`), `kind` (CHECK `holiday|fair`), `name`,
  `start_date`, `end_date` (nullable; ferias con rango), `note`.
- Soft-delete, `sort` por fecha, RLS por tenant, grants explícitos,
  `touch_updated_at()`. CHECK `end_date >= start_date`.

**No reusa `nomina_holidays`** (SDD-0103): esa es nómina-scoped (VE, triggers de
asistencia, RLS por rol admin/accounting). Dominio distinto → tablas separadas a
propósito.

## Alcance

- Lista del calendario (feriado/feria · país · nombre · rango · nota) + filtro
  por país.
- CRUD vía drawer (crear/editar/eliminar), admin-gated.

## Superficie de código

- `lib/studio/op-calendar-types.ts` — enums, validators, labels.
- `lib/studio/op-calendar-queries.ts` — `getOperationalCalendar(supabase)`.
- `app/studio/(app)/admin/calendar-actions.ts` — save/delete (admin-gated).
- `app/studio/(app)/admin/_components/CalendarSection.tsx` + `CalendarEventDrawer.tsx`.
- `app/studio/(app)/admin/page.tsx` — fetch + render.

## Follow-ups (fuera de alcance)

- Que TMS/almacén/SLAs **consuman** el calendario (hoy solo se administra).
- Import de feriados oficiales VE/CN por año.

## Estado

Código listo; `pnpm typecheck` + `pnpm lint` + build en verde. Migración
`0192_operational_calendar.sql` en la rama, **no aplicada a prod**.
