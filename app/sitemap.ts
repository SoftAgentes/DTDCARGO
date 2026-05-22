import type { MetadataRoute } from "next";
import { NEWS_POSTS } from "@/lib/design-tokens";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`,          lastModified: now, priority: 1.0, changeFrequency: "weekly" },
    { url: `${base}/servicios`, lastModified: now, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/glosario`,  lastModified: now, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/noticias`,  lastModified: now, priority: 0.8, changeFrequency: "weekly" },
    { url: `${base}/cotizar`,   lastModified: now, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/contacto`,  lastModified: now, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/track`,     lastModified: now, priority: 0.7, changeFrequency: "monthly" },
  ];

  // Posts individuales — pre-generados estáticamente, indexables
  for (const post of NEWS_POSTS) {
    routes.push({
      url: `${base}/noticias/${post.slug}`,
      lastModified: new Date(post.date),
      priority: 0.6,
      changeFrequency: "monthly",
    });
  }

  return routes;
}
