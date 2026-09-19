# Handoff 0467 · seguimiento: el borrado de un cliente contra el acceso al Portal (0454), con sesiones reales

- Fecha: 2026-09-19. Estado de la tarea: **lista para revisión**.
  Falta que el Director revise e integre la PR.
- Owner/sesión: `worker-carrera-borrado-0454-20260919` (Claude Opus 5, Worker, sesión «Automatizar
  la prueba de carrera del for update de 0459», que siguió con esta tarea a pedido de Sam).
  Director: la sesión «Director notificación a workers», que reemplazó a `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-borrado-0454`, creado
  con `harness-worktree start`.
- Rama: `codex/carrera-borrado-0454`, desde `origin/main` = `88713e47`. Con el turno del Director se
  trajo `main` `aab5a43b` (las carreras 0449 y 0466, #163 y #164) con el driver, antes del push único.
- SDD: [0467](../../docs/specs/0467-borrar-cliente-revoca-portal/spec.md), la que introdujo la 0454,
  como seguimiento y sin número nuevo, por decisión del Director.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de cada commit se revalidó con `guard --owner`.
- Permisos del encargo: commits en esta rama. El push y la PR esperan el turno del Director.
  **No merge. No producción.** La 0454 (md5 `02623202…`) está aplicada y no se toca.

## OBJETIVO ORIGINAL

Probar con sesiones reales la carrera entre borrar un cliente y revocar su acceso al Portal: el
FOR SHARE de la guarda (0454:326-330) y el FOR UPDATE de `client_users` (0454:411). Cada escenario
va con barrera por `pg_blocking_pids`, su control en la misma corrida y sus mutantes fuera del
repo. Un hueco real se reporta con evidencia y no se arregla.

## COMPLETADO

- **`supabase/tests/0454_borrado_cliente_carrera.test.sql`** (27 aserciones), con el patrón de las
  otras carreras:
  - `dblink` contra una base propia;
  - barrera por `pg_blocking_pids`, que además exige el tipo de lock en que espera la segunda sesión;
  - limpieza protegida ante cualquier error;
  - guarda de clúster desechable.
  - **Fixture:** el del contrato 0454, leído de su archivo hasta sus utilidades: migraciones reales
    0006, 0080, 0081, 0230, 0360 y 0361, más la auditoría y el D5 de `client_users`. Encima va la
    0454 entera, y después un tenant con su administrador y, por escenario, clientes propios.
  - **Del lado del Studio** van el borrado por RLS (como `softDeleteClientAction`) y las RPC reales
    `portal_invite_client` y `portal_create_access_link`. La mudanza de un vínculo es el UPDATE de
    `client_id` que hace una fusión.
  - **Control en la misma corrida:** cada escenario corre primero con la función de la 0454 que lo
    defiende reemplazada por una variante sin su mecanismo. La variante sale con
    `pg_get_functiondef` y después se restituye; el archivo comprueba que quedó igual. El control
    tiene que dejar un acceso vigente sobre un cliente borrado. Si un reemplazo no encuentra su
    texto, el control no lo deja y el archivo falla.
  - **Seis escenarios**, en todos los cuales la segunda sesión espera en `transactionid`:

    | # | Escenario | Sin el mecanismo (control) | Con la 0454 |
    |---|---|---|---|
    | 1 | Borrado y después invitación nueva | guarda sin FOR SHARE: la invitación queda vigente | la invitación espera y recibe 23514 |
    | 2 | Invitación nueva y después borrado | guarda sin FOR SHARE: el borrado no espera y la invitación queda vigente | el borrado espera y la revoca |
    | 3 | Borrado y después código corto nuevo | guarda sin FOR SHARE: el código queda sin revocar | el código espera y recibe 23514 |
    | 4 | Borrado y un vínculo que se muda a la ficha | guarda sin FOR SHARE: el vínculo activo queda sobre el cliente borrado | la mudanza espera y recibe 23514 |
    | 5 | Borrado y después reinvitación de un vínculo revocado | revocación que se salta los revocados: la reinvitación no espera y queda vigente | la reinvitación espera la fila y la guarda la rechaza |
    | 6 | Reinvitación y después borrado | ídem: el borrado no espera | el borrado espera la fila y, al re-evaluar, la revoca |

- **Spec 0467:** una sección fechada, «Concurrencia en la suite SQL», con los escenarios, los
  controles, los mutantes, la precisión sobre la 0454:411 y dos rutas de allowlist. Corrige además
  la evidencia anterior: las cuatro carreras de la spec se corrieron a mano y su script no está en
  el repo. Registra la verificación de la 0454 en producción que hizo el Director, leyendo solo el
  catálogo:
  - el ledger `20260915155857`;
  - identidad exacta con `main`: md5 `02623202…` y 30 505 bytes;
  - los dos cuerpos coinciden con los del fixture de la carrera.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El archivo solo, con los flags de Docker del runner | **PASÓ**: 27 aserciones, sin residuo en el clúster |
| Escenario por escenario (copia con un `raise notice` por caso) | **PASÓ**: los 12 resultados salen por la razón correcta, según la tabla de arriba |
| **Mutantes de la 0454**, por el runner real y fuera del repo | **Los dos FALLARON, como tenían que fallar**. Ver la tabla de abajo |
| El mismo andamiaje sin mutación | **PASÓ**: ✓ en los dos archivos (el contrato 0454 y la carrera) |
| Huella tras un fallo (bases, roles, extensiones y sesiones del clúster) | **PASÓ en tres modos**: guarda, corte a mitad (la barrera vencida en los 12 casos) y rojo (M1). La guarda, con `service_role` ya creado, aborta sin tocar nada y **conserva** el rol |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ**: 475 specs, sin números repetidos, cápsula vigente |
| Suite SQL completa por el runner real, en el turno de máquina del Director, sobre `f85364ec` | **PASÓ**: 213 de 213 ✓, 0 ✗, 85 s, sin contenedores al terminar. El archivo nuevo pasa junto al contrato 0454 y las otras carreras de `main` |
| `md5(prosrc)` de las dos funciones en el fixture de la carrera contra producción (lectura de catálogo del Director) | **PASÓ**: coinciden exacto. `clients_revoke_portal_access` `050880a2…` (984 bytes) y `portal_access_require_live_client` `b8e102e1…` (728 bytes), las dos DEFINER |
| Merge de `main` `aab5a43b` (#163 y #164), con el driver | **PASÓ**: sin conflictos. Después del merge pasaron `docs:check` (475), `sdd:check`, `governance:check` y `git diff --check` |
| El archivo junto a las carreras 0449 y 0466 que entraron a `main` y a los contratos 0421, 0449, 0454 y 0466, por el runner real | **PASÓ**: 7 de 7 ✓, 14 s |
| CI alojado | **Por mensaje al Director**: la rama se publica después de este commit |

**Qué escenario mata a cada mutante** (fase real de la carrera):

| Mutante | Lo que se quita | Escenarios que fallan | El contrato de una sesión |
| --- | --- | --- | --- |
| M1 | el FOR SHARE de `portal_access_require_live_client` | 1, 2, 3 y 4 | también lo detecta, por su aserción estática 2b, que busca el FOR SHARE en el texto |
| M2 | la revocación de `clients_revoke_portal_access` se salta los vínculos ya revocados | 5 y 6 | también lo detecta, por la fusión de clientes, que deja un duplicado revocado con identidad |

La carrera muestra la consecuencia concurrente de cada mutante. El contrato de una sesión solo ve
el texto (M1) o un efecto secuencial (M2).

## COMMITS

| Commit | Propósito |
| --- | --- |
| `c10a54ba` | `test(db): SDD-0467`: el borrado de un cliente contra el acceso al Portal, con sesiones reales |
| `f85364ec` | `docs(SDD-0467)`: la sección fechada en la spec |
| `a51a5304` | `docs(SDD-0467)`: quién asignó el seguimiento y la verificación de producción en la spec, y este handoff |
| `da3001a0` | merge de `origin/main` `aab5a43b` con el driver, sin conflictos |
| el commit que contiene esta versión | `docs(handoff)`: el merge final en este handoff |

## PR / BRANCH

- Rama `codex/carrera-borrado-0454`, base `main`, worktree de arriba. Se publica con un solo push
  después de este commit. El número de la PR y el SHA van por mensaje al Director.

## PENDIENTES DE ESTA TAREA

1. Push y PR contra `main`, con el número y el SHA por mensaje.
2. Revisión e integración del Director.

## FUERA DE ALCANCE DETECTADO

1. **La 0454:411 no es un lock de tiempo de ejecución.** El `for update of cu` está en el
   `DO $backfill$`, que corrió una vez al aplicar. En ejecución protegen la guarda con FOR SHARE y
   la revocación que actualiza todas las filas del cliente.
2. **Las cuatro carreras de la spec 0467 no tienen script en el repo.** Se corrieron a mano, con
   esperas de 2 s sin confirmar; no figuran en la allowlist ni en `main`. Con este archivo quedan
   cubiertas y reproducibles; los escenarios 2 y 4 son nuevos.
3. **Docker Desktop no arrancó con el reinicio del equipo** del 2026-09-19 (13:14 en Caracas). Lo
   inicié desde esta sesión para poder correr las pruebas. No es de este repo, pero cualquier
   sesión que corra la suite SQL lo necesita.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0467, con la sección nueva y la allowlist. El índice `docs/specs/README.md`
  no cambia (`docs:check` en verde).
- **Documentación en código:** la cabecera del `.test.sql`.
- **No aplica:**
  - `BRAND.md` y `docs/design/**`: no hay UI;
  - `docs/marketing/**` y `docs/governance/**`: no hay política nueva;
  - `revisar-datos-ve`: el test no cambia qué datos se capturan, mueven o borran, y usa fixtures
    ficticios en una base desechable.
  - `docs/legal/privacidad/mapa-de-borrado.md`: la regla de borrado no cambia; solo se prueba bajo
    concurrencia.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff.

## Control rojo reproducible (fuera del repo)

Los mutantes no viven en el repo. El script arma, en una carpeta nueva, una copia de
`supabase/migrations` y de los dos archivos de prueba (el contrato 0454, del que sale el fixture, y
la carrera), con la 0454 mutada, y la pasa por el runner real:

```bash
node rojo-0454.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <M1|M2|verde>
```

```js
// Control rojo de supabase/tests/0454_borrado_cliente_carrera.test.sql, fuera del repo.
// Arma una copia de supabase/ (migraciones + el contrato 0454, del que sale el
// fixture, + el test de la carrera) con UNA mutación de la 0454 y la pasa por el
// runner real (scripts/run-sql-tests.mjs). El contrato también corre, porque el
// runner corre todo *.test.sql.
//
//   node rojo-0454.cjs <worktree> <carpeta-nueva> <variante>
//
//   M1     portal_access_require_live_client sin el FOR SHARE del cliente
//   M2     clients_revoke_portal_access se salta los vínculos ya revocados
//   verde  sin mutación                                                   → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MUTANTES = {
  M1: ["     where c.id = new.client_id and c.deleted_at is null\n       for share of c;",
       "     where c.id = new.client_id and c.deleted_at is null;"],
  M2: ["   where cu.client_id = new.id;",
       "   where cu.client_id = new.id and cu.status <> 'revoked';"],
};
const [W, D, V] = process.argv.slice(2);
if (!W || !D || !V) throw new Error("uso: node rojo-0454.cjs <worktree> <carpeta-nueva> <variante>");
if (!(V in MUTANTES) && V !== "verde") throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
for (const t of ["0454_borrar_cliente_revoca_portal.test.sql", "0454_borrado_cliente_carrera.test.sql"]) {
  fs.copyFileSync(path.join(W, "supabase", "tests", t), path.join(D, "supabase", "tests", t));
}

const archivo = "0454_borrar_cliente_revoca_portal.sql";
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
  spec 0467. Ningún archivo de producto.
- **Dependencias:** `dblink` en la imagen del runner (`postgres:17`) y el contrato
  `0454_borrar_cliente_revoca_portal.test.sql`, del que sale el fixture. Sin `dblink`, el archivo
  falla en vez de hacer SKIP.
- **Conocimiento:** Graphify, Archify y la bóveda quedan para la publicación del Director desde
  `main`.
- **Sesiones consumidoras:** ninguna. El claim se libera al abrir la PR; el worktree y la rama se
  conservan.
