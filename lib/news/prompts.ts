/**
 * lib/news/prompts.ts · Plan v4 — Builders puros de prompts para Claude
 *
 * Funciones que devuelven STRINGS de prompt. Reusables por:
 *  - Modo Auto: las server actions usan estos builders + llaman a Anthropic SDK
 *  - Modo Manual: el modal ManualPromptModal usa los mismos builders + muestra
 *    el prompt al usuario para que lo pegue en claude.ai
 *
 * Single source of truth — si cambia el prompt, cambia en un solo lugar.
 *
 * Todos los prompts:
 *  - Castellano neutro Latam
 *  - SEO-first (inyectan keywords)
 *  - Pain points framework (resuelven dolores del cliente)
 *  - JSON discipline (output estructurado)
 */

import {
  NEWS_CATEGORIES_V4,
  NEWS_TIPOS,
  type NewsCategoria,
  type NewsTipo,
} from "./categories";
import {
  keywordsForPrompt,
  painPointsFor,
} from "./seo-keywords";

export type Tone = "informativo" | "curiosidad" | "polemico";

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  informativo:
    "tono informativo, claro y directo, estilo periodístico serio. Sin adjetivos vacíos.",
  curiosidad:
    "tono que despierte curiosidad, con gancho, que haga clic sin caer en clickbait barato.",
  polemico:
    "tono polémico y provocador, que genere debate honesto, sin desinformación.",
};

// ──────────────────────────────────────────────────────────────
// 1. detectCategory — usuario tipea tema + ya eligió tipo
// ──────────────────────────────────────────────────────────────

export function buildDetectCategoryPrompt(
  topic: string,
  tipo: NewsTipo,
): string {
  const cats = (Object.entries(NEWS_CATEGORIES_V4) as Array<[NewsCategoria, typeof NEWS_CATEGORIES_V4[NewsCategoria]]>)
    .filter(([, info]) => info.tipo === tipo)
    .map(([slug, info]) => `- "${slug}" → ${info.label}: ${info.description}`)
    .join("\n");

  return `Sos editor SEO senior de DTD Cargo (logística China-Venezuela). El usuario eligió tipo "${NEWS_TIPOS[tipo].label}" y ahora propone este tema:

TEMA: ${topic}

Categorías disponibles del tipo "${tipo}":
${cats}

Devolvé SOLO JSON válido con la categoría más apropiada para este tema, sin prosa adicional ni bloques de código:
{"categoria": "<slug>", "reason": "<1 oración explicando por qué>", "confidence": <0-100>}`;
}

// ──────────────────────────────────────────────────────────────
// 2. suggestKeywords — keywords SEO para el post
// ──────────────────────────────────────────────────────────────

export function buildSuggestKeywordsPrompt(
  topic: string,
  categoria: NewsCategoria,
): string {
  const catInfo = NEWS_CATEGORIES_V4[categoria];
  const pains = painPointsFor(categoria).map((p) => `- "${p}"`).join("\n");

  return `Sos editor SEO senior de DTD Cargo. Sugerí keywords SEO para este post:

TEMA: ${topic}
CATEGORÍA: ${catInfo.label} (${catInfo.description})

KEYWORDS OBJETIVO DEL NEGOCIO (priorizadas):
${keywordsForPrompt(14)}

PAIN POINTS DEL CLIENTE en esta categoría:
${pains || "- (no aplica para esta categoría)"}

Devolvé SOLO JSON válido sin prosa adicional ni bloques de código:
{
  "focus_keyword": "<1 keyword principal, idealmente del listado priorizado o variante natural>",
  "secondary_keywords": ["<3 keywords secundarias relacionadas>"],
  "pain_points_addressed": ["<2-3 pain points concretos del listado que este post va a atacar>"],
  "reason": "<1 oración explicando la elección>"
}`;
}

// ──────────────────────────────────────────────────────────────
// 3. generateHeadlines — 5 titulares con prefix literal + SEO
// ──────────────────────────────────────────────────────────────

export function buildGenerateHeadlinesPrompt(
  topic: string,
  tone: Tone,
  categoria: NewsCategoria,
  focusKeyword?: string,
  secondaryKeywords?: string[],
): string {
  const catInfo = NEWS_CATEGORIES_V4[categoria];
  const keywordsBlock = focusKeyword
    ? `\n\nKEYWORD PRINCIPAL: "${focusKeyword}"${secondaryKeywords?.length ? `\nKEYWORDS SECUNDARIAS: ${secondaryKeywords.map((k) => `"${k}"`).join(", ")}` : ""}\n\nIncorporá la keyword principal en al menos 2 de los 5 titulares, de forma natural (no keyword stuffing). Las secundarias pueden aparecer en otros.`
    : "";

  return `Sos editor SEO senior de DTD Cargo (logística China-Venezuela). Generá EXACTAMENTE 5 titulares alternativos optimizados para SEO en castellano neutro Latam.

TEMA: ${topic}
CATEGORÍA: ${catInfo.label} (${catInfo.description})
TONO: ${TONE_INSTRUCTIONS[tone]}${keywordsBlock}

Restricciones IMPORTANTES:
- Cada titular DEBE arrancar EXACTAMENTE con: "${catInfo.titlePrefix}"
- Después del prefix, el resto del titular entre 35 y 50 caracteres (total ~50-65 con prefix)
- Sin comillas envolventes, sin numeración interna, sin emojis
- Castellano neutro Latam (no voseo argentino, no españolismos)
- Optimizado para clicks orgánicos (intent del lector)

Devolvé SOLO JSON válido sin prosa adicional ni bloques de código:
{"headlines": ["${catInfo.titlePrefix}...", "${catInfo.titlePrefix}...", "${catInfo.titlePrefix}...", "${catInfo.titlePrefix}...", "${catInfo.titlePrefix}..."]}`;
}

// ──────────────────────────────────────────────────────────────
// 4. generateBullets — 8-10 secciones del artículo
// ──────────────────────────────────────────────────────────────

export function buildGenerateBulletsPrompt(
  headline: string,
  categoria: NewsCategoria,
  secondaryKeywords?: string[],
): string {
  const catInfo = NEWS_CATEGORIES_V4[categoria];
  const pains = painPointsFor(categoria);
  const painsBlock = pains.length > 0
    ? `\n\nPAIN POINTS RELEVANTES de esta categoría:\n${pains.map((p) => `- "${p}"`).join("\n")}\n\nAl menos 2-3 bullets deben RESOLVER pain points concretos del listado.`
    : "";
  const kwBlock = secondaryKeywords?.length
    ? `\n\nKEYWORDS SECUNDARIAS a incorporar en titles de bullets de forma orgánica: ${secondaryKeywords.map((k) => `"${k}"`).join(", ")}`
    : "";

  return `Sos editor SEO senior de DTD Cargo. Generá la estructura de un artículo para este titular:

TITULAR: ${headline}
CATEGORÍA: ${catInfo.label}${painsBlock}${kwBlock}

Devolvé entre 8 y 10 secciones (bullets) en orden lógico de lectura. Cada bullet:
- title: subtema concreto, corto (máx 60 chars), optimizado para SEO + intención de búsqueda
- desc: 1 línea (máx 120 chars) explicando qué cubrirá la sección

Devolvé SOLO JSON válido sin prosa adicional ni bloques de código:
{"bullets": [{"title": "...", "desc": "..."}, ...]}`;
}

// ──────────────────────────────────────────────────────────────
// 5. generateArticle — artículo Markdown 800-1200 palabras
// ──────────────────────────────────────────────────────────────

export function buildGenerateArticlePrompt(
  headline: string,
  sections: Array<{ title: string; desc: string }>,
  focusKeyword?: string,
  secondaryKeywords?: string[],
): string {
  const sectionsList = sections
    .map((s, i) => `${i + 1}. ${s.title} — ${s.desc}`)
    .join("\n");

  const kwBlock = focusKeyword
    ? `\n\nKEYWORD PRINCIPAL: "${focusKeyword}" — debe aparecer en intro + al menos 1 H2 + 2-3 veces en el body (density 1-2%, NO stuffing).${secondaryKeywords?.length ? `\nKEYWORDS SECUNDARIAS: ${secondaryKeywords.map((k) => `"${k}"`).join(", ")} — incorporar de forma natural cuando encajen.` : ""}`
    : "";

  return `Sos redactor SEO senior de DTD Cargo (logística China-Venezuela). Escribí un artículo completo en castellano neutro Latam.

TITULAR: ${headline}

SECCIONES (en este orden):
${sectionsList}${kwBlock}

Reglas:
- Largo total: 800-1200 palabras
- Introducción atractiva ANTES de la primera sección (sin H2)
- Cada sección con un H2 en Markdown (## Título)
- Transiciones naturales entre secciones
- Conclusión al final (con H2 "## Conclusión")
- Palabras clave naturales, sin sobreoptimización ni stuffing
- Castellano neutro Latam, voz "tú" neutro
- Pain points del cliente como subtexto — el contenido debe RESOLVER, no solo informar

Devolvé SOLO Markdown puro. NO uses bloques de código \`\`\`. NO agregues preámbulo ni notas. Empezá directamente con el párrafo de introducción.`;
}
