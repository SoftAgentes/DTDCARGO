/**
 * lib/news/seo-keywords.ts · Plan v4 — Biblioteca de keywords objetivo del negocio
 *
 * Cada keyword tiene su intent (transaccional/informacional) + importancia.
 * Los prompts del bot inyectan estas keywords cuando generan titulares + bullets
 * + artículo. La validación post-generation chequea density 1-2%.
 *
 * Pain points: cada categoría mapea a 2-3 dolores concretos del cliente B2B
 * venezolano importando de China. El bot orienta el contenido a RESOLVER
 * estos dolores, no solo informar.
 *
 * Lista extensible — sumar nuevas keywords/pain points mientras el equipo
 * aprende del cliente real (futuro: migrar a tabla DB para gestión via UI).
 */

import type { NewsCategoria } from "./categories";

export type KeywordIntent = "transaccional" | "informacional";

export interface KeywordEntry {
  keyword: string;
  intent: KeywordIntent;
  /** Por qué importa para el negocio */
  why: string;
  /** 1-5 — 5 es máxima prioridad. Influye en cuáles aparecen primero al sugerir */
  priority: 1 | 2 | 3 | 4 | 5;
}

/**
 * Keywords objetivo del negocio DTD Cargo.
 * Ordenadas por prioridad descendente (las ⭐ son las top del founder).
 */
export const SEO_KEYWORDS_LIBRARY: KeywordEntry[] = [
  {
    keyword: "puerta a puerta",
    intent: "transaccional",
    why: "Servicio core de DTD — alta conversión",
    priority: 5,
  },
  {
    keyword: "cómo invertir en china",
    intent: "informacional",
    why: "Top of funnel para nuevos importadores",
    priority: 5,
  },
  {
    keyword: "importar de china a venezuela",
    intent: "transaccional",
    why: "Localizada, alta intención",
    priority: 5,
  },
  {
    keyword: "carga DDP china venezuela",
    intent: "transaccional",
    why: "Servicio específico",
    priority: 4,
  },
  {
    keyword: "agente de compras china",
    intent: "transaccional",
    why: "Servicio QC + sourcing",
    priority: 4,
  },
  {
    keyword: "yiwu importadores",
    intent: "transaccional",
    why: "Hub geográfico",
    priority: 4,
  },
  {
    keyword: "incoterms 2020",
    intent: "informacional",
    why: "High-volume educational",
    priority: 3,
  },
  {
    keyword: "FCL LCL china",
    intent: "informacional",
    why: "Selector de modalidad",
    priority: 3,
  },
  {
    keyword: "aduana SENIAT importación",
    intent: "informacional",
    why: "Pain point regulatorio",
    priority: 3,
  },
  {
    keyword: "verificación proveedor china",
    intent: "transaccional",
    why: "Pain point trust",
    priority: 4,
  },
  {
    keyword: "tiempos puerto cabello",
    intent: "informacional",
    why: "Búsqueda operativa frecuente",
    priority: 3,
  },
  {
    keyword: "consolidación LCL china",
    intent: "transaccional",
    why: "Servicio LCL Yiwu",
    priority: 3,
  },
  {
    keyword: "inspección fábrica china",
    intent: "transaccional",
    why: "Servicio QC pre-embarque",
    priority: 3,
  },
];

/**
 * Pain points del cliente B2B venezolano que importa de China.
 * Mapeados por categoría — el bot inyecta los dolores relevantes al
 * generar bullets.
 */
export const PAIN_POINTS_BY_CATEGORIA: Record<NewsCategoria, string[]> = {
  operaciones: [
    "Los tiempos no son los prometidos",
    "Mi carga se atascó en aduana",
    "Tengo cargas paradas por X meses",
    "No sé dónde está mi contenedor",
  ],
  "tarifas-fletes": [
    "Los costos suben de la nada (BAF/CAF)",
    "No entiendo qué es BAF/CAF y por qué pago más",
    "¿FCL o LCL me conviene para mi volumen?",
    "El flete subió 30% en el último embarque sin aviso",
  ],
  "aduana-seniat": [
    "No entiendo la normativa SENIAT",
    "Mi declaración fue rechazada por X",
    "Pago demasiados impuestos en aduana",
    "El despacho aduanero tarda meses",
  ],
  "tutoriales-guias": [
    "No sé qué Incoterm usar con mi proveedor",
    "Mi packing list es rechazado siempre",
    "No sé cómo empezar a importar de China",
    "¿Qué documentos necesito para importar?",
  ],
  china: [
    "Cómo invierto en China sin saber chino",
    "Yiwu vs Shenzhen vs Cantón — dónde compro?",
    "Cómo verifico que el proveedor no me estafe",
    "Necesito alguien que vaya a la fábrica por mí",
  ],
  "industria-global": [
    "¿Qué naviera elijo? — Maersk vs MSC vs COSCO",
    "¿Puerto Cabello o La Guaira es mejor para mi carga?",
    "¿Cómo afecta la geopolítica el flete?",
  ],
  "casos-reales": [
    "¿Funciona realmente este servicio?",
    "Quiero ver clientes parecidos a mí",
    "¿Cuál fue el resultado real?",
  ],
  "analisis-opinion": [
    "¿Conviene esperar a importar?",
    "¿La dolarización del flete me afecta?",
    "¿El mercado se mantiene o sube?",
  ],
  "mitos-realidades": [
    "¿Importar de China es realmente barato?",
    "¿Los chinos cumplen sus promesas?",
    "¿La calidad china es mala?",
    "¿DDP es siempre lo mejor?",
  ],
  "anuncios-dtd": [],
};

/** Helper: keywords ordenadas por prioridad */
export function topKeywords(limit = 10): KeywordEntry[] {
  return [...SEO_KEYWORDS_LIBRARY]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

/** Helper: pain points para una categoría */
export function painPointsFor(categoria: NewsCategoria): string[] {
  return PAIN_POINTS_BY_CATEGORIA[categoria] ?? [];
}

/** Helper: keywords formateadas para prompt (string list) */
export function keywordsForPrompt(limit = 10): string {
  return topKeywords(limit)
    .map((k) => `- "${k.keyword}" (${k.intent}) — ${k.why}`)
    .join("\n");
}
