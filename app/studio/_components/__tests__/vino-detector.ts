/**
 * SDD-0686 · fase 2: cómo se cuenta el vino de un archivo, se escriba como se
 * escriba. Lo comparten los contratos de los grupos 3 y 4.
 *
 * Ve: `var(--wine…)`, `var(--grad-wine…)`, `var(--color-wine…)`, clases
 * Tailwind (`bg-wine`, `hover:border-wine`…) y tonos `"wine"` dados como valor.
 * No ve, y se anota en la spec: la variante arbitraria (`[&>svg]:text-wine`),
 * el alias `--studio-wine*`, un hex de la familia vino escrito a mano (fase 4)
 * ni un tono armado con plantilla.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const RAIZ = join(__dirname, "..", "..", "..", "..");

/** Tokens de vino del Studio y de la web, usados como valor. */
const VINO_TOKEN = /var\(--(?:grad-|color-)?wine[a-z-]*/g;
/** Clases Tailwind de vino, con o sin variante (`hover:`, `focus-within:`…). */
const VINO_CLASE =
  /(?<=^|[\s"'`])(?:[a-z-]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|accent|decoration|divide|placeholder|caret|shadow)-wine(?:-[a-z]+)?(?![\w-])/gm;

/**
 * Tonos `"wine"` dados como valor. Se quitan antes las uniones de tipo
 * (`"a" | "wine"` en una línea, o una línea que empieza con `|`) y las
 * comparaciones (`=== "wine"`), que no pintan nada.
 */
export function tonosVino(texto: string): number {
  let n = 0;
  for (const cruda of texto.split("\n")) {
    if (/^\s*\|/.test(cruda)) continue;
    const linea = cruda
      .replace(/["'][a-z-]+["'](?:\s*\|\s*["'][a-z-]+["'])+/g, "")
      .replace(/[!=]==?\s*["']wine["']/g, "");
    n += (linea.match(/["']wine["']/g) ?? []).length;
  }
  return n;
}

export function cuentaVino(texto: string): number {
  return (texto.match(VINO_TOKEN) ?? []).length + (texto.match(VINO_CLASE) ?? []).length + tonosVino(texto);
}

export function fuentesDe(dir: string, extension: RegExp): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre === "__tests__") continue;
      salida.push(...fuentesDe(ruta, extension));
    } else if (extension.test(nombre) && !/\.test\.tsx?$/.test(nombre)) {
      salida.push(ruta);
    }
  }
  return salida;
}

export const rel = (ruta: string) => relative(RAIZ, ruta).split(sep).join("/");
