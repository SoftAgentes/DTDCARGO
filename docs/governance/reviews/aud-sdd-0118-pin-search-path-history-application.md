# Aplicación individual de `0275_restore_pin_search_path_history`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-029 |
| Diseño local | [REV-AUD-028](aud-sdd-0118-pin-search-path-history.md) |
| Proyecto | `xpfuzqombmjmxvprjgmi` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada |

## 1. Autorización

El founder autorizó expresamente el basename exacto:

```text
0275_restore_pin_search_path_history
```

Se siguió
[Aplicar migraciones a prod](../../runbooks/aplicar-migraciones-prod.md). No se
autorizó bundle, otra migración, Vercel ni un entorno efímero.

## 2. Preflight metadata-only

| Control | Resultado |
|---|---|
| Proyecto | `ACTIVE_HEALTHY` |
| Ramas | sólo `main` |
| Ledger | 278 entradas |
| Recibo 0275 previo | cero |
| Entrada objetivo | una |
| Estado objetivo | `statements IS NULL` |
| Estado final previo | ausente |
| `0270_audit_governed_query_rbac` | ausente |
| SHA-256 local | `83675cddbd1d3e48354e423f2a6247771394865436d0af33ab09e1994bcebf2b` |
| Tamaño local | 5121 bytes |

No se leyeron filas de negocio ni PII.

## 3. Aplicación

`apply_migration` se invocó una vez con:

| Parámetro | Valor |
|---|---|
| `project_id` | `xpfuzqombmjmxvprjgmi` |
| `name` | `0275_restore_pin_search_path_history` |
| Archivo | `supabase/migrations/0275_restore_pin_search_path_history.sql` |
| Resultado | `success=true` |

La operación actualizó únicamente
`supabase_migrations.schema_migrations.statements` para
`20260703235255 0210_pin_search_path_triggers`. Los 33 `ALTER FUNCTION`
quedaron almacenados como texto; no fueron ejecutados sobre Producción.

## 4. Postcondiciones

| Control | Resultado |
|---|---|
| Recibo único | `20260729152036` |
| Ledger final | 279 entradas |
| Cardinalidad objetivo | 1 |
| MD5 objetivo | `c3131d8ea3756049d6455bc98b4d0ecc` |
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
`0275` no creó tablas, funciones, policies, grants, índices ni DML de producto.

## 6. Veredicto

REV-AUD-029 cierra el gate Cloud de
`0275_restore_pin_search_path_history`. El payload de
`0210_pin_search_path_triggers` ya es reproducible en un branch futuro.

SDD-0118 y SDD-0172 permanecen `in-progress` hasta que un entorno efímero nuevo
complete replay, seed, E2E, verificación y teardown terminal.

CMP-01 v1.1, caso deprecated, D1, slices de adopción, D2–D5 y PLG-P3
permanecen cerrados. No existe plugin ni marketplace.
