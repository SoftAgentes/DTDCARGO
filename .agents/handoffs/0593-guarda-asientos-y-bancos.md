# Handoff — SDD-0593 · Escribir asientos queda para accounting y admin; las cuentas bancarias, por su RPC

- **Owner / sesión:** Claude Opus 5.5, `eeeb0433-bf95-4b6b-8cdc-d201699e5f95`. Es la sesión del Director, que hizo la tarea por pedido literal de Sam: «Haz esta tarea aquí: “Restringir quién escribe asientos y cuentas bancarias”».
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\guarda-asientos`
- **Rama:** `codex/guarda-asientos`, desde `origin/main` `1c2286f1f`
- **SDD:** 0593. Reserva local por plumbing, igual que la 0591.
- **Migración:** 0511. La 0510 es de la SDD-0591, rama `codex/guarda-accounts`. Las dos ramas no comparten archivos salvo `supabase/migrations-baseline.json` y `docs/specs/README.md`.

## Objetivo

Que solo `accounting` y `admin` escriban asientos por el cliente de sesión, que las líneas solo se inserten, y que las cuentas bancarias de la empresa solo se escriban por `audit_d1_execute`.

## Alcance y aceptación

Allowlist y aceptación en `docs/specs/0593-guarda-asientos-y-bancos/spec.md`.

## Dependencias y permisos

- Sin dependencia de cuerpos de la 0497; va después en el orden del ledger.
- **Producción:** solo lectura de catálogo y conteos, sin filas. No se escribió nada.
- **Aplicar la 0511:** ya aplicada el 2026-11-03 por el Director General, con el OK de Sam. Ver «Cierre del runbook §6».
- **Publicar:** PR contra `main`. La fusiona el Director General después de leer el CI.

## Validación

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Contrato, control rojo y mutantes en PGlite | PASÓ, 20 de 20 | `rls-escritura-asientos-y-bancos.migration.test.ts` |
| Contrato en `postgres:17` con psql | PASÓ, 175 aserciones | control rojo: `commercial-A pudo crear un asiento` |
| Preflight contra el catálogo de producción | PASÓ, solo lectura y con ROLLBACK | 2026-11-02 |
| `docs:check`, `sdd:check`, `governance:check`, `pending-migration-symbols`, ESLint del archivo | PASÓ | |
| `check-schema-rebuild.mjs` | PASÓ | 474 migraciones desde cero; aislamiento en 219 tablas |
| `run-sql-tests.mjs` | FALLÓ: 3 rojos ajenos; la 0511 pasa | `0467_reversion_credito_carrera`, `0497_reverso_al_anular_factura` y su `_carrera`. Control: los mismos 3, con el mismo error, en `main` `1c2286f1f` |
| `pnpm verify` sobre `1f2c58a08`, corrido por el Director General | FALLÓ, exit 1, solo en `e2e`: `sin-scroll-horizontal.spec.ts:119`, el rojo conocido que corrige la #365, y flaky `auth.spec.ts:81`; 217 pasan. El reintento se colgó y lo cortó el watchdog, sin causa medida. PASÓ lint, typecheck, edge-functions, `test` (883 archivos, 13352 pruebas), `sql-tests`, `schema-rebuild` y `build`. `migrations-applied` NO EJECUTADO, sin credenciales | Su comentario en la PR. No se repitió sobre la cabeza de este cierre |
| Aplicar en producción | PASÓ, según la salida del apply que pasó el Director General | «Cierre del runbook §6» |

**Límite:** `audit_d1_execute` es un doble en el contrato; el preflight comprueba en producción que la real es DEFINER de postgres. Esa pantalla se probó en prueba el 2026-11-03: guardar, recargar, editar y borrar una cuenta bancaria como administrador pasó (`0573-evidencia/ensayo-0510/pantallas.out`). Asientos por pantalla: sin ejecutar.

La misma lección de la SDD-0591 con el WITH CHECK de UPDATE: el contrato agregó el caso que no lee columnas.

## Cierre del runbook §6 (2026-11-03)

Lo hizo el Subdirector, con turno del Director General. La identidad la pasó él, de la salida del apply; este cierre no consultó producción. Comprobé contra el archivo el md5 y los bytes.

| Dato | Valor |
|---|---|
| COMMIT | 2026-11-03T17:03:14.436Z |
| `version` | `20261103170314` |
| md5 y bytes | `f9522a5b7550940e1fc96cc3bcba776e`, 16896 |
| Filas del ledger | 503, leído por el Director General |
| Respaldo previo | `dtd-cargo-20261103T170055Z` |
| Evidencia | `/srv/ops/evidencias/apply-0511-dtd-cargo-20261103T170313Z` |
| Ensayo en prueba | `ensayo-0510-0511-prueba-20261103T163820Z` y `0573-evidencia/ensayo-0510/` en las notas: 6 puntos PASÓ, según el Director General. Punto 5: se puso una cuenta sintética con rol `operations` y se devolvió. Sin ejecutar: asientos por pantalla. En `pantallas.out` consta 1 FALLÓ: un clic con tiempo agotado al editar una cuenta contable; la repetición en `cuenta.out` dio 4 de 4 |
| OK literal de Sam | «Autorizo: prueba y luego producción», en el chat del Director General, a «¿Autorizas aplicar las guardas contables 0510 y 0511 en dtd-cargo y fusionar sus PR #351 y #352?» |
| Merge | #352, 2026-11-03T20:01:19Z, `8b6b3a0e1`, por el Director General |

**Lo que cambia en el repo:** `retirar-espera.mjs` con ese md5 la saca de `pendingBelowCutoff`, sin declaraciones de símbolos que quitar, y la sella con `ledger` exacta, sha256 `819e9912e1fb005cfcc1fd52cd3b7178be4a0966bf4d2bd4750154a0f8535be7`. `migrations-lock.mjs` sale con 0. El `.sql` no se tocó. También anota la hora del merge de la #351 en el registro de la SDD-0591.

**Lo que afirmaba la espera:** nada. `revisarAMano` salió vacía, y `git grep` de `0511_rls`, `0593`, «la 0511» y de comentarios con «todavía» o «sin aplicar» sobre asientos o cuentas bancarias tampoco encontró nada en `lib`, `app`, `components`, `infra` y `scripts`.

## FUERA DE ALCANCE DETECTADO

1. `accounting` y `admin` todavía pueden alterar un asiento asentado por PATCH a `journal_entries`.
2. `company_offices` y otras tablas sin medir pueden tener el mismo patrón: conviene un barrido por catálogo.
3. La lectura de asientos sigue siendo de todo el equipo, deuda deliberada de la 0407.

## Impacto documental

Spec nueva e índice de specs regenerado. Sin cambios en runbooks. Graphify y Archify: pendiente de registrar al cierre.
