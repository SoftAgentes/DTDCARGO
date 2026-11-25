/**
 * SDD-0686 · fase 2: cómo se cuenta el vino de un archivo, se escriba como se
 * escriba. Lo comparten los contratos de los grupos 3 y 4.
 *
 * Ve: `var(--wine…)`, `var(--grad-wine…)`, `var(--color-wine…)`, clases
 * Tailwind (`bg-wine`, `hover:border-wine`…), tonos `"wine"` dados como valor,
 * la clase `eyebrow-wine` y el atributo `data-tono="vino"` (revisión de la #745).
 * No ve, y se anota en la spec: la variante arbitraria (`[&>svg]:text-wine`),
 * el alias `--studio-wine*`, un hex de la familia vino escrito a mano (fase 4)
 * ni un tono armado con plantilla.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const RAIZ = join(__dirname, "..", "..", "..", "..");

/** Tokens de vino del Studio y de la web, usados como valor. */
const VINO_TOKEN = /var\(--(?:grad-|color-)?wine[a-z-]*/g;
/** La clase base se prueba una sola vez, después de consumir sus variantes. */
const VINO_CLASE = /^(?:bg|text|border|ring|outline|fill|stroke|from|via|to|accent|decoration|divide|placeholder|caret|shadow)-wine(?:-[a-z]+)?(?![\w-])/;

/**
 * Cada variante termina en su propio `:`. Los corchetes se balancean para
 * admitir `group-[[open]]:` y selectores anidados sin reconsiderar particiones
 * cuando la clase final no usa vino. Cada carácter se recorre como máximo una vez.
 */
function clasesVino(texto: string): number {
  let n = 0;
  for (const [clase] of texto.matchAll(/[^\s"'`]+/g)) {
    let inicio = 0;
    while (inicio < clase.length) {
      let fin = inicio;
      while (fin < clase.length && /[a-z-]/.test(clase[fin])) fin++;
      if (clase[fin] === "[") {
        let nivel = 1;
        while (++fin < clase.length && nivel > 0) {
          // Una barra consume el siguiente carácter, incluso otra barra.
          if (clase[fin] === "\\") fin++;
          else if (clase[fin] === "[") nivel++;
          else if (clase[fin] === "]") nivel--;
        }
        if (nivel > 0) break;
      }
      if (fin === inicio || clase[fin] !== ":") break;
      inicio = fin + 1;
    }
    if (VINO_CLASE.test(clase.slice(inicio))) n++;
  }
  return n;
}

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

/** Clase de eyebrow en vino (`tokens.css`) y el tono «vino» del contador de iconos. */
const VINO_EYEBROW = /(?<=^|[\s"'`])eyebrow-wine(?![\w-])/gm;
const VINO_DATA_TONO = /data-tono=["'{]*vino["'}]*/g;

export function cuentaVino(texto: string): number {
  return (
    (texto.match(VINO_TOKEN) ?? []).length +
    clasesVino(texto) +
    (texto.match(VINO_EYEBROW) ?? []).length +
    (texto.match(VINO_DATA_TONO) ?? []).length +
    tonosVino(texto)
  );
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
