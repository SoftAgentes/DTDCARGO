---
sdd: "0217"
title: "Timezone explícito en eventos del calendario"
status: done
author: "Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0015", "0141", "0146"]
confidencialidad: interno
---

# SDD-0217 · Timezone explícito en eventos del calendario

## 1. Problema

`calendar-events-queries.ts` obtenía el día mediante `timestamp.slice(0, 10)`.
Eso presentaba UTC como fecha local: un evento de madrugada podía aparecer un
día tarde en Venezuela o un evento nocturno un día temprano en China.

CAL-01 exige distinguir fecha local, instante con timezone y rango. Este slice
es R2 porque cambia ubicación visual del hito, no el instante durable.

## 2. Contrato

- la zona sale de `user_profiles.timezone` y se valida como IANA;
- valor ausente/inválido degrada a `America/Caracas`;
- `Intl.DateTimeFormat(...).formatToParts()` convierte el instante al día civil;
- el query amplía un día UTC a cada extremo y filtra después de convertir, para
  no perder eventos en bordes de mes;
- cada evento declara `temporalKind`: `instant` o `local-date`;
- eventos `instant` conservan `timeZone`; tareas con `due_date` son fecha local;
- la UI muestra `Zona horaria · <IANA>` junto al mes;
- `todayIso` usa la misma zona, no el reloj local del servidor.

## 3. Reprogramación y DAT-01

Zarpe (`shipment_events.occurred_at`), arribo y entrega son hechos ya ocurridos.
No existe ETD/ETA planificado editable en este modelo. Arrastrarlos para
“reprogramar” falsearía el historial. Por ello:

- reprogramación queda bloqueada por diseño de datos, no por implementación UI;
- no se crea columna, action, selector DAT-01 ni migración en este slice;
- un SDD futuro debe definir la fecha planificada fuente, permisos, conflicto,
  dependencia y auditoría antes de abrir el selector transversal.

## 4. Allowlist

- `docs/specs/0217-calendar-event-timezone/spec.md`
- `docs/specs/README.md`
- `lib/studio/calendar-events-types.ts`
- `lib/studio/calendar-events-queries.ts`
- `lib/studio/calendar-events.test.ts`
- `app/studio/(app)/calendario/page.tsx`
- `app/studio/(app)/calendario/_components/CalendarClient.tsx`
- `docs/governance/policies/cal-01.md`
- `docs/governance/README.md`
- `docs/governance/generated/governance-capsule.json`

Conteo: una query, un contrato de tipo, una página y un componente. Cero tablas,
migraciones, jobs, actions o mutaciones.

## 5. SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| 01 claridad | cumple | zona IANA visible junto al mes |
| 02 trabajo | cumple | filtros y navegación se conservan |
| 03 riesgo | cumple | R2 read-only; no se mutan hechos |
| 04 auditoría | no aplica | no hay mutación |
| 05 autoridad | cumple | profile y eventos siguen sesión/RLS |
| 06 contexto | cumple | alcance exclusivo del calendario operativo |
| 07 estado real | cumple | fecha deriva del instante y zona reales |
| 08 recuperación | cumple | zona inválida degrada; query sigue advisory |
| 09 consistencia | cumple | un helper puro convierte todos los hitos |
| 10 accesibilidad | cumple | zona es texto visible; no depende de color |
| 11 adaptación | cumple | chip refluye con el header existente |
| 12 autoridad humana IA | no aplica | no interviene IA |

## 6. Verificación

- 12 pruebas focalizadas: VE/CN, medianoche, fin de mes, zona inválida, tipos y
  query aditiva;
- ESLint focalizado y TypeScript en cero;
- revisión UI: tokens existentes, texto compacto legible y sin control falso;
- docs, gobernanza, suite completa y build se repiten en el gate final.
