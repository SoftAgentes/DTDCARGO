import type { MetadataRoute } from "next";
import { listPublishedPosts } from "@/lib/news/queries";
import { GEO_ZONAS } from "@/lib/geo-zonas";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
  // lastModified honesto (remate SEO 2026-07-05): las rutas estáticas y las
  // geo-páginas lo OMITEN — antes llevaban `new Date()` en cada request/build,
  // o sea siempre "hoy" = señal muerta que Google aprende a ignorar. Omitirlo
  // es válido en MetadataRoute.Sitemap. Solo los posts llevan fecha (la real).
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`,          priority: 1.0, changeFrequency: "weekly" },
    { url: `${base}/puerta-a-puerta`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/markbox`,     priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/servicios`,   priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/servicios/inspeccion`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${base}/academia`,    priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/nosotros`,    priority: 0.7, changeFrequency: "monthly" },
    { url: `${base}/brochure`,    priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/fcl`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/calculadora-terrestre`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/enlaces`,     priority: 0.5, changeFrequency: "monthly" },
    { url: `${base}/glosario`,    priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/faq`,         priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/importar-de-china`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/noticias`,  priority: 0.8, changeFrequency: "weekly" },
    { url: `${base}/contacto`,  priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/registro`,  priority: 0.7, changeFrequency: "monthly" },
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
      lastModified: new Date(post.date),
      priority: 0.6,
      changeFrequency: "monthly",
    });
  }

  return routes;
}
