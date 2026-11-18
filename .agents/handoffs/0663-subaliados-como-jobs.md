# Handoff — SDD-0663 · Subaliados como jobs

Fecha: 2026-11-18 · Rama: `claude/admiring-saha-bfeb23` · PR #676 (borrador) · Tipo: solo spec (`proposed`)

## Hecho

- `docs/specs/0663-subaliados-como-jobs/spec.md`. Segunda versión, con las decisiones de Sam del 2026-11-18: DTD le cobra solo al aliado; el subaliado es un job dentro de su estado de cuenta; Clientes gana una sección «Aliados»; quién es subaliado de quién lo resuelve la oficina después.
- La primera versión («a quién se le cobra») quedó descartada. La carpeta se renombró de `0663-subaliados-a-quien-se-le-cobra` a `0663-subaliados-como-jobs`.
- `docs/specs/README.md` regenerado con `node scripts/build-docs-index.mjs`.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ |
| `node scripts/check-numbering.mjs` | PASÓ |
| `pnpm verify` | NO EJECUTADO: el cambio es solo documental |
| Producción | NO CONSULTADA |

## Pendientes de esta tarea

- Las tres decisiones de Sam del §5 de la spec.
- Con la spec aprobada: asignación de fases por el Director General.

## FUERA DE ALCANCE DETECTADO

- SDD-0255 §8.3 (accesos por aliado) y §8.5 (cláusula de tratamiento de datos para aliados) siguen abiertos y frenan el acceso de un subaliado al portal.
- No está verificado si la línea «Exceso de peso» de las facturas de lote lleva código de embarque; sin él cae en el grupo «General».
