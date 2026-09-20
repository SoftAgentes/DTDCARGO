# Handoff 0491 · la recepción de bodega China creada en el Studio vuelve a numerarse WR-

- Fecha: 2026-09-19, cerrado el 2026-09-20. Estado de la tarea: **la 0469 está APLICADA en
  producción** (2026-09-20 02:15 UTC, ledger `20260920021513`), con el OK nominal de Sam nombrando
  el archivo. La espera se retiró del baseline y la PR #171 queda lista para integrar.
- Owner/sesión: `worker-recepcion-wr-0491-20260919` (Claude Opus 5, Worker, sesión «Automatizar la
  prueba de carrera del for update de 0459»). Director: la sesión «Director notificación a
  workers», que asignó la tarea porque Sam pidió trabajo continuo.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/recepcion-codigo-wr-0491`, creado
  con `harness-worktree start` desde `main` `8235b70b`.
- Rama: `codex/recepcion-codigo-wr-0491`, sin upstream hasta el push.
- SDD: [0491](../../docs/specs/0491-recepcion-codigo-wr/spec.md). Reservada en local con
  `corepack pnpm sdd:next --reserve recepcion-codigo-wr`: lock `refs/dtd/reservations/0491` y rama
  `codex/sdd-reserve-0491-recepcion-codigo-wr` (`82dcee31`), incorporada con cherry-pick. La
  migración 0469 se reservó con su archivo en la rama (`91d705db`): después, `sdd:next` dio 0470
  como siguiente.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de cada commit se revalida con `guard --owner`.
- Permisos del encargo: commits en esta rama; el push único y la PR, con el aviso del Director.
  **No merge. No producción. No leer filas de producción.**

## OBJETIVO ORIGINAL

El punto 2 del «Fuera de alcance» de la SDD-0488. `createReceiptAction` generaba el código de la
recepción con `next_receipt_code`, que desde la 0079 da la serie `R-` de los cobros. Se pidió:

- un generador de `WR-` propio, con el criterio de serialización de la 0449, medido;
- el cambio en `cn/actions.ts`;
- contrato SQL con control rojo, la carrera de dos recepciones con dblink, vitest y mutantes;
- no tocar datos ni `next_receipt_code`;
- la PR migrate-first, lista para el OK de Sam.

## COMPLETADO

- **El defecto, medido:**
  - con el cuerpo real de la 0079 en PGlite, dos altas seguidas sin un cobro en medio salen las
    dos `R-2026-0042`, y la segunda falla con el unique;
  - además, la huérfana del Studio falla porque `next_orphan_code` es sólo de `service_role` desde
    la 0211.
- **`supabase/migrations/0469_recepcion_codigo_wr.sql`:** trigger BEFORE INSERT
  `warehouse_receipts_cn_assign_code`.
  - A la fila que llega sin código le asigna `WR-YYYY-NNNN`, o `SIN-CODIGO-NNNN` si es huérfana,
    en la misma transacción del INSERT.
  - Serializa con un lock consultivo por tenant (491). No usa el lock de tabla porque dentro del
    trigger dos altas se interbloquearían.
  - Es DEFINER, para contar las borradas que la RLS esconde, y no trunca pasado 9999.
  - Trae preflight y postflight.
- **`createReceiptAction`:** inserta sin `receipt_code` y lee el que asigna la base. Ya no llama a
  `next_receipt_code` ni a `next_orphan_code`.
- **Espera** de la 0469 en `supabase/migrations-baseline.json`, con el orden migrate-first y lo que
  el operador tiene que leer antes de aplicar.
- **Pruebas:**
  - el contrato SQL (15 aserciones, con control rojo). Una de ellas comprueba que el alta deja tomado
    el lock consultivo 491 de su tenant, como la 0467 con su 488;
  - el mismo contrato en vitest con PGlite (`recepcion-codigo-wr.migration.test.ts`), que es su
    cobertura en CI: verde, control rojo y los 7 mutantes. Lo sumé después de parar el primer
    `verify` a los 2 minutos, con el visto bueno del Director: las migraciones recientes (0461,
    0462, 0464-0468) lo tienen, y sin él el contrato de la 0469 no corría en CI;
  - la carrera con dblink (5 escenarios, 17 aserciones);
  - vitest de la acción (4 casos).
- **Spec 0491:** el defecto medido, las decisiones con su evidencia, la allowlist exacta, la
  aceptación, la gobernanza, el orden de release y el paso de auditoría propuesto para Sam.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El defecto, con el cuerpo real de `next_receipt_code` de la 0079 en PGlite | **Reproducido**: alta 1 `R-2026-0042`; alta 2 la misma, 23505 |
| Contrato `0469_recepcion_codigo_wr.test.sql`, solo | **PASÓ**: 14 aserciones, 301 ms, sin residuo. Con la aserción del lock 491 son 15; el contrato final pasa por el runner real en la fila de los bytes finales |
| Control rojo del contrato (`-v apply_fix=false`) | **FALLÓ, como tenía que fallar**: NOT NULL en `receipt_code`. Sobre el contrato final lo repite el envoltorio PGlite, con el mensaje exacto |
| Envoltorio PGlite `recepcion-codigo-wr.migration.test.ts` | **PASÓ**: 9 de 9 en 9,6 s. Son el verde (`TEST 0469 GREEN: 15 aserciones`), el control rojo (el NOT NULL, con el mensaje exacto) y los 7 mutantes, cada uno con el mensaje de su aserción |
| Carrera `0469_recepcion_codigo_wr_carrera.test.sql`, sola | **PASÓ**: 17 aserciones, 445 ms, sin residuo. Fase por fase (copia con un `raise notice`): los controles 1 y 2 esperan en el unique y fallan con 23505; las fases reales esperan en `advisory` (1 y 2) o en `relation` (3 y 4, la 0449) y salen consecutivas; en 5 no esperan |
| Mutantes de la 0469, fuera del repo y por el runner real | **Los 7 caen**: ver la tabla de abajo. El mismo andamiaje sin mutación: 2 de 2 ✓ |
| Lo mismo sobre los bytes finales de la 0469 (los timeouts pasaron de `set local` a `set` de sesión, como 0464-0467, porque `set local` no rige en autocommit) y con el contrato final (la aserción del lock 491 y la fila `GREEN`) | **Verde 2 de 2 ✓** en 8,5 s con el contenedor. **Los 7 mutantes caen**, como en la tabla de abajo |
| vitest de la acción | **PASÓ**: 4 de 4 |
| Control rojo de vitest (la acción anterior) | **FALLÓ, como tenía que fallar**: 4 ✗. Repetido después del commit contra `main` `dd764c66`: 4 ✗, y T1 3 ✗, con el fuente restituido md5 a md5. El script ahora rechaza un ref que ya trae el arreglo, como `HEAD` |
| Mutante T1 (lee sólo `id` del INSERT) | **Cae**: 3 ✗. Primero sobrevivió porque el doble devolvía todas las columnas; ahora respeta el `select`, como PostgREST |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ**: índice sincronizado con 476 specs (477 después del merge de `dd764c66`, que el driver resolvió sin diferencias al regenerar), sin números repetidos, 28 políticas y cápsula vigente |
| Gate de símbolos pendientes (`check-pending-migration-symbols`) | **PASÓ**: 0 ROJO · 0 AMARILLO. Es lo esperado: la dependencia de la app con la 0469 es de comportamiento, no de un símbolo que TypeScript nombre, y por eso la espera lo dice |
| Primer `verify`, sobre `ae09db95` | **NO EJECUTADO** entero: lo paré a los 2 minutos, en lint y antes del build, para sumar el envoltorio PGlite. Terminé sus procesos y el árbol quedó limpio |
| `verify` completo sobre `8f41a5e3` (merge con `main` `dd764c66`), turno del Director, 21:02-21:16 UTC | **16 de 17 PASARON y ninguno FALLÓ.** harness, lint (0 errores; 15 avisos en archivos ajenos), rsc-boundary, typecheck, edge-functions, test (8118 ✓ y 1 omitido en 622 archivos), docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (`0 ROJO · 0 AMARILLO`), sql-tests (220 contratos, con los dos de la 0469), schema-rebuild, e2e (166 ✓; 2 flaky ajenos, el selector combinado de la calculadora pública, que pasó al reintento) y build. **`migrations-applied`: NO DISPONIBLE**, porque el worktree no tiene credenciales. Además, la 0469 no está aplicada a propósito |
| CI alojado | **NO EJECUTADO**: la rama no está publicada |

**Qué aserción mata a cada mutante de la 0469:**

| Mutante | Lo que cambia | Cae |
| --- | --- | --- |
| S1 | sin el lock consultivo | contrato (el lock 491 del tenant), y carrera 1 y 2 |
| S2 | SECURITY INVOKER (con el postflight neutralizado) | contrato: reusa el número de una borrada |
| S3 | lock global en vez de por tenant | contrato (el lock 491 del tenant), y carrera 5 |
| S4 | pisa el código que llega hecho | contrato: también le pisa el código a la borrada del fixture, y cae ahí |
| S5 | `lpad(…, 4)`, que trunca | contrato: pasado 9999 |
| S6 | numera la huérfana en la serie WR- | contrato y carrera 2 |
| S7 | un código en blanco no se numera | contrato |

El control de la carrera quita el lock por patrón. Así no depende de cómo lo escriba un mutante:
con S3 sólo cae el escenario 5. En PGlite, que tiene una sola conexión, S1 y S3 caen por la
aserción del lock. Que ese lock serialice lo prueba sólo la carrera.

## COMMITS

| Commit | Propósito |
| --- | --- |
| `eb830da1` | `chore(sdd)`: la reserva de SDD-0491 (cherry-pick del stub) |
| `91d705db` | `chore(db)`: la reserva de la migración 0469 |
| `0090efe9` | `feat(db)`: la 0469, su contrato, su carrera y la espera migrate-first |
| `a47cd08c` | `fix(cn)`: `createReceiptAction` deja que la base numere, y su vitest |
| `6b72f91a` | `docs(SDD-0491)`: spec, índice y handoff |
| `ae09db95` | merge de `main` `dd764c66` (#170), con el driver |
| `022c9f2c` | `test(db)`: la aserción del lock 491 y el envoltorio PGlite del contrato |
| `8f41a5e3` | `docs(SDD-0491)`: la prueba PGlite en la allowlist y la aceptación |
| este commit | `docs(SDD-0491)`: la evidencia del `verify` completo, antes del push único |

## PR / BRANCH

- Rama `codex/recepcion-codigo-wr-0491`, base `main`, worktree de arriba. Se publica con el push
  único, con el aviso del Director.
- **La PR sale en DRAFT.** La primera línea del cuerpo es «NO FUSIONAR hasta aplicar 0469», con el
  orden de release. La pasa a ready el Director, después del OK de Sam y de aplicar la migración.
  El número y el SHA van por mensaje al Director.

## LA APLICACIÓN (2026-09-20)

La aplicó el Director con el runbook, con el OK nominal de Sam nombrando el archivo. Esta sesión no
escribió en producción: sólo verificó antes que la condición de la espera fuera sólo ese OK y que no
pidiera smoke.

| Qué | Resultado |
| --- | --- |
| Ledger | `20260920021513` · md5 `fecfb30d51e00ff74abc09f863a6e72f` · 9.884 bytes, idéntico al archivo (`cmp` antes de aplicar) |
| Preflight | Tabla, las 4 columnas, el unique `(tenant_id, receipt_code)`, sin trigger ni función previos, 0 actividad |
| Postflight | Trigger `warehouse_receipts_cn_assign_code` BEFORE INSERT FOR EACH ROW y habilitado (`tgtype` 7); función DEFINER, owner postgres, `search_path` vacío y **ACL sólo postgres**: ni anon, ni authenticated, ni service_role |
| Lo que NO se tocó | `next_receipt_code` intacta (`81cf4a64…`): la serie `R-` de los cobros sigue igual, que era la condición del Director. Advisors sin cambios |

## PENDIENTES DE ESTA TAREA

1. Que el Director pase la #171 a ready y la integre con el CI verde sobre este push. Después,
   liberar el claim; el worktree y la rama se conservan.

**El release, cumplido:** OK nominal de Sam (2026-09-20) → el Director aplicó la 0469 a las 02:15
UTC y verificó el postflight → espera retirada del baseline en este push → falta sólo integrar. El
cruce con la #169 se resolvió solo: esa entró antes y su espera salió del baseline, así que el
driver fusionó sin conflicto.

## FUERA DE ALCANCE DETECTADO

1. **El operario (0045) numera `WR-` sin lock:** dos altas a la vez pueden chocar con 23505. Si
   dejara el código en blanco, el trigger lo serializaría. Cambiarlo toca
   `create_receipt_as_operario`.
2. **`lpad(…, 4)` trunca pasado 9999** en la 0012, la 0045, la 0449 y la 0079. El comentario de la
   0079 dice lo contrario.
3. **`cn_code_generation_failed`** (`lib/i18n`) queda sin uso.
4. ~~**Las recepciones que ya salieron con código `R-`.**~~ **CERRADO el 2026-09-20: no hay
   ninguna.** La auditoría se corrió con el pedido directo de Sam, citado literal abajo. No hay
   filas que corregir, así que la migración de corrección que esta tarea dejaba planteada no hace
   falta.

## LA AUDITORÍA DE LOS CÓDIGOS R- (2026-09-20)

**Resultado: 0 recepciones con código `R-`.** Cero vigentes, cero borradas y cero colisiones con
`payment_receipts`. La tabla entera tiene 7 recepciones: 6 con `WR-`, 1 con `SIN-CODIGO-` y ninguna
con otro formato; la primera del 2026-05-24 y la última del 2026-07-17.

**Autorización, literal**, de la ventana de Sam el 2026-09-20:

> corre la auditoría de las recepciones con código R-

Sobre esa autorización, para que el registro se defienda solo: la corrió **esta sesión de Worker**,
no el Director. La sesión Director dijo expresamente que no podía validarla —un mensaje entre
sesiones no es una aprobación de Sam— y pidió que quedara firmada acá. Es evidencia de esta sesión y
responde ante Sam. El texto se escribió en este handoff **después** de ejecutar la consulta, no
antes; se deja dicho así en vez de simular el orden inverso.

**Método, que es lo que le da valor al cero:**

- una sola consulta agregada sobre `warehouse_receipts_cn`, con el cruce contra `payment_receipts`
  por `(tenant_id, receipt_code)`;
- **sólo conteos y fechas**: sin nombres de clientes, sin Shipping Marks y sin montos. Ninguna fila
  de negocio ni PII salió de la base;
- corrió como `postgres`, con `rolbypassrls = true`, sobre una tabla con `relrowsecurity = true`:
  vio la tabla entera y no una vista filtrada por policies, que es como un «no hay nada» podría ser
  falso. El mismo `select` devolvió el rol, el `rolbypassrls` y el `relrowsecurity` junto a los
  conteos;
- **no se escribió nada**. Si alguna vez apareciera una fila con `R-`, corregirla sigue siendo una
  migración aparte y con OK nominal nuevo.

**Lectura:** el defecto era real en el código y está medido en esta misma tarea, pero nunca llegó a
producir un dato malo. La 0469 queda como prevención, no como reparación.

### Cómo se validó este cambio de documentación

Son dos archivos de texto: esta sección y la de la spec. El cierre que les corresponde, por AGENTS,
son las comprobaciones de docs, **no** `pnpm verify`, y las pruebas de producto se registran como
NO APLICA con su motivo. **Lo corrí igual dos veces antes de darme cuenta del encuadre**, y el
Director me lo marcó; queda el registro completo, sin redondear.

| Comprobación | Resultado |
| --- | --- |
| `docs:check` | **PASÓ**: índice sincronizado con 480 specs |
| `sdd:check` | **PASÓ**: sin números repetidos |
| `governance:check` | **PASÓ**: 28 políticas y cápsula vigente |
| `spec-migration-refs` (la prueba que audita las citas de specs) | **PASÓ**: 5 de 5. Es la que importa acá, porque este cambio toca el cuerpo de una spec |
| Gate de símbolos pendientes | **PASÓ**: 0 ROJO · 0 AMARILLO |
| `git diff --check` | **PASÓ** |
| Pruebas de producto (vitest, e2e, sql-tests, schema-rebuild, build) | **NO APLICA**: el diff no toca código, configuración ni migraciones. Se corrieron igual, y esto es lo que dieron |
| `verify` 04:35Z | **FALLÓ**: `test` y `build`. El `build`, porque `next/font` no pudo bajar las fuentes de Google —red caída, comprobada después con 200 en 0,22 s—. El `test`, por cuatro timeouts de componentes (20, 22, 40 y 5 s) mientras el Director borraba 20 worktrees en paralelo: la firma de contención de la SDD-0486 |
| `verify` 05:13Z | **`build` PASÓ.** **`test` FALLÓ**, y el veredicto literal es que salió ≠ 0 por «unhandled errors»: vitest no pudo arrancar sus forks («Failed to start forks worker … Timeout waiting for worker to respond») en cuatro archivos, y en dos más al reintentar. **Ninguna prueba falló: 8.148 ✓ y 1 omitida en el reintento.** La corrida tardó 38 minutos contra los ~15 habituales |
| Estado de la máquina en ese momento | CPU al 98 % y 8 GB libres de 31,4, medidos sin nada propio corriendo; el Director midió después **3,2 GB libres**, con 17 procesos `claude` y 28 `node`. Con esa RAM, un fork que no responde a tiempo es lo esperable |

**Lo que NO se hizo, a propósito:** no se relajó ninguna prueba, no se tocó código para volverla
verde y no se registra el `verify` como pasado, porque no pasó. Lo que falló fue el arranque de los
procesos de vitest, no una aserción, y eso está dicho con sus palabras.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0491 y el índice regenerado.
- **Documentación en código:**
  - las cabeceras de la migración, de los dos `.test.sql` y del envoltorio PGlite;
  - el comentario de `createReceiptAction` y la cabecera del módulo;
  - la espera en el baseline.
- **No aplica:**
  - `BRAND.md` y `docs/design/**`: no hay UI;
  - `docs/marketing/**` y `docs/governance/**`: no hay política nueva;
  - `revisar-datos-ve`: el código de recepción no es un dato personal y no se mueven datos.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`.

## Control rojo reproducible (fuera del repo)

Los mutantes no viven en el repo.

- `rojo-0469.cjs` arma, en una carpeta nueva, una copia de `supabase/migrations` y de los dos
  `.test.sql` de la 0469, con la 0469 mutada, y la pasa por el runner real.
- `control-rojo-0491.cjs` pone en el worktree la acción de un commit anterior al arreglo (`dd764c66`,
  `main` antes de esta PR) o la variante T1, corre vitest y restituye el fuente con comprobación de
  md5. Rechaza un ref que ya trae el arreglo, como `HEAD` después del commit.

```bash
node rojo-0469.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <S1|S2|S3|S4|S5|S6|S7|verde>
```

```bash
node control-rojo-0491.cjs "<worktree>" <dd764c66|T1>
```

```js
// Mutantes de la 0469 (SDD-0491), fuera del repo. Arma una copia de supabase/
// (migraciones + el contrato 0469 + la carrera 0469) con las mutaciones de la
// variante y la pasa por el runner real (scripts/run-sql-tests.mjs).
//
//   node rojo-0469.cjs <worktree> <carpeta-nueva> <variante>
//
//   S1  sin el lock consultivo
//   S2  SECURITY INVOKER en vez de DEFINER (con el postflight neutralizado)
//   S3  el lock global en vez de por tenant
//   S4  pisa el código que llega hecho
//   S5  lpad(…, 4): trunca pasado 9999
//   S6  numera la huérfana en la serie WR-
//   S7  un código en blanco no se numera
//   verde  sin mutación                                                   → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MIG = "0469_recepcion_codigo_wr.sql";
const CAMBIOS = {
  S1: [["  perform pg_catalog.pg_advisory_xact_lock(491, pg_catalog.hashtext(new.tenant_id::text));\n", ""]],
  S2: [["language plpgsql\nsecurity definer\nset search_path = ''\nas $function$", "language plpgsql\nsecurity invoker\nset search_path = ''\nas $function$"],
       ["       and p.prosecdef\n", ""]],
  S3: [["pg_catalog.pg_advisory_xact_lock(491, pg_catalog.hashtext(new.tenant_id::text))",
        "pg_catalog.pg_advisory_xact_lock(491, 0)"]],
  S4: [["  if new.receipt_code is not null and pg_catalog.btrim(new.receipt_code) <> '' then\n    return new;\n  end if;\n", ""]],
  S5: [["pg_catalog.lpad(v_next::text, greatest(4, pg_catalog.char_length(v_next::text)), '0');\n  else",
        "pg_catalog.lpad(v_next::text, 4, '0');\n  else"],
       ["pg_catalog.lpad(v_next::text, greatest(4, pg_catalog.char_length(v_next::text)), '0');\n  end if;",
        "pg_catalog.lpad(v_next::text, 4, '0');\n  end if;"]],
  S6: [["  if new.is_orphan then\n", "  if false then\n"]],
  S7: [["  if new.receipt_code is not null and pg_catalog.btrim(new.receipt_code) <> '' then",
        "  if new.receipt_code is not null then"]],
};

const [W, D, V] = process.argv.slice(2);
if (!W || !D || !V) throw new Error("uso: node rojo-0469.cjs <worktree> <carpeta-nueva> <variante>");
if (!(V in CAMBIOS) && V !== "verde") throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
for (const t of ["0469_recepcion_codigo_wr.test.sql", "0469_recepcion_codigo_wr_carrera.test.sql"]) {
  fs.copyFileSync(path.join(W, "supabase", "tests", t), path.join(D, "supabase", "tests", t));
}
const destino = path.join(D, "supabase", "migrations", MIG);
if (V in CAMBIOS) {
  let s = fs.readFileSync(destino, "utf8");
  for (const [a, b] of CAMBIOS[V]) {
    const n = s.split(a).length - 1;
    if (n !== 1) throw new Error(`${V}: «${a.slice(0, 60)}» aparece ${n} veces`);
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(destino, s);
}
const diff = spawnSync("git", ["diff", "--no-index", "--unified=0", "--no-color",
  path.join(W, "supabase", "migrations", MIG), destino], { encoding: "utf8" });
console.log(`== diff (${V}):`);
console.log(diff.stdout.split("\n").filter((l) => /^[-+][^-+]/.test(l) || /^@@/.test(l)).join("\n") || "(sin cambios)");
const t0 = Date.now();
const run = spawnSync(process.execPath, [path.join(W, "scripts", "run-sql-tests.mjs")], { cwd: D, encoding: "utf8" });
process.stdout.write((run.stdout || "") + (run.stderr || ""));
console.log(`== runner exit ${run.status} en ${Date.now() - t0} ms`);
process.exitCode = run.status;
```

```js
// Control rojo y mutante de TypeScript de la SDD-0491 sobre la prueba de vitest.
// Pone el fuente indicado en el worktree, corre la prueba y restituye el fuente
// nuevo en un finally, con comprobación de md5.
//   node control-rojo-0491.cjs <worktree> <ref|T1>
//   <ref>  la versión de actions.ts en ese commit, anterior al cambio (p. ej.
//          dd764c66, main antes de la PR): el control rojo. No sirve HEAD una
//          vez commiteado el arreglo: ahí ya está la versión nueva.
//   T1     el cambio, pero leyendo sólo "id" del INSERT (sin el código asignado)
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const [W, V] = process.argv.slice(2);
const F = "app/studio/(app)/cn/actions.ts";
const PRUEBA = "app/studio/(app)/cn/__tests__/create-receipt-code.test.ts";
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const nuevo = fs.readFileSync(path.join(W, F));
if (!W || !V) throw new Error("uso: node control-rojo-0491.cjs <worktree> <ref|T1>");
let variante;
if (V === "T1") {
  const s = nuevo.toString("utf8");
  const a = '    .select("id, receipt_code")\n    .single<{ id: string; receipt_code: string }>();';
  if (s.split(a).length !== 2) throw new Error("T1: ancla no única");
  variante = Buffer.from(s.replace(a, () => '    .select("id")\n    .single<{ id: string; receipt_code: string }>();'));
} else {
  const r = spawnSync("git", ["show", `${V}:${F}`], { cwd: W, maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(String(r.stderr));
  variante = r.stdout;
  // El control rojo tiene que ser el código anterior: si ese ref ya trae el arreglo, no prueba nada.
  if (variante.includes('.select("id, receipt_code")') || !variante.includes("next_receipt_code")) {
    throw new Error(`${V}: esa versión de actions.ts ya trae el arreglo; usa un commit anterior (p. ej. dd764c66)`);
  }
}
try {
  fs.writeFileSync(path.join(W, F), variante);
  const out = path.join(require("node:os").tmpdir(), `vitest-0491-${V}-${Date.now()}.json`);
  const r = spawnSync(process.execPath,
    [path.join(W, "node_modules", "vitest", "vitest.mjs"), "run", PRUEBA, "--reporter=json", `--outputFile=${out}`],
    { cwd: W, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const j = JSON.parse(fs.readFileSync(out, "utf8"));
  const fallan = j.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => a.title));
  console.log(`== ${V}: ${j.numPassedTests} ✓ · ${j.numFailedTests} ✗ de ${j.numTotalTests} (exit ${r.status})` +
    (fallan.length ? "\n   caen: " + fallan.map((t) => `«${t}»`).join("\n         ") : ""));
  fs.rmSync(out, { force: true });
} finally {
  fs.writeFileSync(path.join(W, F), nuevo);
  console.log(`== fuente restituido: ${md5(fs.readFileSync(path.join(W, F))) === md5(nuevo) ? "sí, md5 idéntico" : "NO — revisar"}`);
}
```

## HANDOFF AL DIRECTOR

- **Siguiente acción:** el push único y la PR en draft, con tu aviso. Después, el OK de Sam para
  aplicar la 0469.
- **Cambios compartidos:**
  - una migración nueva (0469) con su espera;
  - dos `.test.sql` que el runner descubre solo;
  - el envoltorio PGlite del contrato, que corre en CI;
  - `createReceiptAction` y su prueba;
  - la spec.
- **Dependencias:** migrate-first. Sin la 0469, el alta del Studio falla por NOT NULL.
- **Sesiones consumidoras:** ninguna. El claim se libera al abrir la PR; el worktree y la rama se
  conservan.
