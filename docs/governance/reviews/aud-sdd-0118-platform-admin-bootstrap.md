# Reparación replay-safe de `platform_admins`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-024 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Candidata | `0273_skip_platform_admin_bootstrap_history` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada; nuevo branch pendiente |

## 1. Evidencia y causa

El tercer branch efímero avanzó a 83 migraciones y falló al ejecutar:

```text
20260529071707 · platform_admins
```

PostgreSQL registró una violación de
`platform_admins_user_id_fkey`. El payload histórico crea correctamente tabla,
FK, RLS, policies, grants y `is_platform_admin()`, pero termina insertando un
UUID fijo de Auth que no existe en un branch nuevo sin datos.

El teardown R3 fue terminal y no se intentó fabricar esa identidad.

## 2. Decisión

`0273` modifica exclusivamente
`supabase_migrations.schema_migrations.statements` para esa versión y nombre.
El payload final:

- conserva todo el DDL canónico;
- elimina el INSERT de bootstrap y su identificador fijo;
- deja explícito que la membresía de plataforma se provisiona fuera del
  replay del schema;
- no elimina ni modifica la fila real que ya existe en Producción;
- no ejecuta el DDL almacenado sobre el proyecto padre.

El archivo histórico `0058_platform_admins.sql` permanece inmutable.

## 3. Contrato fail-closed

| Estado | Digest MD5 |
|---|---|
| Remoto observado | `6c31b8ac8841b24815e3fb2463eabdd2` |
| Fuente canónica normalizada | `bb99b54106d671457836daa0dc53b839` |
| Payload final replay-safe | `cb374d4ad4c3b2bb62915e80a5a13793` |

Precondiciones:

- versión `20260529071707`;
- nombre `platform_admins`;
- cardinalidad exacta de un statement;
- digest remoto, canónico o final conocido.

La escritura sólo acepta los dos digests fuente. El digest final convierte la
segunda ejecución en no-op. Cualquier otro estado aborta toda la transacción.

## 4. Evidencia local

| Gate | Resultado |
|---|---|
| SHA-256 | `27b37488283d8dd12dbe754950be33916b323b202b6e97a4c69b08478a355942` |
| Tamaño | 4585 bytes |
| Generación determinista | verde |
| Vitest | 1 archivo · 6/6 |
| PostgreSQL 15 | verde · UPDATE 1 + UPDATE 0 + replay + rollback |
| PostgreSQL 17 | verde · UPDATE 1 + UPDATE 0 + replay + rollback |
| Residuo Docker propio | cero |

El replay contractual se ejecutó con `auth.users` vacío y comprobó:

- tabla `public.platform_admins`;
- FK hacia `auth.users` con `ON DELETE CASCADE`;
- RLS habilitado;
- dos policies esperadas;
- grants de `authenticated` y `service_role`;
- función `is_platform_admin()` como `SECURITY DEFINER` y
  `search_path=public`;
- cero filas `platform_admins`.

## 5. Allowlist aplicada

| Superficie | Archivo |
|---|---|
| Generador | `scripts/build-sdd-0118-repair.mjs` |
| Unit | `scripts/__tests__/build-sdd-0118-repair.test.ts` |
| Migración | `supabase/migrations/0273_skip_platform_admin_bootstrap_history.sql` |
| DB test | `supabase/tests/0273_skip_platform_admin_bootstrap_history.test.sql` |
| SDD replay | `docs/specs/0118-seed-migrations-idempotentes/spec.md` |
| SDD fixture | `docs/specs/0172-tenant-fixtures-lifecycle/spec.md` |
| Revisión | `docs/governance/reviews/aud-sdd-0118-platform-admin-bootstrap.md` |
| Baseline | `docs/governance/BASELINE-2026-07-29-23.md` |
| Índice | `docs/governance/README.md` |

## 6. Veredicto

REV-AUD-024 aprueba técnicamente el diseño, el artefacto determinista y las
pruebas locales de `0273_skip_platform_admin_bootstrap_history`.

La aplicación individual y su postflight están registrados en
[REV-AUD-025](aud-sdd-0118-platform-admin-bootstrap-application.md). El próximo
gate es crear otro entorno efímero para continuar SDD-0172.

CMP-01 v1.1, caso deprecated, D1, slices de adopción, D2–D5, Vercel y PLG-P3
permanecen cerrados. No existe plugin ni marketplace.
