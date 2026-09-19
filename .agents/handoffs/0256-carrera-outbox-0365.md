# Handoff 0256 · seguimiento: dos drenajes del outbox de Kommo a la vez (0365), con sesiones reales

- Fecha: 2026-09-19. Estado de la tarea: **lista para revisión**.
  Falta que el Director revise e integre la PR.
- Owner/sesión: `worker-carrera-outbox-0365-20260919` (Claude Opus 5, Worker, sesión «Automatizar
  la prueba de carrera del for update de 0459»). Director: la sesión «Director notificación a
  workers», que asignó la tarea porque Sam le pidió avanzar en continuo mientras no está.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-outbox-0365`, creado con
  `harness-worktree start`.
- Rama: `codex/carrera-outbox-0365`, desde `origin/main` = `d624ea45`. Con el aviso del Director se
  trajo `main` `6c2413d1` (#167, la carrera del cupo) con el driver, antes del push único.
- SDD: [0256](../../docs/specs/0256-crm-outbox-operable/spec.md), la que introdujo la 0365, como
  seguimiento y sin número nuevo, por decisión del Director.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de cada commit se revalida con `guard --owner`.
- Permisos del encargo: commits en esta rama; el push único y la PR, con el aviso del Director.
  **No merge. No producción.** La 0365 está aplicada y no se toca.

## OBJETIVO ORIGINAL

Probar con sesiones reales que dos drenajes simultáneos del outbox de Kommo no toman las mismas
filas: el `FOR UPDATE SKIP LOCKED` de `claim_kommo_writeback_batch` (0365:88). Cada escenario lleva
barrera por `pg_blocking_pids`, su control en la misma corrida y sus mutantes fuera del repo. Si una
premisa no se sostiene, se mide y se anota.

## COMPLETADO

- **Lectura antes de probar.** El claim está definido sólo en la 0365. La edge function
  `kommo-writeback` suelta primero las reservas vencidas y después reserva con
  `claim_kommo_writeback_batch` (`DRAIN_BATCH` = 100), cada RPC en su propia transacción. La
  disparan el cron (cada 15 minutos) y el nudge de `app/studio/(app)/crm/actions.ts:349`. Hay dos
  comentarios sobre el claim, y no dicen lo mismo:
  - la 0365 (líneas 67-69): con SKIP LOCKED, el segundo drenaje saltea las filas del primero «en
    lugar de esperarlas (y terminar procesándolas también)»;
  - la cabecera de su contrato: SKIP LOCKED «sólo agrega que el segundo no se quede esperando; la
    exclusión la da la transición de estado».
- **`supabase/tests/0365_outbox_kommo_carrera.test.sql`** (15 aserciones), con el patrón de las
  otras carreras:
  - `dblink` contra una base propia;
  - barrera por `pg_blocking_pids`, que distingue si el segundo drenaje espera al primero o termina
    sin esperarlo, y exige el tipo de lock cuando espera;
  - limpieza protegida ante cualquier error;
  - guarda de clúster desechable.
  - **Fixture:** el del contrato 0365, leído de su archivo hasta la migración (roles, tenants y la
    cola en su forma de la 0136 con la 0344), con la 0365 entera encima. Por escenario, un tenant
    propio con 4 filas pendientes.
  - **Las dos sesiones reservan como `service_role`**, igual que la edge function.
  - **Control en la misma corrida:** cada escenario corre primero con el claim reemplazado por una
    variante sacada con `pg_get_functiondef`, que después se restituye; el archivo comprueba por
    md5 que quedó igual. Los reemplazos son tolerantes: con un mutante que ya no tiene el lock, o
    que sólo tiene FOR UPDATE, la variante queda como tiene que quedar.
  - **Tres escenarios:**

    | # | Escenario | Control | Con la 0365 |
    |---|---|---|---|
    | 1 | Dos drenajes a la vez con el lote de la edge function (100) | el claim sin lock: el segundo espera y vuelve a tomar las 4, con `attempts` = 2 | el segundo no espera y no toma ninguna; el primero tomó las 4 |
    | 2 | Dos drenajes a la vez con un lote de 2 | el claim sin lock: el segundo espera y vuelve a tomar las 2 del primero; las otras 2 quedan pendientes | el segundo no espera y toma las otras 2 |
    | 3 | Lo mismo que 2 | el claim con FOR UPDATE a secas: el segundo espera en `transactionid` y después toma las otras 2, sin repetir | el segundo no espera |

- **Corrección de premisas, medida y sin tocar la 0365:**
  1. **Sin lock, la transición de estado no excluye.** El UPDATE del segundo drenaje espera la
     fila del primero y, al re-evaluar, sólo vuelve a comprobar `o.id = e.id`, así que la toma
     otra vez (controles 1 y 2). Lo que excluye es el lock del SELECT, que al re-evaluar vuelve a
     comprobar `status = 'pending'`. La frase del contrato vale en una sola sesión.
  2. **Con FOR UPDATE a secas no hay duplicados** (control 3). La frase de la 0365, «y terminar
     procesándolas también», no se sostiene.
  3. **Lo que agrega SKIP LOCKED es que el segundo no espera.** Inferencia, no medida: como cada
     reserva confirma enseguida, con FOR UPDATE a secas la espera duraría lo que tarda el primer
     claim.
- **Spec 0256:** `updated` pasa a 2026-09-19, y se agrega una sección fechada, «Concurrencia del
  claim en la suite SQL», con:
  - cómo se drena la cola;
  - la verificación de producción del Director;
  - los dos comentarios y la corrección medida;
  - los escenarios y los mutantes.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El archivo solo, con los flags de Docker del runner | **PASÓ**: 15 aserciones, 385 ms, sin residuo en el clúster |
| Fase por fase (copia con un `raise notice` por fase) | **PASÓ**: los 6 resultados salen por la razón correcta. En los controles 1 y 2, el segundo espera en `transactionid` y vuelve a tomar las filas del primero (`attempts` 2,2,2,2 y 2,2,0,0). En el control 3 espera y toma 3 y 4. En las fases reales nunca espera ni repite |
| **Mutantes**, por el runner real y fuera del repo | **Caen donde tienen que caer**: ver la tabla de abajo. Los controles muestran el defecto también con cada mutante |
| El mismo andamiaje sin mutación: la carrera y los contratos 0365 y 0377 | **PASÓ**: 3 de 3 ✓, 3,7 s |
| Huella tras un fallo (bases, roles, extensiones y sesiones del clúster) | **PASÓ en tres modos**: guarda, corte a mitad (la barrera vencida en los 6 casos) y rojo (M1). La guarda, con `service_role` ya creado, aborta sin tocar nada y **conserva** el rol. Las corridas esperaron a que terminara el contenedor del Worker de Tesorería |
| `md5(prosrc)` del claim en el fixture contra producción (lectura de catálogo del Director) | **PASÓ**: coincide exacto, `d7bf6554352007502887fa2b796d687c`, 494 bytes, DEFINER |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ**: 475 specs, sin números repetidos, cápsula vigente |
| Suite SQL completa por el runner real, en el turno de máquina del Director, sobre `4a0d04ed` | **PASÓ**: 216 de 216 ✓, 0 ✗, 79 s, sin contenedores antes ni después. El archivo nuevo pasa junto a los contratos y las otras carreras de `main` |
| `verify` completo | **NO EJECUTADO**: el cambio es un `.test.sql` y documentación |
| Merge de `main` `6c2413d1` (#167), con el driver | **PASÓ**: sin conflictos. Después del merge pasaron `docs:check`, `sdd:check`, `governance:check` y `git diff --check` |
| El archivo junto a la carrera del cupo que entró con la #167 y a los contratos 0365 y 0377, por el runner real, después del merge | **PASÓ**: 8 de 8 ✓ en 5,9 s, contando también los contratos 0445, 0446, 0461 y 0462, sin contenedores al terminar |
| CI alojado | **Por mensaje al Director**: la rama se publica después de este commit |

**Qué escenario mata a cada mutante** (fase real de la carrera). Los contratos de una sola sesión
(0365 y 0377) no detectan ninguno:

| Mutante | Lo que se quita | Escenarios que fallan |
| --- | --- | --- |
| M1 | el lock del SELECT del claim (`for update skip locked`) | 1, 2 y 3: el segundo espera y repite filas |
| M2 | el SKIP LOCKED (queda `for update`) | 1, 2 y 3: el segundo espera, sin repetir filas |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `06674bcb` | `test(db): SDD-0256`: dos drenajes del outbox de Kommo a la vez, con sesiones reales |
| `4a0d04ed` | `docs(SDD-0256)`: la sección fechada en la spec y este handoff |
| `5419a942` | merge de `main` `6c2413d1` con el driver, sin conflictos |
| el commit que contiene esta versión | `docs(handoff)`: la suite completa y el merge final en este handoff, antes del push único |

## PR / BRANCH

- Rama `codex/carrera-outbox-0365`, base `main`, worktree de arriba. Se publica con un solo push
  después de este commit. El número de la PR y el SHA van por mensaje al Director.

## PENDIENTES DE ESTA TAREA

1. Push y PR contra `main`, con el número y el SHA por mensaje.
2. Revisión e integración del Director.

## FUERA DE ALCANCE DETECTADO

1. **La cabecera del contrato `0365_kommo_outbox_claim.test.sql` dice que «la exclusión la da la
   transición de estado».** Vale en una sola sesión; con dos a la vez, lo que excluye es el lock
   del SELECT. No se tocó: la corrección está en la spec 0256. Queda para quien vuelva a tocar ese
   contrato.
2. **El ledger de la 0365 no coincide con su archivo** (`80935bdb…`, 4.577 bytes, contra
   `7211eed9…`, 8.004 bytes, según el Director). El cuerpo de la función coincide. Es el mismo
   patrón que la 0361, la 0445, la 0446 y la 0447, anotado en el handoff
   `0439-carrera-cupo-0445.md`: el texto aplicado no es el archivo byte a byte.
3. **La spec 0256 dice `status: done` en su cabecera y `in-progress` en su §7.** No se tocó.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0256, con la sección nueva. El índice `docs/specs/README.md` no cambia.
- **Documentación en código:** la cabecera del `.test.sql`.
- **No aplica:**
  - `BRAND.md` y `docs/design/**`: no hay UI;
  - `docs/marketing/**` y `docs/governance/**`: no hay política nueva;
  - `revisar-datos-ve`: el test no cambia qué datos se capturan, mueven o borran, y usa fixtures
    ficticios en una base desechable.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff.

## Control rojo reproducible (fuera del repo)

Los mutantes no viven en el repo. El script arma, en una carpeta nueva, una copia de
`supabase/migrations` y de tres archivos de prueba (la carrera y los contratos 0365 y 0377, que usan
el claim), con la 0365 mutada, y la pasa por el runner real:

```bash
node rojo-0365.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <M1|M2|verde>
```

```js
// Control rojo de supabase/tests/0365_outbox_kommo_carrera.test.sql, fuera del repo.
// Arma una copia de supabase/ (migraciones + los contratos 0365 y 0377, que usan el
// claim, + el test de la carrera) con UNA mutación de la 0365 y la pasa por el
// runner real (scripts/run-sql-tests.mjs). Los contratos también corren, porque el
// runner corre todo *.test.sql: así se ve si la prueba de una sola sesión la detecta.
//
//   node rojo-0365.cjs <worktree> <carpeta-nueva> <variante>
//
//   M1     claim_kommo_writeback_batch sin su lock: elige las pendientes sin reservarlas
//   M2     claim_kommo_writeback_batch con FOR UPDATE a secas, sin SKIP LOCKED
//   verde  sin mutación                                                   → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MUTANTES = {
  M1: ["     for update skip locked\n", ""],
  M2: ["     for update skip locked\n", "     for update\n"],
};
const [W, D, V] = process.argv.slice(2);
if (!W || !D || !V) throw new Error("uso: node rojo-0365.cjs <worktree> <carpeta-nueva> <variante>");
if (!(V in MUTANTES) && V !== "verde") throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
for (const t of ["0365_kommo_outbox_claim.test.sql", "0377_kommo_outbox_post_idempotente.test.sql",
  "0365_outbox_kommo_carrera.test.sql"]) {
  fs.copyFileSync(path.join(W, "supabase", "tests", t), path.join(D, "supabase", "tests", t));
}

const archivo = "0365_kommo_outbox_claim.sql";
const destino = path.join(D, "supabase", "migrations", archivo);
if (V in MUTANTES) {
  const [a, b] = MUTANTES[V];
  const s = fs.readFileSync(destino, "utf8");
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`«${a.slice(0, 60)}» aparece ${n} veces en ${archivo}`);
  fs.writeFileSync(destino, s.replace(a, () => b));
}

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

- **Siguiente acción:** revisar la PR e integrarla.
- **Cambios compartidos:** un archivo nuevo en `supabase/tests/`, que el runner descubre solo, y la
  spec 0256. Ningún archivo de producto.
- **Dependencias:** `dblink` en la imagen del runner (`postgres:17`) y el contrato
  `0365_kommo_outbox_claim.test.sql`, del que sale el fixture. Sin `dblink`, el archivo falla en vez
  de hacer SKIP.
- **Conocimiento:** Graphify, Archify y la bóveda quedan para la publicación del Director desde
  `main`.
- **Sesiones consumidoras:** ninguna. El claim se libera al abrir la PR; el worktree y la rama se
  conservan.
