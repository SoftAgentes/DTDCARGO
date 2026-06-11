import type { Metadata } from "next";
import { BRAND_ASSETS } from "@/lib/design-tokens";

/**
 * Social meta (Open Graph + Twitter) reusable para páginas del sitio público.
 *
 * Por qué existe: Next REEMPLAZA (no mergea) `openGraph` y `twitter` cuando una
 * página los redefine. Las páginas que solo querían setear su `title`/`url`
 * terminaban perdiendo la `images`, el `type`/`siteName`/`locale` y el card que
 * vienen del layout → el preview en WhatsApp/redes salía sin imagen y con el
 * título genérico del home. Este helper reconstruye ambos bloques COMPLETOS a
 * partir del title/description/path de cada página, con la imagen de marca.
 *
 * Uso:
 *   export const metadata = {
 *     title: { absolute: "..." },
 *     description: "...",
 *     alternates: { canonical: "/ruta" },
 *     ...socialMeta({ title: "...", description: "...", path: "/ruta" }),
 *   };
 */
const OG_IMAGE = {
  url: BRAND_ASSETS.ogImage, // metadataBase (layout) lo vuelve absoluto
  width: 1200,
  height: 630,
  alt: "DTD Cargo — Con Confianza, de China a tu puerta",
};

export function socialMeta(opts: {
  title: string;
  description: string;
  path: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      locale: "es_VE",
      siteName: "DTD Cargo",
      title: opts.title,
      description: opts.description,
      url: opts.path,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [BRAND_ASSETS.ogImage],
    },
  };
}
