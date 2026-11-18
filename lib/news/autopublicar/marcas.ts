/**
 * SDD-0611 F4 y criterio 3 · Marcas `[VERIFICAR` en cualquier forma.
 *
 * Gemela de `public.news_texto_tiene_marca` (migración 0518): las dos reglas
 * tienen que decir lo mismo, y una prueba lo fija.
 *
 * Cuenta como marca, sin distinguir mayúsculas:
 *   - `[VERIFICAR: dato]`, `[VERIFICAR]`, `[VERIFICAR: ]`, `[verificar x]`;
 *   - con espacios después del corchete (`[ VERIFICAR`), o sin cerrar;
 *   - con el corchete de ancho completo (`［`), que NFKC vuelve `[`;
 *   - con un carácter invisible o un guion blando en medio (`VERI­FICAR`);
 *   - codificada en un enlace (`%5BVERIFICAR`).
 *
 * Detectar de más solo cuesta que la noticia vaya a revisión manual.
 */

/** Guion blando, espacios de ancho cero, marcas de dirección, word joiner y BOM. */
const INVISIBLES = /[­​-‏⁠﻿]/g;

const MARCA = /(\[|%5b)\s*verificar/gi;

/** Texto listo para buscar marcas: NFKC y sin invisibles. */
export function normalizarParaMarcas(texto: string | null | undefined): string {
  return (texto ?? "").normalize("NFKC").replace(INVISIBLES, "");
}

/** Cuántas marcas hay en el texto. */
export function contarMarcas(texto: string | null | undefined): number {
  return (normalizarParaMarcas(texto).match(MARCA) ?? []).length;
}

/** ¿Alguno de los textos tiene una marca? */
export function tieneMarca(...textos: Array<string | null | undefined>): boolean {
  return textos.some((t) => contarMarcas(t) > 0);
}

/**
 * Lo que dice cada marca, para mostrarlo en pantalla. Una marca vacía o sin
 * cerrar se lista igual, como «(sin texto)»: también bloquea.
 */
export function listarMarcas(texto: string | null | undefined): string[] {
  const t = normalizarParaMarcas(texto);
  const out: string[] = [];
  for (const m of t.matchAll(MARCA)) {
    const desde = (m.index ?? 0) + m[0].length;
    const cierre = t.indexOf("]", desde);
    const crudo = cierre === -1 ? t.slice(desde, desde + 60) : t.slice(desde, cierre);
    const limpio = crudo.replace(/^\s*:?\s*/, "").trim();
    out.push(limpio.length > 0 ? limpio : "(sin texto)");
  }
  return out;
}
