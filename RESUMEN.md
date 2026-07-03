# RESUMEN · lane `calendario-norte`

**Ventana:** secundaria (no push, no merge, no migrations).
**Rama:** `feat/calendario-norte` (off `main`, sin upstream).
**Tarea:** llevar Calendario al Norte — Slice 1 (vistas + eventos de embarques),
elegida por auditoría de drift Norte↔prod. **Spec:** `docs/specs/0141-calendario-norte/spec.md`.

## Commit
- `3e4d5903` — feat(studio): SDD-0141 — Calendario al Norte, eventos de embarques (Slice 1)

## Qué quedó
Tabs (Calendario/Ferias CN/Ferias VE) + vistas Mes/Semana/Agenda + eventos
reales de embarques (zarpe/arribo/entrega) + drawer de día + filtros. Todo
lectura, sin migración. `MonthGrid`/`CalendarHeader` estáticos reemplazados
por `MonthView` + `CalendarClient`.

## Verificación
- `tsc --noEmit` → exit 0 · `eslint` calendario + libs → 0 errores.
- Sin `Date.now()`/`new Date()` en render (fecha "hoy" baja del server).
- NO corrí verify.mjs. Sin migración. Sin push.

## Pendiente del Director
`verify.mjs` + `pnpm build` + `ui-ux-designer` + `docs:index`. Merge con OK del founder.

## Diferido a Slice 2
Drag-to-reprogramar (mutación + migración), export ICS, HolidayImpact, FairDetect IA.
