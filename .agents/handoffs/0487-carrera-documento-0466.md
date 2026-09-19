# Handoff 0487 · seguimiento: la unicidad del documento del cliente bajo concurrencia (0466 con la 0462)

- Fecha: 2026-09-19. Estado de la tarea: **lista en local**. La suite SQL completa pasó en el turno
  del Director. El push único y la PR esperan su aviso por el bloqueo de Vercel.
- Owner/sesión: `worker-carrera-documento-0466-20260919` (Claude Opus 5, Worker, sesión «Automatizar
  la prueba de carrera del for update de 0459» [7a0aa1], que siguió con esta tarea a pedido de Sam).
  Director: `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-documento-0466`, creado
  con `harness-worktree start`.
- Rama: `codex/carrera-documento-0466`, desde `origin/main` = `88713e47`, sin upstream hasta el push.
  Es una rama separada de la de la 0449: una tarea, una rama.
- SDD: [0487](../../docs/specs/0487-portal-cliente-empresa-facturacion/spec.md), como seguimiento y
  sin número nuevo, por decisión del Director.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de cada commit se revalidó con `guard --owner`.
- Permisos del encargo: commits en esta rama. El push y la PR esperan el turno del Director.
  **No merge. No producción.** La 0466 (md5 `5d2416b1…`, idéntica a la de producción según el
  Director) y la 0462 (`9dc2934f…`) no se tocan.

## OBJETIVO ORIGINAL

Probar con sesiones reales la unicidad del documento del cliente en la 0466, con la 0446 y la 0462:

- el mismo documento entra a la vez por las dos puertas: la RPC del Portal (0466:495) y el trigger
  de `clients` (0466:209);
- dos fichas toman el mismo documento, con el lock de la 0446 (:175) y los FOR UPDATE.

Cada escenario va con barrera por `pg_blocking_pids`, su control sin el lock en la misma corrida y
sus mutantes fuera del repo, anotando qué escenario mata a cada mutante. Tiene que quedar claro si
se sostiene la afirmación de la spec («los dos lados toman el mismo lock consultivo por (tenant,
documento normalizado)»). Un hueco real se reporta con evidencia y no se arregla.

## COMPLETADO

- **`supabase/tests/0466_documento_cliente_carrera.test.sql`** (39 aserciones), con el patrón de
  las otras carreras:
  - `dblink` contra una base propia;
  - barrera por `pg_blocking_pids`, que además exige el tipo de lock en que espera la segunda sesión;
  - limpieza protegida ante cualquier error;
  - guarda de clúster desechable.
  - **Fixture:** el del contrato 0466, leído de los archivos. Es la región del contrato 0421 que la
    0466 incluye en modo `fixture_in_transaction`, más la suya: 0464, 0392, columnas de `clients`,
    0445, 0462 y 0466. Encima, por escenario, clientes propios del tenant A con su principal activo
    del Portal.
  - **Control en la misma corrida:** cada escenario corre primero sin el lock que defiende. La
    variante sale con `pg_get_functiondef`; el trigger de `clients` se reemplaza y se restituye, y el
    archivo comprueba que quedó igual. Si un reemplazo no encuentra su texto, el control no da lo
    esperado y el archivo falla.
  - **Nueve escenarios** (la tabla completa está en la spec 0487, sección «Unicidad del documento
    bajo concurrencia»):
    - 1 a 4, entre clientes, por el lock consultivo de los dos lados. Sin el lock, el documento
      queda repetido entre las dos tablas; en el 3, el índice de identidades lo bloquea igual pero
      el intento pierde la ficha en conflicto. Con la 0466, espera en `advisory` y sale `blocked` o
      `client_doc_taken_by_billing_identity`.
    - 5, dos fichas con el mismo RIF desde su perfil: con el lock o sin él queda `blocked`. Lo
      protege el índice `clients_tenant_doc_unique` (0095).
    - 6 a 9, el mismo cliente contra sí mismo, por los FOR UPDATE. Sin ellos:
      - una elección de tipo devuelve `applied` y queda auditada, aunque no ocurrió;
      - guardar dos veces deja dos eventos de auditoría;
      - el mismo cambio de RIF consume dos del cupo;
      - un guardado responde `no_changes` mientras la empresa queda borrada.
- **Spec 0487:** una sección fechada, «Unicidad del documento bajo concurrencia», con los
  escenarios, los mutantes, dos precisiones, el hallazgo y dos rutas de allowlist. El hallazgo
  queda además en su «Fuera de alcance», por indicación del Director. La spec dice que la
  protección entre fichas es `clients_tenant_doc_unique` (0095) más el `unique_violation` de la
  0462, y cita la 0446:175 solo para aclarar que es un backfill que corre una vez.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El archivo solo, con los flags de Docker del runner | **PASÓ**: 39 aserciones, sin residuo en el clúster |
| Escenario por escenario (copia con un `raise notice` por caso) | **PASÓ**: los 18 resultados salen por la razón correcta (con el 9 agregado después, el archivo completo volvió a pasar) |
| **Mutantes de la 0466 y la 0462**, por el runner real y fuera del repo | **Los seis FALLARON, como tenían que fallar**. Ver la tabla de abajo |
| El mismo andamiaje sin mutación | **PASÓ**: ✓ en los tres archivos (contratos 0421 y 0466, y la carrera) |
| Huella tras un fallo (bases, roles, extensiones y sesiones del clúster) | **PASÓ en tres modos**: guarda, corte a mitad (la barrera vencida en los 18 casos) y rojo (M1). La guarda, con `service_role` ya creado, aborta sin tocar nada y **conserva** el rol |
| Restaurar una ficha borrada que tenía empresa (una sola sesión, fixture del contrato 0466, fuera del repo) | **HUECO REPRODUCIDO**: ver «FUERA DE ALCANCE DETECTADO» |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ**: 475 specs, sin números repetidos, cápsula vigente |
| Suite SQL completa por el runner real, en el turno de máquina del Director, sobre `cb7de492` | **PASÓ**: 213 de 213 ✓, 0 ✗, 79 s, sin contenedores al terminar. El archivo nuevo pasa junto al contrato 0466 y las otras carreras de `main` |
| CI alojado | **NO EJECUTADO**: la rama no está publicada, por el aviso de costos del Director |

**Qué escenario mata a cada mutante** (fase real de la carrera):

| Mutante | Lo que se quita | Escenarios que fallan |
| --- | --- | --- |
| M1 | 0466: el lock consultivo del trigger de `clients` | 1, 2, 4 y 5 |
| M2 | 0466: el lock consultivo de `portal_upsert_my_billing_identity` | 1, 2, 3 y 4 |
| M3 | 0466: el FOR UPDATE de la ficha en `portal_upsert_my_billing_identity` | 7 |
| M4 | 0466: el FOR UPDATE de la empresa en `portal_upsert_my_billing_identity` | 9 |
| M5 | 0466: el FOR UPDATE de `portal_set_my_billing_kind` | 6 |
| M6 | 0462: el FOR UPDATE de `portal_update_my_profile` | 8 |

Dos notas sobre esta tabla:

- M1 y M2 caen cada uno en los dos órdenes (1 y 2): el lock tiene que estar en los dos lados.
- M1 cae en el 5 solo por el tipo de lock: la segunda espera en el índice en vez del lock
  consultivo, y queda `blocked` igual.

El contrato 0466 de una sola sesión no detecta ninguno de los seis.

## COMMITS

| Commit | Propósito |
| --- | --- |
| `5ff2e077` | `test(db): SDD-0487`: la unicidad del documento bajo concurrencia, con sesiones reales |
| `cb7de492` | `docs(SDD-0487)`: la sección fechada en la spec |
| el commit que contiene este documento | `docs(SDD-0487)`: el hueco en «Fuera de alcance» de la spec, y este handoff |

## PR / BRANCH

- Rama `codex/carrera-documento-0466`, base `main`, worktree de arriba. No está publicada. El push
  único y la PR esperan el aviso del Director.

## PENDIENTES DE ESTA TAREA

1. Esperar el aviso del Director: cuando vuelva Vercel y Sam decida sobre Vercel Agent.
2. Con el aviso: traer `main` si avanzó, repetir lo liviano y el archivo, hacer un solo push y abrir la
   PR, con el número y el SHA por mensaje.

## FUERA DE ALCANCE DETECTADO

1. **Hueco latente, no de concurrencia: restaurar una ficha borrada puede repetir el documento de su
   empresa.** El trigger `clients_doc_not_billing_identity_elsewhere` salta al restaurar (UPDATE de
   `deleted_at`), pero revisa el `rif` principal de la ficha restaurada, no el de su empresa. Lo
   reproduje en una sola sesión con el fixture del contrato 0466:
   - se hace soft delete de A, que tiene la empresa `J-33333333-3`;
   - B toma ese RIF como documento principal, y el trigger lo deja pasar porque el dueño está
     borrado;
   - se restaura A, sin error.

   Queda el documento repetido entre `clients` y `client_billing_identities` en fichas vivas. Hoy
   ningún camino de la app restaura clientes (`ClientDrawer.tsx:61`: «Desde el Studio no se puede
   restaurar»). Solo se abriría con una restauración a mano por SQL o si algún día se agrega. Es un
   cambio de producto: el Director se lo pasa a Sam para que decida. Queda también en «Fuera de
   alcance» de la spec 0487.
2. **La 0446:175 no es un lock de tiempo de ejecución.** El `lock table public.clients,
   public.client_profile_edits in share row exclusive mode` está en el `DO $backfill_guard$` de
   reparación, que corrió una vez al aplicar. La unicidad entre fichas depende del índice 0095.
3. **El índice de identidades no distingue dueños borrados**, a diferencia del de `clients`.
   `client_billing_identities_tenant_doc_unique` no filtra por el dueño, así que la empresa de una
   ficha borrada sigue ocupando su documento para otras empresas. En cambio, el `rif` principal de
   otra ficha puede tomarlo. Es una asimetría: no duplica, pero bloquea con `blocked` y sin ficha en
   conflicto.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0487, con la sección nueva y la allowlist. El índice `docs/specs/README.md`
  no cambia (`docs:check` en verde).
- **Documentación en código:** la cabecera del `.test.sql`.
- **No aplica:**
  - `BRAND.md` y `docs/design/**`: no hay UI;
  - `docs/marketing/**` y `docs/governance/**`: no hay política nueva;
  - `revisar-datos-ve`: el test no cambia qué datos se capturan, mueven o borran. Usa fixtures
    ficticios (nombres, RIF y cédulas inventados) en una base desechable.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff.

## Control rojo reproducible (fuera del repo)

Los mutantes no viven en el repo. El script arma, en una carpeta nueva, una copia de
`supabase/migrations` y de los tres archivos de prueba (los contratos 0421 y 0466, de los que sale
el fixture, y la carrera), con la 0466 o la 0462 mutada, y la pasa por el runner real:

```bash
node rojo-0466.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <M1|M2|M3|M4|M5|M6|verde>
```

```js
// Control rojo de supabase/tests/0466_documento_cliente_carrera.test.sql, fuera del repo.
// Arma una copia de supabase/ (migraciones + los contratos 0421 y 0466, de los que
// sale el fixture, + el test de la carrera) con UNA mutación de la 0466 o de la 0462
// y la pasa por el runner real (scripts/run-sql-tests.mjs). Los contratos también
// corren, porque el runner corre todo *.test.sql.
//
//   node rojo-0466.cjs <worktree> <carpeta-nueva> <variante>
//
//   M1  0466: el trigger de clients sin el lock consultivo del documento
//   M2  0466: portal_upsert_my_billing_identity sin el lock consultivo del documento
//   M3  0466: portal_upsert_my_billing_identity sin el FOR UPDATE de la ficha
//   M4  0466: portal_upsert_my_billing_identity sin el FOR UPDATE de la empresa
//   M5  0466: portal_set_my_billing_kind sin el FOR UPDATE de la empresa
//   M6  0462: portal_update_my_profile sin el FOR UPDATE de la ficha
//   verde  sin mutación                                                    → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const M0466 = "0466_client_billing_identity.sql";
const M0462 = "0462_portal_profile_direct_edit.sql";
const MUTANTES = {
  M1: [M0466, "  perform pg_catalog.pg_advisory_xact_lock(\n" +
    "    pg_catalog.hashtextextended('billing-doc:' || new.tenant_id::text || ':' || v_norm, 0)\n  );\n", ""],
  M2: [M0466, "    perform pg_catalog.pg_advisory_xact_lock(\n" +
    "      pg_catalog.hashtextextended('billing-doc:' || v_tenant_id::text || ':' || v_norm, 0)\n    );\n", ""],
  M3: [M0466, "  where client.id = v_client_id and client.deleted_at is null\n  for update;",
    "  where client.id = v_client_id and client.deleted_at is null;"],
  M4: [M0466, "    into v_current\n  from public.client_billing_identities as identity\n" +
    "  where identity.client_id = v_client_id\n  for update;",
    "    into v_current\n  from public.client_billing_identities as identity\n" +
    "  where identity.client_id = v_client_id;"],
  M5: [M0466, "    into v_identity\n  from public.client_billing_identities as identity\n" +
    "  where identity.client_id = v_client_id\n  for update;",
    "    into v_identity\n  from public.client_billing_identities as identity\n" +
    "  where identity.client_id = v_client_id;"],
  M6: [M0462, "  where client.id = v_client_id and client.deleted_at is null\n  for update;",
    "  where client.id = v_client_id and client.deleted_at is null;"],
};
const [W, D, V] = process.argv.slice(2);
if (!W || !D || !V) throw new Error("uso: node rojo-0466.cjs <worktree> <carpeta-nueva> <variante>");
if (!(V in MUTANTES) && V !== "verde") throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
for (const t of ["0421_payment_report_commands.test.sql", "0466_client_billing_identity.test.sql",
  "0466_documento_cliente_carrera.test.sql"]) {
  fs.copyFileSync(path.join(W, "supabase", "tests", t), path.join(D, "supabase", "tests", t));
}

const archivo = V in MUTANTES ? MUTANTES[V][0] : M0466;
const destino = path.join(D, "supabase", "migrations", archivo);
if (V in MUTANTES) {
  const [, a, b] = MUTANTES[V];
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

- **Siguiente acción:** tu aviso para el push único y la PR. El hueco de la restauración (fuera de
  alcance 1) se lo pasas a Sam.
- **Cambios compartidos:** un archivo nuevo en `supabase/tests/`, que el runner descubre solo, y la
  spec 0487. Ningún archivo de producto.
- **Dependencias:**
  - `dblink` en la imagen del runner (`postgres:17`). Sin él, el archivo falla en vez de hacer
    SKIP;
  - los contratos `0421_payment_report_commands.test.sql` y
    `0466_client_billing_identity.test.sql`, de los que sale el fixture.
- **Conocimiento:** Graphify, Archify y la bóveda quedan para la publicación del Director desde
  `main`.
- **Sesiones consumidoras:** ninguna. El claim se libera al terminar la escritura; el worktree y la
  rama se conservan.
