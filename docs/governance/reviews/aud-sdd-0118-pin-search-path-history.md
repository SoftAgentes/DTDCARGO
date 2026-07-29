# Restauración reproducible de `0210_pin_search_path_triggers`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-028 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Candidata | `0275_restore_pin_search_path_history` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada; nuevo efímero pendiente |

## 1. Evidencia y causa

R5 avanzó hasta 266 migraciones y falló cerrado en el preflight de
`0262_comments_lifecycle_contract`:

```text
DB-1 detectó drift en propiedades de funciones comments
```

El diagnóstico metadata-only comprobó que
`comments_freeze_immutable()` y `comments_validate_entity()` existen pero
tienen `proconfig = NULL`. La entrada que debía fijar sus propiedades está
registrada una sola vez como:

```text
20260703235255 · 0210_pin_search_path_triggers · statements = NULL
```

El archivo histórico canónico contiene 33
`ALTER FUNCTION ... SET search_path = public`. R5 fue eliminado
terminalmente; no se corrigió el branch manualmente.

## 2. Decisión forward-only

`0275` modifica exclusivamente
`supabase_migrations.schema_migrations.statements` para la versión y nombre
exactos de `0210`.

En una aplicación futura a Producción:

- no ejecuta ninguno de los 33 `ALTER FUNCTION`;
- no cambia cuerpos, owners, grants, RLS, Auth ni filas de negocio;
- sólo almacena el archivo canónico como un elemento `text[]`;
- no modifica ni reordena el archivo histórico;
- permite que un branch nuevo reproduzca el hardening en su secuencia normal.

## 3. Contrato fail-closed

| Estado | Valor |
|---|---|
| Versión | `20260703235255` |
| Nombre | `0210_pin_search_path_triggers` |
| Estado remoto | `statements IS NULL` |
| MD5 canónico | `c3131d8ea3756049d6455bc98b4d0ecc` |
| SHA-256 de 0275 | `83675cddbd1d3e48354e423f2a6247771394865436d0af33ab09e1994bcebf2b` |
| Tamaño de 0275 | 5121 bytes |

La precondición admite únicamente `NULL` o el estado final conocido. La
escritura sólo ocurre sobre `NULL`; la segunda ejecución es no-op. Cualquier
cardinalidad, nombre, versión o digest distinto aborta. La postcondición exige
cardinalidad uno y el MD5 canónico.

El generador también exige:

- exactamente 33 firmas `public`;
- cero firmas duplicadas;
- 32 funciones sin argumentos;
- una única firma con argumentos:
  `validate_operario_pin_format(p_pin text)`;
- presencia de las dos funciones que bloquean `0262`.

## 4. Evidencia local

| Gate | Resultado |
|---|---|
| Generación determinista | verde · `node scripts/build-sdd-0118-repair.mjs --check` |
| Vitest focal | verde · 1 archivo · 10/10 |
| TypeScript | verde |
| ESLint proporcional | verde |
| PostgreSQL 15 | verde · UPDATE 1 + UPDATE 0 + 33 ALTER + rollback |
| PostgreSQL 17 | verde · UPDATE 1 + UPDATE 0 + 33 ALTER + rollback |
| Residuo Docker propio | cero |

La prueba transaccional demuestra que la migración almacena el payload sin
ejecutarlo. Después crea 33 funciones sintéticas, reproduce el contenido
almacenado, verifica `search_path=public` en cada firma y termina con rollback
total.

## 5. Allowlist aplicada

| Superficie | Archivo |
|---|---|
| Generador | `scripts/build-sdd-0118-repair.mjs` |
| Unit | `scripts/__tests__/build-sdd-0118-repair.test.ts` |
| Migración | `supabase/migrations/0275_restore_pin_search_path_history.sql` |
| DB test | `supabase/tests/0275_restore_pin_search_path_history.test.sql` |
| SDD replay | `docs/specs/0118-seed-migrations-idempotentes/spec.md` |
| SDD fixture | `docs/specs/0172-tenant-fixtures-lifecycle/spec.md` |
| Revisión | `docs/governance/reviews/aud-sdd-0118-pin-search-path-history.md` |
| Baseline | `docs/governance/BASELINE-2026-07-29-29.md` |
| Índice | `docs/governance/README.md` |

## 6. Criterios de promoción

Antes de aplicar:

1. autorización expresa que nombre
   `0275_restore_pin_search_path_history`;
2. preflight metadata-only fresco;
3. stop inmediato ante rojo, drift o estado diferente de `NULL`;
4. aplicación individual, nunca en bundle.

Después de aplicar:

1. cardinalidad uno y MD5 canónico;
2. recibo único de `0275`;
3. advisors de seguridad y rendimiento;
4. entorno efímero completamente nuevo para replay, seed, E2E, verificación
   y teardown terminal.

Está prohibido ejecutar `0210` manualmente sobre Producción o un branch
fallido, aplicar otra migración, alterar Auth, leer PII o abrir Vercel.

## 7. Veredicto técnico

REV-AUD-028 aprueba el diseño, el artefacto determinista y las pruebas locales
de `0275_restore_pin_search_path_history`.

La aplicación individual y su postflight están registrados en
[REV-AUD-029](aud-sdd-0118-pin-search-path-history-application.md). La
atomicidad se limita a una transacción PostgreSQL sobre una fila del ledger
técnico; no se declara atomicidad con Auth ni con el control plane.

El próximo gate es crear un entorno efímero totalmente nuevo para continuar
SDD-0172. La aplicación de `0275` no sustituye la evidencia de replay, seed,
E2E, verificación y teardown terminal.

CMP-01 v1.1, caso deprecated, D1, slices de adopción, D2–D5 y PLG-P3
permanecen cerrados. No existe plugin ni marketplace.
