# Handoff 0484 · seguimiento — La carrera del saldo de la 0464, con sesiones reales

- Fecha: 2026-09-18 (Caracas; 2026-09-19 UTC). Estado de la tarea: **lista para revisión**.
  Falta que el Director revise e integre la PR.
- Owner/sesión: `worker-carrera-saldo-0464-20260919` (Claude Opus 5, Worker, sesión «Automatizar la
  prueba de carrera del for update de 0459» [7a0aa1], que siguió con esta tarea a pedido de Sam).
  Director: `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-saldo-0464`, creado con
  `harness-worktree start`.
- Rama: `codex/carrera-saldo-0464`, desde `origin/main` = `c8f7f8b6`. Después se trajo `main`
  `7741f587` con merge, con la #156 y la #157.
- SDD: [0484](../../docs/specs/0484-reporte-pago-factura-pagada/spec.md), como seguimiento y sin
  número nuevo, por decisión del Director. El script `scripts/qa/payment-report-confirm-race.mjs`
  se conserva.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de los commits se revalidó con `guard --owner`.
- Permisos del encargo: commits en esta rama; push de la rama propia y PR contra `main` después de
  reportarle al Director. **No merge. No producción.** La 0464 (md5 `44fabe4d…`) y la 0421
  (`6944ffdd…`) no se tocan.

## OBJETIVO ORIGINAL

Llevar a la suite SQL de `verify` la carrera del saldo de la 0464, que hoy corre solo a mano con
`scripts/qa/payment-report-confirm-race.mjs`. Son dos confirmaciones simultáneas sobre la misma
factura.

## COMPLETADO

- **`supabase/tests/0464_saldo_confirmacion_carrera.test.sql`** (7 aserciones), con el patrón de
  las otras carreras:
  - `dblink` contra una base propia;
  - barrera por `pg_blocking_pids`, sin `sleep`;
  - limpieza protegida ante cualquier error;
  - guarda de clúster desechable.

  El fixture es el del contrato 0421 en modo `fixture_only`, como el script, leído de su archivo.
  Encima se siembran dos facturas de 1000 con 20 pagados y dos reportes de 980 cada una.
  - **Control en la misma corrida**, antes de la 0464, con la función de la 0421: la misma
    carrera acredita las dos confirmaciones y la factura queda en 1980 sobre 1000. Si no pasa, la
    carrera no se ejerce y el test falla.
  - **Con la 0464 aplicada** (el archivo entero, por `pg_read_file`): la segunda confirmación
    espera la factura y recibe `PAYMENT_INVOICE_PAID`. Queda pagado 1000, un reporte confirmado y
    un recibo.
- **Spec 0484:** una línea fechada en «Evidencia», con el script conservado, y dos filas en su
  allowlist. No hubo corrección de estado: el script está en `main` (entró con la #150) y la spec
  lo describe bien. Solo le faltaba correr en `verify`.
- **Spec 0484, después del merge:** la sección «Verificación en producción», que agregó la #156,
  contaba la carrera solo con el script. Ahora nombra también este test. Además precisa que la
  regla del excedente (`PAYMENT_EXCEEDS_BALANCE`) la cubren el contrato 0464 y su prueba en PGlite.
  Ni el script ni este test la ejercen: lo comprobé con grep.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El archivo solo, con los flags de Docker del runner | **PASÓ**: 7 aserciones, 0,9 s de psql |
| **Mutante pedido por el Director**, por el runner real: la 0464 sin el `for update` de la factura en la confirmación (con la comparación de md5 del postflight neutralizada; el diff lo muestra) | **FALLÓ, como tenía que fallar**: ✗ «saldo: la segunda confirmación tenía que recibir PAYMENT_INVOICE_PAID». La segunda confirma con el saldo viejo. Los contratos de una sola sesión (0421 y 0464) quedan en **✓**: no lo ven |
| El mismo andamiaje con la 0464 intacta | **PASÓ**: ✓ en los tres archivos |
| Huella tras un fallo (bases, roles, extensiones y sesiones del clúster) | **PASÓ en tres modos**: rojo, corte a mitad de carrera y guarda. La guarda, con `service_role` ya creado, aborta sin tocar nada y **conserva** el rol |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check`, antes del merge | **PASÓ**: 472 specs, sin números repetidos, cápsula vigente |
| Suite SQL completa por el runner real, en el turno de máquina del Director, sobre `25c30119` | **PASÓ**: 207 de 207 ✓, 0 ✗, 103 s. Pasan juntos los cinco archivos de carrera de la rama: 0421, 0427, 0459, 0460 y 0464. La 0426 todavía no está en `main` |
| Merge de `main` `7741f587` (#156 y #157) | **PASÓ**: sin conflictos. Después del merge pasaron el archivo solo (7 aserciones, sin residuo en el clúster), `docs:check` (473), `sdd:check`, `governance:check` y `git diff --check` |
| Suite SQL completa después del merge | **NO EJECUTADA**: la máquina está en turno de la sesión 74, y el Director pidió repetir solo lo liviano. El contrato nuevo de `main`, `0467_cobro_factura_atomico.test.sql`, no corrió junto a este archivo |
| CI alojado | **Por mensaje al Director**: la rama se publica después de este commit |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `3383b83f` | `test(db): SDD-0484`: la carrera del saldo con sesiones reales |
| `25c30119` | `docs(SDD-0484)`: línea fechada y allowlist |
| `1567fe62` | merge de `origin/main` `7741f587`, sin conflictos |
| `29b2d235` | `docs(SDD-0484)`: la cobertura en producción nombra la carrera de `sql-tests` |
| el commit que contiene este documento | `docs(handoff)`: este handoff |

## PR / BRANCH

- Rama `codex/carrera-saldo-0464`, base `main`, worktree de arriba. Se publica con un solo push
  después de este commit. El número de la PR y el SHA van por mensaje al Director.

## PENDIENTES DE ESTA TAREA

1. Push y PR contra `main`, con el número y el SHA por mensaje.
2. Revisión e integración del Director.

## FUERA DE ALCANCE DETECTADO

1. **`scripts/qa/payment-report-confirm-race.mjs` queda duplicado.** Sus modos (con la 0464, sin
   ella y con el mutante) ya los cubren este contrato y su control rojo. El Director decidió
   conservarlo por ahora.
2. **`scripts/qa/cobro-factura-race.mjs`, de la #157 (Cobranzas, 0467), trae 13 escenarios de
   carrera.** Ya entró a `main` (`038cf894`). Puede ser la próxima tarea con este mismo patrón,
   según el Director. No se mezcla con esta.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0484, con la línea fechada, la allowlist y la sección de cobertura en
  producción. El índice `docs/specs/README.md` no cambia (`docs:check` en verde).
- **Documentación en código:** la cabecera del `.test.sql`.
- **No aplica:** `BRAND.md` y `docs/design/**` (no hay UI), `docs/marketing/**` y
  `docs/governance/**` (no hay política nueva). Tampoco `revisar-datos-ve`: el test no cambia qué
  datos se capturan, mueven o borran, y usa fixtures ficticios en una base desechable.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff.

## Control rojo reproducible (fuera del repo)

El mutante no vive en el repo. Este script arma en una carpeta nueva una copia de
`supabase/migrations` y de los tres archivos de prueba (los contratos 0421 y 0464, y el test de la
carrera), con la 0464 mutada, y la pasa por el runner real:

```bash
node rojo-0464.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <factura|verde>
```

```js
// Control rojo de supabase/tests/0464_saldo_confirmacion_carrera.test.sql, fuera del repo.
// Arma una copia de supabase/ (migraciones + el contrato 0421, del que sale el
// fixture, + el contrato 0464 + el test de la carrera) con UNA mutación de la
// 0464 y la pasa por el runner real (scripts/run-sql-tests.mjs). Los dos
// contratos también corren, porque el runner corre todo *.test.sql.
//
//   node rojo-0464.cjs <worktree> <carpeta-nueva> <variante>
//
//   factura  la confirmación sin el FOR UPDATE de la factura     → ✗
//            (el postflight de la 0464 compara el md5 del cuerpo:
//            en la copia esa comparación se neutraliza, y el diff lo muestra)
//   verde    sin mutación                                        → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const [W, D, V] = process.argv.slice(2);
if (!W || !D || !V) throw new Error("uso: node rojo-0464.cjs <worktree> <carpeta-nueva> <variante>");
if (!["factura", "verde"].includes(V)) throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
for (const t of ["0421_payment_report_commands.test.sql", "0464_reporte_pago_factura_pagada.test.sql",
  "0464_saldo_confirmacion_carrera.test.sql"]) {
  fs.copyFileSync(path.join(W, "supabase", "tests", t), path.join(D, "supabase", "tests", t));
}

const archivo = "0464_reporte_pago_factura_pagada.sql";
const destino = path.join(D, "supabase", "migrations", archivo);
let s = fs.readFileSync(destino, "utf8");
const una = (a, b) => {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`«${a.slice(0, 60)}» aparece ${n} veces en ${archivo}`);
  s = s.replace(a, b);
};
if (V === "factura") {
  una("    select * into v_inv from public.invoices\n    where id = v_invoice_id and tenant_id = v_tenant\n" +
      "      and (p_kind <> 'cancel' or (client_markbox = v_markbox and invoice_code = v_code))\n    for update;",
      "    select * into v_inv from public.invoices\n    where id = v_invoice_id and tenant_id = v_tenant\n" +
      "      and (p_kind <> 'cancel' or (client_markbox = v_markbox and invoice_code = v_code));");
  una("      and pg_catalog.md5(prosrc) = 'c3aab7fcb10e3bf5de0fa40cc562a45d') then", "      and true) then");
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

- **Siguiente acción:** revisar la PR e integrarla.
- **Cambios compartidos:** un archivo nuevo en `supabase/tests/`, que el runner descubre solo, y la
  spec 0484. Ningún archivo de producto.
- **Dependencias:** `dblink` en la imagen del runner (`postgres:17`) y el contrato
  `0421_payment_report_commands.test.sql`, del que sale el fixture. Sin `dblink`, el archivo falla
  en vez de hacer SKIP.
- **Conocimiento:** Graphify, Archify y la bóveda quedan para la publicación del Director desde
  `main`.
- **Sesiones consumidoras:** ninguna. El claim se libera al terminar la escritura; worktree y rama
  se conservan.
