import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
  // Material de marca interno + zona interna del equipo. OJO: /track/ NO se
  // bloquea acá — /track/[code] lleva meta `noindex` y bloquear el path
  // impediría que Google lo lea (las URLs quedarían indexadas "URL-only").
  // El noindex per-page es la señal correcta. Decisión 2026-07-05.
  const disallow = ["/marca/", "/interno/"];
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
