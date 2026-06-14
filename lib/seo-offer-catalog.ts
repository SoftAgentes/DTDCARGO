/**
 * OfferCatalog (schema.org) — builder único del catálogo de servicios para GEO/SEO.
 *
 * Por qué existe: el AI Agent de Kommo (y Google / AI Overviews) crawlean el
 * sitio como fuente de conocimiento. Un OfferCatalog machine-readable les dice
 * qué ofrece DTD Cargo, con descripciones grounded (sin inventar). Se usa en dos
 * lugares con EL MISMO shape:
 *   · `app/layout.tsx` → `hasOfferCatalog` del #organization (nivel entidad, todo el sitio).
 *   · `app/servicios/page.tsx` → OfferCatalog standalone de la página.
 * Ambos referencian al proveedor por @id (UNA sola entidad · regla GEO SDD-0064).
 *
 * Anti-invención (SDD-0064): `isOfferable` excluye lo que NO se ofrece hoy
 * (estado "suspendido" o "proximamente"), para no anunciar servicios inexistentes.
 */
import type { ServicioDetalle } from "@/lib/servicios-detalle";

/** Subconjunto de ServicioDetalle que el catálogo necesita. */
export type OfferableServicio = Pick<
  ServicioDetalle,
  "slug" | "titulo" | "resumen" | "incluye" | "estado"
>;

export const OFFER_CATALOG_NAME = "Servicios de DTD Cargo — China a Venezuela";

const AREA_SERVED = [
  { "@type": "Country", name: "Venezuela" },
  { "@type": "Country", name: "China" },
];

/**
 * ¿El servicio se ofrece HOY? Excluye "suspendido" y "proximamente"
 * (anti-invención). `estado` undefined = "activo" por default (ver ServicioDetalle).
 */
export function isOfferable(s: Pick<ServicioDetalle, "estado">): boolean {
  return s.estado !== "suspendido" && s.estado !== "proximamente";
}

/**
 * Construye el nodo OfferCatalog (SIN "@context" — para anidarlo en un @graph o
 * envolverlo en un <script> standalone agregándole el @context aparte).
 * `provider` se aplica al catálogo Y a cada Service: pasar `{ "@id": ORG_ID }`
 * para ligar todo a la entidad única.
 */
export function buildOfferCatalog({
  servicios,
  siteUrl,
  provider,
  name = OFFER_CATALOG_NAME,
}: {
  servicios: OfferableServicio[];
  siteUrl: string;
  provider: Record<string, unknown>;
  name?: string;
}) {
  return {
    "@type": "OfferCatalog",
    name,
    provider,
    itemListElement: servicios.map((s, i) => ({
      "@type": "Offer",
      position: i + 1,
      itemOffered: {
        "@type": "Service",
        name: s.titulo,
        description: [
          s.resumen,
          s.incluye.length ? `Incluye: ${s.incluye.join("; ")}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
        serviceType: s.titulo,
        url: `${siteUrl}/servicios#${s.slug}`,
        areaServed: AREA_SERVED,
        provider,
      },
    })),
  };
}
