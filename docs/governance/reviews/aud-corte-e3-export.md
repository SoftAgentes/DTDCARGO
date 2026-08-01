# REV-AUD-048 · Corte E3 exportación gobernada

| Control | Valor |
|---|---|
| SDD | [SDD-0220](../../specs/0220-audit-export-governed/spec.md) |
| Fuente | AUD-02 + calendario v1.0 |
| Riesgo | R3 |
| Resultado local | aprobado · schema PostgreSQL 17 + 6 pruebas focalizadas |

La exportación no abre acceso crudo a `entity_audit_log`. El job consume una
RPC SECURITY DEFINER con columnas redacted y el endpoint de descarga solo usa
service role después de que la sesión admin fue autorizada por la base.

## Evidencia local

- 299 migrations verificadas; 282 aplicadas desde cero;
- aislamiento de 219 tablas con dos tenants: verde;
- CSV injection, field projection y SHA-256: 6/6;
- TypeScript y ESLint focalizado: verde;
- bucket `audit-exports` privado, sin grants crudos de aplicación.

## Producción

`0302_audit_export_governed` fue aplicada como versión `20260731192253`.
Tablas, RPCs y bucket privado con límites quedaron verdes.
