# REV-AUD-049 · Corte E4 expiración de artefactos

| Control | Valor |
|---|---|
| SDD | [SDD-0221](../../specs/0221-audit-export-expiry/spec.md) |
| Riesgo | R3 |
| Resultado local | aprobado · schema PostgreSQL 17 + 7 pruebas E3/E4 |

E4 separa la eliminación del objeto temporal de la retención de eventos. Un
hold sobre `audit_export/{request_id}` impide reclamar el artefacto.

La reconstrucción aplicó 283 migrations y verificó aislamiento en 219 tablas.
La prueba del worker confirma el orden claim → Storage delete → recibo; el
camino de error nunca ejecuta la confirmación.
