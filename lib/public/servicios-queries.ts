/**
 * Queries públicas de servicios para el sitio (SDD-0076 Fase 3).
 *
 * Llaman a las RPCs `public_servicios` / `public_service_faqs` (SECURITY DEFINER,
 * grant anon) de `supabase/migrations/0130_service_configs.sql`. Devuelven solo
 * lo publicado del tenant dtd, con WHITELIST de columnas (la capa interna nunca sale).
 *
 * `mergeServiciosPublicados()` combina el contenido publicado con el estático de
 * `lib/servicios-detalle.ts`: cada servicio usa su contenido de DB si está publicado
 * (con fallback al estático por campo vacío) y el estático si no — CERO regresión.
 * Hasta que coordinación aplique la migración 0130 y publique servicios, las RPCs
 * devuelven [] y el sitio muestra el estático tal cual.
 *
 * Frontera: vive en lib/public (capa de datos pública). Importa @/lib/shared
 * (claves) y @/lib/servicios-detalle (estático) — nunca lib/studio.
 */

import { getAnonClient } from "./supabase-anon";
import {
  SERVICE_CATALOG,
  SERVICE_CATALOG_BY_ID,
  type ServicioId,
} from "@/lib/shared/service-catalog";
import {
  CHARGE_MODES,
  type ChargeMode,
  type OfferOverride,
  type OfferOverrides,
} from "@/lib/shared/service-offer";
import {
  SERVICIOS_DETALLE,
  type ServicioDetalle,
  type ServicioEstado,
} from "@/lib/servicios-detalle";

export type PublicServicio = {
  service_key: string;
  shipment_service: string | null;
  title_public: string;
  description_public: string;
  includes_public: string[];
  excludes_public: string[];
  price_text: string;
  price_table: { columnas: string[]; filas: string[][]; nota?: string } | null;
  charge_moment: string | null;
  payment_methods: string[];
  how_to_request: string;
  timelines_public: string;
  note_public: string | null;
  condiciones_politicas: string | null;
  service_state: string;
  // SDD-0090 (matriz de oferta) — opcionales: el RPC 0130 no los devuelve hasta
  // aplicar la migración 0142, así que pueden venir undefined (forward-compat).
  suggests_keys?: string[] | null;
  includes_keys?: string[] | null;
  charge_mode?: string | null;
};

export type PublicServiceFaq = {
  service_key: string;
  question: string;
  answer: string;
  sort_order: number;
};

const VALID_ESTADOS: ServicioEstado[] = [
  "activo",
  "suspendido",
  "a-pedido",
  "proximamente",
];

function normalizeEstado(v: string | null | undefined): ServicioEstado | null {
  return v && (VALID_ESTADOS as string[]).includes(v)
    ? (v as ServicioEstado)
    : null;
}

/**
 * Servicios publicados del tenant dtd. Nunca tira (página pública): cualquier
 * falla (env, Supabase caído, RPC ausente porque 0130 no está aplicada) → [].
 */
export async function getPublicServicios(): Promise<PublicServicio[]> {
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_servicios");
    if (error) {
      console.error("[getPublicServicios] RPC error:", error.message);
      return [];
    }
    return Array.isArray(data) ? (data as PublicServicio[]) : [];
  } catch (e) {
    console.error(
      "[getPublicServicios] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  }
}

/** FAQ públicas publicadas. Nunca tira → []. */
export async function getPublicServiceFaqs(): Promise<PublicServiceFaq[]> {
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_service_faqs");
    if (error) {
      console.error("[getPublicServiceFaqs] RPC error:", error.message);
      return [];
    }
    return Array.isArray(data) ? (data as PublicServiceFaq[]) : [];
  } catch (e) {
    console.error(
      "[getPublicServiceFaqs] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  }
}

// service_key (id del catálogo) → legacySlug (slug del estático). Para empatar
// el contenido de DB con la ficha estática correspondiente.
const KEY_TO_LEGACY = new Map<string, string | null>(
  SERVICE_CATALOG.map((c) => [c.id, c.legacySlug]),
);
const CATALOG_BY_KEY = new Map<string, (typeof SERVICE_CATALOG)[number]>(
  SERVICE_CATALOG.map((c) => [c.id, c]),
);

/**
 * Combina el estático con lo publicado. Para cada ficha estática, si hay un
 * servicio publicado que le corresponde (por service_key↔legacySlug), usa el
 * contenido de DB con fallback al estático por campo vacío. Los publicados sin
 * ficha estática (ej. un servicio nuevo) se agregan al final.
 *
 * Función PURA (sin red) — testeable. Si `publicados` está vacío, devuelve el
 * estático intacto (cero regresión).
 */
export function mergeServiciosPublicados(
  estaticos: ServicioDetalle[],
  publicados: PublicServicio[],
): ServicioDetalle[] {
  if (!publicados.length) return estaticos;

  const pubByKey = new Map(publicados.map((p) => [p.service_key, p]));
  // legacySlug → service_key, para resolver desde el slug del estático.
  const legacyToKey = new Map<string, string>();
  for (const [key, legacy] of KEY_TO_LEGACY) {
    if (legacy) legacyToKey.set(legacy, key);
  }

  const usedKeys = new Set<string>();

  const merged = estaticos.map((est) => {
    const key = legacyToKey.get(est.slug);
    const pub = key ? pubByKey.get(key) : undefined;
    if (!pub) return est;
    usedKeys.add(pub.service_key);
    return {
      ...est, // conserva slug, sede, destacado, href
      titulo: pub.title_public?.trim() || est.titulo,
      resumen: pub.description_public?.trim() || est.resumen,
      incluye: pub.includes_public?.length ? pub.includes_public : est.incluye,
      noIncluye: pub.excludes_public?.length
        ? pub.excludes_public
        : est.noIncluye,
      precio: pub.price_text?.trim() || est.precio,
      precioTabla: pub.price_table ?? est.precioTabla,
      comoSolicitar: pub.how_to_request?.trim() || est.comoSolicitar,
      tiempos: pub.timelines_public?.trim() || est.tiempos,
      nota: pub.note_public?.trim() || est.nota,
      estado: normalizeEstado(pub.service_state) ?? est.estado,
    } satisfies ServicioDetalle;
  });

  // Publicados sin ficha estática (servicios nuevos): construir desde DB.
  for (const pub of publicados) {
    if (usedKeys.has(pub.service_key)) continue;
    if (!pub.title_public?.trim()) continue;
    const cat = CATALOG_BY_KEY.get(pub.service_key);
    merged.push({
      slug: cat?.legacySlug ?? pub.service_key,
      titulo: pub.title_public,
      sede: cat?.sede ?? "ambas",
      resumen: pub.description_public,
      incluye: pub.includes_public ?? [],
      noIncluye: pub.excludes_public ?? [],
      precio: pub.price_text ?? "",
      precioTabla: pub.price_table ?? undefined,
      comoSolicitar: pub.how_to_request ?? "",
      tiempos: pub.timelines_public ?? "",
      nota: pub.note_public ?? undefined,
      estado: normalizeEstado(pub.service_state) ?? "activo",
      destacado: cat?.principal,
    });
  }

  return merged;
}

/**
 * Helper para el server component: trae lo publicado y lo combina con el
 * estático. Lo usará `app/servicios/page.tsx` cuando se haga el cableado final
 * (paso post-migración, junto con publicar servicios en el Studio).
 */
export async function getServiciosParaSitio(): Promise<ServicioDetalle[]> {
  const publicados = await getPublicServicios();
  return mergeServiciosPublicados(SERVICIOS_DETALLE, publicados);
}

const isServicioId = (x: string): x is ServicioId =>
  Object.prototype.hasOwnProperty.call(SERVICE_CATALOG_BY_ID, x);

/**
 * Construye los overrides del motor de oferta (SDD-0090) desde lo publicado.
 * Función PURA. La matriz default vive en código (lib/shared/service-offer.ts);
 * acá la DB la PISA por servicio cuando el founder seede suggests_keys/includes_keys/
 * charge_mode en el Studio. Mientras la migración 0142 no esté aplicada, los campos
 * vienen undefined → devuelve {} → el cerebro usa el default (cero regresión).
 * Descarta claves que no son del catálogo y charge_mode inválidos (defensa).
 */
export function buildOfferOverrides(publicados: PublicServicio[]): OfferOverrides {
  const out: OfferOverrides = {};
  for (const p of publicados) {
    if (!isServicioId(p.service_key)) continue;
    const ov: OfferOverride = {};
    const suggests = (p.suggests_keys ?? []).filter(isServicioId);
    const includes = (p.includes_keys ?? []).filter(isServicioId);
    if (suggests.length) ov.suggests = suggests;
    if (includes.length) ov.includes = includes;
    if (p.charge_mode && CHARGE_MODES.includes(p.charge_mode as ChargeMode)) {
      ov.chargeMode = p.charge_mode as ChargeMode;
    }
    if (Object.keys(ov).length) out[p.service_key] = ov;
  }
  return out;
}

/**
 * Overrides del motor de oferta para el sitio. Nunca tira (página pública):
 * cualquier falla → {} y el wizard cae al default del catálogo.
 */
export async function getOfferOverridesParaSitio(): Promise<OfferOverrides> {
  const publicados = await getPublicServicios();
  return buildOfferOverrides(publicados);
}
