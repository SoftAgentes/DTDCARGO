# Recibo de aplicación de guardrails tenant/fixtures

| Control | Valor |
|---|---|
| Revisión | REV-AUD-018 |
| SDD | [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Revisión previa | [REV-AUD-011](aud-tenant-fixtures-implementation.md) |
| Migración | [`0268_tenant_lifecycle_guardrails.sql`](../../../supabase/migrations/0268_tenant_lifecycle_guardrails.sql) |
| Proyecto | DTD Cargo · `xpfuzqombmjmxvprjgmi` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada |
| Ledger | `20260729053713` · `0268_tenant_lifecycle_guardrails` |
| SHA-256 | `28ED8B2CD6B29B8D30778798E9F3906DF06FA6EA819080795DFAC9D91385801A` |

## 1. Autorización y alcance

Sam (founder) autorizó aplicar individualmente en Supabase Producción la
migración exacta `0268_tenant_lifecycle_guardrails`. Se siguió el runbook y no
se incluyó otra migración. `0270_audit_governed_query_rbac` no se aplicó.

No se consultaron filas de negocio ni PII. Las únicas filas creadas fueron dos
fixtures sintéticas dentro de una transacción que terminó en `ROLLBACK`.

## 2. Preflight metadata-only fresco

| Control | Resultado |
|---|---|
| Git canónico | `origin/main` `e7be56c6245f23703703ff93026757c753e091f3`; limpio al iniciar |
| PostgreSQL | 17.6 |
| Ledger | 0268 ausente; 0269 presente; 0270 ausente |
| Objetos | `tenants`, `entity_audit_log` y writer 0267 presentes |
| FK audit | validada y `ON DELETE CASCADE`, estado exacto esperado |
| ACL `service_role` | SELECT/INSERT/UPDATE/DELETE presentes |
| Roles cliente | `anon` y `authenticated` sin DELETE |
| Policy DELETE | ninguna |
| Fixture SDD-0168 | ausente por ID sintético conocido |
| Locks en espera | 0 |
| Prueba local | PostgreSQL 15 y 17 verdes; rollback total |
| Advisors previos | seguridad y rendimiento capturados; deuda global preexistente |

Todo el preflight coincidió con las precondiciones fail-closed del SQL.

## 3. Aplicación única

Supabase aceptó una sola operación:

```text
name: 0268_tenant_lifecycle_guardrails
result: success
```

No hubo bundle, reintento, DML de negocio ni aplicación de 0270.

## 4. Verificación contra objetos

| Comprobación | Resultado |
|---|---|
| Ledger exacto | `20260729053713 / 0268_tenant_lifecycle_guardrails` |
| FK audit | `ON DELETE RESTRICT`, validada |
| ACL `service_role` | SELECT/INSERT/UPDATE preservados; DELETE revocado |
| Roles cliente | continúan sin DELETE |
| Policy DELETE | continúa ausente |
| Locks en espera | 0 |

La prueba transaccional de Producción:

1. creó dos tenants sintéticos y un evento audit sintético;
2. comprobó que el owner recibe `foreign_key_violation` al intentar borrar el
   tenant con auditoría;
3. comprobó que `service_role` recibe `insufficient_privilege` al intentar
   borrar un tenant vacío;
4. ejecutó `ROLLBACK`;
5. confirmó residuo cero por IDs y `correlation_id` sintéticos.

## 5. Advisors

Los advisors de seguridad y rendimiento se ejecutaron antes y después. Los
avisos posteriores corresponden a deuda global preexistente y ninguno
referencia el cambio de FK, el grant DELETE de `tenants` o un objeto creado por
0268. Referencias de los tipos globales observados:

- [RLS habilitado sin policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy);
- [FK sin índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys);
- [policies permisivas múltiples](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).

0268 no crea tabla, índice, función o policy y no amplía privilegios.

## 6. Cierre

El gate Cloud de 0268 queda aplicado y verificado. SDD-0172 continúa
`in-progress` únicamente por el recorrido real en un proyecto Supabase efímero
y la evidencia de teardown terminal.

Este recibo no abre 0270, Corte C, D1 de aplicación, D2–D5, retención/purga,
Auth de usuarios, Vercel ni limpieza de worktrees.
