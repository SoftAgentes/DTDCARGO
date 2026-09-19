# Handoff 0478 · seguimiento 3 — La carrera del `for update` de la 0459, automatizada

- Fecha: 2026-09-18. Estado de la tarea: **lista para revisión**. Se publica con este head, en el
  turno de integración que dio el Director: un solo push y la PR lista para revisión.
- Owner/sesión: `worker-carrera-for-update-0459-20260918` (Claude Opus 5, Worker, sesión «Automatizar
  la prueba de carrera del for update de 0459» [7a0aa1]). Director: `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-for-update-0459`, creado
  con `harness-worktree start`.
- Rama: `codex/carrera-for-update-0459`, desde `origin/main` = `cc15e48c`.
- SDD: [0478](../../docs/specs/0478-tarifa-programada-a-futuro/spec.md), seguimiento 3. El Director
  decidió colgarlo de la 0478, sin número nuevo. Este handoff es propio; el de la 0478 no se
  reescribe.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK` y claim
  adquirido con el owner de arriba. Antes de los commits se revalidó con `guard --owner`.
- Permisos del encargo: commits en esta rama; push de la rama propia y PR contra `main` después de
  reportarle al Director. **No merge. No producción.** La 0459 está aplicada (ledger
  `20260918155832`) y no se edita: blob `3508282b`, md5 `ed65e847`, 13.483 bytes, igual antes y
  después de esta tarea.

## OBJETIVO ORIGINAL

Convertir en test automático la prueba de carrera de dos sesiones del `for update` de la 0459 (anexo
del handoff 0478). Tiene que fallar con el mutante sin `for update` (control rojo) y pasar con el
`.sql` real. Los contratos de PGlite no la detectan porque tienen una sola conexión.

## COMPLETADO

- **`supabase/tests/0459_relevo_carrera_for_update.test.sql`**, un contrato más de la suite SQL
  local que corre `verify` (paso `sql-tests`, `postgres:17` en Docker). No toca el runner, ni
  `verify.mjs`, ni el CI. El Director aprobó la ubicación.
- **Tres sesiones reales con `dblink`** (contrib de la imagen) contra una base propia
  (`dtd_carrera_0459`): `s` prepara y observa, `f` es el founder y `j` es el job.
- **La barrera es determinista, sin `sleep`.** `f` cancela la programada y deja la transacción
  abierta. `j` corre `promover_tarifas_programadas()` en asíncrono, y `f` confirma recién cuando
  `pg_blocking_pids(j)` lo contiene. Si `j` termina sin esperar, o no queda bloqueado en 10 s, el
  test falla con «la carrera no ocurrió».
- **Piezas reales**, leídas con `pg_read_file` del montaje `/sb` como en la 0460: el índice
  singleton de 0255, el guard de listas de 0382 con su trigger, la 0458 entera y la 0459 entera.
- **Tres cancelaciones con la 0459 tal cual**: desprogramar, posponer una semana y archivar. En las
  tres, el relevo devuelve `[]`, `rates` queda como la dejó el founder y el sitio cotiza $850.
- **Un control en la misma corrida.** Se toma la función instalada, se le quita el `for update`
  (derivado de `pg_get_functiondef`) y se corren los mismos tres casos: tiene que publicar la $900
  cancelada. Si no la publica, el escenario dejó de ejercer la carrera y el test falla. Así un verde
  nunca puede ser vacío.
- **Sin huella, también cuando falla**, porque los archivos siguientes comparten el clúster:
  - El fixture viaja como una sola consulta simple de varias sentencias: es una transacción, y si
    falla no queda ningún rol.
  - Toda la corrida está dentro de un bloque con manejador. Ante cualquier error, incluidos
    `query_canceled` y `assert_failure`, desconecta las sesiones, borra la base
    (`with (force)`, que termina a `f` y a `j` si quedaron esperando) y los tres roles, y recién
    entonces propaga el error.
  - `dblink` se crea dentro de la transacción del archivo y se va con el `rollback`: nunca se
    confirma, así que no hace falta `drop extension`.
  - Al final, el archivo afirma que no quedó ni la base, ni los roles, ni `dblink`.
- **Guarda de clúster desechable**: si ya existen `anon`, `authenticated` o `service_role`, aborta
  sin tocar nada. No borra roles que no creó.
- **Seguimiento 3 de la spec 0478** marcado como cumplido, con fecha. Es una línea, como pidió el
  Director. Después, a pedido suyo, la allowlist exacta de la 0478 suma dos filas: el test y este
  handoff.

### Pedidos del Director y cómo quedaron

| Pedido | Resultado |
| --- | --- |
| Todos los archivos comparten la base `postgres`: limpiar la base, los roles y `drop extension dblink` | Base y roles: se borran en el camino feliz y en el de error. `dblink` nunca se confirma, porque vive en la transacción del archivo. El cierre lo afirma y la huella medida lo confirma (ver Validación) |
| Roles con nombres únicos con prefijo del test | **No se puede.** La 0458 y la 0459 nombran `anon`, `authenticated` y `service_role` en sus `grant`/`revoke`. En su lugar: la guarda exige que no existan antes, el fixture los crea en una transacción atómica y la limpieza los borra |
| Cubrir también el fixture y la creación de la base, no solo la carrera | Todo corre dentro del bloque protegido: la creación de la base, el fixture, las carreras y el control. Se probó con un fixture roto y con una barrera que no se cumple (ver Validación) |
| El mutante no puede quedar en `supabase/tests/` como `.test.sql` | Vive fuera del repo. El comando está en «Control rojo reproducible» |
| Que ningún Vitest recorra `supabase/tests/*.test.sql` con un glob | **Confirmado.** El único que los recorre es `scripts/run-sql-tests.mjs`. Los Vitest de PGlite leen archivos por nombre (`identity-photo-replacement.migration.test.ts` lee la 0461). `check-schema-rebuild.mjs` solo lee `_supabase-platform-stubs.sql`. `vitest.config.ts` no incluye `.sql` |
| Evidencia: el runner con el archivo en ✓ y los demás intactos; el control rojo; cuánto tarda | En Validación |
| Una sola corrida pesada a la vez (regla nueva del Director) | Rige desde que terminó el `verify` de esta rama. Después solo se corrieron pruebas focales |
| Turno de integración: dos filas en la allowlist, merge de `origin/main` (`1b64bdae`) sin rebase, chequeos livianos, un solo push y PR lista para revisión | Allowlist en `d47bc3d0`, merge en `2473d0be` y chequeos en Validación. El push y la PR van con el head que contiene este documento |

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El archivo solo, con los flags de Docker del runner (27 aserciones) | **PASÓ.** La sesión de psql dura 2,3 s y el bloque principal 1,4 s, según el log del servidor (`log_min_duration_statement=0`). En cada carrera el relevo esperó al founder entre 11 y 14 ms. Con la CPU saturada, el bloque llegó a 4,6 s. El arranque de `docker exec` se suma aparte: lo paga cualquier archivo del runner |
| Runner real con solo este archivo, sobre una copia de `supabase/` fuera del repo con la 0459 intacta | **PASÓ** — ✓, 7,1 s con contenedor incluido |
| Runner real, suite completa en el worktree (`node scripts/run-sql-tests.mjs`) | **PASÓ** — 200 de 200 ✓, 0 ✗, 188 s. Los que corren después (0460 y 0461) siguen en verde |
| **Control rojo**: la 0459 sin la línea `for update` (el diff es solo la línea 218), por el runner real | **FALLÓ, como tenía que fallar** — ✗ con «desprogramar: el relevo publicó la tarifa que el founder canceló mientras corría (¿falta el for update?)». La $850 quedó despublicada, la $900 pública y el sitio cotiza 900; el relevo devolvió la $900 con `relevadas: 1` |
| Huella tras un fallo: bases, roles, extensiones y sesiones del clúster después del archivo | **PASÓ en los cuatro modos.** Rojo, fixture roto (la 0458 terminada en una función inexistente) y barrera incumplida (el founder no toca la programada y deja la transacción abierta): queda `postgres,template0,template1`, sin roles, solo `plpgsql` y 0 sesiones. Guarda (el clúster ya tenía `anon`): aborta antes de tocar nada y **conserva** `anon` |
| Identidad de la 0459 | Sin cambios: blob `3508282b`, md5 `ed65e847`, 13.483 bytes |
| Ningún Vitest recorre `supabase/tests/*.test.sql` | **PASÓ** (búsqueda en el repo; ver «Pedidos del Director») |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ** — 468 specs, índice sin cambios, sin números repetidos, cápsula vigente |
| `pnpm verify` sobre `03b34f08` (35 min) | **exit 1**: 16 de 17 pasos medidos y un solo fallo, `test`. Detalle en las filas siguientes |
| › harness, lint, rsc-boundary, typecheck, edge-functions | **PASÓ** |
| › test | **FALLÓ** en el intento y en el reintento (23 casos y después 8) en tres archivos ajenos a esta rama. `app/p/[token]/PackingListProductsStep.test.tsx` y `app/p/[token]/supplier-flow.test.tsx` caen por timeouts de 20 s, y varios casos más fallan en decenas de ms con el `<body>` vacío. El tercero es `app/studio/(app)/clientes/_components/ClientDrawer.confirm-delete.test.tsx`. Son **intermitencias conocidas** que corrige la SDD-0486, según el Director. El diff de esta rama no toca `app/` |
| › las tres, aisladas sobre el mismo SHA (`--pool=threads --maxWorkers=1`) | **PASÓ** — 9/9 (15 s), 23/23 (63 s), 9/9 (26 s) |
| › docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols | **PASÓ** (símbolos: 0 ROJO · 0 AMARILLO) |
| › migrations-applied | **NO EJECUTADO** — `[SKIP]` sin credenciales; no se copian credenciales de producción |
| › sql-tests | **PASÓ** — 200 contratos, este incluido |
| › schema-rebuild | **PASÓ** — 458 migraciones: 440 aplicadas desde cero y 18 solo-ledger; aislamiento multi-tenant verificado |
| › e2e | **PASÓ** — 167 ✓, 18 omitidas y 1 flaky ajena (`calculadora-semantic-colors`, verde en el reintento), contra el Supabase sintético deny-only (SDD-0479). El resumen no la declara parcial |
| › build | **PASÓ** — build de producción OK; el paso restauró `tsconfig.json` |
| Carga | El paso `test` de este `verify` levantó entre 20 y 24 workers de vitest y saturó la máquina, según vio otro Worker. Desde entonces rige la regla del Director de una sola corrida pesada a la vez |
| Merge de `origin/main` (`1b64bdae`, PR #147) → `2473d0be` | **PASÓ** — sin conflictos y sin tocar `supabase/`. El diff neto contra `main` son los tres archivos de esta tarea |
| Después del merge: `docs:check` / `sdd:check` / `governance:check` / `pending-migration-symbols` / `git diff --check` | **PASÓ** — 468 specs, sin números repetidos, cápsula vigente, 0 ROJO · 0 AMARILLO |
| Después del merge: este archivo solo, por el runner real (andamiaje verde) | **PASÓ** — ✓. El runner tardó 225 s con la máquina ocupada por otros turnos; antes, 7,1 s |
| CI alojado | **NO EJECUTADO todavía**: la rama no está publicada. El resultado del head publicado se reporta por mensaje |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `a916797a` | `test(db)`: el contrato de concurrencia |
| `03b34f08` | `docs(SDD-0478)`: seguimiento 3 cumplido |
| `c62a419f` | `docs(handoff)`: la primera versión de este handoff, la del reporte previo a la PR |
| `d47bc3d0` | `docs(SDD-0478)`: la allowlist nombra el test y este handoff |
| `2473d0be` | merge de `origin/main` (`1b64bdae`, PR #147), sin rebase |
| el commit que contiene este documento | `docs(handoff)`: el turno de integración |

## PR / BRANCH

- Rama `codex/carrera-for-update-0459`, base `main`, worktree de arriba. Se publica con el head que
  contiene este documento, en un solo push, y la PR se abre lista para revisión (no draft). Su número,
  el SHA y el CI van por mensaje, para no mover el head revisado.

## PENDIENTES DE ESTA TAREA

1. El push y la PR, justo después de este commit (turno ya dado por el Director).
2. Reportar por mensaje el número de la PR, el SHA y el resultado de «Calidad local sin secretos»
   sobre el head publicado.
3. Integrar: lo hace el Director. La PR de baterías (`dtdcargo-d5`) entra primero; si esta queda
   detrás de `main`, el Director la actualiza desde GitHub y no hace falta otro push.

## FUERA DE ALCANCE DETECTADO

1. **La 0460 declara sin probar la concurrencia de su RPC.** Su contrato dice: «la concurrencia
   (SKIP LOCKED entre dos corridas) no se prueba en una sola sesión de psql». El mismo patrón de
   este archivo la cubriría: `dblink`, `pg_blocking_pids` y limpieza protegida. Es tarea propia.
2. **La 0421 y la 0427 dependen de evidencia manual de bloqueo.** Tienen modos opt-in
   (`fixture_only`, `keep_fixture`) para dejar el fixture y probar a mano con sesiones separadas. La
   0421 lo dice: «este contrato transaccional no sustituye esa evidencia». Son candidatas al mismo
   patrón.
3. **`verify` no corre `scripts/check-public-verify-concurrency.mjs` (SDD-0375).** Es la prueba de
   concurrencia de la reserva atómica, con barreras por `pg_stat_activity`, y hoy solo corre a mano.
4. **El runner resume con «rollback total».** Este archivo no revierte su base propia: la borra y
   comprueba que no quedó nada. Para los archivos siguientes el efecto es el mismo, pero la frase ya
   no describe a todos. No se tocó el runner.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0478, con una línea fechada en Seguimiento 3. El índice
  `docs/specs/README.md` no cambia, porque no cambian ni el título ni el estado (`docs:check` en
  verde).
- **Documentación en código:** la cabecera del `.test.sql` explica qué defiende, cómo, la limpieza y
  sus límites.
- **No aplica:** `BRAND.md` y `docs/design/**` (no hay UI), `docs/marketing/**`, `docs/governance/**`
  (no hay política nueva) y los runbooks (el runner no cambia).
- **Propuesta de conocimiento, no decisión:** el patrón de carrera para contratos SQL (`dblink`,
  barrera por `pg_blocking_pids`, limpieza protegida y control en la misma corrida) podría
  documentarse junto al docstring de `scripts/run-sql-tests.mjs` o en `docs/engineering/project-rules.md`.
  Motivo: sirve para los puntos 1 a 3 de «Fuera de alcance detectado». Lo decide el Director.
- **Graphify: NO EJECUTADO.** Por indicación del Director, lo publica él desde `main` después de
  integrar, como pide el runbook. En este worktree nuevo, `knowledge:status` da estructura INVALID
  porque no hay `graphify-out` (4.229 pendientes, 3.125 faltantes), lo esperable sin derivados.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff, así que esta tarea no debe
  recibo.
- **Archify: NO EJECUTADO.** El mapa `knowledge-lifecycle` no depende de estas fuentes, y el runtime
  no está en este worktree; bajarlo requiere un permiso aparte.
- **Vista previa de Obsidian: NO EJECUTADO.** Es una corrida pesada y la bóveda la publica el
  Director desde `main`.

## Control rojo reproducible (fuera del repo)

El mutante no vive en el repo. Este script arma una copia mínima de `supabase/` en una carpeta
nueva, con la 0459 sin la línea `for update`, y la pasa por el runner real. Tiene que salir ✗. Con
`VARIANTE=verde` copia la 0459 intacta y tiene que salir ✓: el mismo andamiaje sirve para correr
este archivo solo.

```bash
bash rojo-0459.sh "<worktree>" "<carpeta-nueva-fuera-del-repo>"
VARIANTE=verde bash rojo-0459.sh "<worktree>" "<otra-carpeta-nueva>"
```

```bash
#!/usr/bin/env bash
# Control rojo de supabase/tests/0459_relevo_carrera_for_update.test.sql, fuera del repo.
# Arma una copia mínima de supabase/ con la 0459 SIN la línea `for update` y la
# pasa por el runner real (scripts/run-sql-tests.mjs). Tiene que salir ✗.
# Con VARIANTE=verde copia la 0459 intacta: tiene que salir ✓ (mismo andamiaje).
# Uso: bash rojo-0459.sh <worktree> <carpeta-destino-nueva>
set -euo pipefail
W="$1"
D="$2"
mkdir "$D"   # falla si ya existe: nunca se reutiliza ni se borra nada
mkdir -p "$D/supabase/migrations" "$D/supabase/tests"
for m in 0255_rates_public_calc_modo 0382_price_books 0458_tarifa_lectura_sin_vigencia; do
  cp "$W/supabase/migrations/$m.sql" "$D/supabase/migrations/"
done
M=0459_tarifa_programada_a_futuro.sql
if [ "${VARIANTE:-rojo}" = verde ]; then
  cp "$W/supabase/migrations/$M" "$D/supabase/migrations/$M"
else
  sed '/^     for update$/d' "$W/supabase/migrations/$M" > "$D/supabase/migrations/$M"
fi
echo "== diff de la 0459 (${VARIANTE:-rojo}):"
diff "$W/supabase/migrations/$M" "$D/supabase/migrations/$M" || true
cp "$W/supabase/tests/0459_relevo_carrera_for_update.test.sql" "$D/supabase/tests/"
cd "$D"
start=$(date +%s%3N)
set +e
node "$W/scripts/run-sql-tests.mjs"
rc=$?
set -e
echo "== runner exit $rc en $(( $(date +%s%3N) - start )) ms"
exit $rc
```

Corrida registrada, el 2026-09-18 sobre este worktree: el diff mostró `218d217 <      for update`
y el runner salió con exit 1 y el ✗ citado en Validación. Con `VARIANTE=verde`, el diff salió vacío
y el runner dio ✓ con exit 0.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR e integrarla después de la de baterías. Los textos 0447/0458
  ya están en `main` y en esta rama (merge `2473d0be`). Los hallazgos 1 a 3 de «Fuera de alcance
  detectado» los anotó el Director como candidatos a la tarea siguiente, con este mismo patrón.
- **Cambios compartidos:** un archivo nuevo en `supabase/tests/`, que el runner descubre solo, y una
  línea en la spec 0478. Riesgo medido para la suite: ninguno. El archivo deja el clúster como
  estaba y lo afirma, y la suite completa pasó 200 de 200 con los siguientes en verde.
- **Dependencia:** `dblink` en la imagen del runner (`postgres:17`, 17.11). Si alguien cambia
  `SQL_TEST_PG_IMAGE` por una imagen sin contrib, este archivo falla en vez de hacer SKIP. Es
  deliberado: sin `dblink` la propiedad no se mide.
- **Conocimiento:** Graphify, Archify y la bóveda quedan para la publicación del Director desde
  `main`.
- **Sesiones consumidoras:** ninguna. El claim se libera al terminar la escritura; worktree y rama
  se conservan.
