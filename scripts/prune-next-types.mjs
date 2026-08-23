#!/usr/bin/env node
/**
 * SDD-0281 · Poda los tipos de ruta GENERADOS por Next que quedaron viejos.
 *
 * El problema, medido el 2026-08-23 sobre `main` (7528e0f1): el gate salía
 * **rojo en dos pasos** (`typecheck` y `build`) sin que el código tuviera nada
 * malo. La causa era un archivo que Next escribió meses atrás:
 *
 *   .next/types/validator.ts:737
 *     import("../../app/portal/(auth)/login/page.js")
 *
 * Esa página la borró SDD-0276 al unificar la puerta en `/entrar`. Next genera
 * estos tipos en cada `dev`/`build` pero **nunca los recolecta** cuando una ruta
 * desaparece, y `tsconfig.json` los mete en `include`. Resultado: `tsc` y el
 * build de producción miden el árbol de rutas del pasado.
 *
 * SDD-0280 ya había visto la mitad del problema: `check-build.mjs` construye en
 * `.next-verify` para que la SALIDA del build no contamine al dev. Pero la
 * ENTRADA seguía sucia — `tsconfig.json` apunta a `.next/**`, así que el build
 * aislado igual leía los tipos viejos del dev. Esto cierra esa mitad.
 *
 * ⚠️ **Poda quirúrgica, no barrido.** Sólo borra un árbol de tipos si encontró
 * al menos UNA referencia a una ruta que ya no existe en el disco. Si está
 * sano, no toca nada — el `include` sigue dándole a `tsc` la validación de
 * params de ruta, que es para lo que existe. Y borra el árbol ENTERO (no el
 * archivo suelto) porque `validator.ts` agrega todas las rutas en un archivo:
 * podar por archivo dejaría la referencia muerta adentro igual.
 *
 * Lo que borra es artefacto: Next lo regenera en el siguiente `dev` o `build`.
 *
 * Uso:
 *   node scripts/prune-next-types.mjs          → poda y reporta
 *   node scripts/prune-next-types.mjs --check  → sólo reporta (exit 1 si hay vieja)
 * También se importa: `podarTiposDeRuta()` desde verify.mjs y check-build.mjs.
 */

import fs from "node:fs";
import path from "node:path";

/** Los dos árboles que Next genera: uno del `build`, otro del `dev`. */
const ARBOLES = [
  path.join(".next", "types"),
  path.join(".next", "dev", "types"),
];

/** `import("…/page.js")` / `require("…/route.js")` — la ruta relativa que apunta al fuente. */
const REFERENCIA = /(?:import|require)\(\s*["'](\.[^"']+)\.js["']\s*\)/g;

/** Extensiones con las que un fuente de Next puede materializar ese `.js`. */
const EXTENSIONES = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"];

function listarArchivosTs(dir, acc = []) {
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entradas) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listarArchivosTs(p, acc);
    else if (e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

/** ¿El fuente al que apunta esta referencia existe con alguna extensión válida? */
function fuenteExiste(base) {
  return EXTENSIONES.some((ext) => fs.existsSync(base + ext));
}

/**
 * Primera referencia muerta del árbol, o `null` si está sano. Corta al primer
 * hallazgo: para decidir la poda basta una, y estos árboles tienen miles de
 * líneas.
 */
function primeraReferenciaMuerta(arbol) {
  for (const archivo of listarArchivosTs(arbol)) {
    let texto;
    try {
      texto = fs.readFileSync(archivo, "utf8");
    } catch {
      continue;
    }
    for (const m of texto.matchAll(REFERENCIA)) {
      const base = path.resolve(path.dirname(archivo), m[1]);
      if (!fuenteExiste(base)) {
        return { archivo, apuntaA: m[1] };
      }
    }
  }
  return null;
}

/**
 * Poda los árboles de tipos generados que referencian rutas muertas.
 *
 * @param {{ raiz?: string, soloReportar?: boolean }} opciones
 * @returns {{ podados: string[], hallazgos: {arbol: string, apuntaA: string}[] }}
 */
export function podarTiposDeRuta({ raiz = process.cwd(), soloReportar = false } = {}) {
  const podados = [];
  const hallazgos = [];
  for (const rel of ARBOLES) {
    const arbol = path.join(raiz, rel);
    if (!fs.existsSync(arbol)) continue;
    const muerta = primeraReferenciaMuerta(arbol);
    if (!muerta) continue;
    hallazgos.push({ arbol: rel, apuntaA: muerta.apuntaA });
    if (!soloReportar) {
      fs.rmSync(arbol, { recursive: true, force: true });
      podados.push(rel);
    }
  }
  return { podados, hallazgos };
}

/** Una línea para imprimir en el gate, o `null` si no hubo nada que podar. */
export function notaDePoda(resultado) {
  if (resultado.hallazgos.length === 0) return null;
  const detalle = resultado.hallazgos
    .map((h) => `${h.arbol} (apuntaba a ${h.apuntaA})`)
    .join(" · ");
  return `podados ${resultado.hallazgos.length} árbol(es) de tipos generados por rutas que ya no existen: ${detalle}`;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const esCli = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (esCli) {
  const soloReportar = process.argv.includes("--check");
  const r = podarTiposDeRuta({ soloReportar });
  const nota = notaDePoda(r);
  if (!nota) {
    console.log("[tipos-de-ruta] sanos — nada que podar");
    process.exit(0);
  }
  console.log(`[tipos-de-ruta] ${nota}`);
  process.exit(soloReportar ? 1 : 0);
}
