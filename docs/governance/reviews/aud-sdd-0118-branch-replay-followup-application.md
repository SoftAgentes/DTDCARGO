# Aplicación Cloud del follow-up del replay Supabase

| Control | Valor |
|---|---|
| Revisión | REV-AUD-023 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Migración | `0272_skip_superseded_invite_history` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada |

## 1. Autorización y preflight

El founder autorizó expresamente el basename exacto:

```text
0272_skip_superseded_invite_history
```

El preflight metadata-only fresco comprobó:

- proyecto `xpfuzqombmjmxvprjgmi` en `ACTIVE_HEALTHY`;
- inventario de branches limitado a `main`;
- 275 entradas en el ledger;
- `0031` y `0032` con una entrada cada una y sus digests de origen exactos;
- `0272_skip_superseded_invite_history` ausente;
- `0270_audit_governed_query_rbac` ausente;
- archivo local SHA-256
  `5aa89ccb01db8aefeada9625ec08c8d7ba6dd90e17d4a16013e4a819e476ccea`;
- worktree limpio y `origin/main` ancestro del commit candidato.

No se leyeron filas de negocio ni PII.

## 2. Aplicación individual

Se ejecutó una sola llamada `apply_migration`:

| Campo | Valor |
|---|---|
| `project_id` | `xpfuzqombmjmxvprjgmi` |
| `name` | `0272_skip_superseded_invite_history` |
| Resultado | `success=true` |
| Versión del recibo | `20260729140214` |

No se envió un bundle y no se aplicó `0270`.

## 3. Postcondiciones

El postflight metadata-only comprobó:

- `0031` con un statement y digest
  `9e4dc98716f8335c93e9961ccdf18fbe`;
- `0032` con un statement y digest
  `accd69afa043efc46960c8de5faa7c34`;
- un único recibo `0272_skip_superseded_invite_history`;
- ledger final de 276 entradas;
- `0270_audit_governed_query_rbac` todavía ausente;
- proyecto padre todavía `ACTIVE_HEALTHY`;
- inventario de branches todavía limitado a `main`.

La migración sólo modificó
`supabase_migrations.schema_migrations.statements`. No ejecutó los payloads
históricos almacenados, no creó objetos y no escribió tablas de negocio.

## 4. Advisors

| Tipo | Total | INFO | WARN |
|---|---:|---:|---:|
| Seguridad | 125 | 5 | 120 |
| Rendimiento | 546 | 430 | 116 |

Los totales coinciden con el inventario posterior a `0271`. Corresponden a
deuda preexistente sobre RLS, funciones `SECURITY DEFINER`, índices y
policies. `0272` no crea ni altera objetos evaluados por advisors.

Referencias de remediación:

- [Database linter de Supabase](https://supabase.com/docs/guides/database/database-linter);
- [Producción y conexiones Auth](https://supabase.com/docs/guides/deployment/going-into-prod).

## 5. Veredicto

REV-AUD-023 aprueba la aplicación individual y el postflight de `0272`.
SDD-0118 aún no queda `done`: la aceptación exige que un branch nuevo complete
el replay. El próximo gate es exclusivamente el tercer entorno efímero de
SDD-0172.

No se autoriza mediante este recibo `0270`, D1, slices de adopción, D2–D5,
Vercel ni PLG-P3.
