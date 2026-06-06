const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

type Crumb = { name: string; path: string };

/**
 * BreadcrumbList (schema.org) JSON-LD — rich results de Google (la ruta de migas
 * bajo el título en los resultados) + contexto de jerarquía para motores
 * generativos. `items` van en orden de raíz → página actual; `path` es relativo
 * al dominio (ej. "/servicios"). Server component (HTML <script>, sin estado).
 *
 * Uso:
 *   <BreadcrumbJsonLd items={[{ name: "Inicio", path: "/" }, { name: "Servicios", path: "/servicios" }]} />
 */
export function BreadcrumbJsonLd({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
