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
 * Uso:
 *   <WebPageJsonLd path="/" speakableSelectors={["#respuesta-rapida"]} />
 */
export function WebPageJsonLd({
  path,
  speakableSelectors,
}: {
  /** Ruta relativa al dominio (ej. "/"). */
  path: string;
  /** Selectores CSS del/los bloque(s) citables (ej. ["#respuesta-rapida"]). */
  speakableSelectors?: string[];
}) {
  const url = `${SITE_URL}${path}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
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
      // Escapar `<` evita que un valor con `</script>` rompa el tag (igual que layout.tsx).
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
