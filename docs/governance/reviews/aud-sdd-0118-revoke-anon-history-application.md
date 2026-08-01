# Aplicación individual de `0276_restore_revoke_anon_rpc_sweep_history`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-031 |
| Diseño local | [REV-AUD-030](aud-sdd-0118-revoke-anon-history.md) |
| Proyecto | `xpfuzqombmjmxvprjgmi` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada |

## 1. Autorización

El founder autorizó expresamente el basename exacto:

```text
0276_restore_revoke_anon_rpc_sweep_history
```

Se siguió
[Aplicar migraciones a prod](../../runbooks/aplicar-migraciones-prod.md). La
autorización cubrió una aplicación individual, su postflight y el branch
efímero posterior; no autorizó bundles, `0270`, Vercel ni lectura de PII.

## 2. Preflight metadata-only

| Control | Resultado |
|---|---|
| Proyecto | `ACTIVE_HEALTHY` |
| Ramas | sólo `main` |
| Ledger | 279 entradas |
| Recibo 0276 previo | cero |
| Entrada objetivo | una |
| Estado objetivo | `statements IS NULL` |
| `0270_audit_governed_query_rbac` | ausente |
| SHA-256 local | `46d2850b11b69d73aab75ff83a7195d610d57e8694b37b9cb9ffe54950f2c917` |
| Tamaño local | 13877 bytes |

No se leyeron filas de negocio ni PII.

## 3. Aplicación

`apply_migration` se invocó una vez con:

| Parámetro | Valor |
|---|---|
| `project_id` | `xpfuzqombmjmxvprjgmi` |
| `name` | `0276_restore_revoke_anon_rpc_sweep_history` |
| Archivo | `supabase/migrations/0276_restore_revoke_anon_rpc_sweep_history.sql` |
| Resultado | `success=true` |

La operación actualizó únicamente
`supabase_migrations.schema_migrations.statements` para
`20260703234254 0209_revoke_anon_rpc_sweep`. Los 48 pares
`REVOKE/GRANT` quedaron almacenados como texto; no fueron ejecutados sobre
Producción.

## 4. Postcondiciones

| Control | Resultado |
|---|---|
| Recibo único | `20260729163005` |
| Ledger final | 280 entradas |
| Cardinalidad objetivo | 1 |
| MD5 objetivo | `c6c722efdb7ff79ef037e0d826739205` |
| `statements IS NULL` residual | cero |
| Proyecto | `ACTIVE_HEALTHY` |
| Ramas | sólo `main` |
| `0270_audit_governed_query_rbac` | ausente |

## 5. Advisors

| Tipo | Antes | Después | Variación |
|---|---:|---:|---:|
| Seguridad | 125 · 5 INFO · 120 WARN | 125 · 5 INFO · 120 WARN | 0 |
| Rendimiento | 546 · 430 INFO · 116 WARN | 546 · 430 INFO · 116 WARN | 0 |

Los avisos preexistentes permanecen inventariados por el
[Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter).
`0276` no creó tablas, funciones, policies, grants, índices ni DML de producto.

## 6. Veredicto

REV-AUD-031 cierra el gate Cloud de
`0276_restore_revoke_anon_rpc_sweep_history`. El payload de
`0209_revoke_anon_rpc_sweep` quedó almacenado y disponible para un replay
posterior.

SDD-0118 y SDD-0172 permanecen `in-progress` hasta que un entorno efímero
complete replay, seed, E2E, verificación y teardown terminal.

CMP-01 v1.1, caso deprecated, D1, slices de adopción, D2–D5 y PLG-P3
permanecen cerrados. No existe plugin ni marketplace.
