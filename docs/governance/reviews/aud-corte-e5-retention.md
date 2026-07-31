# REV-AUD-050 · Corte E5 retención por lotes

| Control | Valor |
|---|---|
| SDD | [SDD-0222](../../specs/0222-audit-retention-batches/spec.md) |
| Fuente | [Calendario v1.0](../../legal/retention-schedule-v1.md) |
| Riesgo | R3 destructivo |
| Resultado local | aprobado · contrato destructivo PostgreSQL 17 |

No hay purga automática. Cada lote nace de un dry-run, se aprueba por un actor
distinto y se revalida inmediatamente antes del DELETE. Un cambio de hold o de
conjunto invalida el hash.

El contrato funcional verificó que el dry-run selecciona un evento operativo,
excluye fiscal y hold, rechaza autoaprobación, acepta segundo actor, borra solo
el UUID sellado y conserva recibo de conteo/hash. La reconstrucción aplicó 284
migrations y mantuvo aislamiento en 219 tablas.
