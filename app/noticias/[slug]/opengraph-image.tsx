/**
 * OG image dinámica por artículo · /noticias/[slug]/opengraph-image
 *
 * Remate SEO 2026-07-05: antes cada post compartía el og-image genérico del
 * sitio (BRAND_ASSETS.ogImage) → previews idénticas en WhatsApp/X/LinkedIn
 * para todo el blog. Esta file convention de Next genera una card 1200×630
 * con el título real del post + categoría + marca, y (por prioridad de
 * file-based metadata) manda sobre cualquier `openGraph.images` de config.
 *
 * Colores: next/og (Satori) NO lee CSS vars, así que los tokens de marca van
 * como literales COPIADOS de `app/globals.css` (tema claro) — única excepción
 * autorizada a la regla "solo var(--*)", documentada aquí:
 *   #0f1e3d = --color-ink (navy)   · #7f0f1a = --color-wine
 *   #fbfaf7 = --color-paper        · #c2747f = --color-wine-soft
 *
 * Tipografía: next/og no integra next/font y no hay TTF/OTF de Archivo
 * accesible localmente (no usamos @fontsource; next/font/google solo deja
 * woff2 en el output del build, que Satori no acepta). Prohibido fetch a
 * Google Fonts en runtime → usamos la fuente default embebida de ImageResponse
 * (sans-serif neutral). Si algún día se versiona un Archivo-*.ttf en el repo,
 * cargarlo aquí con fs.readFile + option `fonts`.
 *
 * Datos: getPostBySlug usa createClient() → cookies() de next/headers. Esta
 * file convention compila a un route handler request-scoped, donde cookies()
 * es válido (igual que en page.tsx, que no pre-genera params). Igual va en
 * try/catch: si la query falla o el post no existe → card genérica de marca.
 */

import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/news/queries";
import { getCategoryInfo } from "@/lib/news/categories";

export const alt = "DTD Cargo · Noticias";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Tokens de marca (ver nota de cabecera — copiados de app/globals.css).
const INK = "#0f1e3d";
const WINE = "#7f0f1a";
const PAPER = "#fbfaf7";
const WINE_SOFT = "#c2747f";

type Props = { params: Promise<{ slug: string }> };

export default async function Image({ params }: Props) {
  const { slug } = await params;

  let title = "Noticias de comercio China → Venezuela";
  let category = "Noticias";
  try {
    const post = await getPostBySlug(slug);
    if (post) {
      title = post.title;
      category = getCategoryInfo(post.categoria).label;
    }
  } catch {
    // Fallback genérico de marca: nunca romper la preview por un error de DB.
  }

  // Títulos largos: achicar tipografía para que no desborde la card.
  const titleSize = title.length > 90 ? 44 : title.length > 55 ? 52 : 62;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: INK,
          padding: "64px 72px",
        }}
      >
        {/* Categoría del post (eyebrow) */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: WINE_SOFT,
          }}
        >
          {category}
        </div>

        {/* Título del artículo */}
        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.12,
            color: PAPER,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        {/* Pie de marca: barra wine + wordmark + dominio */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            borderTop: `6px solid ${WINE}`,
            paddingTop: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 800,
              color: PAPER,
            }}
          >
            DTD Cargo
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: WINE_SOFT,
            }}
          >
            dtdcargo.com · China → Venezuela
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
