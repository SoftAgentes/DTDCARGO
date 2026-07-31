# REV-AUD-047 · Corte E2 legal holds

| Control | Valor |
|---|---|
| SDD | [SDD-0219](../../specs/0219-audit-legal-holds/spec.md) |
| Fuente | [Calendario v1.0](../../legal/retention-schedule-v1.md) |
| Riesgo | R3 |
| Resultado local | aprobado · contrato SQL efímero en PostgreSQL 17 |

## Decisión

E2 se implementa como dos tablas append-only y RPCs admin-only. La liberación
es una transición en dos pasos con actores distintos. El estado `active` y
`release_requested` preserva; solo `released` deja de bloquear.

La migration no crea exportación, expiración ni purga. Su aplicación en Cloud
requiere autorización nominal del basename y postcondiciones/advisors propios.

## Evidencia local

- creación por admin y scope `entity_type`: verde;
- `active` y `release_requested` preservan: verde;
- autoaprobación rechazada y segundo actor aceptado: verde;
- estado `released` deja de bloquear: verde;
- definición protegida contra UPDATE y tres eventos canónicos: verde.
