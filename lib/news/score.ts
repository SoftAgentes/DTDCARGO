/**
 * lib/news/score.ts · Score SEO post-redacción (Plan v5)
 *
 * Función PURA — sin DB, sin Claude, sin secretos. Vive como helper
 * compartible client + server: el panel lateral del Step 3 la llama
 * en cliente para recomputar el score cuando el operador edita el
 * markdown inline. Tener una server action acá sería overengineering
 * (cada keypress un round-trip).
 *
 * Métricas calculadas:
 *  - wordCount (palabras del cuerpo, descontando markup)
 *  - readTimeMin (200 wpm)
 *  - h2Count (cuenta de "## " en el markdown)
 *  - focusKeywordDensity (%, target 1-2%)
 *  - focusKeywordOccurrences
 *  - painPointsCovered + painPointsMissed (heurística: ≥60% palabras del
 *    pain point aparecen en el markdown)
 *  - hasNutGraf (proxy: al menos 1 párrafo de 2-4 oraciones en los
 *    primeros 3 párrafos no-heading)
 *  - verifyMarkers (lista de las marcas `[VERIFICAR` encontradas, en cualquier
 *    forma; bloquean publish, también la vacía — SDD-0611)
 */

import { listarMarcas } from "./autopublicar/marcas";

export interface ArticleScore {
  wordCount: number;
  readTimeMin: number;
  h2Count: number;
  focusKeywordDensity: number; // porcentaje 0-100, redondeado a 2 decimales
  focusKeywordOccurrences: number;
  painPointsCovered: string[];
  painPointsMissed: string[];
  hasNutGraf: boolean;
  verifyMarkers: string[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Convención editorial: target 1-2% density del focus keyword. */
export const TARGET_DENSITY_MIN = 1.0;
export const TARGET_DENSITY_MAX = 2.0;

export function computeArticleScore(
  markdown: string,
  focusKeyword: string,
  painPoints: string[] = [],
): ArticleScore {
  const md = markdown ?? "";

  // Word count (strip markup mínimo)
  const stripped = md
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_`[\]()>]/g, "")
    .replace(/\[VERIFICAR:?[^\]]*\]/gi, "")
    .trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const readTimeMin = Math.max(1, Math.round(wordCount / 200));

  // H2 count
  const h2Count = (md.match(/^##\s+/gm) || []).length;

  // Focus keyword
  const focus = (focusKeyword ?? "").trim().toLowerCase();
  let focusOccurrences = 0;
  if (focus) {
    const re = new RegExp(`\\b${escapeRegex(focus)}\\b`, "g");
    focusOccurrences = (md.toLowerCase().match(re) || []).length;
  }
  const focusDensityPct =
    wordCount > 0 ? (focusOccurrences / wordCount) * 100 : 0;

  // Pain points cover (heurística simple)
  const mdLower = md.toLowerCase();
  const painPointsCovered: string[] = [];
  const painPointsMissed: string[] = [];
  for (const pain of painPoints) {
    const kws = pain
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    if (kws.length === 0) {
      painPointsMissed.push(pain);
      continue;
    }
    const hits = kws.filter((kw) => mdLower.includes(kw)).length;
    const coverage = hits / kws.length;
    if (coverage >= 0.6) painPointsCovered.push(pain);
    else painPointsMissed.push(pain);
  }

  // Nut graf proxy
  const firstParas = md
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith("#") && !p.startsWith(">"))
    .slice(0, 3);
  const hasNutGraf = firstParas.some((p) => {
    const sentences = p.split(/[.!?]\s+/).filter((s) => s.trim().length > 10);
    return sentences.length >= 2 && sentences.length <= 4;
  });

  // [VERIFICAR: ...] markers. SDD-0611: la marca vacía (`[VERIFICAR]`,
  // `[VERIFICAR: ]`), en minúsculas, sin cerrar o en un enlace también cuenta,
  // con la misma regla que el servidor (lib/news/autopublicar/marcas.ts).
  const verifyMarkers = listarMarcas(md);

  return {
    wordCount,
    readTimeMin,
    h2Count,
    focusKeywordDensity: Math.round(focusDensityPct * 100) / 100,
    focusKeywordOccurrences: focusOccurrences,
    painPointsCovered,
    painPointsMissed,
    hasNutGraf,
    verifyMarkers,
  };
}

/** Devuelve true si el artículo está listo para publicar (sin VERIFICAR sin resolver). */
export function isPublishReady(score: ArticleScore): boolean {
  return score.verifyMarkers.length === 0 && score.wordCount >= 400;
}

/** Tono visual para la density (target 1-2%). */
export function densityTone(
  density: number,
): "ok" | "low" | "high" | "missing" {
  if (density === 0) return "missing";
  if (density < TARGET_DENSITY_MIN) return "low";
  if (density > TARGET_DENSITY_MAX) return "high";
  return "ok";
}
