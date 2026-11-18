# Handoff — SDD-0663 · Subaliados: a quién se le cobra

Fecha: 2026-11-18 · Rama: `claude/admiring-saha-bfeb23` · Tipo: solo spec (`proposed`)

## Hecho

- `docs/specs/0663-subaliados-a-quien-se-le-cobra/spec.md`: análisis de lo que existe (SDD-0255, 0269, 0336, 0456, 0461, 0543) y propuesta de un dato «Se le cobra a» por subaliado, factura por pagador y estado de cuenta consolidado e individual.
- `docs/specs/README.md` regenerado con `node scripts/build-docs-index.mjs`.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ |
| `node scripts/check-numbering.mjs` | PASÓ |
| `pnpm verify` | NO EJECUTADO: el cambio es solo documental |
| Producción | NO CONSULTADA |

## Pendientes de esta tarea

- Las cinco decisiones de Sam del §6 de la spec.
- Con la spec aprobada: asignación de fases y número de migración por el Director General.

## FUERA DE ALCANCE DETECTADO

- SDD-0255 §8.3 (accesos por aliado) y §8.5 (cláusula de tratamiento de datos para aliados) siguen abiertos y frenan el acceso de un subaliado al portal.
- La liquidación de aliados (SDD-0255 §8.1) no está construida.
