---
sdd: "0216"
title: "DND-01 accesible y durable en Bitácora"
status: done
author: "Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0146", "0210"]
confidencialidad: interno
---

# SDD-0216 · DND-01 accesible y durable en Bitácora

## 1. No conformidad

El Kanban de Bitácora permitía drag HTML5 y un botón que avanzaba solo al estado
siguiente. Teclado y touch no podían elegir cualquiera de los cuatro destinos;
no existían pickup anunciado, placeholder ni detección de escritura concurrente.

El flujo es R2: el cambio es reversible y no altera un asiento financiero. La
corrección se limita a Bitácora y no migra otros Kanban.

## 2. Contrato implementado

- drag mantiene tarjeta tomada, columnas válidas y placeholder con texto;
- el selector nativo `Mover a` alcanza cualquier estado por teclado/touch y
  conserva target de 44 px;
- abrir la tarea tiene un botón independiente y accesible;
- `aria-live` anuncia pickup y destino sin narrar cada movimiento del puntero;
- el cliente aplica optimistic update y rollback focalizado a la tarea;
- `moveTaskAction(id, destino, origen)` ejecuta
  `UPDATE ... WHERE id = ... AND estado = origen`;
- cero filas significa conflicto: mensaje recuperable, rollback y refresh;
- éxito durable habilita Deshacer, que usa la misma comparación de estado;
- el trigger existente continúa sellando/limpiando `completed_at`.

No se creó migración. Tenant y permiso permanecen en RLS y
`moduleEditDenial("bitacora")`.

## 3. Allowlist

- `docs/specs/0216-dnd-bitacora-accessible/spec.md`
- `docs/specs/README.md`
- `app/studio/(app)/bitacora/_components/BoardKanban.tsx`
- `app/studio/(app)/bitacora/_components/BoardKanban.test.tsx`
- `app/studio/(app)/bitacora/_components/BitacoraClient.tsx`
- `app/studio/(app)/bitacora/actions.ts`
- `app/studio/(app)/bitacora/__tests__/move-task-action.test.ts`
- `docs/governance/policies/dnd-01.md`
- `docs/governance/README.md`
- `docs/governance/generated/governance-capsule.json`

Conteo: un tablero, una action y dos archivos de prueba. Cero tablas,
migraciones, componentes nuevos o Kanban ajenos.

## 4. SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| 01 claridad | cumple | selector nombra el destino y conserva labels de estado |
| 02 trabajo | cumple | rollback focalizado; otros cambios optimistas no se pierden |
| 03 riesgo | cumple | R2 reversible; Deshacer disponible |
| 04 auditoría | no aplica | transición operativa R2 sin exigencia de evento AUD-01 |
| 05 autoridad | cumple | permiso, tenant RLS y estado esperado se validan en servidor |
| 06 contexto | cumple | alcance exclusivo de Bitácora |
| 07 estado real | cumple | éxito solo después de respuesta durable |
| 08 recuperación | cumple | conflicto y fallo revierten, explican y refrescan |
| 09 consistencia | cumple | metadata `ESTADO_META` sigue siendo la fuente de labels |
| 10 accesibilidad | cumple | teclado, touch, live region, control independiente y 44 px |
| 11 adaptación | cumple | móvil usa selector; no emula drag HTML5 |
| 12 autoridad humana IA | no aplica | la transición es humana |

## 5. Verificación

- `BoardKanban.test.tsx`: cualquier destino, apertura separada, pickup,
  placeholders, live region y estado esperado;
- `move-task-action.test.ts`: origen inválido, update condicional y conflicto;
- ESLint focalizado en cero errores/advertencias;
- TypeScript, suite completa y build se ejecutan en el gate final;
- revisión UI: solo tokens existentes, sin color como señal única, target touch y
  alternativa explícita al drag.
