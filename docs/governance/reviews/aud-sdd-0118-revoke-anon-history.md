# Restauración reproducible de `0209_revoke_anon_rpc_sweep`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-030 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Candidata | `0276_restore_revoke_anon_rpc_sweep_history` |
| Fecha | 2026-07-29 |
| Resultado | diseño y artefacto local aprobados; Cloud cerrado |

## 1. Evidencia y causa

R6 avanzó a 268 migraciones y falló cerrado en
`0264_harden_comment_mentions_validate_execute`. La función
`comment_mentions_validate()` conservó EXECUTE para PUBLIC y `anon`.

El diagnóstico metadata-only confirmó una sola entrada técnica:

```text
20260703234254 · 0209_revoke_anon_rpc_sweep · statements = NULL
```

El archivo histórico canónico contiene 48 pares de ACL. Cada par revoca
EXECUTE de PUBLIC y `anon`, y lo concede explícitamente a `authenticated` y
`service_role`. R6 terminó destruido; no fue corregido manualmente.

## 2. Decisión forward-only

`0276` modifica exclusivamente
`supabase_migrations.schema_migrations.statements` para la versión y nombre
exactos de `0209`.

En una aplicación futura a Producción:

- no ejecuta ningún `REVOKE` ni `GRANT`;
- no cambia funciones, owners, RLS, Auth ni filas de negocio;
- sólo almacena el archivo canónico como un elemento `text[]`;
- no modifica ni reordena el archivo histórico;
- permite que un branch nuevo reproduzca el ACL en su secuencia normal.

## 3. Contrato fail-closed

| Estado | Valor |
|---|---|
| Versión | `20260703234254` |
| Nombre | `0209_revoke_anon_rpc_sweep` |
| Estado remoto | `statements IS NULL` |
| MD5 canónico | `c6c722efdb7ff79ef037e0d826739205` |
| SHA-256 de 0276 | `46d2850b11b69d73aab75ff83a7195d610d57e8694b37b9cb9ffe54950f2c917` |
| Tamaño de 0276 | 13877 bytes |

La precondición admite sólo `NULL` o el estado final conocido. El UPDATE sólo
ocurre sobre `NULL`; una segunda ejecución es no-op. Cualquier versión,
nombre, cardinalidad o digest distinto aborta. La postcondición exige
cardinalidad uno y el MD5 canónico.

El generador exige exactamente 48 REVOKE, 48 GRANT, firmas únicas,
correspondencia uno-a-uno en el mismo orden y presencia de
`comment_mentions_validate()`.

## 4. Evidencia local

| Gate | Resultado |
|---|---|
| Preflight Git | limpio · rama 2 commits adelante de `origin/main` |
| Preflight Cloud | proyecto saludable · sólo `main` · 0209 NULL · 0276 ausente |
| Generación determinista | verde |
| Vitest focal | verde · 1 archivo · 12/12 |
| TypeScript | verde |
| ESLint proporcional | verde |
| PostgreSQL 15 | verde · UPDATE 1/0 · 48 pares ACL · rollback |
| PostgreSQL 17 | verde · UPDATE 1/0 · 48 pares ACL · rollback |
| Build | verde · warning NFT preexistente y fallbacks por env local ausente |
| Docs + diff | `docs:check` y `git diff --check` verdes |
| Residuo Docker propio | cero |

La prueba crea las 48 firmas sintéticas y comprueba primero que la migración
sólo almacena el payload. Luego reproduce el sweep canónico, verifica que
PUBLIC y `anon` pierden EXECUTE, que `authenticated` y `service_role` lo
conservan, y termina con rollback total.

## 5. Allowlist aplicada

| Superficie | Archivo |
|---|---|
| Generador | `scripts/build-sdd-0118-repair.mjs` |
| Unit | `scripts/__tests__/build-sdd-0118-repair.test.ts` |
| Migración | `supabase/migrations/0276_restore_revoke_anon_rpc_sweep_history.sql` |
| DB test | `supabase/tests/0276_restore_revoke_anon_rpc_sweep_history.test.sql` |
| SDD replay | `docs/specs/0118-seed-migrations-idempotentes/spec.md` |
| SDD fixture | `docs/specs/0172-tenant-fixtures-lifecycle/spec.md` |
| Revisión | `docs/governance/reviews/aud-sdd-0118-revoke-anon-history.md` |
| Baseline | `docs/governance/BASELINE-2026-07-29-32.md` |
| Índice | `docs/governance/README.md` |

## 6. Criterios de promoción

Antes de aplicar:

1. autorización expresa que nombre
   `0276_restore_revoke_anon_rpc_sweep_history`;
2. preflight metadata-only fresco;
3. stop inmediato ante rojo, drift o estado diferente de `NULL`;
4. aplicación individual, nunca en bundle.

Después de aplicar:

1. cardinalidad uno y MD5 canónico;
2. recibo único de `0276`;
3. advisors de seguridad y rendimiento;
4. entorno efímero completamente nuevo para replay, seed, E2E, verificación
   y teardown terminal.

Está prohibido ejecutar `0209` manualmente sobre Producción o un branch
fallido, aplicar otra migración, alterar Auth, leer PII o abrir Vercel.

## 7. Veredicto técnico

REV-AUD-030 aprueba el diseño, el artefacto determinista y las pruebas locales
de `0276_restore_revoke_anon_rpc_sweep_history`.

Cloud permanece cerrado hasta recibir la autorización expresa del basename.
La atomicidad se limita a una transacción PostgreSQL sobre una fila del ledger
técnico; no se declara atomicidad con Auth ni con el control plane.

La aplicación de `0276` no sustituye la evidencia posterior de replay, seed,
E2E, verificación y teardown de SDD-0172. CMP-01 v1.1, caso deprecated, D1,
slices de adopción, D2–D5 y PLG-P3 permanecen cerrados. No existe plugin ni
marketplace.
