#!/usr/bin/env node
/**
 * infra/ops/migraciones/retirar-espera.mjs — saca de las esperas una migración ya
 * aplicada en producción (SDD-0546).
 *
 * Corre en un checkout, DESPUÉS de que aplicar.sh dejó la migración en el ledger
 * con su verificación PASÓ, en la rama de cierre (nunca en main):
 *   - quita su entrada de `supabase/migrations-baseline.json › pendingBelowCutoff`;
 *   - quita sus declaraciones de `supabase/pending-migration-symbol-declarations.json`;
 *   - la sella en `supabase/migrations.lock.json` (SDD-0561) con la identidad del
 *     archivo, después de comprobar que su md5 es el aplicado (`--md5`, el que dio
 *     la verificación del apply): desde ahí, editar el archivo hace caer la prueba
 *     scripts/tests/migrations-lock.node.mjs;
 *   - lista las pruebas y el código que nombran la migración junto con
 *     `pendingBelowCutoff`: pueden afirmar la espera y hay que cambiarlas a mano
 *     (como la de la 0491 en el commit 2bb0c817).
 * No toca el `.sql`: la cabecera «NO APLICADA» se conserva, porque el ledger
 * guarda el texto exacto y la identidad se prueba por md5. Calcula todo antes de
 * escribir: si el md5 no cuadra, no cambia ningún archivo.
 *
 * Uso:
 *   node infra/ops/migraciones/retirar-espera.mjs <NNNN_nombre> --md5 <md5 del ledger> [--raiz <checkout>] [--en-seco]
 *
 * Códigos: 0 listo · 2 uso inválido (también: sin --md5, sin candado o sin el
 * archivo) · 3 la migración no estaba en pendingBelowCutoff, ya estaba sellada o su
 * md5 no es el aplicado.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANDADO, formato as formatoCandado, prepararSello, Rechazo as RechazoCandado } from "../../../scripts/migrations-lock.mjs";

export const BASELINE = "supabase/migrations-baseline.json";
export const DECLARACIONES = "supabase/pending-migration-symbol-declarations.json";
const NOMBRE_RE = /^[0-9]{4}[a-z]?_[a-z0-9_]+$/;

export class Rechazo extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.codigo = codigo;
  }
}

const leer = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const formato = (o) => JSON.stringify(o, null, 2) + "\n";

/** Archivos rastreados que nombran la migración y `pendingBelowCutoff`. null si no hay git. */
export function pruebasQueNombranLaEspera(raiz, nombre) {
  let lista;
  try {
    lista = execFileSync("git", ["-C", raiz, "grep", "-l", "-F", "-e", nombre, "--", "lib", "scripts", "supabase/tests", "app", "components", "infra"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (e) {
    if (e.status === 1) return []; // git grep sin coincidencias
    return null;
  }
  return lista
    .split("\n")
    .filter(Boolean)
    .filter((f) => !f.startsWith("infra/ops/migraciones/"))
    .filter((f) => fs.readFileSync(path.join(raiz, f), "utf8").includes("pendingBelowCutoff"));
}

/** El candado con la migración sellada, sin escribir. Los rechazos del candado conservan su código. */
function selloDe(raiz, nombre, md5) {
  try {
    return prepararSello({ raiz, nombre, md5 });
  } catch (e) {
    if (e instanceof RechazoCandado) throw new Rechazo(`candado: ${e.message}`, e.codigo);
    throw e;
  }
}

export function retirarEspera({ raiz = ".", nombre, md5, enSeco = false }) {
  if (!NOMBRE_RE.test(nombre || "")) throw new Rechazo("uso: el nombre tiene que ser el exacto, sin .sql (NNNN_nombre)", 2);
  const fb = path.join(raiz, BASELINE);
  const fd = path.join(raiz, DECLARACIONES);
  const baseline = leer(fb);
  const textoBaseline = fs.readFileSync(fb, "utf8");
  if (formato(baseline) !== textoBaseline) throw new Rechazo(`${BASELINE} no tiene el formato de JSON.stringify(…, null, 2): no lo reescribo`, 2);
  if (!Object.hasOwn(baseline.pendingBelowCutoff ?? {}, nombre)) {
    throw new Rechazo(`${nombre} no está en pendingBelowCutoff: no hay espera que retirar`, 3);
  }
  delete baseline.pendingBelowCutoff[nombre];

  let quitadas = 0;
  let declaraciones = null;
  if (fs.existsSync(fd)) {
    declaraciones = leer(fd);
    if (formato(declaraciones) !== fs.readFileSync(fd, "utf8")) throw new Rechazo(`${DECLARACIONES} no tiene el formato de JSON.stringify(…, null, 2): no lo reescribo`, 2);
    const antes = (declaraciones.degradations ?? []).length;
    declaraciones.degradations = (declaraciones.degradations ?? []).filter((d) => d.migration !== nombre);
    quitadas = antes - declaraciones.degradations.length;
  }
  const sello = selloDe(raiz, nombre, md5);
  if (!enSeco) {
    fs.writeFileSync(fb, formato(baseline));
    if (declaraciones && quitadas) fs.writeFileSync(fd, formato(declaraciones));
    fs.writeFileSync(path.join(raiz, CANDADO), formatoCandado(sello.nuevo));
  }
  const pruebas = pruebasQueNombranLaEspera(raiz, nombre);
  return {
    nombre,
    enSeco,
    esperaRetirada: true,
    declaracionesQuitadas: quitadas,
    sellada: sello.ident,
    esperasQuedan: Object.keys(baseline.pendingBelowCutoff),
    revisarAMano: pruebas,
  };
}

function esPrincipal() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync.native(path.resolve(process.argv[1])) === fs.realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (esPrincipal()) {
  const args = process.argv.slice(2);
  const o = { raiz: ".", enSeco: false };
  try {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--raiz") o.raiz = args[++i];
      else if (args[i] === "--md5") o.md5 = args[++i];
      else if (args[i] === "--en-seco") o.enSeco = true;
      else if (!args[i].startsWith("--") && !o.nombre) o.nombre = args[i].replace(/\.sql$/, "");
      else throw new Rechazo(`uso: argumento desconocido ${args[i]}`, 2);
    }
    const r = retirarEspera(o);
    console.log(JSON.stringify(r, null, 1));
    if (r.revisarAMano === null) console.log("retirar-espera: AVISO · sin git: no pude buscar las pruebas que afirman la espera");
    else if (r.revisarAMano.length) console.log(`retirar-espera: revisa a mano (pueden afirmar la espera): ${r.revisarAMano.join(", ")}`);
  } catch (e) {
    if (e instanceof Rechazo) {
      console.error(`retirar-espera: ${e.message}`);
      process.exit(e.codigo);
    }
    throw e;
  }
}
