# Restauración reproducible de `0103_calculator_settings`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-026 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Candidata | `0274_restore_calculator_settings_history` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada; R5 confirma reparación y revela próximo bloqueo |

## 1. Evidencia y causa

R4 avanzó a 120 migraciones y falló al llegar a:

```text
20260607034503 · calculator_settings_container_limits
```

El diagnóstico metadata-only comprobó que `public.calculator_settings` no
existía. Su prerequisito remoto está registrado como:

```text
20260604131310 · 0103_calculator_settings · statements = NULL
```

El replay no tenía payload que ejecutar y omitió la creación de tabla, policy,
trigger, seed y RPC. R4 fue eliminado terminalmente sin corrección manual.

## 2. Decisión

`0274` modifica exclusivamente
`supabase_migrations.schema_migrations.statements` para esa versión y nombre.
Convierte el `NULL` técnico en un array de un statement con el contenido
canónico de `0103_calculator_settings.sql`.

En Producción:

- no ejecuta `CREATE TABLE`, policy, trigger, seed o RPC;
- no escribe `calculator_settings` ni otra tabla de negocio;
- sólo almacena el texto que un branch futuro reproducirá;
- no modifica el archivo histórico.

## 3. Contrato fail-closed

| Estado | Valor |
|---|---|
| Versión | `20260604131310` |
| Nombre | `0103_calculator_settings` |
| Estado remoto | `statements IS NULL` |
| Digest MD5 final | `0f7deee22e3a978c52159b6fc211ee2c` |

Precondiciones:

- versión y nombre exactos;
- `statements IS NULL` o estado final conocido;
- cualquier cardinalidad o digest distinto aborta.

La escritura sólo ocurre cuando `statements IS NULL`. El estado final convierte
la segunda ejecución en no-op. La postcondición exige cardinalidad uno y el
digest canónico exacto.

## 4. Evidencia local

| Gate | Resultado |
|---|---|
| SHA-256 | `5e33ee512a20da3c0e9c1cf200cb3cb9a97cac51308578f4ed6a26724ac1ff89` |
| Tamaño | 8634 bytes |
| Generación determinista | verde |
| Vitest | 1 archivo · 8/8 |
| PostgreSQL 15 | verde · UPDATE 1 + UPDATE 0 + replay + rollback |
| PostgreSQL 17 | verde · UPDATE 1 + UPDATE 0 + replay + rollback |
| Residuo Docker propio | cero |

El replay contractual comprobó:

- tabla `public.calculator_settings`;
- FK tenant con `ON DELETE CASCADE` y FK `updated_by` hacia `auth.users`;
- ocho defaults y una fila sintética para el tenant `dtd`;
- RLS y policy tenant;
- grants SELECT/INSERT/UPDATE sin DELETE para `authenticated`;
- trigger `calculator_settings_touch`;
- RPC `public_calculator_config()` estable, `SECURITY DEFINER`,
  `search_path=public`, sin EXECUTE de PUBLIC y con EXECUTE de
  `anon`/`authenticated`;
- retorno mínimo con los ocho defaults esperados.

## 5. Allowlist aplicada

| Superficie | Archivo |
|---|---|
| Generador | `scripts/build-sdd-0118-repair.mjs` |
| Unit | `scripts/__tests__/build-sdd-0118-repair.test.ts` |
| Migración | `supabase/migrations/0274_restore_calculator_settings_history.sql` |
| DB test | `supabase/tests/0274_restore_calculator_settings_history.test.sql` |
| SDD replay | `docs/specs/0118-seed-migrations-idempotentes/spec.md` |
| SDD fixture | `docs/specs/0172-tenant-fixtures-lifecycle/spec.md` |
| Revisión | `docs/governance/reviews/aud-sdd-0118-calculator-settings-history.md` |
| Baseline | `docs/governance/BASELINE-2026-07-29-26.md` |
| Índice | `docs/governance/README.md` |

## 6. Veredicto

REV-AUD-026 aprueba técnicamente el diseño, artefacto determinista y pruebas
locales de `0274_restore_calculator_settings_history`.

La aplicación individual y su postflight están registrados en
[REV-AUD-027](aud-sdd-0118-calculator-settings-history-application.md).

R5 confirmó que `0274` reparó `0103`: el replay avanzó de 120 a 266
migraciones. El siguiente bloqueo es independiente: `0262` detectó que dos
funciones trigger de comments no tienen `search_path=public` porque
`0210_pin_search_path_triggers` está registrado con `statements = NULL`.
R5 fue eliminado terminalmente; la evidencia vive en
[REV-AUD-019](aud-tenant-fixtures-ephemeral-validation.md).

El próximo gate es diseñar y validar localmente una reparación forward-only
del payload reproducible de `0210`, y obtener autorización expresa del nuevo
basename antes de aplicarla.

CMP-01 v1.1, caso deprecated, D1, slices de adopción, D2–D5, Vercel y PLG-P3
permanecen cerrados. No existe plugin ni marketplace.
