import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * ⏱️ I/O-BOUND: recorre app/studio, app/portal y app/m enteros. Es el DÉCIMO
 * contrato de esta clase; en paralelo sobre 428 archivos de test la lectura se va
 * muy por encima del testTimeout global de 20 s. Ver el resto en la misma nota.
 */
vi.setConfig({ testTimeout: 120_000 });


/**
 * Contrato de contraste del tema Oscuro.
 *
 * `--ink-inv*` significa "tinta para superficie INVERTIDA", y por eso VOLTEA entre
 * temas: es casi blanco en claro (#FBFAF7) y navy en oscuro (#0F1E3D). Eso está
 * bien mientras el fondo también voltee. El bug aparece cuando se usa sobre una
 * superficie que es oscura en LOS DOS temas (`--bg-sidebar`, `--wine`,
 * `--grad-wine-panel`): en tema Oscuro queda navy sobre casi-negro.
 *
 * Medido sobre los tokens reales antes de este contrato:
 *
 *   --ink-inv      sobre --bg-sidebar → claro 15,80  ·  oscuro  1,18  ❌
 *   --ink-inv-soft sobre --bg-sidebar → claro  9,71  ·  oscuro  1,12  ❌
 *   --ink-inv-mute sobre --bg-sidebar → claro  5,04  ·  oscuro  1,07  ❌
 *   --ink-inv      sobre --wine       → claro 10,13  ·  oscuro  2,51  ❌
 *
 * El token correcto sobre esas superficies es `--ink-side*`, que es blanco en
 * ambos temas:
 *
 *   --ink-side-strong sobre --bg-sidebar → claro 16,49 · oscuro 19,41  ✅
 *   --ink-side        sobre --bg-sidebar → claro 12,15 · oscuro 14,97  ✅
 *   --ink-side-soft   sobre --bg-sidebar → claro  5,82 · oscuro  5,32  ✅
 *
 * OJO: esto NO es "reemplazar --ink-inv en todos lados". Sobre `--danger`
 * (#A8323E claro / #E07785 oscuro) el token correcto SIGUE siendo `--ink-inv`
 * (6,31 / 5,61); ahí `--ink-side` daría 2,61 en oscuro. El criterio es el fondo,
 * no el token.
 */

/** Superficies que son oscuras en AMBOS temas → exigen --ink-side*. */
const SUPERFICIES_OSCURAS = [
  "var(--bg-sidebar)",
  "var(--wine)",
  "var(--grad-wine-panel)",
];

const RAICES = ["app/studio", "app/portal", "app/m"];

function fuentes(dir: string, acc: string[] = []): string[] {
  let entradas;
  try {
    entradas = readdirSync(join(process.cwd(), dir), { withFileTypes: true });
  } catch {
    return acc; // la raíz no existe en este árbol: no es un fallo del contrato
  }
  for (const e of entradas) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      fuentes(rel, acc);
    } else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) {
      acc.push(rel);
    }
  }
  return acc;
}

/**
 * Para cada uso de --ink-inv*, mira hacia atrás el `background` más cercano
 * dentro de la misma vecindad de estilo.
 *
 * Sutileza que costó una prueba de mutación: un divisor de 1px declara su propio
 * `background` con un token de tinta (`background: var(--ink-side-soft)`), y eso
 * ENMASCARABA al contenedor navy de más arriba — la búsqueda se detenía en el
 * divisor, no era superficie oscura, y la violación pasaba invisible. Un token de
 * tinta usado como fondo es una línea, no una superficie de texto: se salta y se
 * sigue buscando la superficie de verdad.
 */
function violaciones(archivo: string): string[] {
  const lineas = readFileSync(join(process.cwd(), archivo), "utf8").split("\n");
  const encontradas: string[] = [];
  lineas.forEach((linea, i) => {
    if (!linea.includes("--ink-inv")) return;
    // Ventana amplia a propósito: en InvoiceDrawer el contenedor navy está 62
    // líneas por encima del texto que lo viola. Con 30 líneas el contrato salía
    // verde teniendo la violación delante (lo cazó una prueba de mutación).
    for (let j = i; j >= Math.max(0, i - 150); j--) {
      const m = lineas[j].match(/background(?:Color)?\s*:\s*["']?([^,;"'}]+)/);
      if (!m) continue;
      const fondo = m[1].trim();
      // Divisor/hairline pintado con un token de tinta: no es superficie, seguir.
      if (fondo.startsWith("var(--ink-")) continue;
      if (SUPERFICIES_OSCURAS.some((s) => fondo.startsWith(s))) {
        encontradas.push(`${archivo}:${i + 1} → --ink-inv* sobre ${fondo}`);
      }
      return; // la primera superficie real manda
    }
  });
  return encontradas;
}

describe("contraste del tema Oscuro · --ink-inv* nunca sobre superficie oscura", () => {
  it("los tokens siguen volteando entre temas (si dejan de hacerlo, este contrato sobra)", () => {
    const css = readFileSync(join(process.cwd(), "app/studio/tokens.css"), "utf8");
    const claro = css.slice(css.indexOf(":root"), css.indexOf('[data-theme="dark"]'));
    const oscuro = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(claro).toContain("--ink-inv: #FBFAF7");
    expect(oscuro).toContain("--ink-inv: #0F1E3D");
    // --ink-side* es blanco en ambos: por eso es el token correcto sobre navy.
    expect(claro).toContain("--ink-side: rgba(255,255,255,");
    expect(oscuro).toContain("--ink-side: rgba(255,255,255,");
  });

  it("ningún archivo pinta --ink-inv* sobre navy o vino", () => {
    const todas = RAICES.flatMap((r) => fuentes(r)).flatMap(violaciones);
    expect(todas).toEqual([]);
  });
});
