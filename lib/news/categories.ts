/**
 * lib/news/categories.ts · SDD-0088 F1 — Single source of truth de tipos/categorías/gradients
 *
 * 6 categorías de NEGOCIO (founder, 2026-06-14) agrupadas en 4 tipos editoriales.
 * Reemplazan las 10 categorías técnicas (operaciones, tarifas-fletes, …) del Plan v4.
 * Orientadas al público objetivo: importador pyme VE que ya compra recurrente cada
 * ~3 meses → jalarlo a compra mensual.
 *
 * Cada categoría tiene:
 *  - label (UI), slug (DB + URL), tipo (writer assignment), titlePrefix (literal en cada titular)
 *  - description (propósito, útil en cards de Step 0 / hover)
 *  - gradient (from/to hex para la franja de 140px en /noticias)
 *
 * La columna `news_posts.categoria` está acotada por el CHECK de la migración
 * 0139 a exactamente estos 6 slugs.
 */

export type NewsTipo = "informativo" | "curiosidad" | "polemica" | "especial";

export type NewsCategoria =
  | "importa-sin-perder-plata"
  | "que-se-mueve-en-china"
  | "como-llega-tu-mercancia"
  | "venezuela-y-tu-bolsillo"
  | "historias-reales"
  | "novedades-dtd";

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
  // Motor / categoría destacada — la serie de flujo de caja (lenguaje de calle).
  "importa-sin-perder-plata": {
    label: "Importa sin perder plata",
    tipo: "informativo",
    titlePrefix: "Importa · ",
    description: "Comprar y traer mejor sin secar la caja. Autoridad + SEO/GEO.",
    gradient: { from: "#0F1E3D", to: "#1F8A5B" }, // ink → success (plata)
  },
  "como-llega-tu-mercancia": {
    label: "Cómo llega tu mercancía",
    tipo: "informativo",
    titlePrefix: "Envío · ",
    description: "Envío, aduana, tiempos, costos, puerta a puerta. Confianza.",
    gradient: { from: "#0F1E3D", to: "#7F0F1A" }, // ink → wine
  },

  // ── CURIOSIDAD ─────────────────────────────────────────────
  "que-se-mueve-en-china": {
    label: "Qué se mueve en China",
    tipo: "curiosidad",
    titlePrefix: "China · ",
    description: "Productos, Yiwu, ferias y tendencias del mercado chino.",
    gradient: { from: "#1F8A5B", to: "#7F0F1A" }, // success → wine
  },
  "historias-reales": {
    label: "Historias reales",
    tipo: "curiosidad",
    titlePrefix: "Historias · ",
    description: "Casos de clientes y detrás de cámara de la operación.",
    gradient: { from: "#C2747F", to: "#1F8A5B" }, // wine-soft → success
  },

  // ── POLÉMICA ───────────────────────────────────────────────
  "venezuela-y-tu-bolsillo": {
    label: "Venezuela y tu bolsillo",
    tipo: "polemica",
    titlePrefix: "Bolsillo · ",
    description: "Dólar, economía y reglas que le pegan al importador.",
    gradient: { from: "#7F0F1A", to: "#C2353F" }, // wine → danger
  },

  // ── ESPECIAL ───────────────────────────────────────────────
  "novedades-dtd": {
    label: "Novedades DTD",
    tipo: "especial",
    titlePrefix: "Novedades · ",
    description: "Servicios nuevos, equipo y el ERP de DTD Cargo.",
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

/**
 * Fallback seguro para categorías legacy o desconocidas — p.ej. posts que aún
 * tienen la taxonomía vieja en DB antes de aplicar la migración 0139, o cualquier
 * slug fuera de los 6. Gradient = ink → wine (paleta de marca, sin hex inventado).
 */
const FALLBACK_CATEGORY: NewsCategoryInfo = {
  label: "Noticias",
  tipo: "informativo",
  titlePrefix: "",
  description: "",
  gradient: { from: "#0F1E3D", to: "#7F0F1A" },
};

/**
 * Info de una categoría con fallback seguro. USAR SIEMPRE en el sitio público:
 * `news_posts.categoria` viene de DB y puede traer un slug legacy hasta que la
 * migración 0139 se aplique en prod. Acceder a `NEWS_CATEGORIES_V4[slug]` directo
 * devolvería `undefined` → crash al leer `.gradient`/`.label`.
 */
export function getCategoryInfo(categoria: string): NewsCategoryInfo {
  return NEWS_CATEGORIES_V4[categoria as NewsCategoria] ?? FALLBACK_CATEGORY;
}
