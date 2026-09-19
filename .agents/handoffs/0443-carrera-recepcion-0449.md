# Handoff 0443 · seguimiento: la concurrencia de la recepción de prealertas (0449), con sesiones reales

- Fecha: 2026-09-19. Estado de la tarea: **lista en local**. La suite SQL completa pasó en el turno
  del Director. El push único y la PR esperan su aviso: la cuenta de Vercel está
  bloqueada por una factura impaga, y cada push a una PR dispara Vercel Agent y un build de preview.
- Owner/sesión: `worker-carrera-recepcion-0449-20260919` (Claude Opus 5, Worker, sesión «Automatizar
  la prueba de carrera del for update de 0459» [7a0aa1], que siguió con esta tarea a pedido de Sam).
  Director: `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-recepcion-0449`, creado
  con `harness-worktree start`.
- Rama: `codex/carrera-recepcion-0449`, desde `origin/main` = `88713e47`, sin upstream hasta el push.
- SDD: [0443](../../docs/specs/0443-prealertas-proveedor-etiquetas-recepcion/spec.md), como
  seguimiento y sin número nuevo, por decisión del Director. El script
  `scripts/qa/prealertas-reception-concurrency.mjs` se conserva.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de cada commit se revalidó con `guard --owner`.
- Permisos del encargo: commits en esta rama. El push de la rama propia y la PR contra `main`
  esperan el turno del Director. **No merge. No producción.** La 0449 (md5 `8f3c228d…`) no se toca.

## OBJETIVO ORIGINAL

Llevar a la suite SQL de `verify` la concurrencia de la 0449, con el patrón de las otras carreras.
Cada punto va con barrera por `pg_blocking_pids`, su control en la misma corrida y sus mutantes fuera
del repo. Son tres puntos, según el Director:

- el lock de `warehouse_receipts_cn` y los FOR UPDATE de `receive_prealerta_boxes_as_operario`;
- el lock consultivo y la versión esperada de `save_shipping_label_presentation`;
- el FOR UPDATE de `reconcile_labels_after_packing_list`.

Además, corregir la afirmación del `qa.md`: la corrida anterior no tenía barrera.

## COMPLETADO

- **`supabase/tests/0449_recepcion_prealerta_carrera.test.sql`** (29 aserciones), con el patrón de
  las otras carreras:
  - `dblink` contra una base propia;
  - barrera por `pg_blocking_pids`, que además exige el tipo de lock en que espera la segunda sesión;
  - limpieza protegida ante cualquier error;
  - guarda de clúster desechable.
  - **Fixture:** el del contrato 0449, leído de su archivo entre `begin;` y la primera inserción,
    con su `\ir` reemplazado por la migración. Encima: un tenant, dos administradores, un operario CN
    y, por escenario, compras propias con sus cajas.
  - **Control en la misma corrida:** cada escenario corre primero con una variante sin el lock que
    defiende. La variante sale con `pg_get_functiondef` de la versión aplicada; en el 6 se reemplaza
    el trigger y se restituye después, y el archivo comprueba que quedó igual. El control tiene que
    reproducir el defecto. Si un reemplazo no encuentra su texto, la variante queda igual a la
    función y el control no reproduce: el archivo falla.
  - **Seis escenarios**:

    | # | Escenario | Control (sin el lock) | Real (0449) | Espera en |
    |---|---|---|---|---|
    | 1 | Las mismas cajas, dos operarios a la vez (el del script) | sin los tres locks: la segunda choca con el código WR- repetido | la segunda recibe «Las cajas cambiaron o ya fueron recibidas»; una recepción con tres cajas | `relation` |
    | 2 | Dos compras del mismo tenant a la vez | sin el lock de la tabla: la segunda muere por el código WR- repetido | las dos reciben, con WR- consecutivos | `relation` |
    | 3 | La compra se cancela durante la recepción | sin el FOR UPDATE de la compra: se recibe una compra cancelada y termina en `recibida` | P0133 «no está activa»; la compra sigue cancelada y sin recepción | `transactionid` |
    | 4 | Una caja se anula durante la recepción | sin el FOR UPDATE de las cajas: aborta tarde, con «Recepción concurrente» | rechaza enseguida con «Las cajas cambiaron»; sin recepción | `transactionid` |
    | 5 | Dos administradores guardan las etiquetas con la misma versión | sin el lock consultivo: 23505 de la clave primaria; sin la versión esperada: el segundo pisa al primero en silencio | 40001 «Otra sesión cambió las etiquetas»; queda la versión del primero | `advisory` |
    | 6 | Llega una lista de empaque durante la recepción | sin el FOR UPDATE del trigger: el lote pasa de 3 a 5 | el lote no cambia | `transactionid` |

- **Spec 0443:** una sección fechada, «Concurrencia en la suite SQL», con los escenarios, los
  controles y los mutantes, y dos rutas de allowlist. También anota que la frase de «Criterios de
  aceptación» que da la 0449 por pendiente quedó desactualizada. Registra además la verificación de
  la 0449 en producción que hizo el Director el 2026-09-19, leyendo solo el catálogo:
  - ledger `20260910170544`;
  - el archivo no es idéntico byte a byte, por dos ediciones de la cabecera después de aplicar;
  - los tres cuerpos coinciden exacto con los del fixture de la carrera.
- **`qa.md` de la 0443:** una corrección fechada junto a la afirmación. El script lanza las dos
  llamadas con `Promise.all`, sin barrera, así que su verde no demuestra que compitieran.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El archivo solo, con los flags de Docker del runner | **PASÓ**: 29 aserciones, sin residuo en el clúster |
| Escenario por escenario (copia con un `raise notice` por caso) | **PASÓ**: los 13 resultados salen por la razón correcta, según la tabla de arriba |
| **Mutantes de la 0449**, por el runner real y fuera del repo | **Los seis FALLARON, como tenían que fallar**. Ver la tabla de abajo |
| El mismo andamiaje con la 0449 intacta | **PASÓ**: ✓ en los dos archivos (el contrato 0449 y la carrera) |
| Huella tras un fallo (bases, roles, extensiones y sesiones del clúster) | **PASÓ en tres modos**: guarda, corte a mitad (la barrera vencida en los 13 casos) y rojo (M2). La guarda, con `service_role` ya creado, aborta sin tocar nada y **conserva** el rol |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ**: 475 specs, sin números repetidos, cápsula vigente |
| Suite SQL completa por el runner real, en el turno de máquina del Director, sobre `9c2c8e72` | **PASÓ**: 213 de 213 ✓, 0 ✗, 77 s, sin contenedores al terminar. El archivo nuevo pasa junto al contrato 0449 y las otras ocho carreras |
| `md5(prosrc)` de las tres funciones en el fixture de la carrera contra producción (lectura de catálogo del Director) | **PASÓ**: coinciden exacto. `receive_prealerta_boxes_as_operario` `bf85211e…` (6350 bytes), `save_shipping_label_presentation` `f6550630…` (1332) y `reconcile_labels_after_packing_list` `66889600…` (804), las tres DEFINER |
| CI alojado | **NO EJECUTADO**: la rama no está publicada, por el aviso de costos del Director |

**Qué escenario mata a cada mutante de la 0449** (fase real de la carrera):

| Mutante | Lo que se quita | Escenarios que fallan | Lo que se ve |
| --- | --- | --- | --- |
| M1 | el lock de `warehouse_receipts_cn` en la recepción | 1 y 2 | en el 1, la segunda espera en la fila de la compra y no en la tabla; en el 2, muere por el WR- repetido |
| M2 | el FOR UPDATE de la compra en la recepción | 3 y 6 | se recibe una compra cancelada; y el trigger de conciliación ya no espera a la recepción, así que el lote se redimensiona |
| M3 | el FOR UPDATE de las cajas en la recepción | 4 | el rechazo llega tarde, con «Recepción concurrente». Los datos quedan bien por el chequeo final de filas |
| M4 | el lock consultivo de `save_shipping_label_presentation` | 5 | la segunda choca con la clave primaria (23505) en vez de recibir 40001 |
| M5 | la versión esperada de `save_shipping_label_presentation` | 5 | el segundo guardado pisa al primero en silencio. El contrato 0449 también lo detecta («Stale settings accepted») |
| M6 | el FOR UPDATE de `reconcile_labels_after_packing_list` | 6 | el lote pasa de 3 a 5 después de empezar la recepción |

Con M4, el control 5b tampoco reproduce. Su variante nace de la función mutada, así que pierde
también el lock consultivo y choca con la clave primaria en vez de pisar en silencio. En una corrida
normal los 13 controles reproducen.

## COMMITS

| Commit | Propósito |
| --- | --- |
| `4eb1fa76` | `test(db): SDD-0443`: la recepción de prealertas de la 0449, con sesiones reales |
| `9c2c8e72` | `docs(SDD-0443)`: la sección de la spec y la corrección del `qa.md` |
| `9b21373e` | `docs(SDD-0443)`: la 0449 verificada contra producción por el Director |
| el commit que contiene este documento | `docs(handoff)`: este handoff |

## PR / BRANCH

- Rama `codex/carrera-recepcion-0449`, base `main`, worktree de arriba. No está publicada. El push
  único y la PR esperan el aviso del Director.

## PENDIENTES DE ESTA TAREA

1. Esperar el aviso del Director: cuando vuelva Vercel y Sam decida sobre Vercel Agent.
2. Con el aviso: traer `main` si avanzó, repetir lo liviano y el archivo, hacer un solo push y
   abrir la PR, con el número y el SHA por mensaje.

## FUERA DE ALCANCE DETECTADO

1. **La spec 0443 da la 0449 por pendiente** («La migración sigue pendiente de autorización y
   aplicación»), pero está aplicada desde el 2026-09-10: el Director lo verificó contra el ledger. La
   nueva sección lo anota; la frase original no se reescribió. El Director decide si corresponde cerrar la aceptación de la 0443.
2. **El lock de `warehouse_receipts_cn` es de toda la tabla, sin distinguir tenant.** Dos
   recepciones de tenants distintos también se serializan. Hoy es un solo tenant operativo, así que
   no se nota. Con más aliados, se podría serializar solo el código WR- del tenant, como hace la
   0467 con su lock consultivo.
3. **`scripts/qa/prealertas-reception-concurrency.mjs` queda duplicado**, y sin barrera. El Director
   decidió conservarlo.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0443 (sección nueva y allowlist) y su `qa.md` (corrección fechada). El
  índice `docs/specs/README.md` no cambia (`docs:check` en verde).
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
`supabase/migrations` y de los dos archivos de prueba (el contrato 0449, del que sale el fixture, y
la carrera), con la 0449 mutada, y la pasa por el runner real:

```bash
node rojo-0449.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <M1|M2|M3|M4|M5|M6|verde>
```

```js
// Control rojo de supabase/tests/0449_recepcion_prealerta_carrera.test.sql, fuera del repo.
// Arma una copia de supabase/ (migraciones + el contrato 0449, del que sale el
// fixture, + el test de la carrera) con UNA mutación de la 0449 y la pasa por el
// runner real (scripts/run-sql-tests.mjs). El contrato también corre, porque el
// runner corre todo *.test.sql.
//
//   node rojo-0449.cjs <worktree> <carpeta-nueva> <variante>
//
//   M1  receive_prealerta_boxes_as_operario sin el lock de warehouse_receipts_cn
//   M2  receive_prealerta_boxes_as_operario sin el FOR UPDATE de la compra
//   M3  receive_prealerta_boxes_as_operario sin el FOR UPDATE de las cajas
//   M4  save_shipping_label_presentation sin el lock consultivo del tenant
//   M5  save_shipping_label_presentation sin la versión esperada
//   M6  reconcile_labels_after_packing_list sin el FOR UPDATE de la compra
//   verde  sin mutación                                                   → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MUTANTES = {
  M1: [["  -- Serialize the short allocation/adoption transaction before locking purchase/boxes.\n" +
        "  lock table public.warehouse_receipts_cn in share row exclusive mode;\n",
        "  -- Serialize the short allocation/adoption transaction before locking purchase/boxes.\n"]],
  M2: [["    where pr.id = v_box.prealerta_id and pr.tenant_id = v_op.tenant_id\n    for update;",
        "    where pr.id = v_box.prealerta_id and pr.tenant_id = v_op.tenant_id;"]],
  M3: [["    and prealerta_id = v_p.id and code = any(v_selected) for update;",
        "    and prealerta_id = v_p.id and code = any(v_selected);"]],
  M4: [["  perform pg_advisory_xact_lock(hashtextextended('shipping-label:' || v_tenant::text, 0));\n", ""]],
  M5: [["  if p_expected_version is distinct from v_version then\n" +
        "    raise exception 'Otra sesión cambió las etiquetas. Actualiza antes de guardar.' using errcode = '40001';\n" +
        "  end if;\n", ""]],
  M6: [["    and tenant_id = new.tenant_id for update;", "    and tenant_id = new.tenant_id;"]],
};
const [W, D, V] = process.argv.slice(2);
if (!W || !D || !V) throw new Error("uso: node rojo-0449.cjs <worktree> <carpeta-nueva> <variante>");
if (!(V in MUTANTES) && V !== "verde") throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
for (const t of ["0449_prealerta_exact_box_reception.test.sql", "0449_recepcion_prealerta_carrera.test.sql"]) {
  fs.copyFileSync(path.join(W, "supabase", "tests", t), path.join(D, "supabase", "tests", t));
}

const archivo = "0449_prealerta_exact_box_reception.sql";
const destino = path.join(D, "supabase", "migrations", archivo);
let s = fs.readFileSync(destino, "utf8");
for (const [a, b] of MUTANTES[V] || []) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`«${a.slice(0, 60)}» aparece ${n} veces en ${archivo}`);
  s = s.replace(a, () => b);
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

- **Siguiente acción:** tu aviso para el push único y la PR.
- **Cambios compartidos:** un archivo nuevo en `supabase/tests/`, que el runner descubre solo, y la
  spec 0443 con su `qa.md`. Ningún archivo de producto.
- **Dependencias:** `dblink` en la imagen del runner (`postgres:17`) y el contrato
  `0449_prealerta_exact_box_reception.test.sql`, del que sale el fixture. Sin `dblink`, el archivo
  falla en vez de hacer SKIP.
- **Conocimiento:** Graphify, Archify y la bóveda quedan para la publicación del Director desde
  `main`.
- **Sesiones consumidoras:** ninguna. El claim se libera al terminar la escritura; el worktree y la
  rama se conservan.
