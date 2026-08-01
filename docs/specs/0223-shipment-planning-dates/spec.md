---
sdd: "0223"
title: "Fechas planificadas de embarques"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0013", "0141", "0217"]
confidencialidad: interno
---

# SDD-0223 · Fechas planificadas de embarques

## Decisión

El plan de salida, llegada y entrega vive en `shipments`, separado de los
hitos reales. Cada plan conserva zona IANA, versión, actor y fecha de cambio.
Solo el RPC `update_shipment_plan` puede mutarlo; exige permiso operativo,
versión esperada, cronología válida y motivo, y registra el antes/después en
el ledger append-only.

El formulario transversal del detalle acepta teclado y selector nativo móvil.
El servidor vuelve a validar zona, orden, permiso y conflicto. El calendario
muestra plan y realidad como tipos distintos y enlaza a la fuente.

## Allowlist

- `supabase/migrations/0305_shipment_planning_dates.sql`
- `lib/studio/shipment-types.ts`
- `lib/studio/shipment-queries.ts`
- `lib/studio/calendar-events-types.ts`
- `lib/studio/calendar-events-queries.ts`
- `lib/studio/calendar-events.test.ts`
- `app/studio/(app)/tracking/[id]/actions.ts`
- `app/studio/(app)/tracking/[id]/page.tsx`
- `app/studio/(app)/tracking/[id]/_components/ShipmentPlanPanel.tsx`
- `app/studio/(app)/calendario/_components/CalendarClient.tsx`
- `docs/governance/policies/cal-01.md`
- `docs/governance/policies/dat-01.md`
- índices normativos derivados

## Aceptación

- el plan no altera hitos reales;
- una escritura directa o sin rol autorizado falla;
- la versión antigua obtiene conflicto;
- secuencia o zona inválida falla también en servidor;
- el calendario distingue “planificado” del hecho real;
- borrar una fecha es explícito y no equivale a hoy;
- toda reprogramación guarda motivo y evento de auditoría.

## Producción

Aplicada como `0305_shipment_planning_dates` (`20260731192339`). Se verificaron
siete columnas, guard trigger, check cronológico, RPC y bloqueo de `anon`.
