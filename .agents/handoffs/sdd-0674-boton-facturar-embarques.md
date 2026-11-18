# Handoff · SDD-0674 — Botón «Facturar» en Embarques (regla transitoria)

Fecha: 2026-11-18. Datos de la tarea:

- Owner: Worker `worker-0674-facturar`.
- Rama: `codex/sdd-0674-boton-facturar-embarques`.
- Worktree: `DTD-worktrees/sdd-0674-boton-facturar-embarques`.
- Base: `origin/main` `9434cc4f6`.
- Número de SDD asignado por el DG.

Encargo del DG, por pedido de Sam en la reunión del 2026-11-18: **solo una spec en borrador, sin código**.
Contiene las cinco preguntas para Sam, cada una con su recomendación.

## Medición (spec §2, en código y migraciones; no se leyó producción)

- **El portal ya muestra los embarques del cliente aunque no tengan factura.** Ni `listMyShipments` ni la
  policy 0416 miran `invoices`. Encima sale el aviso `TRACKING_EN_CONSTRUCCION = true`.
- **Los borradores no se ven en el portal** (0452).
- **El rol de Embarques no puede crear, emitir ni leer facturas**, por la RLS 0407 y la 0414 y por el
  RBAC (`invoices` es solo de accounting y admin).
- **La emisión de una factura DDP choca con el gate legal AUT-04**, que está en bloqueo duro.
- **La carga de consolidados ya calcula una factura por cliente y contenedor** con los precios del Excel.
  Los contenedores montados así no tienen tarifa congelada.

## Hecho

- `docs/specs/0674-boton-facturar-embarques/spec.md` en estado `draft`, con el índice regenerado.

## Evidencia

| Comprobación | Resultado |
|---|---|
| docs:check / sdd:check / git diff --check | PASÓ (649 specs) |
| Pruebas de producto | NO APLICA: cambio solo de docs |
| `pnpm verify` | NO EJECUTADO: es solo docs y el portón es el CI |

## Pendientes de esta tarea

- Decisión 1 de Sam ya escrita en la spec (dos modos: contenedor completo con doble aprobación, y por cliente dentro del contenedor con doble confirmación; la unidad mínima es el cliente del contenedor). Siguen abiertas las preguntas 2 a 5 y la 6 nueva (qué es la doble aprobación). La 4 cambió de recomendación: el monto se ve solo en la pantalla de confirmación.
- Si las respuestas llevan migración (RPC de facturar con el rol de Embarques, o una regla nueva del
  portal), pedirle el número al DG.
- Con las respuestas, completar la aceptación y pasar a implementación en una PR aparte o en esta misma,
  según lo que diga el DG.

## FUERA DE ALCANCE DETECTADO

- La 0668 está en la PR #680, sin fusionar. Según el DG no cruza con esta spec, salvo que cambie la regla del portal.
