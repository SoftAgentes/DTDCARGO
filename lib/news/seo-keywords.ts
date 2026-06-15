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
 * Mapeados por las 6 categorías de negocio (SDD-0088 F1) — el bot inyecta
 * los dolores relevantes al generar bullets. Reasignados por afinidad
 * temática desde las 10 categorías técnicas del Plan v4.
 */
export const PAIN_POINTS_BY_CATEGORIA: Record<NewsCategoria, string[]> = {
  // Motor — la serie de flujo de caja (sin nombrar "flujo de caja" en lo visible).
  // El mensaje nunca es "compra menos volumen", sino "no congeles toda la plata de golpe".
  "importa-sin-perder-plata": [
    "Importo bien pero siempre ando corto de efectivo",
    "Cada compra grande me deja la caja seca por semanas",
    "¿Importar de China es realmente tan barato como dicen?",
    "¿Conviene traer todo de una o repartir las compras?",
    "Siento que gano, pero la plata no me rinde",
  ],
  // Envío / aduana / tiempos / costos / modalidad / documentos / naviera → confianza.
  "como-llega-tu-mercancia": [
    "Los tiempos no son los prometidos",
    "Mi carga se atascó en aduana",
    "No sé dónde está mi contenedor",
    "Los costos suben de la nada (BAF/CAF)",
    "¿FCL o LCL me conviene para mi volumen?",
    "No entiendo la normativa SENIAT",
    "No sé qué documentos necesito para importar",
  ],
  // Mercado chino, Yiwu, sourcing, verificación de proveedor.
  "que-se-mueve-en-china": [
    "Cómo compro en China sin saber chino",
    "Yiwu vs Shenzhen vs Cantón — dónde compro?",
    "Cómo verifico que el proveedor no me estafe",
    "Necesito alguien que vaya a la fábrica por mí",
  ],
  // Dólar, economía, reglas que le pegan al importador VE.
  "venezuela-y-tu-bolsillo": [
    "¿Conviene esperar a importar?",
    "¿La dolarización del flete me afecta?",
    "¿El mercado se mantiene o sube?",
    "¿Las nuevas reglas me cambian los costos?",
  ],
  // Casos de clientes, detrás de cámara.
  "historias-reales": [
    "¿Funciona realmente este servicio?",
    "Quiero ver clientes parecidos a mí",
    "¿Cuál fue el resultado real?",
  ],
  // Anuncios institucionales — sin pain points (no es contenido de dolor).
  "novedades-dtd": [],
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
