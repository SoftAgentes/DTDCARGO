/**
 * scripts/check-feature-constants.mjs — una bandera que se flipea sin avisar
 * pudre lo que todos creen del sistema.
 *
 * SIN SHEBANG a propósito: este módulo se importa desde su test y el `#!` de la
 * línea 1 rompe el parser de Vite (mismo motivo que en `check-numbering.mjs`).
 * `verify.mjs` lo invoca como `node <entry>`.
 *
 * POR QUÉ EXISTE
 * El 2026-08-18, verificando memoria contra el repo, aparecieron DOS banderas
 * que llevaban meses contradiciendo lo que todo el mundo daba por cierto:
 *
 *   · `SHIPMENT_ACCEPTANCE_CTA_LIVE` estaba en `true` desde el 22-jul (commit
 *     a08373a6) y se seguía reportando como "pendiente de flipear" — 4 semanas.
 *   · `LEGAL_GATE_HARD_BLOCK` estaba en `true` desde el 11-jun (commit 082ec292)
 *     y se seguía reportando como advisory — 2 meses. Ésa toca DINERO: la
 *     diferencia es entre "avisa" y "no deja emitir la factura DDP".
 *
 * Las migraciones no sufren esto porque `migrations-applied` las vigila. Las
 * constantes no tenían nada: se flipean en una línea, el gate queda verde, y la
 * creencia vieja sobrevive en handoffs, docs y memoria de agentes hasta que
 * alguien la mide de casualidad.
 *
 * QUÉ VIGILA
 * Que el valor declarado en `scripts/feature-constants.json` sea el valor real
 * en el código. Nada más. La verdad es el código — este paso NO opina sobre qué
 * valor debería tener; sólo exige que el cambio quede DICHO.
 *
 * QUÉ **NO** VIGILA (a propósito)
 * · No mira los feature flags de la DB (`feature_flags`): ésos ya tienen su
 *   contrato en `lib/studio/__tests__/feature-flags-catalog.test.ts` y su verdad
 *   vive en prod, no en el repo.
 * · No descubre banderas nuevas solo. Si alguien agrega una constante que prende
 *   algo para el cliente y no la declara acá, este paso no la ve — por eso la
 *   lista se revisa a mano cuando se agrega una.
 */

import fs from "node:fs";
import path from "node:path";

const C = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  nc: "\x1b[0m",
};

const ROOT = path.resolve(import.meta.dirname, "..");
const DECL = path.join(ROOT, "scripts", "feature-constants.json");

/**
 * Lee el valor real de `export const NOMBRE = true|false;` en un archivo TS.
 * Devuelve `true`/`false`, o `null` si la constante no está (borrada/renombrada).
 *
 * Acepta la anotación de tipo opcional (`: boolean`) porque `TERMINOS_LIVE` la
 * lleva. NO evalúa el módulo: leer el texto evita arrastrar el árbol de imports
 * de `lib/` a un script del gate.
 */
export function leerValorReal(fuente, nombre) {
  const re = new RegExp(
    `export\\s+const\\s+${nombre}\\s*(?::\\s*boolean\\s*)?=\\s*(true|false)\\s*;`,
  );
  const m = fuente.match(re);
  return m ? m[1] === "true" : null;
}

/** Compara la declaración contra el código. Devuelve la lista de desvíos. */
export function encontrarDesvios(flags, leerArchivo) {
  const desvios = [];
  for (const f of flags) {
    let fuente;
    try {
      fuente = leerArchivo(f.file);
    } catch {
      desvios.push({
        name: f.name,
        tipo: "archivo-ausente",
        detail: `${f.name}: no existe ${f.file} — ¿se movió la constante?`,
      });
      continue;
    }
    const real = leerValorReal(fuente, f.name);
    if (real === null) {
      desvios.push({
        name: f.name,
        tipo: "constante-ausente",
        detail: `${f.name}: declarada en ${f.file} pero no aparece ahí — ¿la borraron o le cambiaron el nombre?`,
      });
      continue;
    }
    if (real !== f.value) {
      desvios.push({
        name: f.name,
        tipo: "valor",
        detail: `${f.name} (${f.file}): declarado ${f.value}, real ${real}`,
        significa: f.significa,
      });
    }
  }
  return desvios;
}

function main() {
  if (!fs.existsSync(DECL)) {
    console.log(
      `${C.red}[FAIL]${C.nc} feature-constants: falta ${path.relative(ROOT, DECL)}`,
    );
    return 1;
  }

  const { flags } = JSON.parse(fs.readFileSync(DECL, "utf8"));
  if (!Array.isArray(flags) || flags.length === 0) {
    // Una lista vacía saldría verde sin medir nada — el modo de verde falso que
    // ya mordió en el paso e2e. Acá es rojo.
    console.log(
      `${C.red}[FAIL]${C.nc} feature-constants: la declaración no tiene banderas — 0 medidas no es verde`,
    );
    return 1;
  }

  const desvios = encontrarDesvios(flags, (rel) =>
    fs.readFileSync(path.join(ROOT, rel), "utf8"),
  );

  if (desvios.length > 0) {
    console.log(
      `${C.red}[FAIL]${C.nc} feature-constants: ${desvios.length} bandera(s) fuera de lo declarado:`,
    );
    for (const d of desvios) {
      console.log(`${C.red}   🔴 ${d.detail}${C.nc}`);
      if (d.significa) console.log(`${C.dim}      ${d.significa}${C.nc}`);
    }
    console.log(
      `${C.yellow}   ↳ Si el flip es correcto, actualizá scripts/feature-constants.json` +
        ` en ESTE commit y decí qué cambia para el cliente.${C.nc}`,
    );
    return 1;
  }

  console.log(
    `${C.green}[OK]${C.nc}   feature-constants: ${flags.length} bandera(s) coinciden con lo declarado`,
  );
  return 0;
}

// Solo corre cuando este archivo ES el entry point (si no, el test que importa
// encontrarDesvios dispararía main() al importar). Mismo guard que
// check-numbering.mjs.
const isEntryPoint =
  process.argv[1] && import.meta.filename === path.resolve(process.argv[1]);

if (isEntryPoint) {
  try {
    process.exitCode = main();
  } catch (e) {
    console.log(
      `${C.red}[FAIL]${C.nc} feature-constants: error inesperado → ${e?.stack ?? e}`,
    );
    process.exitCode = 2;
  }
}
