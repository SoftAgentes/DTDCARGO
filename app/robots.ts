import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/track/"], // resultados de tracking individuales no se indexan
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
