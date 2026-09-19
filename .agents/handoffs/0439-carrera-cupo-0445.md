# Handoff 0439 · seguimiento: el cupo de 3 cambios del perfil (0445 con 0446 y 0462), con sesiones reales

- Fecha: 2026-09-19. Estado de la tarea: **lista en local**. Faltan la suite SQL completa, que
  corre en el turno del Director, el push único y la PR, que esperan su aviso.
- Owner/sesión: `worker-carrera-cupo-0445-20260919` (Claude Opus 5, Worker, sesión «Automatizar la
  prueba de carrera del for update de 0459», que siguió con esta tarea a pedido de Sam).
  Director: la sesión «Director notificación a workers».
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-cupo-0445`, creado con
  `harness-worktree start`.
- Rama: `codex/carrera-cupo-0445`, desde `origin/main` = `3bd3aae5`, sin upstream hasta el push.
- SDD: [0439](../../docs/specs/0439-portal-cliente-edicion-de-perfil/spec.md), la que introdujo el
  cupo. Es la antigua SDD-0435: se renumeró, y las migraciones 0445 y 0446 conservan «SDD-0435» en
  sus comentarios. Va como seguimiento y sin número nuevo, por decisión del Director.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de cada commit se revalidó con `guard --owner`.
- Permisos del encargo: commits en esta rama. El push y la PR esperan el turno del Director.
  **No merge. No producción.** La 0445, la 0446, la 0461 y la 0462 están aplicadas y no se tocan.

## OBJETIVO ORIGINAL

Probar con sesiones reales el conteo del trigger `portal_profile_edit_request_lifecycle` bajo el
FOR UPDATE de la ficha (0445:138). Con 1 cambio restante, dos solicitudes a la vez tienen que dejar
la segunda con `profile_edit_limit_reached`. Los FOR UPDATE de la 0446 (:75, :133 y :256) entran si
son de ejecución; los de backfill se anotan y no se prueban. Cada escenario lleva barrera por
`pg_blocking_pids`, su control en la misma corrida y sus mutantes fuera del repo. Un hueco real se
reporta con evidencia y no se arregla.

## COMPLETADO

- **Lectura antes de probar.** Los tres FOR UPDATE de la 0446 son de ejecución: están en funciones
  y triggers. El `lock table` de la 0446:175 es del backfill. En la app, el cupo se consume por dos
  caminos, y los dos toman FOR UPDATE de la ficha antes de contar:
  - `portal_update_my_profile` (0462:214), que inserta la solicitud aprobada que cuenta el trigger;
  - `portal_set_identity_photo` (0446:256).

  El Portal ya no crea solicitudes pendientes: solo cancela las anteriores a SDD-0482
  (`app/portal/(app)/perfil/actions.ts:366`). El Studio registra sus cambios con
  `source = 'admin'` (`app/studio/(app)/clientes/actions.ts:365-379`), y esos el trigger no los
  cuenta. Las fusiones van siempre por la RPC `merge_clients`
  (`app/studio/(app)/clientes/merge-actions.ts:46`).
- **`supabase/tests/0445_cupo_perfil_carrera.test.sql`** (29 aserciones), con el patrón de las otras
  carreras:
  - `dblink` contra una base propia;
  - barrera por `pg_blocking_pids`, que además exige el tipo de lock en que espera la segunda sesión;
  - limpieza protegida ante cualquier error;
  - guarda de clúster desechable.
  - **Fixture:** el del contrato 0462, leído de su archivo hasta sus migraciones. Se le suman las
    columnas de `clients` que exige la 0446 y ese contrato no trae (salen del contrato 0446) y,
    encima, la cadena real 0445 → 0446 → 0447 → 0461 → 0462, en orden de número. La fusión es la
    recortada del contrato 0446: toma las dos fichas FOR UPDATE al empezar, como `merge_clients`.
  - **Del lado del Portal** van las dos RPC reales, con la sesión del cliente (`authenticated` y su
    `sub`).
  - **Control en la misma corrida:** cada escenario, del 1 al 6, corre primero con la función que lo
    defiende reemplazada por una variante sin su FOR UPDATE. La variante sale con
    `pg_get_functiondef` y después se restituye; el archivo comprueba por md5 que las tres quedaron
    iguales. Si un reemplazo no encuentra su texto, el control no muestra el defecto y el archivo
    falla.
  - **Siete escenarios.** Salvo en la fusión, el cliente arranca con 1 cambio disponible:

    | # | Escenario | Sin el FOR UPDATE (control) | Con las migraciones |
    |---|---|---|---|
    | 1 | Dos altas directas de la solicitud aprobada, desde un llamador sin lock propio: el contrato del trigger | trigger sin 0445:138: la segunda no espera, pasan las dos y quedan 4 | la segunda espera y recibe `profile_edit_limit_reached` |
    | 2 | Dos ediciones directas a la vez, con cambios distintos | la 0462 y el trigger sin sus locks: pasan las dos y quedan 4 | la segunda espera y recibe el límite |
    | 3 | Una edición directa y, encima, un cambio de foto | foto sin 0446:256: cuenta antes de esperar, pasa y quedan 4 | la foto espera y recibe el límite |
    | 4 | Dos cambios de foto a la vez | ídem: pasan los dos y quedan 4 | el segundo espera y recibe el límite |
    | 5 | Una fusión retira la ficha y su cliente edita sus datos a la vez | 0462 sin 0462:214: el cambio cae en la ficha retirada y se cuenta ahí, fuera del cupo del superviviente | la edición espera y recibe `profile_client_not_found` |
    | 6 | Lo mismo con un cambio de foto | foto sin 0446:256: ídem | el cambio espera y recibe `profile_client_not_found` |
    | 7 | Una fusión y un cambio del superviviente a la vez | sin control: no hay defecto posible | el cambio espera la fusión, cuenta la historia unida y recibe el límite |

    En las siete corridas reales, la segunda sesión espera en `transactionid`.
- **Hallazgos**, reportados y sin arreglar, porque ninguno es un hueco:
  1. **El lock del trigger (0445:138) y el de la edición directa (0462:214) se cubren entre sí.** La
     premisa «sin el lock pasan las dos» vale para el trigger solo (escenario 1). En la app, quitar
     cualquiera de los dos no rompe nada: M1 y M2 no tumban el escenario 2, y M1+M2 sí.
  2. **El lock del trigger no filtra fichas retiradas.** Durante una fusión, lo que impide consumir
     sobre la ficha retirada son los FOR UPDATE con `deleted_at is null` de la 0462 y de la foto
     (escenarios 5 y 6).
  3. **El lock de la foto (0446:256) es el único de su camino** (escenarios 3, 4 y 6).
  4. **Los locks de los triggers de la fusión (0446:75 y :133) son de ejecución, pero no cambian
     nada observable.**
     - En la app solo los alcanza `merge_clients`, que ya toma FOR UPDATE de las dos fichas al
       empezar (0361:84-89).
     - Una fusión no aplica el máximo (0446:49-51). Por eso cualquier orden entre una fusión y un
       consumo del superviviente equivale a uno en serie: el consumo antes o después de la fusión.
     - Sin ningún lock explícito en la fusión, el consumo que llega durante ella espera igual.
       Mover las filas a la superviviente toma KEY SHARE sobre ella por las FK, y retirar la otra
       ficha la actualiza. Los FOR UPDATE de los dos caminos chocan con esos locks.

     Los escenarios 5 a 7 lo miden. M4, M5, M4+M5 y M45F (además, sin el FOR UPDATE inicial de la
     fusión del fixture) sobreviven. Son defensa en profundidad.
- **Spec 0439:** `updated` pasa a 2026-09-19, y se agrega una sección fechada, «Concurrencia del
  cupo en la suite SQL», con:
  - la verificación de producción del Director;
  - lo que afirma la spec y cómo corre en la app;
  - los escenarios, los mutantes y lo que muestran;
  - dos rutas de allowlist.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El archivo solo, con los flags de Docker del runner | **PASÓ**: 29 aserciones, 646 ms, sin residuo en el clúster |
| Fase por fase (copia con un `raise notice` por fase) | **PASÓ**: los 13 resultados salen por la razón correcta. El control 1 no espera. Los controles 2 a 6 esperan más adelante, en el UPDATE o en la FK, y dejan el defecto. Las siete fases reales esperan en `transactionid` y reciben su error |
| **Mutantes**, por el runner real y fuera del repo | **Caen donde tienen que caer**: ver la tabla de abajo. Los controles muestran el defecto también con cada mutante |
| El mismo andamiaje sin mutación: la carrera y los contratos 0445, 0446, 0461 y 0462 | **PASÓ**: 5 de 5 ✓, 4,4 s |
| Huella tras un fallo (bases, roles, extensiones y sesiones del clúster) | **PASÓ en tres modos**: guarda, corte a mitad (la barrera vencida en los 13 casos) y rojo (M3). La guarda, con `service_role` ya creado, aborta sin tocar nada y **conserva** el rol |
| `md5(prosrc)` de las cinco funciones del fixture contra producción (lectura de catálogo del Director) | **PASÓ**: coinciden exacto, las cinco son DEFINER. `portal_profile_edit_request_lifecycle` `5316eac7…`, `portal_set_identity_photo` `057aea5c…`, `portal_update_my_profile` `724dc0cf…`, `portal_profile_edit_follow_request_reassignment` `10b6e764…`, `portal_profile_edits_follow_client_merge` `8948fa55…`. Las diferencias de tamaño contra los bytes del Director son las tildes |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ**: 475 specs, sin números repetidos, cápsula vigente |
| Suite SQL completa por el runner real | **NO EJECUTADO**: espera el turno de máquina del Director |
| `verify` completo | **NO EJECUTADO**: el cambio es un `.test.sql` y documentación |
| CI alojado | **NO EJECUTADO**: la rama no está publicada |

**Qué escenario mata a cada mutante** (fase real de la carrera). Los contratos de una sola sesión
(0445, 0446, 0461 y 0462) no detectan ninguno:

| Mutante | Lo que se quita | Escenarios que fallan |
| --- | --- | --- |
| M1 | el FOR UPDATE del trigger (0445:138) | 1 |
| M2 | el FOR UPDATE de `portal_update_my_profile` (0462:214) | 5 |
| M1+M2 | los dos | 1, 2 y 5 |
| M3 | el FOR UPDATE de `portal_set_identity_photo` (0446:256) | 3, 4 y 6 |
| M4 | el FOR UPDATE del trigger de reasignación (0446:75) | ninguno |
| M5 | el FOR UPDATE del trigger de fusión (0446:133) | ninguno |
| M4+M5 | los dos | ninguno |
| M45F | M4+M5 y, en la copia del contrato 0446, el FOR UPDATE inicial de las dos fichas en su fusión: ningún lock explícito en la fusión | ninguno |

La 0461 comprueba en su preflight que la foto sea la versión 0446: busca en el texto
`doc_verify_status = null` y `profile_edit_limit_reached`. Los mutantes no tocan esas líneas, así
que el fixture se arma igual y el rojo cae por la carrera.

## COMMITS

| Commit | Propósito |
| --- | --- |
| `0f5d7ea0` | `test(db): SDD-0439`: el cupo de 3 cambios del perfil bajo concurrencia, con sesiones reales |
| el commit que contiene este documento | `docs(SDD-0439)`: la sección fechada en la spec y este handoff |

## PR / BRANCH

- Rama `codex/carrera-cupo-0445`, base `main`, worktree de arriba. No está publicada. El push
  único y la PR esperan el aviso del Director.

## PENDIENTES DE ESTA TAREA

1. Suite SQL completa por el runner real, en el turno de máquina del Director.
2. Con su aviso: traer `main` si avanzó, repetir lo liviano y el archivo, hacer un solo push y abrir
   la PR, con el número y el SHA por mensaje.
3. Revisión e integración del Director.

## FUERA DE ALCANCE DETECTADO

1. **El ledger de producción no coincide con el archivo en la 0361, la 0445, la 0446 y la 0447**,
   según la lectura de catálogo del Director. No es por ediciones posteriores:
   - el archivo de la 0445 en `main` tiene exactamente el SHA-256 que registró la spec 0439 al
     aplicarla (`5A256A83E1E8C056…`);
   - el último commit de la 0361 (`e30aa69a`, 2026-08-09 12:08 -04:00), de la 0446 (`07d1dea1`,
     2026-09-06) y de la 0447 (`bab07a73`, 2026-09-04) es anterior a su ledger.

   Inferencia, no verificada: el texto aplicado no fue el archivo tal cual. En la 0361, la 0446 y
   la 0447, el ledger pesa menos que el archivo, y en la 0445, 2 bytes más. Los cuerpos y los
   triggers que ejercita la carrera coinciden con producción. Decide el Director si se investiga
   la identidad de esas cuatro.
2. **La fusión del contrato 0446 toma las fichas en otro orden que la real.** Toma primero la
   superviviente y después la retirada; `merge_clients` (0361:84-89) las toma en orden de id. Da
   igual con una sola sesión en contra, como en esta carrera. Una carrera de fusión contra fusión
   necesitaría la función real o ese orden.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0439, con la sección nueva y la allowlist. El índice `docs/specs/README.md`
  no cambia (`docs:check` en verde).
- **Documentación en código:** la cabecera del `.test.sql`.
- **No aplica:**
  - `BRAND.md` y `docs/design/**`: no hay UI;
  - `docs/marketing/**` y `docs/governance/**`: no hay política nueva;
  - `revisar-datos-ve`: el test no cambia qué datos se capturan, mueven o borran, y usa fixtures
    ficticios en una base desechable;
  - `docs/legal/privacidad/**`: el tratamiento no cambia; solo se prueba bajo concurrencia.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff.

## Control rojo reproducible (fuera del repo)

Los mutantes no viven en el repo. El script arma, en una carpeta nueva, una copia de
`supabase/migrations` y de cinco archivos de prueba: la carrera y los contratos 0445, 0446, 0461 y
0462, de los que salen el fixture y la comparación. Aplica las mutaciones de la variante (M45F toca
también la copia del contrato 0446) y la pasa por el runner real:

```bash
node rojo-0445.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <M1|M2|M3|M4|M5|M12|M45|M45F|verde>
```

```js
// Control rojo de supabase/tests/0445_cupo_perfil_carrera.test.sql, fuera del repo.
// Arma una copia de supabase/ (migraciones + los contratos 0445, 0446, 0461 y 0462,
// de los que salen el fixture y la comparación, + el test de la carrera) con las
// mutaciones de la variante y la pasa por el runner real
// (scripts/run-sql-tests.mjs). Los contratos también corren, porque el runner
// corre todo *.test.sql: así se ve si la prueba de una sola sesión la detecta.
//
//   node rojo-0445.cjs <worktree> <carpeta-nueva> <variante>
//
//   M1     el trigger de la 0445 sin su FOR UPDATE de la ficha (0445:138)
//   M2     portal_update_my_profile sin su FOR UPDATE de la ficha (0462:214)
//   M3     portal_set_identity_photo sin su FOR UPDATE de la ficha (0446:256)
//   M4     el trigger de reasignación de la 0446 sin su FOR UPDATE (0446:75)
//   M5     el trigger de fusión de la 0446 sin su FOR UPDATE (0446:133)
//   M12    M1 y M2 juntos
//   M45    M4 y M5 juntos
//   M45F   M4 y M5, y además la fusión del fixture (contrato 0446) sin su FOR
//          UPDATE inicial de las dos fichas: ningún lock explícito en la fusión
//   verde  sin mutación                                                   → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const A445 = ["migrations", "0445_portal_profile_edit_limit.sql"];
const A446 = ["migrations", "0446_portal_profile_functional_remediation.sql"];
const A462 = ["migrations", "0462_portal_profile_direct_edit.sql"];
const C446 = ["tests", "0446_portal_profile_functional_remediation.test.sql"];
const CAMBIO = {
  M1: [A445, "    perform 1 from public.clients where id = new.client_id for update;",
             "    perform 1 from public.clients where id = new.client_id;"],
  M2: [A462, "  where client.id = v_client_id and client.deleted_at is null\n  for update;",
             "  where client.id = v_client_id and client.deleted_at is null;"],
  M3: [A446, "  where client.id = v_client_id and client.deleted_at is null\n  for update;",
             "  where client.id = v_client_id and client.deleted_at is null;"],
  M4: [A446, "    and client.deleted_at is null\n  for update;",
             "    and client.deleted_at is null;"],
  M5: [A446, "    and survivor.deleted_at is null\n  for update;",
             "    and survivor.deleted_at is null;"],
  FS: [C446, "  where id = p_survivor_id and deleted_at is null\n  for update;",
             "  where id = p_survivor_id and deleted_at is null;"],
  FM: [C446, "  where id = p_merged_id and deleted_at is null\n  for update;",
             "  where id = p_merged_id and deleted_at is null;"],
};
const VARIANTES = { M1: ["M1"], M2: ["M2"], M3: ["M3"], M4: ["M4"], M5: ["M5"],
  M12: ["M1", "M2"], M45: ["M4", "M5"], M45F: ["M4", "M5", "FS", "FM"], verde: [] };

const [W, D, V] = process.argv.slice(2);
if (!W || !D || !V) throw new Error("uso: node rojo-0445.cjs <worktree> <carpeta-nueva> <variante>");
if (!(V in VARIANTES)) throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
for (const t of ["0445_portal_profile_edit_limit.test.sql", "0446_portal_profile_functional_remediation.test.sql",
  "0461_identity_photo_replacement_enable.test.sql", "0462_portal_profile_direct_edit.test.sql",
  "0445_cupo_perfil_carrera.test.sql"]) {
  fs.copyFileSync(path.join(W, "supabase", "tests", t), path.join(D, "supabase", "tests", t));
}

const tocados = new Map();
for (const m of VARIANTES[V]) {
  const [[carpeta, archivo], a, b] = CAMBIO[m];
  const destino = path.join(D, "supabase", carpeta, archivo);
  const s = fs.readFileSync(destino, "utf8");
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${m}: «${a.slice(0, 60)}» aparece ${n} veces en ${archivo}`);
  fs.writeFileSync(destino, s.replace(a, () => b));
  tocados.set(archivo, carpeta);
}

for (const [archivo, carpeta] of tocados.size ? tocados : new Map([[A445[1], A445[0]]])) {
  const diff = spawnSync("git", ["diff", "--no-index", "--unified=0", "--no-color",
    path.join(W, "supabase", carpeta, archivo), path.join(D, "supabase", carpeta, archivo)], { encoding: "utf8" });
  console.log(`== diff de ${archivo} (${V}):`);
  console.log(diff.stdout.split("\n").filter((l) => /^[-+][^-+]/.test(l) || /^@@/.test(l)).join("\n") || "(sin cambios)");
}

const t0 = Date.now();
const run = spawnSync(process.execPath, [path.join(W, "scripts", "run-sql-tests.mjs")], { cwd: D, encoding: "utf8" });
process.stdout.write((run.stdout || "") + (run.stderr || ""));
console.log(`== runner exit ${run.status} en ${Date.now() - t0} ms`);
process.exitCode = run.status;
```

## HANDOFF AL DIRECTOR

- **Siguiente acción:** tu turno de máquina para la suite SQL completa y, después, tu aviso para
  el push único y la PR.
- **Cambios compartidos:** un archivo nuevo en `supabase/tests/`, que el runner descubre solo, y la
  spec 0439. Ningún archivo de producto.
- **Dependencias:** `dblink` en la imagen del runner (`postgres:17`) y los contratos
  `0462_portal_profile_direct_edit.test.sql` y `0446_portal_profile_functional_remediation.test.sql`,
  de los que sale el fixture. Sin `dblink`, el archivo falla en vez de hacer SKIP.
- **Conocimiento:** Graphify, Archify y la bóveda quedan para la publicación del Director desde
  `main`.
- **Sesiones consumidoras:** ninguna. El claim se libera al abrir la PR; el worktree y la rama se
  conservan.
