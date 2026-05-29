/**
 * lib/news/categories.ts · Plan v4 — Single source of truth de tipos/categorías/gradients
 *
 * 10 categorías agrupadas en 4 tipos editoriales. Cada categoría tiene:
 *  - label (UI), slug (DB + URL), tipo (writer assignment), titlePrefix (literal en cada titular)
 *  - gradient (from/to hex para la franja de 140px en /noticias)
 *
 * Las 10 categorías reemplazan al NEWS_CATEGORIES de design-tokens.ts (que era 4 cats).
 * Phase F migrará la página pública para leer de acá. Por ahora, design-tokens.ts
 * mantiene el shape viejo para no romper /noticias actual.
 */

export type NewsTipo = "informativo" | "curiosidad" | "polemica" | "especial";

export type NewsCategoria =
  | "operaciones"
  | "tarifas-fletes"
  | "aduana-seniat"
  | "tutoriales-guias"
  | "china"
  | "industria-global"
  | "casos-reales"
  | "analisis-opinion"
  | "mitos-realidades"
  | "anuncios-dtd";

export interface NewsCategoryInfo {
  /** Label visible en UI (badge, dropdown, etc) */
  label: string;
  /** Tipo editorial — drive writer assignment + agrupación visual */
  tipo: NewsTipo;
  /** Prefix literal que el bot pone al inicio de cada titular generado */
  titlePrefix: string;
  /** Descripción corta — útil en cards de Step 0 / hover */
  description: string;
  /** Gradient para la franja de 140px en cards de /noticias */
  gradient: { from: string; to: string };
}

export const NEWS_TIPOS: Record<NewsTipo, { label: string; description: string }> = {
  informativo: {
    label: "Informativo",
    description: "Claro, directo, accionable. Periodístico serio.",
  },
  curiosidad: {
    label: "Curiosidad",
    description: "Engagement editorial. Historia, contexto, descubrimiento.",
  },
  polemica: {
    label: "Polémica",
    description: "Opinión y debate. Provocador sin desinformación.",
  },
  especial: {
    label: "Especial",
    description: "Anuncios oficiales DTD Cargo. Sin escritor externo.",
  },
};

export const NEWS_CATEGORIES_V4: Record<NewsCategoria, NewsCategoryInfo> = {
  // ── INFORMATIVO ────────────────────────────────────────────
  operaciones: {
    label: "Operaciones",
    tipo: "informativo",
    titlePrefix: "Operaciones · ",
    description: "Paros, retrasos, novedades del corredor logístico.",
    gradient: { from: "#0F1E3D", to: "#7F0F1A" }, // ink → wine
  },
  "tarifas-fletes": {
    label: "Tarifas & Fletes",
    tipo: "informativo",
    titlePrefix: "Tarifas · ",
    description: "Precios FCL/LCL/aéreo, BAF/CAF, cambios navieras.",
    gradient: { from: "#0F1E3D", to: "#5E0A12" }, // ink → wine-deep
  },
  "aduana-seniat": {
    label: "Aduana & SENIAT",
    tipo: "informativo",
    titlePrefix: "Aduana · ",
    description: "Regulación, Incoterms, normativa import/export.",
    gradient: { from: "#0F1E3D", to: "#333333" }, // ink → grey-700
  },
  "tutoriales-guias": {
    label: "Tutoriales & Guías",
    tipo: "informativo",
    titlePrefix: "Guía · ",
    description: "Paso a paso prácticos para importadores.",
    gradient: { from: "#0F1E3D", to: "#1F8A5B" }, // ink → success
  },

  // ── CURIOSIDAD ─────────────────────────────────────────────
  china: {
    label: "China",
    tipo: "curiosidad",
    titlePrefix: "China · ",
    description: "Mercado, fábricas, cultura comercial china.",
    gradient: { from: "#1F8A5B", to: "#7F0F1A" }, // success → wine
  },
  "industria-global": {
    label: "Industria global",
    tipo: "curiosidad",
    titlePrefix: "Industria · ",
    description: "Navieras top, puertos récord, contenedores gigantes.",
    gradient: { from: "#1F8A5B", to: "#0F1E3D" }, // success → ink
  },
  "casos-reales": {
    label: "Casos reales",
    tipo: "curiosidad",
    titlePrefix: "Casos · ",
    description: "Clientes DTD, viajes operativos, behind-the-scenes.",
    gradient: { from: "#C2747F", to: "#1F8A5B" }, // wine-soft → success
  },

  // ── POLÉMICA ───────────────────────────────────────────────
  "analisis-opinion": {
    label: "Análisis & Opinión",
    tipo: "polemica",
    titlePrefix: "Opinión · ",
    description: "Mercado, economía, geopolítica del comercio.",
    gradient: { from: "#7F0F1A", to: "#C2353F" }, // wine → danger
  },
  "mitos-realidades": {
    label: "Mitos & Realidades",
    tipo: "polemica",
    titlePrefix: "Mitos · ",
    description: "Desmontar mitos sobre importar de China.",
    gradient: { from: "#C2353F", to: "#B8893A" }, // danger → warning
  },

  // ── ESPECIAL ───────────────────────────────────────────────
  "anuncios-dtd": {
    label: "Anuncios DTD",
    tipo: "especial",
    titlePrefix: "Anuncio · ",
    description: "Comunicados oficiales de DTD Cargo.",
    gradient: { from: "#5E0A12", to: "#0F1E3D" }, // wine-deep → ink
  },
};

/** Helper: lista de categorías para un tipo dado */
export function categoriasByTipo(tipo: NewsTipo): NewsCategoria[] {
  return (Object.entries(NEWS_CATEGORIES_V4) as Array<[NewsCategoria, NewsCategoryInfo]>)
    .filter(([, info]) => info.tipo === tipo)
    .map(([slug]) => slug);
}

/** Helper: lista completa de slugs */
export const ALL_CATEGORIA_SLUGS = Object.keys(NEWS_CATEGORIES_V4) as NewsCategoria[];
export const ALL_TIPO_SLUGS = Object.keys(NEWS_TIPOS) as NewsTipo[];

/** Convierte gradient a CSS linear-gradient(135deg, from 0%, to 100%) */
export function gradientToCss(g: { from: string; to: string }): string {
  return `linear-gradient(135deg, ${g.from} 0%, ${g.to} 100%)`;
}
