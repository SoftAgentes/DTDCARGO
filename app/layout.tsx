import type { Metadata } from "next";
import { Archivo, Archivo_Black, Noto_Sans_SC } from "next/font/google";
import { BRAND_ASSETS, CONTACT } from "@/lib/design-tokens";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400", // Archivo Black solo trae el peso 400 (que renderiza como 900 visual)
  variable: "--font-archivo-black",
  display: "swap",
});

const notoSansSc = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sc",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DTD Cargo — Con confianza, de China a tu puerta.",
    template: "%s · DTD Cargo",
  },
  description:
    "Logística end-to-end China → Venezuela desde 2008. Carga puerta a puerta todo incluido (DDP), agente de compra, inspección de fábrica. Equipo propio Yiwu/Valencia.",
  applicationName: "DTD Cargo",
  authors: [{ name: "DTD Cargo" }],
  keywords: [
    "logística China Venezuela",
    "carga DDP puerta a puerta",
    "agente de compra China",
    "inspección de fábrica Yiwu",
    "Yiwu Venezuela",
    "Incoterms 2020",
    "FCL contenedor completo",
    "consolidación LCL China",
    "import China Venezuela DDP",
  ],
  openGraph: {
    type: "website",
    locale: "es_VE",
    url: SITE_URL,
    siteName: "DTD Cargo",
    title: "DTD Cargo — Con confianza, de China a tu puerta.",
    description:
      "Logística end-to-end China → Venezuela operando desde 2008. Construyendo confianza cliente a cliente, contenedor a contenedor.",
    images: [
      {
        url: BRAND_ASSETS.ogImage,
        width: 1200,
        height: 630,
        alt: "DTD Cargo — Con confianza, de China a tu puerta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DTD Cargo — Con confianza, de China a tu puerta.",
    description:
      "Logística end-to-end China → Venezuela operando desde 2008. Construyendo confianza cliente a cliente, contenedor a contenedor.",
    images: [BRAND_ASSETS.ogImage],
  },
  icons: {
    // Multi-size PNG primero, .ico al final como legacy fallback.
    // Modern browsers eligen el PNG del tamaño que mejor matchea su tab bar.
    icon: [
      { url: BRAND_ASSETS.favicon32, sizes: "32x32", type: "image/png" },
      { url: BRAND_ASSETS.favicon16, sizes: "16x16", type: "image/png" },
      { url: BRAND_ASSETS.favicon, sizes: "any" }, // .ico legacy
    ],
    apple: BRAND_ASSETS.appleIcon,
  },
  robots: {
    index: true,
    follow: true,
  },
};

// @id estable de la entidad EMPRESA. Los publishers de VideoObject (WorkBand)
// y NewsArticle lo referencian para que Google/IA lean UNA sola entidad
// consolidada (no varias "DTD Cargo" sueltas).
const ORG_ID = `${SITE_URL}/#organization`;

/**
 * Schema.org JSON-LD — grafo de entidad para SEO + GEO (Google / motores de IA).
 *
 * Dos nodos enlazados por @id:
 *  · #organization (LocalBusiness, subtipo de Organization): la EMPRESA. Aporta
 *    identidad de empresa + señales locales (dirección, horarios, mapa). La
 *    identidad legal (legalName/taxID/founder) vive SOLO acá, no en texto visible.
 *  · #website (WebSite): el SITIO, con publisher → #organization.
 *
 * Sin SearchAction: el sitio no tiene buscador (añadirlo sería inválido).
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      // LocalBusiness es el tipo correcto para freight forwarding / logistics B2B
      // (subtipo de Organization → vale como identidad de empresa para el knowledge graph).
      "@type": "LocalBusiness",
      "@id": ORG_ID,
      name: CONTACT.brandName,
      alternateName: ["DoorTuDoor", "Doortudoor Services"],
      // Identidad legal real — solo en el schema, nunca en texto visible.
      legalName: CONTACT.legalEntity.legalName,
      taxID: CONTACT.legalEntity.taxID,
      founder: { "@type": "Person", name: CONTACT.legalEntity.founder },
      url: SITE_URL,
      // Para Google Knowledge Panel usamos el isólogo oficial v3.0 variante primary
      // (navy + wine sobre fondo claro — el más universal).
      logo: `${SITE_URL}${BRAND_ASSETS.isologoPrimary}`,
      image: `${SITE_URL}${BRAND_ASSETS.ogImage}`,
      slogan: "Con confianza, de China a tu puerta.",
      description:
        "Operación logística integral China–Venezuela desde 2008: carga consolidada puerta a puerta DDP, agente de compra e inspección de fábrica en origen. Equipo propio en Yiwu y Valencia. Con confianza, de China a tu puerta.",
      // priceRange es opcional; en freight no hay tier fijo → texto honesto (no "$$").
      priceRange: "Cotización a medida según volumen y ruta",
      // 2008 = inicios comerciales en China (año de fundación canónico, FAQ §14 +
      // decisión founder 2026-06-08). Hitos posteriores: 2010 empresa de carga
      // formalizada · 2015 expansión a Venezuela (DTD Services LCL).
      foundingDate: "2008",
      email: CONTACT.emailGeneral,
      telephone: CONTACT.ve.phone,
      sameAs: [CONTACT.instagram.url, CONTACT.youtube.url, CONTACT.tiktok.url],
      address: [
        {
          "@type": "PostalAddress",
          streetAddress: CONTACT.ve.address,
          addressLocality: "Valencia",
          addressRegion: "Carabobo",
          postalCode: CONTACT.ve.postalCode,
          addressCountry: "VE",
        },
        {
          "@type": "PostalAddress",
          streetAddress: CONTACT.cn.address,
          addressLocality: "Yiwu",
          addressRegion: "Zhejiang",
          postalCode: CONTACT.cn.postalCode,
          addressCountry: "CN",
        },
      ],
      hasMap: CONTACT.ve.mapsUrl,
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer service",
          telephone: CONTACT.ve.phone,
          email: CONTACT.ve.email,
          areaServed: "VE",
          availableLanguage: ["es", "en"],
        },
        {
          "@type": "ContactPoint",
          contactType: "warehouse",
          telephone: CONTACT.cn.phone,
          email: CONTACT.cn.email,
          areaServed: "CN",
          availableLanguage: ["zh"],
        },
      ],
      areaServed: [
        { "@type": "Country", name: "Venezuela" },
        { "@type": "Country", name: "China" },
      ],
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          opens: "09:00",
          closes: "17:00",
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: CONTACT.brandName,
      inLanguage: "es-VE",
      publisher: { "@id": ORG_ID },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${archivo.variable} ${archivoBlack.variable} ${notoSansSc.variable}`}
      // Token de marca INMUNE: captura la familia real de Archivo Black (next/font)
      // como literal, sin pasar por --font-archivo-black (que el portal redefine a
      // Sora). Así el wordmark del logo sigue en Archivo Black en TODA la app,
      // incluido /portal (capa branding ≠ capa sistema · regla del Norte).
      style={
        {
          "--font-brand-display": `${archivoBlack.style.fontFamily}, "Archivo Black", sans-serif`,
        } as React.CSSProperties
      }
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          // Escapar `<` previene que un valor con `</script>` rompa el tag.
          // JSON.stringify por default no lo hace. Defense-in-depth gratis.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
