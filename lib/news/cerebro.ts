/**
 * lib/news/cerebro.ts · SDD-0089 F-A — El cerebro clasificador (Banco de ideas).
 *
 * Antecede al wizard de noticia de SDD-0088. Metés nombre + título de una idea,
 * el motor corre el **Test de Noticia** (5 preguntas sí/no, §5 del manual de
 * comunicación) y decide:
 *   - Flujo A (noticia / blog) si score ≥ 3, Flujo B (redes/WhatsApp) si ≤ 2.
 *   - Categoría del blog (6 de negocio), tipo editorial (4), canales, ángulo, títulos.
 *
 * Los 8 tipos del cerebro (Guía, Postura, Historia, Dato, Actualidad, Promo,
 * Pregunta, Detrás de cámara) se **mapean a los 4 editoriales** existentes
 * (`informativo | curiosidad | polemica | especial`) para no tocar `writers.ts`.
 * Los tipos que NUNCA van a noticias (Promo, Pregunta, Detrás de cámara) mapean
 * a `null` → solo Flujo B.
 *
 * Funciones PURAS — sin DB, sin Claude, sin secretos. Single source of truth de
 * la taxonomía del cerebro (igual que `categories.ts` lo es de la editorial).
 * El prompt-cerebro vive en `prompts.ts`; la validación server-side en `actions.ts`.
 *
 * Frontera: F-A NO toca DB (el schema `content_pieces` es F-B), NO genera piezas
 * de redes (F-B), NO recompra (F-D), NO publicación (F-E).
 */

import type { NewsCategoria, NewsTipo } from "./categories";

// ──────────────────────────────────────────────────────────────
// Tipos del cerebro (8) · §3 del manual de comunicación
// ──────────────────────────────────────────────────────────────

/**
 * Los 8 tipos de contenido del manual (la columna "Tipo" de §3). Son una capa
 * de clasificación MÁS RICA que los 4 tipos editoriales: distinguen intención
 * (promo, pregunta, detrás de cámara) que no existe en la taxonomía de blog.
 */
export type CerebroTipo =
  | "guia" // Guía / Consejo — enseña a hacer algo
  | "postura" // Postura / Opinión — tu punto de vista
  | "historia" // Historia / Caso — un relato real
  | "dato" // Dato que pega — una cifra fuerte
  | "actualidad" // Actualidad — algo que pasó ahora
  | "promo" // Promo / Oferta — precio, fecha, cupos
  | "pregunta" // Pregunta / Conversación — para enganchar
  | "detras-camara"; // Detrás de cámara — el día a día, el galpón

/** Label visible + descripción de cada tipo del cerebro (UI + prompt). */
export const CEREBRO_TIPOS: Record<
  CerebroTipo,
  { label: string; description: string }
> = {
  guia: {
    label: "Guía / Consejo",
    description: "Enseña a hacer algo. No caduca — el motor del blog.",
  },
  postura: {
    label: "Postura / Opinión",
    description: "Tu punto de vista. Genera debate honesto.",
  },
  historia: {
    label: "Historia / Caso",
    description: "Un relato real. Prueba de que no es teoría.",
  },
  dato: {
    label: "Dato que pega",
    description: "Una cifra fuerte que incomoda y se comparte.",
  },
  actualidad: {
    label: "Actualidad",
    description: "Algo que pasó ahora. Blog solo si perdura.",
  },
  promo: {
    label: "Promo / Oferta",
    description: "Precio, fecha, cupos, contenedor que sale. Nunca al blog.",
  },
  pregunta: {
    label: "Pregunta / Conversación",
    description: "Para enganchar y medir interés. Directo al canal.",
  },
  "detras-camara": {
    label: "Detrás de cámara",
    description: "El día a día, el galpón, Yiwu. Construye cercanía.",
  },
};

/** Lista completa de slugs del cerebro (orden de §3). */
export const ALL_CEREBRO_TIPOS = Object.keys(CEREBRO_TIPOS) as CerebroTipo[];

// ──────────────────────────────────────────────────────────────
// Mapeo 8 → 4 · cerebro → editorial (no tocar writers.ts)
// ──────────────────────────────────────────────────────────────

/**
 * Mapeo de los 8 tipos del cerebro a los 4 tipos editoriales de blog.
 *
 * `null` = el tipo NUNCA va a noticias (§3: Promo, Pregunta, Detrás de cámara
 * son "No" en la columna "¿Noticia?"). Esos tipos solo producen Flujo B aunque
 * el Test de Noticia diera score alto por error — la regla de §3 es dura.
 *
 *   guia          → informativo  (enseña, accionable)
 *   dato          → informativo  (cifra con contexto)
 *   postura       → polemica     (opinión, debate)
 *   actualidad    → polemica     (dólar/aduana, ángulo de bolsillo)
 *   historia      → curiosidad   (relato, caso, detrás)
 *   promo         → null         (solo redes/WhatsApp)
 *   pregunta      → null         (solo redes/WhatsApp)
 *   detras-camara → null         (solo IG stories)
 *
 * No hay tipo del cerebro que mapee a "especial" (Novedades DTD) por defecto:
 * "especial" es un anuncio oficial de la empresa, decisión editorial humana, no
 * una clasificación automática de idea entrante. Si una idea es sobre la empresa
 * misma, el operador la rutea manualmente en el wizard (tipo especial existe ahí).
 */
export const CEREBRO_A_EDITORIAL: Record<CerebroTipo, NewsTipo | null> = {
  guia: "informativo",
  postura: "polemica",
  historia: "curiosidad",
  dato: "informativo",
  actualidad: "polemica",
  promo: null,
  pregunta: null,
  "detras-camara": null,
};

/** True si el tipo del cerebro puede llegar a blog (tiene tipo editorial). */
export function cerebroPuedeSerNoticia(tipo: CerebroTipo): boolean {
  return CEREBRO_A_EDITORIAL[tipo] !== null;
}

// ──────────────────────────────────────────────────────────────
// Canales y ángulos · §7 y §4 del manual
// ──────────────────────────────────────────────────────────────

/** Destinos posibles de una pieza (§7 — tabla de canales). */
export type CanalDestino = "noticias" | "linkedin" | "instagram" | "whatsapp";

export const ALL_CANALES: CanalDestino[] = [
  "noticias",
  "linkedin",
  "instagram",
  "whatsapp",
];

/** Label visible de cada canal (UI badges). */
export const CANAL_LABELS: Record<CanalDestino, string> = {
  noticias: "Noticias (blog)",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
};

/** Ángulos disponibles — el "gancho" de cada pieza (§4 del manual). */
export type Angulo =
  | "provocador" // rompe el hábito, cuestiona lo dado por hecho
  | "autoridad" // educativo, posiciona como experto
  | "historia" // relato real, antes/después
  | "dato" // abre con una cifra que incomoda
  | "how-to" // paso a paso, práctico, accionable
  | "contrario"; // "lo que todos creen está mal, y por qué"

export const ALL_ANGULOS: Angulo[] = [
  "provocador",
  "autoridad",
  "historia",
  "dato",
  "how-to",
  "contrario",
];

/** Label visible de cada ángulo (UI). */
export const ANGULO_LABELS: Record<Angulo, string> = {
  provocador: "Provocador",
  autoridad: "Autoridad",
  historia: "Historia",
  dato: "Dato que pega",
  "how-to": "Paso a paso",
  contrario: "Contrario",
};

// ──────────────────────────────────────────────────────────────
// El Test de Noticia (5 preguntas sí/no) · §5
// ──────────────────────────────────────────────────────────────

/**
 * Resultado del Test de Noticia. Los 5 booleanos son las 5 preguntas de §5;
 * `score` = cantidad de `true` (0-5). La regla A/B se deriva del score con
 * `flujoFromScore` — NUNCA se confía en lo que diga el LLM (defensa
 * anti-alucinación, igual que SDD-0088 recalcula `confidence`).
 */
export interface TestNoticia {
  /** ¿Alguien lo buscaría en Google? */
  busca_google: boolean;
  /** ¿Una IA lo daría como respuesta a alguien? */
  ia_responde: boolean;
  /** ¿Sirve igual dentro de 6 meses (no caduca)? */
  sirve_6_meses: boolean;
  /** ¿Enseña o resuelve algo de verdad? */
  ensena_resuelve: boolean;
  /** ¿Te hace ver como el que sabe? */
  parece_experto: boolean;
  /** Suma de los 5 booleanos (0-5). Recalculado en server, nunca del LLM. */
  score: number;
}

/** Las 5 claves booleanas del test (sin `score`), en orden de §5. */
export const TEST_NOTICIA_KEYS = [
  "busca_google",
  "ia_responde",
  "sirve_6_meses",
  "ensena_resuelve",
  "parece_experto",
] as const;

export type TestNoticiaKey = (typeof TEST_NOTICIA_KEYS)[number];

/** Texto humano de cada pregunta del test (UI). */
export const TEST_NOTICIA_LABELS: Record<TestNoticiaKey, string> = {
  busca_google: "¿Alguien lo buscaría en Google?",
  ia_responde: "¿Una IA lo daría como respuesta?",
  sirve_6_meses: "¿Sirve igual en 6 meses (no caduca)?",
  ensena_resuelve: "¿Enseña o resuelve algo real?",
  parece_experto: "¿Te hace ver como el que sabe?",
};

/** Suma los 5 booleanos del test → score 0-5. Fuente de verdad del score. */
export function scoreFromTest(
  test: Record<TestNoticiaKey, boolean>,
): number {
  return TEST_NOTICIA_KEYS.reduce(
    (acc, k) => acc + (test[k] ? 1 : 0),
    0,
  );
}

// ──────────────────────────────────────────────────────────────
// La regla A/B · §5 (3+ SÍ = A, 2 o menos = B)
// ──────────────────────────────────────────────────────────────

export type Flujo = "A" | "B" | "mixto";

/**
 * Deriva el flujo del score del Test de Noticia.
 *   - score ≥ 3 → "A" (Flujo A: Noticia + atomizar)
 *   - score ≤ 2 → "B" (Flujo B: directo al canal)
 *
 * Nota: "mixto" NO sale de acá — es una decisión posterior del operador (Flujo A
 * + también atomizar a redes). El cerebro automático solo decide A o B; por eso
 * la firma devuelve estrictamente 'A' | 'B'.
 */
export function flujoFromScore(score: number): "A" | "B" {
  return score >= 3 ? "A" : "B";
}

// ──────────────────────────────────────────────────────────────
// El resultado del clasificador
// ──────────────────────────────────────────────────────────────

/**
 * Lo que devuelve `routeIdea()` (server action). Es el contrato entre el cerebro
 * y la UI del Banco de ideas. `confidence` se recalcula/clampa en server.
 */
export interface RouteIdeaResult {
  /** Tipo del cerebro (8) clasificado a partir de nombre + título. */
  tipo: CerebroTipo;
  /** El Test de Noticia con sus 5 booleanos + score (recalculado en server). */
  test_noticia: TestNoticia;
  /** Flujo derivado del score. 'A' = noticia, 'B' = redes/WhatsApp. */
  flujo: Flujo;
  /** Categoría del blog (6) si Flujo A; null si Flujo B (no va a blog). */
  categoria: NewsCategoria | null;
  /** Tipo editorial (4) si Flujo A; null si Flujo B. */
  tipo_editorial: NewsTipo | null;
  /** Canales sugeridos (§7). Flujo A incluye 'noticias'; Flujo B nunca. */
  canales: CanalDestino[];
  /** Ángulo recomendado para el gancho (§4). */
  angulo: Angulo;
  /** 2-3 títulos propuestos. */
  titulos: string[];
  /** Razón en 1-2 líneas (por qué este flujo/categoría). */
  reason: string;
  /** Confianza del modelo (0-100), clampada en server. */
  confidence: number;
}
