import type { MetadataRoute } from "next";
import { listPublishedPosts } from "@/lib/news/queries";
import { GEO_ZONAS } from "@/lib/geo-zonas";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`,          lastModified: now, priority: 1.0, changeFrequency: "weekly" },
    { url: `${base}/servicios`,   lastModified: now, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/brochure`,    lastModified: now, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/calculadora`, lastModified: now, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/glosario`,    lastModified: now, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/faq`,         lastModified: now, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/noticias`,  lastModified: now, priority: 0.8, changeFrequency: "weekly" },
    { url: `${base}/cotizar`,   lastModified: now, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/contacto`,  lastModified: now, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/track`,     lastModified: now, priority: 0.7, changeFrequency: "monthly" },
  ];

  // Páginas geo-locales "Importar de China a {zona}" (fuente: lib/geo-zonas)
  for (const z of GEO_ZONAS) {
    routes.push({
      url: `${base}/importar-de-china/${z.slug}`,
      lastModified: now,
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
