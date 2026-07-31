# Revisión técnica D5 — residual y retiro del writer

| Control | Valor |
|---|---|
| Revisión | REV-AUD-022 |
| Migración | `0293_audit_d5_residual_and_writer_retirement` |
| Resultado | aplicado y verificado en Producción por REV-AUD-042 |

D5 cubre las acciones residuales mediante nueve triggers y trata Auth/correo
como efectos externos durables. La adaptación añade clave idempotente
reutilizable, lease, contador de intentos, reintento y reconciliación explícita.
La prueba verifica eventos representativos, ausencia de PII, no duplicación,
estado final del workflow, rollback y revocación de `INSERT service_role`.

El ledger de aplicación queda sin writers TypeScript directos. No se declara
atomicidad ACID entre PostgreSQL y Auth/Resend. Cada migración conserva
aplicación individual en Producción.

REV-AUD-042 registra `0293` con basename exacto, RLS, cuatro funciones
selladas, nueve triggers habilitados y `INSERT service_role` revocado.

La suite contractual completa pasó 32/32 en PostgreSQL 17 efímero con rollback
total; incluye `0270` y `0289`–`0293`.
