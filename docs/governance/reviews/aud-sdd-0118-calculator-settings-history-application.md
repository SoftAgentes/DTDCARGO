# Aplicación Cloud de la reparación de `0103_calculator_settings`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-027 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Migración | `0274_restore_calculator_settings_history` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada |

## 1. Autorización y preflight

El founder autorizó expresamente:

```text
Autorizo aplicar individualmente 0274_restore_calculator_settings_history en Supabase Producción
```

El preflight metadata-only fresco comprobó:

- proyecto `xpfuzqombmjmxvprjgmi` en `ACTIVE_HEALTHY`;
- inventario de branches limitado a `main`;
- ledger con 277 entradas;
- `20260604131310 0103_calculator_settings` con `statements IS NULL`;
- `0274_restore_calculator_settings_history` ausente;
- `0270_audit_governed_query_rbac` ausente;
- archivo local SHA-256
  `5e33ee512a20da3c0e9c1cf200cb3cb9a97cac51308578f4ed6a26724ac1ff89`;
- worktree limpio y `origin/main` ancestro del commit candidato.

No se leyeron filas de negocio, Auth ni PII.

## 2. Aplicación individual

Se ejecutó una sola llamada `apply_migration`:

| Campo | Valor |
|---|---|
| `project_id` | `xpfuzqombmjmxvprjgmi` |
| `name` | `0274_restore_calculator_settings_history` |
| Resultado | `success=true` |
| Versión del recibo | `20260729143620` |

No se envió un bundle y no se aplicó `0270`.

## 3. Postcondiciones

El postflight metadata-only comprobó:

- `20260604131310 0103_calculator_settings` con cardinalidad uno;
- digest canónico exacto `0f7deee22e3a978c52159b6fc211ee2c`;
- un único recibo `0274_restore_calculator_settings_history`;
- ledger final de 278 entradas;
- `0270_audit_governed_query_rbac` todavía ausente;
- proyecto padre todavía `ACTIVE_HEALTHY`;
- inventario de branches todavía limitado a `main`.

La migración sólo modificó
`supabase_migrations.schema_migrations.statements`. No ejecutó el payload
almacenado y no escribió tablas de negocio o Auth.

## 4. Advisors

| Tipo | Total | INFO | WARN |
|---|---:|---:|---:|
| Seguridad | 125 | 5 | 120 |
| Rendimiento | 546 | 430 | 116 |

Los totales coinciden con los baselines posteriores a `0271`–`0273`.
Corresponden a deuda preexistente. `0274` no creó ni alteró objetos evaluados
por advisors.

Referencias:

- [Database linter de Supabase](https://supabase.com/docs/guides/database/database-linter);
- [Producción y conexiones Auth](https://supabase.com/docs/guides/deployment/going-into-prod).

## 5. Veredicto

REV-AUD-027 aprueba la aplicación individual y el postflight de `0274`.
SDD-0118 y SDD-0172 aún no quedan `done`: el próximo gate debe crear un
entorno nuevo, completar el replay y ejecutar seed, E2E, verificación y
teardown terminal.

CMP-01 v1.1, caso deprecated, D1, slices de adopción, D2–D5, Vercel y PLG-P3
permanecen cerrados. No existe plugin ni marketplace.
