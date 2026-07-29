# Reparación histórica de `rls_auto_enable()` y `ensure_rls`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-032 |
| Fecha | 2026-07-29 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Basenames | `0277_version_rls_auto_enable` y `0278_restore_rls_auto_enable_history` |
| Resultado | 0277 recuperada; 0278 aprobada localmente, aplicación pendiente |

## 1. Evidencia metadata-only

Producción contiene `public.rls_auto_enable()` con:

- retorno `event_trigger`;
- `SECURITY DEFINER`;
- `search_path=pg_catalog`;
- owner `postgres`;
- EXECUTE sólo para `postgres` y `service_role`;
- `md5(pg_get_functiondef)=6998ea6b4c2480f5d2e34b5dcf3f8d36`.

El event trigger `ensure_rls` está activo en `ddl_command_end` para `CREATE
TABLE`, `CREATE TABLE AS` y `SELECT INTO`.

La definición fue recuperada desde el commit preservado que aplicó
`0277_version_rls_auto_enable`. Producción registra ese basename con versión
`20260729213453`. El archivo documental normalizado tiene MD5
`171643b4a504a765e5183d0e80cd461f`; al retirar exclusivamente sus líneas de
comentario `--`, el payload ejecutable mide 1.878 caracteres y queda
byte-idéntico al statement del ledger, MD5
`3be131a05cb2d712fc92996004ae8b33`.

## 2. R8 demuestra que 0277 no resuelve el orden histórico

Se creó un branch nuevo sin datos de Producción:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r8` |
| `branch_id` | `fdcc9a71-e7b7-4cbd-a278-52551e10f70e` |
| `project_ref` | `alcyqfunqvszooxmufqd` |
| Costo | USD 0,01344/h |
| Estado final del replay | `MIGRATIONS_FAILED` |

El replay volvió a fallar dentro de `0209_revoke_anon_rpc_sweep`:

```text
function public.rls_auto_enable() does not exist
```

Esto es determinista: 0277 corre después de 0209 y no puede satisfacer una
referencia anterior. No se ejecutaron seed, Auth, fixtures o E2E. El branch fue
eliminado por su ID exacto y el inventario posterior dejó únicamente `main`
`ACTIVE_HEALTHY`.

## 3. Diseño forward-only de 0278

`0278_restore_rls_auto_enable_history` modifica únicamente
`supabase_migrations.schema_migrations`. Sobre la entrada:

```text
20260703234254 · 0209_revoke_anon_rpc_sweep
```

antepone como `statements[1]` el SQL exacto de 0277 y conserva el sweep como
`statements[2]`. Así, un replay fresco:

1. crea la función y el event trigger;
2. ejecuta el sweep ACL de 0209;
3. deja que 0211 retire `authenticated`;
4. reejecuta 0277 idempotentemente al llegar a su versión normal.

La migración aplicada a Producción no ejecuta la función ni crea el trigger:
sólo almacena el payload en el ledger. El preflight acepta exclusivamente:

- estado actual: cardinalidad 1 y MD5 de 0209
  `c6c722efdb7ff79ef037e0d826739205`;
- estado objetivo: cardinalidad 2 con MD5 del statement 0277
  `3be131a05cb2d712fc92996004ae8b33` seguido del MD5 de 0209.

Cualquier otro estado aborta.

## 4. Verificación local

- generador determinista y `--check`: verde;
- Vitest: 3/3;
- PostgreSQL 15: 0277 + 0278 verdes, doble ejecución y rollback;
- PostgreSQL 17: 0277 + 0278 verdes, doble ejecución y rollback;
- tabla creada después del bootstrap recibió RLS automáticamente;
- trigger, tags, `SECURITY DEFINER`, `search_path` y ACL verificados;
- Docker residual: cero contenedores del gate;
- `git diff --check`: verde.

## 5. Límite operativo

REV-AUD-032 aprueba el diseño y las pruebas locales. El runbook de Producción
continúa exigiendo autorización que nombre exactamente
`0278_restore_rls_auto_enable_history` antes de aplicar. Después se requiere un
branch completamente nuevo para replay, seed, E2E, verificación y teardown.

No modifica producto, Auth, Vercel, CMP-01, D1, D2–D5, slices o PLG-P3.
