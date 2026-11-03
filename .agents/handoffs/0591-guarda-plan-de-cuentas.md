# Handoff — SDD-0591 · Cambiar el plan de cuentas queda para accounting y admin

- **Owner / sesión:** Claude Opus 5.5, `eeeb0433-bf95-4b6b-8cdc-d201699e5f95`. Es la sesión del Director, que hizo la tarea por pedido literal de Sam: «Haz esta tarea aquí: “Restringir quién puede cambiar la tabla de cuentas”».
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\guarda-accounts`
- **Rama:** `codex/guarda-accounts`, desde `origin/main` `1c2286f1f`
- **SDD:** 0591. Reserva local por plumbing: `sdd:next --reserve` se cancela porque GitHub corta la conexión a mitad del inventario de PR. El inventario sin reserva sí terminó y dio 0591.
- **Migración:** 0510. Las 0498 a 0509 están en ramas sin fusionar.

## Objetivo

Que solo `accounting` y `admin` puedan crear, cambiar o borrar cuentas de `public.accounts`, también por PostgREST. Es la condición que Sam aceptó al quitar el filtro de la 0497: antes del uso real del ERP.

## Alcance y aceptación

Allowlist y aceptación en `docs/specs/0591-guarda-plan-de-cuentas/spec.md`.

## Dependencias y permisos

- Sin orden obligatorio respecto de 0496 y 0497.
- **Producción:** solo lectura de catálogo y conteo de miembros por rol. No se escribió nada.
- **Aplicar la 0510:** ya aplicada el 2026-11-03 por el Director General, con el OK de Sam. Ver «Cierre del runbook §6».
- **Publicar:** PR contra `main`. La fusiona el Director General después de leer el CI.

## Validación

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Contrato, control rojo y mutantes en PGlite | PASÓ, 13 de 13 | `rls-escritura-accounts.migration.test.ts` |
| Contrato en `postgres:17` con psql | PASÓ, 101 aserciones | control rojo: `commercial-A pudo dar de alta en accounts` |
| Preflight contra el catálogo de producción | PASÓ, solo lectura y con ROLLBACK | 2026-11-02 |
| `docs:check`, `sdd:check`, `governance:check`, `pending-migration-symbols`, ESLint del archivo | PASÓ | |
| CI «Calidad continua» sobre `e8e87cd89` | PASÓ | lint, tsc, unitarios, build y gates |
| `check-schema-rebuild.mjs` | PASÓ | 474 migraciones desde cero; aislamiento en 219 tablas |
| `run-sql-tests.mjs` | FALLÓ: 3 rojos ajenos; la 0510 pasa | `0467_reversion_credito_carrera`, `0497_reverso_al_anular_factura` y su `_carrera`. Control: los mismos 3, con el mismo error, en `main` `1c2286f1f` |
| `pnpm verify` sobre `fcf2c6593`, corrido por el Director General | FALLÓ solo en `e2e`, por `sin-scroll-horizontal.spec.ts:119`: según él, el fallo conocido que corrige la #365, ya en `main`. `test`, `sql-tests`, `schema-rebuild` y `build` en OK; `migrations-applied` sin medir | Su reporte. No se repitió sobre la cabeza de este cierre |
| CI «Calidad local sin secretos» sobre `2c0d636bc` | PASÓ | Antes de este cierre. El de la cabeza final lo lee el Director General |
| Aplicar en producción | PASÓ, según la salida del apply que pasó el Director General | «Cierre del runbook §6» |

Un mutante sobrevivió la primera vuelta: el WITH CHECK de UPDATE sin el tenant. Faltaba una prueba, no sobraba código: si la sentencia lee alguna columna, Postgres aplica también la policy de SELECT a la fila nueva, y eso tapaba la falta. El contrato agregó el caso sin leer columnas.

## Cierre del runbook §6 (2026-11-03)

Lo hizo el Subdirector, con turno del Director General. La identidad la pasó él, de la salida del apply; este cierre no consultó producción. Comprobé contra el archivo el md5 y los bytes.

| Dato | Valor |
|---|---|
| COMMIT | 2026-11-03T17:02:55.956Z |
| `version` | `20261103170255` |
| md5 y bytes | `53c078ff06e1b1b889a1f79295ac10e1`, 12056 |
| Filas del ledger | 503 después de aplicar también la 0511, leído por el Director General. 502 después de la 0510 es **inferencia** |
| Respaldo previo | `dtd-cargo-20261103T170055Z` |
| Evidencia | `/srv/ops/evidencias/apply-0510-dtd-cargo-20261103T170254Z` |
| Ensayo en prueba | `ensayo-0510-0511-prueba-20261103T163820Z` y `0573-evidencia/ensayo-0510/` en las notas: 6 puntos PASÓ, según el Director General. Punto 5: se puso una cuenta sintética con rol `operations` y se devolvió. Sin ejecutar: asientos por pantalla |
| OK literal de Sam | «Autorizo: prueba y luego producción», en el chat del Director General, a «¿Autorizas aplicar las guardas contables 0510 y 0511 en dtd-cargo y fusionar sus PR #351 y #352?» |
| Merge | Pendiente: lo hace el Director General después de leer el CI |

**Lo que cambia en el repo:** `retirar-espera.mjs` con ese md5 la saca de `pendingBelowCutoff`, sin declaraciones de símbolos que quitar, y la sella con `ledger` exacta, sha256 `f236c923b22a11886ef2d780a3206243929a410e1c0daf294fb390f9c41dde20`. `migrations-lock.mjs` sale con 0. El `.sql` no se tocó.

**Lo que afirmaba la espera:** nada. `revisarAMano` salió vacía, y `git grep` de `0510_rls`, `0591`, «la 0510» y de comentarios con «todavía» o «sin aplicar» tampoco encontró nada en `lib`, `app`, `components`, `infra` y `scripts`. Las coincidencias de `0510` en `GenerateBLModal` son de otra spec, la SDD-0510.

## FUERA DE ALCANCE DETECTADO

1. `accounting` y `admin` todavía pueden hacer el PATCH por PostgREST. La regla «una cuenta con movimientos no se vuelve grupo» vive solo en `updateAccount`.
2. `journal_entries`, `journal_lines` y `company_bank_accounts` tienen el mismo hueco: policy FOR ALL que solo pide el tenant, medido en producción el 2026-11-02. Necesitan su propio inventario de escritores.

## Impacto documental

Spec nueva e índice de specs regenerado. Sin cambios en runbooks. Graphify y Archify: pendiente de registrar al cierre.
