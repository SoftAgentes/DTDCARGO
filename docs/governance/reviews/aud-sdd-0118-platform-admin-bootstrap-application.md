# Aplicación Cloud de la reparación de `platform_admins`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-025 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Migración | `0273_skip_platform_admin_bootstrap_history` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada |

## 1. Autorización y preflight

El founder autorizó expresamente el basename exacto:

```text
0273_skip_platform_admin_bootstrap_history
```

El preflight metadata-only fresco comprobó:

- proyecto `xpfuzqombmjmxvprjgmi` en `ACTIVE_HEALTHY`;
- inventario de branches limitado a `main`;
- ledger con 276 entradas;
- `20260529071707 platform_admins` con un statement y digest remoto exacto
  `6c31b8ac8841b24815e3fb2463eabdd2`;
- `0273_skip_platform_admin_bootstrap_history` ausente;
- `0270_audit_governed_query_rbac` ausente;
- archivo local SHA-256
  `27b37488283d8dd12dbe754950be33916b323b202b6e97a4c69b08478a355942`;
- worktree limpio y `origin/main` ancestro del commit candidato.

No se leyeron filas de negocio, `auth.users` ni PII.

## 2. Aplicación individual

Se ejecutó una sola llamada `apply_migration`:

| Campo | Valor |
|---|---|
| `project_id` | `xpfuzqombmjmxvprjgmi` |
| `name` | `0273_skip_platform_admin_bootstrap_history` |
| Resultado | `success=true` |
| Versión del recibo | `20260729141805` |

No se envió un bundle y no se aplicó `0270`.

## 3. Postcondiciones

El postflight metadata-only comprobó:

- `20260529071707 platform_admins` conserva un statement;
- digest final exacto `cb374d4ad4c3b2bb62915e80a5a13793`;
- un único recibo `0273_skip_platform_admin_bootstrap_history`;
- ledger final de 277 entradas;
- `0270_audit_governed_query_rbac` todavía ausente;
- proyecto padre todavía `ACTIVE_HEALTHY`;
- inventario de branches todavía limitado a `main`.

La migración sólo modificó
`supabase_migrations.schema_migrations.statements`. No ejecutó el payload
almacenado, no modificó la fila real de `platform_admins` y no escribió tablas
de negocio o Auth.

## 4. Advisors

| Tipo | Total | INFO | WARN |
|---|---:|---:|---:|
| Seguridad | 125 | 5 | 120 |
| Rendimiento | 546 | 430 | 116 |

Los totales coinciden con los inventarios posteriores a `0271` y `0272`.
Corresponden a deuda preexistente sobre RLS, funciones `SECURITY DEFINER`,
índices y policies. `0273` no creó ni alteró objetos evaluados por advisors.

Referencias de remediación:

- [Database linter de Supabase](https://supabase.com/docs/guides/database/database-linter);
- [Producción y conexiones Auth](https://supabase.com/docs/guides/deployment/going-into-prod).

## 5. Veredicto

REV-AUD-025 aprueba la aplicación individual y el postflight de `0273`.
SDD-0118 y SDD-0172 aún no quedan `done`: el próximo gate debe crear un
entorno nuevo, completar el replay y ejecutar seed, E2E, verificación y
teardown terminal.

CMP-01 v1.1, caso deprecated, D1, slices de adopción, D2–D5, Vercel y PLG-P3
permanecen cerrados. No existe plugin ni marketplace.
