import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
  const disallow = ["/track/", "/marca/"]; // tracking individual + material de marca interno
  return {
    rules: [
      // Crawlers de IA: permitidos explícitamente (señal deliberada de opt-in).
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "PerplexityBot",
          "Google-Extended",
        ],
        allow: "/",
        disallow,
      },
      // Resto de crawlers (buscadores, etc.).
      { userAgent: "*", allow: "/", disallow },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
