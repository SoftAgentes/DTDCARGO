import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
  // Material de marca interno + zona interna del equipo. OJO: /track/ NO se
  // bloquea acá — /track/[code] lleva meta `noindex` y bloquear el path
  // impediría que Google lo lea (las URLs quedarían indexadas "URL-only").
  // El noindex per-page es la señal correcta. Decisión 2026-07-05.
  // `/marca` SIN barra final: en robots.txt el match es por prefijo, así que
  // `/marca/` dejaba fuera la raíz `/marca` — que desde SDD-0238 es justamente la
  // página del centro de marca, la que se comparte por link.
  const disallow = ["/marca", "/interno/"];
  return {
    rules: [
      // Crawlers de IA: permitidos explícitamente (señal deliberada de opt-in).
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-SearchBot",
          "Claude-User",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
          "Google-CloudVertexBot",
          "Applebot-Extended",
          "Meta-ExternalAgent",
          "CCBot",
          "Bingbot",
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
