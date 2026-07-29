# Aplicación Cloud de la reparación del replay Supabase

| Control | Valor |
|---|---|
| Revisión | REV-AUD-021 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Migración | `0271_repair_branch_replay_history` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada |

## 1. Autorización y preflight

El founder autorizó expresamente el basename exacto:

```text
0271_repair_branch_replay_history
```

El preflight metadata-only fresco comprobó:

- proyecto `xpfuzqombmjmxvprjgmi` en `ACTIVE_HEALTHY`;
- inventario de branches limitado a `main`;
- 274 entradas en el ledger;
- 11/11 versiones, nombres, cardinalidades y digests de origen exactos;
- `0271_repair_branch_replay_history` ausente;
- `0270_audit_governed_query_rbac` ausente;
- archivo local SHA-256
  `9edcf5658702b483617dad257c058b346f595fa0c04247260db4b42456681d46`;
- worktree limpio y `origin/main` ancestro del commit candidato.

No se leyeron filas de negocio ni PII.

## 2. Aplicación individual

Se ejecutó una sola llamada `apply_migration`:

| Campo | Valor |
|---|---|
| `project_id` | `xpfuzqombmjmxvprjgmi` |
| `name` | `0271_repair_branch_replay_history` |
| Resultado | `success=true` |
| Versión del recibo | `20260729135053` |

No se envió un bundle y no se aplicó `0270`.

## 3. Postcondiciones

El postflight metadata-only comprobó:

- 11/11 entradas con cardinalidad final y digests exactos;
- un único recibo `0271_repair_branch_replay_history`;
- ledger final de 275 entradas;
- `0270_audit_governed_query_rbac` todavía ausente;
- proyecto padre todavía `ACTIVE_HEALTHY`.

La migración sólo modificó
`supabase_migrations.schema_migrations.statements`. No ejecutó los payloads
históricos almacenados, no creó objetos y no escribió tablas de negocio.

## 4. Advisors

| Tipo | Total | INFO | WARN |
|---|---:|---:|---:|
| Seguridad | 125 | 5 | 120 |
| Rendimiento | 546 | 430 | 116 |

El inventario corresponde a deuda preexistente sobre RLS, funciones
`SECURITY DEFINER`, índices y policies. `0271` no crea ni altera objetos
evaluados por advisors, por lo que estos avisos quedan fuera de su allowlist.

Referencias de remediación:

- [Database linter de Supabase](https://supabase.com/docs/guides/database/database-linter);
- [Producción y conexiones Auth](https://supabase.com/docs/guides/deployment/going-into-prod).

## 5. Veredicto

REV-AUD-021 aprueba la aplicación individual y el postflight de `0271`.
SDD-0118 aún no queda `done`: la aceptación exige que un branch nuevo complete
el replay. El próximo gate es exclusivamente la repetición efímera de
SDD-0172.

No se autoriza mediante este recibo `0270`, D1, slices de adopción, D2–D5,
Vercel ni PLG-P3.
