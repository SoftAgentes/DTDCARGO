# Handoff 0488 · seguimiento: la carrera del cobro de la 0467 y la interoperabilidad con la 0466

- Fecha: 2026-09-18 (Caracas; 2026-09-19 UTC). Estado de la tarea: **lista para la PR**. Espera
  el turno de integración del Director, detrás de la #154, la #158 y el cierre de la 0487.
- Owner/sesión: `worker-carrera-cobro-0467-20260919` (Claude Opus 5, Worker, sesión «Automatizar la
  prueba de carrera del for update de 0459» [7a0aa1], que siguió con esta tarea a pedido de Sam).
  Director: `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-cobro-0467`, creado con
  `harness-worktree start`.
- Rama: `codex/carrera-cobro-0467`, desde `origin/main` = `7741f587`. Después se trajo `main`
  `e9e8240e` con el driver `dtd-generated-records`, con la #159 y la 0466.
- SDD: [0488](../../docs/specs/0488-carrera-cobro-factura/spec.md), como seguimiento y sin número
  nuevo, por decisión del Director. El segundo entregable es el seguimiento que la
  [SDD-0487](../../docs/specs/0487-portal-cliente-empresa-facturacion/spec.md) dejó para el Worker de
  las carreras. El script `scripts/qa/cobro-factura-race.mjs` se conserva.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de cada commit se revalidó con `guard --owner`.
- Permisos del encargo: commits en esta rama; push de la rama propia y PR contra `main` después de
  reportarle al Director. **No merge. No producción.** La 0466 (md5 `5d2416b1…`) y la 0467
  (`e40de959…`, el mismo md5 que el ledger de producción) no se tocan.

## OBJETIVO ORIGINAL

1. Llevar a la suite SQL de `verify` la carrera del cobro de la 0467. Hasta ahora corre solo a mano
   con `scripts/qa/cobro-factura-race.mjs`. Según el Director:
   - van los 13 escenarios, cada uno con su control ANTES en la misma corrida. Si un control no
     reproduce, el archivo falla;
   - en el 8, el control es que S1 muera por `duplicate key`;
   - los 12 y 13 (coherencia con la 0464) no se recortan;
   - los cinco mutantes del script corren fuera del repo, con el runner real. Tienen que morir los
     cinco, y hay que anotar qué escenario mata a cada uno.
2. La interoperabilidad real de la 0466 y la 0467, que la SDD-0487 dejó como seguimiento, en un
   archivo aparte de una sola sesión. Son las tres RPC de Cobranzas sobre facturas que la 0466 selló
   al emitir. Tiene que probar cuatro cosas:
   - el titular no cambia;
   - no se vuelve a sellar;
   - no aparece `invoice_bill_to_overridden`;
   - las transiciones son las mismas que sin la 0466.

## COMPLETADO

- **`supabase/tests/0467_cobro_factura_carrera.test.sql`** (54 aserciones), con el patrón de las
  otras carreras:
  - `dblink` contra una base propia;
  - barrera por `pg_blocking_pids`, sin `sleep`;
  - limpieza protegida ante cualquier error;
  - guarda de clúster desechable.
  - **Fixture:** la unión de los fixtures de los contratos 0467 y 0421. La parte de plataforma sale
    del contrato 0467, leído de su archivo, e incluye `get_user_tenant_id` con el cuerpo de la 0453,
    el que exige el preflight de la 0467. Lo que la 0421 necesita y la 0467 no trae va copiado del
    contrato 0421: Storage, `clients` y el markbox de `shipments`. Las migraciones son las que los
    dos contratos incluyen con `\ir`, sin repetir y en orden de número. Después van la 0421 y la
    0464, como en producción, y la semilla del script.
  - **Fase ANTES**, sin la 0467: la app vieja, petición por petición, cada una en su propia
    transacción. Los 13 escenarios tienen que reproducir la pérdida. En el 8, S1 tiene que morir
    por el código R- repetido.
  - **Fase DESPUÉS**, con la 0467 aplicada en la misma corrida: las RPC. En los 13, S2 tiene que
    esperar a S1: en el 8 en el lock consultivo del tenant, y en los demás en la fila. Además:
    - S1 no falla;
    - sale el rechazo esperado: `PAYMENT_EXCEEDS_BALANCE` en el 2, el 12 y el 13, y
      `PAYMENT_RECEIPT_APPLIED` en el 7;
    - en cada factura, pagado = recibos vigentes + reportes confirmados, sin pasar el total;
    - en el 8 quedan dos códigos R- distintos.
  - Cada escenario que no cumple queda anotado y la corrida sigue. El mensaje final lista los
    controles que no reprodujeron y los escenarios que fallaron. Así, cada mutante muestra todos
    sus escenarios.
- **`supabase/tests/0467_cobro_factura_sellada.test.sql`** (10 aserciones).
  - **Fixture:** el de la carrera, más la región del contrato 0466 que sigue a su `\ir` de la 0464:
    la 0392, las columnas de `clients`, la 0445, la 0462 y, en la base `con`, la 0466. Encima va la
    0467. Se compone sin trucos, porque el fixture de la carrera ya trae el cuerpo de producción de
    `get_user_tenant_id`.
  - **Dos bases:** `con` (con la 0466) y `sin` (sin ella). En cada una, una sola sesión de
    contabilidad corre la misma secuencia con las RPC reales.
  - **X**, emitida con la preferencia (su empresa), pasa por:
    - un cobro de 300;
    - la identificación de un sin-ref de 200;
    - un cobro de 500, con el que queda `pagada`;
    - la anulación de los tres recibos, hasta volver a `emitida`.
  - **Y**, emitida desde el borrador con `bill_to_kind = persona` y override auditado: un cobro de
    1000 y su anulación.
  - Ya emitidas, cambian la razón social y el domicilio de la empresa y el nombre del cliente. Si
    algo volviera a sellar, el titular cambiaría.
  - **Aserciones:**
    - la base `con` tiene la 0466 y la `sin` no; las dos tienen la 0467;
    - el sello inicial de X y de Y, y el override de Y;
    - transiciones iguales en las dos bases: estado y pagado de la RPC y de la factura;
    - el recorrido esperado: parcial, pagada y vuelta a emitida;
    - el titular de X y de Y no cambia en ningún paso;
    - X sigue sin override e Y con uno solo;
    - los recibos de X llevan el nombre sellado.
- **Spec 0488:** una sección fechada en «Evidencia» con los escenarios que mata cada mutante, y
  cuatro filas en su allowlist. **Spec 0487:** una línea en el seguimiento que dice dónde quedó la
  interoperabilidad.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| La carrera, sola, con los flags de Docker del runner (después del merge con `e9e8240e`) | **PASÓ**: 54 aserciones, 0,9 s, sin residuo en el clúster |
| La carrera, escenario por escenario (copia con un `raise notice` por escenario) | **PASÓ**: los 26 resultados salen por la razón correcta. ANTES pierde en los 13; en el 8, S1 muere por `payment_receipts_tenant_id_receipt_code_key`. DESPUÉS, S2 espera en los 13 (`advisory` en el 8, `transactionid` en los demás). Salen los rechazos esperados y el invariante vale |
| **Mutantes de la 0467**, por el runner real y fuera del repo, con la función `mutant` del script | **Los cinco FALLARON, como tenían que fallar**. Ningún control ANTES dejó de reproducir. Los escenarios DESPUÉS que fallan están en la tabla de abajo |
| El mismo andamiaje con la 0467 intacta | **PASÓ**: ✓ en los tres archivos (contratos 0421 y 0467, y la carrera) |
| La interoperabilidad, sola | **PASÓ**: 10 aserciones, 0,7 s, sin residuo |
| **Mutantes de la 0466**, por el runner real y fuera del repo | **Los dos FALLARON, como tenían que fallar**. «resella» (vuelve a sellar al pasar de parcial a emitida): ✗ en el titular. El contrato 0466 también lo detecta, en «parcial → emitida no vuelve a sellar», con sus UPDATE simulados. «congela» (la inmutabilidad también congela el estado): la RPC choca con `invoice_titular_frozen` |
| El mismo andamiaje con la 0466 intacta | **PASÓ**: ✓ en los cuatro archivos (contratos 0421, 0466 y 0467, y la interoperabilidad) |
| Huella tras un fallo (bases, roles, extensiones y sesiones del clúster), en los dos archivos | **PASÓ en tres modos**: guarda, corte a mitad (la barrera vencida en los 26 escenarios; una RPC que choca a mitad de la secuencia) y rojo (M1). La guarda, con `service_role` ya creado, aborta sin tocar nada y **conserva** el rol |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ**: 474 specs, sin números repetidos, cápsula vigente |
| Suite SQL completa por el runner real, en el turno de máquina del Director, sobre `95be5370` | **PASÓ**: 210 de 210 ✓, 0 ✗, 81 s. Pasan juntos los dos archivos nuevos, los contratos de los que sale su fixture (0421, 0466 y 0467) y las otras carreras de la rama (0421, 0427, 0459 y 0460) |
| CI alojado | **NO EJECUTADO todavía**: la rama no está publicada |

**Qué escenario mata a cada mutante de la 0467** (fase DESPUÉS de la carrera):

| Mutante | `FOR UPDATE` quitado | Escenarios que fallan | Lo que se ve |
| --- | --- | --- | --- |
| M1 | la factura, en `register_collection_receipt` | 1, 2, 4, 5 y 13 | S2 lee el pagado viejo y escribe encima. En el 1 y el 2 espera en el lock consultivo y no en la fila; el 2 y el 13 cobran sin `PAYMENT_EXCEEDS_BALANCE` |
| M2 | el recibo, en `identify_collection_receipt` | 7 | el mismo pago queda acreditado en las dos facturas |
| M3 | la factura, en `identify_collection_receipt` | 9 | la identificación pisa el cobro |
| M4 | el recibo, en `void_collection_receipt` | 10 | la anulación no ve la identificación en curso |
| M5 | la factura, en `void_collection_receipt` | 11 | la anulación pisa el cobro |

El script listaba para M1 los escenarios 1, 2, 4 y 13, y solo corría esos. La suite corre los 13, y
M1 cae también en el 5: el cobro lee el pagado de antes de la anulación y deja 700 con 300 en
recibos. El contrato `0467_cobro_factura_atomico.test.sql` detecta los cinco con su centinela, que
cuenta los `FOR UPDATE` en el texto. La carrera muestra la consecuencia de cada uno.

## COMMITS

| Commit | Propósito |
| --- | --- |
| `058a128d` | `test(db): SDD-0488`: la carrera del cobro de la 0467, con sesiones reales |
| `934c7bcd` | merge de `origin/main` `e9e8240e` con el driver, sin conflictos |
| `9454be63` | `test(db): SDD-0488`: las RPC de Cobranzas sobre facturas selladas por la 0466 |
| `fc2ac901` | `test(db): SDD-0488`: la carrera exige el lock en que espera S2 |
| `95be5370` | `docs(SDD-0488)`: evidencia y allowlist en la 0488; la línea en la 0487 |
| el commit que contiene este documento | `docs(handoff)`: este handoff |

## PR / BRANCH

- Rama `codex/carrera-cobro-0467`, base `main`, worktree de arriba. Todavía no está publicada.

## PENDIENTES DE ESTA TAREA

1. Traer el `main` que indique el Director. El cierre de la 0487 toca su spec, así que después se repiten lo liviano y los dos archivos nuevos.
2. Push y PR contra `main`, con el número y el SHA por mensaje.

## FUERA DE ALCANCE DETECTADO

1. **`scripts/qa/cobro-factura-race.mjs` queda duplicado** en sus modos ANTES, DESPUÉS y
   `--mutantes`, que ya cubren este contrato y su control rojo. Solo le queda `--migracion
   <archivo>`, para correr DESPUÉS contra otra versión de la 0467. El Director decidió conservarlo.
2. **Los fixtures de los contratos 0421 y 0467 no se pueden componer directamente.** Los dos crean
   `tenants`, `user_tenants` y `get_user_tenant_id`: el de la 0421, con un stub `limit 1`; el de la
   0467, con el cuerpo de la 0453. Los dos incluyen además 0077, 0230, 0258, 0261, 0267 y 0294.
   Este seguimiento los une a mano en su bloque de plataforma. Si alguno de los dos contratos
   cambia de forma, los dos archivos nuevos fallan en vez de probar sobre otro fixture. Un fixture
   compartido de Cobranzas y reportes podría vivir en un solo lugar.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0488, con evidencia y allowlist, y la 0487, con una línea. El índice
  `docs/specs/README.md` no cambia (`docs:check` en verde).
- **Documentación en código:** las cabeceras de los dos `.test.sql`.
- **No aplica:**
  - `BRAND.md` y `docs/design/**`: no hay UI;
  - `docs/marketing/**` y `docs/governance/**`: no hay política nueva;
  - `revisar-datos-ve`: los tests no cambian qué datos se capturan, mueven o borran, y usan fixtures
    ficticios (nombres, RIF y cédula inventados) en bases desechables.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff.

## Control rojo reproducible (fuera del repo)

Los mutantes no viven en el repo. Cada script arma, en una carpeta nueva, una copia de
`supabase/migrations` y de los archivos de prueba que el fixture necesita, con una migración mutada,
y la pasa por el runner real.

**La carrera (mutantes de la 0467):**

```bash
node rojo-0467.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <M1|M2|M3|M4|M5|verde>
```

```js
// Control rojo de supabase/tests/0467_cobro_factura_carrera.test.sql, fuera del repo.
// Arma una copia de supabase/ (migraciones + los contratos 0421 y 0467, de los
// que sale el fixture, + el test de la carrera) con UNA mutación de la 0467 y la
// pasa por el runner real (scripts/run-sql-tests.mjs). Los dos contratos también
// corren, porque el runner corre todo *.test.sql.
//
//   node rojo-0467.cjs <worktree> <carpeta-nueva> <variante>
//
//   M1..M5  los mutantes de scripts/qa/cobro-factura-race.mjs: la 0467 sin UNO de
//           sus FOR UPDATE, con la misma función `mutant` del script      → ✗
//     M1 register_collection_receipt, el único (la factura)
//     M2 identify_collection_receipt, el 1º (el recibo)
//     M3 identify_collection_receipt, el 2º (la factura)
//     M4 void_collection_receipt, el 1º (el recibo)
//     M5 void_collection_receipt, el 2º (la factura)
//   verde   sin mutación                                                  → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MUTANTES = {
  M1: ["register_collection_receipt", 1],
  M2: ["identify_collection_receipt", 1],
  M3: ["identify_collection_receipt", 2],
  M4: ["void_collection_receipt", 1],
  M5: ["void_collection_receipt", 2],
};
const [W, D, V] = process.argv.slice(2);
if (!W || !D || !V) throw new Error("uso: node rojo-0467.cjs <worktree> <carpeta-nueva> <variante>");
if (!(V in MUTANTES) && V !== "verde") throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
for (const t of ["0421_payment_report_commands.test.sql", "0467_cobro_factura_atomico.test.sql",
  "0467_cobro_factura_carrera.test.sql"]) {
  fs.copyFileSync(path.join(W, "supabase", "tests", t), path.join(D, "supabase", "tests", t));
}

// La de scripts/qa/cobro-factura-race.mjs: 0467 sin el FOR UPDATE nº `nth` de `fn`.
function mutant(text, fn, nth) {
  const start = text.indexOf(`create function public.${fn}(`);
  const end = text.indexOf("$function$;", start);
  if (start < 0 || end < 0) throw new Error("mutante: no encontré " + fn);
  const site = [...text.slice(start, end).matchAll(/\n\s*for update;/g)][nth - 1];
  if (!site) throw new Error(`mutante: ${fn} no tiene ${nth} FOR UPDATE`);
  const at = start + site.index;
  return text.slice(0, at) + ";" + text.slice(at + site[0].length);
}

const archivo = "0467_cobro_factura_atomico.sql";
const destino = path.join(D, "supabase", "migrations", archivo);
if (V !== "verde") {
  const [fn, nth] = MUTANTES[V];
  fs.writeFileSync(destino, mutant(fs.readFileSync(destino, "utf8"), fn, nth));
}

const diff = spawnSync("git", ["diff", "--no-index", "--unified=1", "--no-color",
  path.join(W, "supabase", "migrations", archivo), destino], { encoding: "utf8" });
console.log(`== diff de ${archivo} (${V}):`);
console.log(diff.stdout.split("\n").filter((l) => /^[-+ ][^-+]/.test(l) || /^@@/.test(l)).join("\n") || "(sin cambios)");

const t0 = Date.now();
const run = spawnSync(process.execPath, [path.join(W, "scripts", "run-sql-tests.mjs")], { cwd: D, encoding: "utf8" });
process.stdout.write((run.stdout || "") + (run.stderr || ""));
console.log(`== runner exit ${run.status} en ${Date.now() - t0} ms`);
process.exitCode = run.status;
```

**La interoperabilidad (mutantes de la 0466):**

```bash
node rojo-sellada.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <resella|congela|verde>
```

```js
// Control rojo de supabase/tests/0467_cobro_factura_sellada.test.sql, fuera del repo.
// Arma una copia de supabase/ (migraciones + los contratos 0421, 0466 y 0467, de
// los que sale el fixture, + el test de la interoperabilidad) con UNA mutación de
// la 0466 y la pasa por el runner real (scripts/run-sql-tests.mjs). Los contratos
// también corren, porque el runner corre todo *.test.sql.
//
//   node rojo-sellada.cjs <worktree> <carpeta-nueva> <variante>
//
//   resella    el trigger vuelve a sellar cuando la factura vuelve a emitida
//              desde otro estado (parcial → emitida al anular un recibo)   → ✗
//   congela    la inmutabilidad del titular congela también el estado       → ✗
//   verde      sin mutación                                                 → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const [W, D, V] = process.argv.slice(2);
if (!W || !D || !V) throw new Error("uso: node rojo-sellada.cjs <worktree> <carpeta-nueva> <variante>");
if (!["resella", "congela", "verde"].includes(V)) throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
for (const t of ["0421_payment_report_commands.test.sql", "0466_client_billing_identity.test.sql",
  "0467_cobro_factura_atomico.test.sql", "0467_cobro_factura_sellada.test.sql"]) {
  fs.copyFileSync(path.join(W, "supabase", "tests", t), path.join(D, "supabase", "tests", t));
}

const archivo = "0466_client_billing_identity.sql";
const destino = path.join(D, "supabase", "migrations", archivo);
let s = fs.readFileSync(destino, "utf8");
const una = (a, b) => {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`«${a.slice(0, 60)}» aparece ${n} veces en ${archivo}`);
  s = s.replace(a, b);
};
if (V === "resella") {
  una("  if tg_op = 'UPDATE' and old.status <> 'borrador' then",
      "  if tg_op = 'UPDATE' and old.status <> 'borrador'\n     and not (old.status <> 'emitida' and new.status = 'emitida') then");
  una("    or (tg_op = 'UPDATE' and old.status = 'borrador' and new.status = 'emitida')",
      "    or (tg_op = 'UPDATE' and old.status <> 'emitida' and new.status = 'emitida')");
}
if (V === "congela") {
  una("       or new.bill_to_kind is distinct from old.bill_to_kind then",
      "       or new.bill_to_kind is distinct from old.bill_to_kind\n       or new.status is distinct from old.status then");
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

- **Siguiente acción:** el SHA de `main` para el último merge; después, la PR.
- **Cambios compartidos:** dos archivos nuevos en `supabase/tests/`, que el runner descubre solo, y
  las specs 0488 y 0487. Ningún archivo de producto.
- **Dependencias:**
  - `dblink` en la imagen del runner (`postgres:17`). Sin él, los dos archivos fallan en vez de
    hacer SKIP;
  - los contratos `0421_payment_report_commands.test.sql`, `0467_cobro_factura_atomico.test.sql` y
    `0466_client_billing_identity.test.sql`, de los que sale el fixture.
- **Conocimiento:** Graphify, Archify y la bóveda quedan para la publicación del Director desde
  `main`.
- **Sesiones consumidoras:** ninguna. El claim se libera al terminar la escritura; el worktree y la
  rama se conservan.
