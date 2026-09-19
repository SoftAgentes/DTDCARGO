# Handoff 0491 · la recepción de bodega China creada en el Studio vuelve a numerarse WR-

- Fecha: 2026-09-19. Estado de la tarea: **probada en local**. Faltan el `verify` completo, en el
  turno del Director, el push único y la PR. **Migrate-first:** la 0469 no se aplica ni la PR se
  integra sin el OK nominal de Sam.
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
  - el contrato SQL (14 aserciones, con control rojo);
  - la carrera con dblink (5 escenarios, 17 aserciones);
  - vitest de la acción (4 casos).
- **Spec 0491:** el defecto medido, las decisiones con su evidencia, la allowlist exacta, la
  aceptación, la gobernanza, el orden de release y el paso de auditoría propuesto para Sam.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El defecto, con el cuerpo real de `next_receipt_code` de la 0079 en PGlite | **Reproducido**: alta 1 `R-2026-0042`; alta 2 la misma, 23505 |
| Contrato `0469_recepcion_codigo_wr.test.sql`, solo | **PASÓ**: 14 aserciones, 301 ms, sin residuo |
| Control rojo del contrato (`-v apply_fix=false`) | **FALLÓ, como tenía que fallar**: NOT NULL en `receipt_code` |
| Carrera `0469_recepcion_codigo_wr_carrera.test.sql`, sola | **PASÓ**: 17 aserciones, 445 ms, sin residuo. Fase por fase (copia con un `raise notice`): los controles 1 y 2 esperan en el unique y fallan con 23505; las fases reales esperan en `advisory` (1 y 2) o en `relation` (3 y 4, la 0449) y salen consecutivas; en 5 no esperan |
| Mutantes de la 0469, fuera del repo y por el runner real | **Los 7 caen**: ver la tabla de abajo. El mismo andamiaje sin mutación: 2 de 2 ✓ |
| Lo mismo sobre los bytes finales de la 0469 (los timeouts pasaron de `set local` a `set` de sesión, como 0464-0467, porque `set local` no rige en autocommit) | **Verde 2 de 2 ✓** en 8,6 s con el contenedor; **los 7 mutantes caen** en las mismas aserciones |
| vitest de la acción | **PASÓ**: 4 de 4 |
| Control rojo de vitest (la acción de HEAD) | **FALLÓ, como tenía que fallar**: 4 ✗ |
| Mutante T1 (lee sólo `id` del INSERT) | **Cae**: 3 ✗. Primero sobrevivió porque el doble devolvía todas las columnas; ahora respeta el `select`, como PostgREST |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ**: índice sincronizado con 476 specs, sin números repetidos, 28 políticas y cápsula vigente |
| Gate de símbolos pendientes (`check-pending-migration-symbols`) | **PASÓ**: 0 ROJO · 0 AMARILLO. Es lo esperado: la dependencia de la app con la 0469 es de comportamiento, no de un símbolo que TypeScript nombre, y por eso la espera lo dice |
| `verify` completo (typecheck, lint, test, sql-tests, schema-rebuild, e2e, build…) | **PENDIENTE**: turno del Director |
| CI alojado | **NO EJECUTADO**: la rama no está publicada |

**Qué aserción mata a cada mutante de la 0469:**

| Mutante | Lo que cambia | Cae |
| --- | --- | --- |
| S1 | sin el lock consultivo | carrera 1 y 2 |
| S2 | SECURITY INVOKER (con el postflight neutralizado) | contrato: reusa el número de una borrada |
| S3 | lock global en vez de por tenant | carrera 5 |
| S4 | pisa el código que llega hecho | contrato: también le pisa el código a la borrada del fixture, y cae ahí |
| S5 | `lpad(…, 4)`, que trunca | contrato: pasado 9999 |
| S6 | numera la huérfana en la serie WR- | contrato y carrera 2 |
| S7 | un código en blanco no se numera | contrato |

El control de la carrera quita el lock por patrón. Así no depende de cómo lo escriba un mutante:
con S3 sólo cae el escenario 5.

## COMMITS

| Commit | Propósito |
| --- | --- |
| `eb830da1` | `chore(sdd)`: la reserva de SDD-0491 (cherry-pick del stub) |
| `91d705db` | `chore(db)`: la reserva de la migración 0469 |

## PR / BRANCH

- Rama `codex/recepcion-codigo-wr-0491`, base `main`, worktree de arriba. No está publicada.

## PENDIENTES DE ESTA TAREA

1. Traer `main` `dd764c66` (#170) con el driver y correr el `verify` completo, en el turno del
   Director.
2. El push único y la PR (migrate-first, con la espera), con el número y el SHA por mensaje.
3. El OK nominal de Sam para aplicar la 0469. Después se integra la PR y se retira la espera.

## FUERA DE ALCANCE DETECTADO

1. **El operario (0045) numera `WR-` sin lock:** dos altas a la vez pueden chocar con 23505. Si
   dejara el código en blanco, el trigger lo serializaría. Cambiarlo toca
   `create_receipt_as_operario`.
2. **`lpad(…, 4)` trunca pasado 9999** en la 0012, la 0045, la 0449 y la 0079. El comentario de la
   0079 dice lo contrario.
3. **`cn_code_generation_failed`** (`lib/i18n`) queda sin uso.
4. **Las recepciones que ya salieron con código `R-`:** la auditoría y la corrección son decisión de
   Sam. El paso está propuesto en la spec; no se leyó nada de producción.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0491 y el índice regenerado.
- **Documentación en código:**
  - las cabeceras de la migración y de los dos `.test.sql`;
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
- `control-rojo-0491.cjs` pone en el worktree la acción de HEAD (o la variante T1), corre vitest y
  restituye el fuente con comprobación de md5.

```bash
node rojo-0469.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <S1|S2|S3|S4|S5|S6|S7|verde>
```

```bash
node control-rojo-0491.cjs "<worktree>" <HEAD|T1>
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
//   node control-rojo-0491.cjs <worktree> <HEAD|T1>
//   HEAD  la versión de actions.ts de HEAD (antes del cambio): el control rojo
//   T1    el cambio, pero leyendo sólo "id" del INSERT (sin el código asignado)
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const [W, V] = process.argv.slice(2);
const F = "app/studio/(app)/cn/actions.ts";
const PRUEBA = "app/studio/(app)/cn/__tests__/create-receipt-code.test.ts";
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const nuevo = fs.readFileSync(path.join(W, F));
let variante;
if (V === "HEAD") {
  const r = spawnSync("git", ["show", `HEAD:${F}`], { cwd: W, maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(String(r.stderr));
  variante = r.stdout;
} else if (V === "T1") {
  const s = nuevo.toString("utf8");
  const a = '    .select("id, receipt_code")\n    .single<{ id: string; receipt_code: string }>();';
  if (s.split(a).length !== 2) throw new Error("T1: ancla no única");
  variante = Buffer.from(s.replace(a, () => '    .select("id")\n    .single<{ id: string; receipt_code: string }>();'));
} else {
  throw new Error("variante desconocida: " + V);
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

- **Siguiente acción:** el turno de máquina para el `verify` completo.
- **Cambios compartidos:** una migración nueva (0469) con su espera, dos `.test.sql` que el runner
  descubre solo, `createReceiptAction` y su prueba, y la spec.
- **Dependencias:** migrate-first. Sin la 0469, el alta del Studio falla por NOT NULL.
- **Sesiones consumidoras:** ninguna. El claim se libera al abrir la PR; el worktree y la rama se
  conservan.
