/**
 * SDD-0611 §4.3.3 · Puntaje mínimo (F6).
 *
 * El servidor llama a `computeArticleScore` sobre el texto exacto que se va a
 * publicar; no se confía en un puntaje que traiga el borrador. Pasan todas las
 * métricas o el borrador queda retenido con `puntaje:<cuál>`.
 *
 * Los valores son la propuesta inicial de la spec. Cambiarlos es cambiar la
 * spec.
 */

import { NEWS_CATEGORIES_V4, type NewsCategoria, type NewsTipo } from "@/lib/news/categories";
import { computeArticleScore, isPublishReady } from "@/lib/news/score";
import type { NewsContentKind } from "@/lib/news/types";
import { normalizarTexto } from "./control";
import { contarMarcas } from "./marcas";

/** Palabras objetivo por tipo (§4.3.3), con un margen de 150 hacia cada lado. */
export const LARGO_OBJETIVO: Partial<Record<NewsTipo, number>> = {
  informativo: 1000,
  curiosidad: 700,
  polemica: 1100,
};
export const LARGO_MARGEN = 150;

export const SUBTITULOS_MIN = 5;
export const SUBTITULOS_MAX = 7;
export const DENSIDAD_MIN = 0.5;
export const DENSIDAD_MAX = 2.5;
export const TITULAR_MIN = 35;
export const TITULAR_MAX = 50;

const TIPOS_DE_CONTENIDO: ReadonlySet<NewsContentKind> = new Set([
  "guide",
  "news",
  "analysis",
  "case",
]);

/** Cambia al cambiar la lista de muletillas. */
export const MULETILLAS_VERSION = "0611-muletillas-v1";

/**
 * Muletillas (anexo §4.1 y `06-noticias.md`), ya sin acentos y en minúsculas.
 * La lista crece solo con un cambio revisado (§4.11).
 */
export const MULETILLAS: ReadonlyArray<string> = [
  "en conclusion",
  "es importante destacar",
  "no podemos olvidar que",
  "en el mundo actual",
  "en la era digital",
  "en un mundo cada vez mas",
  "sumergete",
  "descubre",
  "desbloquea",
  "potencia tu",
  "navegar el panorama",
  "cabe destacar",
  "vale la pena mencionar",
  "es crucial",
  "es fundamental",
  "en resumen",
  "para concluir",
  "en definitiva",
];

/** La raya larga para cada aclaración y el «no solo… sino también» repetido. */
const RAYAS_MAX = 2;
const NO_SOLO_MAX = 1;

/** Muletillas encontradas en el cuerpo (vacío = pasa). */
export function muletillasEn(markdown: string): string[] {
  const t = normalizarTexto(markdown);
  const halladas = MULETILLAS.filter((m) => new RegExp(`\\b${m}\\b`).test(t));
  if ((markdown.match(/—/g) ?? []).length > RAYAS_MAX) halladas.push("raya larga repetida");
  if ((t.match(/\bno solo\b[^.]{0,120}\bsino tambien\b/g) ?? []).length > NO_SOLO_MAX) {
    halladas.push("no solo… sino también repetido");
  }
  return halladas;
}

/** Problemas del titular frente a su categoría (vacío = pasa). */
export function problemasDelTitular(titular: string, categoria: NewsCategoria): string[] {
  const info = NEWS_CATEGORIES_V4[categoria];
  if (!info) return ["categoria"];
  if (!titular.startsWith(info.titlePrefix)) return ["prefijo"];
  const resto = titular.slice(info.titlePrefix.length);
  const problemas: string[] = [];
  const largo = [...resto].length;
  if (largo < TITULAR_MIN || largo > TITULAR_MAX) problemas.push("largo");
  if (/["“”«»'‘’]/.test(resto)) problemas.push("comillas");
  if (/^\s*\d+\s*[.)\-:]|#\s?\d/.test(resto)) problemas.push("numeracion");
  if (/\p{Extended_Pictographic}/u.test(resto)) problemas.push("emoji");
  return problemas;
}

export interface EntradaPuntaje {
  titular: string;
  markdown: string;
  tipo: NewsTipo;
  categoria: NewsCategoria;
  focusKeyword: string | null;
  coverImageUrl: string | null;
  contentKind: string | null;
}

/** Códigos `puntaje:<cuál>` de lo que no llegó al mínimo. Vacío = pasa. */
export function evaluarPuntaje(e: EntradaPuntaje): string[] {
  const score = computeArticleScore(e.markdown, e.focusKeyword ?? "");
  const codigos: string[] = [];

  // isPublishReady: cero marcas y al menos 400 palabras. Las marcas se cuentan
  // además con la regla ancha (la vacía también cuenta).
  if (!isPublishReady(score) || contarMarcas(e.markdown) > 0) codigos.push("puntaje:listo");

  const objetivo = LARGO_OBJETIVO[e.tipo];
  if (
    objetivo === undefined ||
    score.wordCount < objetivo - LARGO_MARGEN ||
    score.wordCount > objetivo + LARGO_MARGEN
  ) {
    codigos.push("puntaje:largo");
  }

  if (score.h2Count < SUBTITULOS_MIN || score.h2Count > SUBTITULOS_MAX) {
    codigos.push("puntaje:subtitulos");
  }
  if (!score.hasNutGraf) codigos.push("puntaje:tesis");

  const kw = (e.focusKeyword ?? "").trim();
  if (!kw || score.focusKeywordOccurrences === 0) {
    codigos.push("puntaje:palabra_clave");
  } else if (score.focusKeywordDensity < DENSIDAD_MIN || score.focusKeywordDensity > DENSIDAD_MAX) {
    codigos.push("puntaje:densidad");
  }

  if (problemasDelTitular(e.titular, e.categoria).length > 0) codigos.push("puntaje:titular");

  // Portada propia del sitio; sin portada vale la de la categoría.
  const cover = e.coverImageUrl?.trim() ?? "";
  if (cover !== "" && (!cover.startsWith("/") || cover.startsWith("//"))) {
    codigos.push("puntaje:portada");
  }

  if (!e.contentKind || !TIPOS_DE_CONTENIDO.has(e.contentKind as NewsContentKind)) {
    codigos.push("puntaje:tipo_contenido");
  }

  if (muletillasEn(e.markdown).length > 0) codigos.push("puntaje:muletillas");

  return codigos;
}
