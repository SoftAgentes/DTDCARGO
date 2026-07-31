# Preflight fresco del Corte C1

| Control | Valor |
|---|---|
| Revisión | REV-AUD-040 |
| Fecha | 2026-07-30 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Migración | `0270_audit_governed_query_rbac` |
| Alcance | PostgreSQL 17 local + snapshot candidato metadata-only |
| Resultado | local verde; snapshot externo histórico; Producción no consultada ni aplicada |

## Evidencia local

La prueba contractual
`supabase/tests/0270_audit_governed_query_rbac.test.sql` pasó en PostgreSQL 17
con rollback total. Verificó la firma real de las dos RPC, RBAC admin-only,
cursor, filtros, AAL2, evento de acceso, retiro de lectura cruda y ausencia de
persistencia.

## Snapshot histórico de Producción aportado por la rama candidata

Proyecto declarado: `xpfuzqombmjmxvprjgmi`. La integración no repitió esta
consulta y no la presenta como estado actual. La rama candidata declara que no
consultó filas de negocio ni PII.

| Control | Estado observado |
|---|---|
| PostgreSQL | 17.6 |
| `audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)` | ausente |
| `audit_get_event_detail(uuid,text)` | ausente |
| `authenticated` puede `SELECT` crudo | sí |
| `service_role` puede `SELECT` crudo | no |
| `service_role` puede `INSERT` | sí |
| tabla en Realtime | sí |
| policies de tabla | 1 |
| writer `append_audit_event` | 1 |
| ledger | termina en `0288_finalize_replay_gate_split_history`; `0270` ausente |

El snapshot coincidía con las precondiciones esperadas de C1, pero el runbook
exige autorización nominal con el basename completo. La mención abreviada
`0270` no se trató como autorización de escritura. No se llamó
`apply_migration`.

## Advisors históricos

El snapshot candidato no introdujo cambios: 5 hallazgos `INFO` y 120 `WARN` de
seguridad; 430 `INFO` y 116 `WARN` de rendimiento. Incluye deuda preexistente
como tablas RLS server-only sin policy, funciones `SECURITY DEFINER` expuestas
por contratos públicos aprobados, índices sin uso y policies permisivas
múltiples. Al no existir aplicación, estos conteos son línea base, no
regresiones atribuibles a C1.

## Veredicto

El artefacto local continúa aprobado. El gate Producción queda **fail-closed** hasta
recibir autorización que nombre exactamente
`0270_audit_governed_query_rbac`; después deberá repetirse preflight, aplicarse
una sola migración y verificarse postcondiciones/advisors.
