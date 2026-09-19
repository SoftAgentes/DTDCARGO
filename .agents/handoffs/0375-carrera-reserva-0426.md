# Handoff 0375 · seguimiento — La reserva atómica del verificador público, con sesiones reales

- Fecha: 2026-09-18 (Caracas; 2026-09-19 UTC). Estado de la tarea: **lista para revisión**. Se
  publica con este head, en un solo push, y la PR se abre lista para revisión.
- Owner/sesión: `worker-carrera-reserva-0426-20260919` (Claude Opus 5, Worker, sesión «Automatizar
  la prueba de carrera del for update de 0459» [7a0aa1], que siguió con esta tarea a pedido de Sam).
  Director: `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-reserva-0426`, creado
  con `harness-worktree start`.
- Rama: `codex/carrera-reserva-0426`, desde `origin/main` = `d881f75f`.
- SDD: [0375](../../docs/specs/0375-public-verify-atomic-reservation/spec.md), como seguimiento y
  sin número nuevo, por decisión del Director. El script `scripts/check-public-verify-concurrency.mjs`
  se conserva: retirarlo es otra decisión.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de los commits se revalidó con `guard --owner`.
- Permisos del encargo: commits en esta rama; push de la rama propia y PR contra `main` después de
  reportarle al Director. **No merge. No producción.** La 0426 (aplicada, ledger `20260912022928`)
  no se toca: md5 `8e4f06a4…`.

## OBJETIVO ORIGINAL

Llevar a la suite SQL de `verify` la concurrencia de la reserva atómica
`reserve_public_verify_attempt()` (0426). Su contrato corre en una sola sesión, y el script
`scripts/check-public-verify-concurrency.mjs` no corre en `verify`.

## COMPLETADO

- **Hallazgo, el mismo de la 0421 y la 0427.** La allowlist de la 0375 incluye
  `scripts/verify.mjs` («ejecutar el contrato concurrente en el gate») y
  `__tests__/public-verify-concurrency-gate.test.ts`, y la spec dice que el gate pasó
  «concurrencia». Ese cableado quedó en `47b1dd0b`, de la rama de origen, y no está en `main`. En
  `main`, el script existe pero no lo corre nadie. Además, por defecto usa `postgres:17-alpine`,
  que el runner no descarga, así que en esta máquina hace SKIP.
- **`supabase/tests/0426_reserva_verificacion_carrera.test.sql`** (17 aserciones), con el patrón de
  las otras carreras:
  - `dblink` contra una base propia;
  - barrera por `pg_blocking_pids`, sin `sleep`;
  - limpieza protegida ante cualquier error;
  - guarda de clúster desechable.

  El fixture es el del contrato 0426: su sección entre `begin;` y el primer `\ir` de la 0426,
  leída con `pg_read_file`, con cada `\ir` expandido, y la 0426 entera después. Ese fixture crea el
  rol `fixture_0426_extra`: la guarda lo exige ausente y la limpieza lo borra. Los escenarios son
  los del script:
  1. Último cupo, la primera confirma: la segunda espera en el **advisory lock** de la IP y recibe
     false. Quedan 40. Otra IP reserva sin esperar.
  2. Último cupo, la primera se revierte: la segunda espera y reserva ella. Quedan 40.
  3. La ventana vence mientras la segunda espera: al entrar cuenta con su propio reloj y reserva.
     Su `created_at` es posterior a la liberación.
  4. La primera retiene más de 2 s: la segunda corta con lock timeout, sin insertar, y después
     reserva.
  5. REPEATABLE READ, SERIALIZABLE y READ UNCOMMITTED: rechazo 25000, sin filas.
- **Spec 0375:** una corrección de estado fechada en «Pruebas y aceptación local», con la nota del
  Director sobre el script y `postgres:17-alpine`, y dos filas en «Allowlist y ownership».

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El archivo solo, con los flags de Docker del runner | **PASÓ**: 17 aserciones, 3,6 s de psql. Dos de esos segundos son el `lock_timeout` del caso 4 y uno es el vencimiento de la ventana del caso 3 |
| **Control rojo por el runner real**, 4 mutantes de la 0426 en copias fuera del repo, cada uno con su diff | Los 4 **FALLAN, como tenían que fallar**, cada uno en su caso (tabla siguiente). Con la 0426 intacta, los dos archivos dan ✓ |
| Huella tras un fallo (bases, roles, extensiones y sesiones del clúster) | **PASÓ en tres modos**: rojo, corte a mitad de carrera y guarda. La guarda, con `fixture_0426_extra` ya creado, aborta sin tocar nada y **conserva** el rol |
| Identidad de la 0426 | Sin cambios: md5 `8e4f06a4…` |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ**: 471 specs, sin números repetidos, cápsula vigente |
| Suite SQL completa por el runner real (`node scripts/run-sql-tests.mjs`), en el turno de máquina del Director, sobre `fc8d5a09` | **PASÓ**: 206 de 206 ✓, 0 ✗, exit 0, 104 s. Pasan juntos los cinco archivos de carrera (0421, 0426, 0427, 0459 y 0460) y el contrato 0426 |
| Merge de `origin/main` (`c8f7f8b6`: la #151 y la 0465) → `ac94afa1` | **PASÓ**: sin conflictos. `main` trajo solo la 0465 y su prueba, que el fixture no lee, y el diff neto contra `main` son los archivos de esta tarea |
| Después del merge: `docs:check` / `sdd:check` / `governance:check` / `git diff --check`, y este archivo solo | **PASÓ**: 472 specs; el archivo, 17 aserciones y sin huella |
| `pnpm verify` completo | **NO EJECUTADO**, por el criterio del Director para estas carreras: el cambio es un `.test.sql` y documentación. Basta la suite SQL completa, y el CI cubre el resto de los gates |
| CI alojado | **NO EJECUTADO todavía**: la rama no está publicada |

| Mutante de la 0426 (runner real) | Este test | Contrato de una sesión |
| --- | --- | --- |
| Sin el advisory lock | ✗ «último cupo: la segunda reserva tenía que esperar en el advisory lock de la IP» | ✓ (no lo ve) |
| `now()` en vez de `clock_timestamp()` | ✗ «ventana vencida: … (¿el reloj se lee antes del lock?)» | ✓ |
| Sin el `lock_timeout` de 2 s | ✗ «la segunda sesión no terminó sola en 20 s» | ✗ (al reaplicar, lo ve como drift) |
| Sin la exigencia de READ COMMITTED | ✗ «aislamiento: repeatable read tenía que rechazarse (25000)» | ✓ |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `89c7eb97` | `test(db): SDD-0375`: la reserva atómica con sesiones reales |
| `fc8d5a09` | `docs(SDD-0375)`: corrección de estado y allowlist |
| `ac94afa1` | merge de `origin/main` (`c8f7f8b6`), sin rebase |
| el commit que contiene este documento | `docs(handoff)`: este handoff |

## PR / BRANCH

- Rama `codex/carrera-reserva-0426`, base `main` (`c8f7f8b6`, ya incluido), worktree de arriba. Se
  publica con el head que contiene este documento, en un solo push, y la PR se abre lista para
  revisión. Su número, el SHA y el CI van por mensaje, para no mover el head revisado.

## PENDIENTES DE ESTA TAREA

1. El push y la PR, justo después de este commit. El Director ya dio el turno y aprobó el diseño.
2. Reportar por mensaje el número de la PR, el SHA y «Calidad local sin secretos» sobre el head
   publicado.
3. Integrar: lo hace el Director.

## FUERA DE ALCANCE DETECTADO

1. **`scripts/check-public-verify-concurrency.mjs` queda duplicado.** Sus escenarios ya los cubre
   este contrato. Sigue sin correr en `verify` y hace SKIP en esta máquina (`postgres:17-alpine`).
   El Director dejó para después la decisión de retirarlo.
2. **`scripts/qa/payment-report-confirm-race.mjs` (SDD-0484) sigue sin correr en `verify`.** Es la
   última carrera conocida que solo corre a mano.
3. **La retención de `public_verify_throttle` sigue sin plazo**, como ya dice la spec 0375 («deuda
   separada»). No se tocó.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0375, con la corrección de estado y la allowlist. El índice
  `docs/specs/README.md` no cambia (`docs:check` en verde).
- **Documentación en código:** la cabecera del `.test.sql`.
- **No aplica:** `BRAND.md` y `docs/design/**` (no hay UI), `docs/marketing/**` y
  `docs/governance/**` (no hay política nueva). Tampoco `revisar-datos-ve`: el test no cambia qué
  datos se capturan, mueven o borran. Usa IPs de documentación (`198.51.100.0/24`) en una base
  desechable.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff.

## Control rojo reproducible (fuera del repo)

Los mutantes no viven en el repo. Este script arma en una carpeta nueva una copia de
`supabase/migrations`, del contrato 0426 y del test de la carrera, con **una** mutación de la
0426, y la pasa por el runner real:

```bash
node rojo-0426.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <lock|reloj|timeout|aislamiento|verde>
```

```js
// Control rojo de supabase/tests/0426_reserva_verificacion_carrera.test.sql, fuera del repo.
// Arma una copia de supabase/ (migraciones + el contrato 0426, del que sale el
// fixture, + el test de la carrera) con UNA mutación de la 0426 y la pasa por
// el runner real (scripts/run-sql-tests.mjs). El contrato también corre,
// porque el runner corre todo *.test.sql.
//
//   node rojo-0426.cjs <worktree> <carpeta-nueva> <variante>
//
//   lock         sin el advisory lock por IP                        → ✗
//   reloj        el reloj de la transacción (now()) en vez del de   → ✗
//                después del lock (clock_timestamp())
//   timeout      sin el lock_timeout de 2 s de la función           → ✗
//   aislamiento  sin la exigencia de READ COMMITTED                 → ✗
//   verde        sin mutación                                       → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const [W, D, V] = process.argv.slice(2);
if (!W || !D || !V) throw new Error("uso: node rojo-0426.cjs <worktree> <carpeta-nueva> <variante>");
if (!["lock", "reloj", "timeout", "aislamiento", "verde"].includes(V)) throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
for (const t of ["0426_public_verify_atomic_reservation.test.sql", "0426_reserva_verificacion_carrera.test.sql"]) {
  fs.copyFileSync(path.join(W, "supabase", "tests", t), path.join(D, "supabase", "tests", t));
}

const archivo = "0426_public_verify_atomic_reservation.sql";
const destino = path.join(D, "supabase", "migrations", archivo);
let s = fs.readFileSync(destino, "utf8");
const una = (a, b) => {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`«${a.slice(0, 60)}» aparece ${n} veces en ${archivo}`);
  s = s.replace(a, b);
};
switch (V) {
  case "lock":
    una("  perform pg_catalog.pg_advisory_xact_lock(\n    pg_catalog.hashtextextended('public_verify_throttle:' || p_ip, 0)\n  );\n", "");
    break;
  case "reloj":
    una("  v_now := pg_catalog.clock_timestamp();", "  v_now := pg_catalog.now();");
    break;
  case "timeout":
    una("    set search_path = '' set lock_timeout = '2s'\n", "    set search_path = ''\n");
    break;
  case "aislamiento":
    una("  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n" +
        "    raise exception using errcode = '25000',\n" +
        "      message = 'public verify reservation requires read committed';\n" +
        "  end if;\n", "");
    break;
}
fs.writeFileSync(destino, s);

const diff = spawnSync("git", ["diff", "--no-index", "--unified=0", "--no-color",
  path.join(W, "supabase", "migrations", archivo), destino], { encoding: "utf8" });
console.log(`== diff de ${archivo} (${V}):`);
console.log(diff.stdout.split("\n").filter((l) => /^[-+][^-+]/.test(l) || /^@@/.test(l)).join("\n") || "(sin cambios)");

const t0 = Date.now();
const run = spawnSync(process.execPath, [path.join(W, "scripts", "run-sql-tests.mjs")], { cwd: D, encoding: "utf8" });
process.stdout.write((run.stdout || "") + (run.stderr || ""));
console.log(`== runner exit ${run.status} en ${Date.now() - t0} ms`);
process.exitCode = run.status;
```

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR e integrarla en su turno.
- **Cambios compartidos:** un archivo nuevo en `supabase/tests/`, que el runner descubre solo, y la
  spec 0375. Ningún archivo de producto.
- **Dependencias:** `dblink` en la imagen del runner (`postgres:17`) y el contrato
  `0426_public_verify_atomic_reservation.test.sql`, del que sale el fixture. Sin `dblink`, el
  archivo falla en vez de hacer SKIP.
- **Conocimiento:** Graphify, Archify y la bóveda quedan para la publicación del Director desde
  `main`.
- **Sesiones consumidoras:** ninguna. El claim se libera al terminar la escritura; worktree y rama
  se conservan.
