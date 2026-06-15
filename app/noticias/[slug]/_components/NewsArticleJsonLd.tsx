/**
 * NewsArticleJsonLd · schema.org NewsArticle JSON-LD para SEO.
 *
 * Fase D del rediseño noticias-web (Plan v5). Mejora rich snippets en
 * SERP + elegibilidad para AI Overviews + integración con Google News.
 *
 * Server component que emite un <script type="application/ld+json"> con
 * el shape canonical de schema.org/NewsArticle. Se monta en
 * /noticias/[slug]/page.tsx después del header.
 *
 * Validar con: https://search.google.com/test/rich-results
 *
 * NO trae fallbacks de hex/string — todos los valores vienen del post o
 * de env vars públicas del sitio.
 */

import type { NewsPostRow } from "@/lib/news/queries";
import { getCategoryInfo } from "@/lib/news/categories";

interface Props {
  post: NewsPostRow;
}

/**
 * Cuenta palabras del body (strip básico de markdown). Same heurística
 * que lib/news/score.ts pero standalone para no introducir dependencia
 * cliente-server.
 */
function wordCountOf(markdown: string): number {
  const stripped = markdown
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_`[\]()>]/g, "")
    .replace(/\[VERIFICAR:?[^\]]*\]/gi, "")
    .trim();
  return stripped.split(/\s+/).filter(Boolean).length;
}

export function NewsArticleJsonLd({ post }: Props) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://dtdcargo.com";
  const url = `${siteUrl}/noticias/${post.slug}`;
  const logoUrl = `${siteUrl}/brand/dtdcargo-isologo-primary.png`;
  const ogImageUrl = `${siteUrl}/brand/dtdcargo-isologo-primary.png`;

  const cat = getCategoryInfo(post.categoria);
  const articleSection = cat.label;

  const description = post.meta_description || post.excerpt;
  const wordCount = wordCountOf(post.body_markdown);

  // Author shape · si hay role (escritor invitado), incluimos jobTitle.
  // Si author_name = "DTD Cargo" usamos Organization en vez de Person
  // para reflejar que es contenido institucional.
  const author =
    post.author_name === "DTD Cargo"
      ? {
          "@type": "Organization" as const,
          name: "DTD Cargo",
          url: siteUrl,
        }
      : {
          "@type": "Person" as const,
          name: post.author_name,
          ...(post.author_role ? { jobTitle: post.author_role } : {}),
        };

  // Keywords como string CSV (formato canónico schema.org)
  const keywordsArr = [
    ...(post.focus_keyword ? [post.focus_keyword] : []),
    ...post.secondary_keywords,
  ];

  const data = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    headline: post.title,
    description,
    image: [ogImageUrl],
    datePublished: post.date,
    dateModified: post.date,
    author: [author],
    publisher: {
      "@type": "Organization",
      // @id → consolida con el nodo #organization del root layout (una sola entidad).
      "@id": `${siteUrl}/#organization`,
      name: "DTD Cargo",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: logoUrl,
        width: 512,
        height: 512,
      },
    },
    articleSection,
    ...(keywordsArr.length > 0 ? { keywords: keywordsArr.join(", ") } : {}),
    wordCount,
    inLanguage: "es",
    ...(post.author_role ? { creditText: post.author_role } : {}),
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
