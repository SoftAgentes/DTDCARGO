import { serializeJsonLd } from "@/lib/public/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/**
 * WebPage (schema.org) JSON-LD con `speakable` — SDD-0064 GEO.
 *
 * Liga una página a la entidad (`#organization`) y al sitio (`#website`) por
 * `@id` (UNA sola entidad · regla GEO) y, opcionalmente, marca el bloque
 * "citable" con `speakable` para que asistentes de voz y motores de IA sepan qué
 * fragmento leer en voz alta como respuesta. Server component (HTML `<script>`,
 * sin estado) — patrón gemelo de `BreadcrumbJsonLd`.
 *
 * `name` (y `description` si la página la tiene) salen de los metadatos que la
 * página ya declara: el nodo `WebPage` sin nombre no le dice a un motor qué es
 * la página (auditoría SEO 2026-11-07: faltaba en las 5 páginas que lo usan).
 *
 * Uso:
 *   <WebPageJsonLd path="/" name={TITLE} description={DESC} speakableSelectors={["#respuesta-rapida"]} />
 */
export function WebPageJsonLd({
  path,
  name,
  description,
  speakableSelectors,
}: {
  /** Ruta relativa al dominio (ej. "/"). */
  path: string;
  /** El mismo título que la página declara en `metadata.title`. */
  name: string;
  /** La misma descripción que la página declara en `metadata.description`. */
  description?: string;
  /** Selectores CSS del/los bloque(s) citables (ej. ["#respuesta-rapida"]). */
  speakableSelectors?: string[];
}) {
  const url = `${SITE_URL}${path}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    ...(description ? { description } : {}),
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "es-VE",
    ...(speakableSelectors?.length
      ? {
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: speakableSelectors,
          },
        }
      : {}),
  };
  return (
    <script
      type="application/ld+json"
      // El escape de `<` vive en `serializeJsonLd` (SDD-0303).
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(jsonLd),
      }}
    />
  );
}
