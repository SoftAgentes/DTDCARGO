import type { MetadataRoute } from "next";
import { listPublishedPosts } from "@/lib/public/news-queries";
import { GEO_ZONAS } from "@/lib/geo-zonas";

// ISR: lee news_posts con listPublishedPosts(); sin esto Next lo genera en el build y una
// lectura fallida deja el sitemap sin /noticias/<slug>. Ver app/noticias/page.tsx.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
  // lastModified honesto (remate SEO 2026-07-05): las rutas estáticas y las
  // geo-páginas lo OMITEN — antes llevaban `new Date()` en cada request/build,
  // o sea siempre "hoy" = señal muerta que Google aprende a ignorar. Omitirlo
  // es válido en MetadataRoute.Sitemap. Solo los posts llevan fecha (la real).
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`,          priority: 1.0, changeFrequency: "weekly" },
    { url: `${base}/puerta-a-puerta`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/shipping-mark`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/pre-alertas`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/servicios`,   priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/servicios/inspeccion`, priority: 0.7, changeFrequency: "monthly" },
    // Las tres hermanas de /servicios/inspeccion quedaron fuera del sitemap sin
    // que nadie lo decidiera. Van a 0.7 como ella: por debajo de la landing
    // /puerta-a-puerta (0.9) para que la jerarquía quede clara y la página de
    // detalle no le compita a la principal por la misma búsqueda.
    { url: `${base}/servicios/puerta-a-puerta`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${base}/servicios/fcl`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${base}/servicios/lcl`, priority: 0.7, changeFrequency: "monthly" },
    // Herramienta pública, misma familia que /calculadora-terrestre.
    { url: `${base}/llenado`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/academia`,    priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/nosotros`,    priority: 0.7, changeFrequency: "monthly" },
    { url: `${base}/brochure`,    priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/tarifas`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/fcl`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/calculadora-terrestre`, priority: 0.8, changeFrequency: "monthly" },
    // SDD-0473 · Misma familia de herramientas, pero detrás de una bandera: con
    // `DOCUMENT_IMPORT_ENABLED` apagada la ruta es 404, y un sitemap que la
    // lista le pide a Google rastrear una página que no existe.
    ...(process.env.DOCUMENT_IMPORT_ENABLED === "true"
      ? [{ url: `${base}/cotizador`, priority: 0.8, changeFrequency: "monthly" as const }]
      : []),
    { url: `${base}/enlaces`,     priority: 0.5, changeFrequency: "monthly" },
    { url: `${base}/glosario`,    priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/faq`,         priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/importar-de-china`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/noticias`,  priority: 0.8, changeFrequency: "weekly" },
    { url: `${base}/contacto`,  priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/registro`,  priority: 0.7, changeFrequency: "monthly" },
    // SDD-0604 · Indexables a propósito (ver el comentario de /privacidad). El
    // contrato de cobertura no las veía porque esa palabra aparecía en comentarios.
    { url: `${base}/privacidad`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${base}/cookies`,    priority: 0.3, changeFrequency: "yearly" },
  ];

  // Páginas geo-locales "Importar de China a {zona}" (fuente: lib/geo-zonas)
  for (const z of GEO_ZONAS) {
    routes.push({
      url: `${base}/importar-de-china/${z.slug}`,
      priority: 0.7,
      changeFrequency: "monthly",
    });
  }

  // Posts individuales · ahora DB-backed (Plan v4 Phase F)
  const posts = await listPublishedPosts();
  for (const post of posts) {
    routes.push({
      url: `${base}/noticias/${post.slug}`,
      // SDD-0604 · La última edición real; `date` es la fecha de publicación.
      lastModified: new Date(post.updated_at ?? post.date),
      priority: 0.6,
      changeFrequency: "monthly",
    });
  }

  return routes;
}
