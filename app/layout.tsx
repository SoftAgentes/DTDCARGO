import type { Metadata } from "next";
import { Archivo, Archivo_Black, Noto_Sans_SC } from "next/font/google";
import { BRAND_ASSETS, CONTACT } from "@/lib/design-tokens";
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
    "Logística end-to-end China → Venezuela desde 2010. Carga DDP puerta a puerta, agente de compra, inspección de fábrica. Equipo propio Yiwu/Valencia.",
  applicationName: "DTD Cargo",
  authors: [{ name: "DTD Cargo" }],
  keywords: [
    "logística China Venezuela",
    "carga DDP puerta a puerta",
    "agente de compra China",
    "inspección de fábrica Yiwu",
    "Yiwu Venezuela",
    "Incoterms 2020",
    "FCL BL propio",
    "consolidación LCL China",
    "courier aéreo China",
    "import China Venezuela DDP",
  ],
  openGraph: {
    type: "website",
    locale: "es_VE",
    url: SITE_URL,
    siteName: "DTD Cargo",
    title: "DTD Cargo — Con confianza, de China a tu puerta.",
    description:
      "Logística end-to-end China → Venezuela operando desde 2010. Construyendo confianza cliente a cliente, contenedor a contenedor.",
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
      "Logística end-to-end China → Venezuela operando desde 2010. Construyendo confianza cliente a cliente, contenedor a contenedor.",
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

/**
 * Schema.org JSON-LD para SEO local (Google/Bing rich results).
 *
 * Tipo MovingCompany es el más específico de Schema.org para logística
 * door-to-door internacional. Hereda de LocalBusiness y agrega areaServed.
 */
const jsonLd = {
  "@context": "https://schema.org",
  // LocalBusiness es el tipo correcto para freight forwarding / logistics B2B.
  // MovingCompany (anterior) es específicamente para mudanzas residenciales — no nuestro caso.
  "@type": "LocalBusiness",
  name: CONTACT.legalName,
  url: SITE_URL,
  // Para Google Knowledge Panel usamos el isólogo oficial v3.0 variante primary
  // (navy + wine sobre fondo claro — el más universal).
  logo: `${SITE_URL}${BRAND_ASSETS.isologoPrimary}`,
  image: `${SITE_URL}${BRAND_ASSETS.ogImage}`,
  description:
    "Logística end-to-end China → Venezuela operando desde 2010. Con confianza, de China a tu puerta — construyendo confianza cliente a cliente, contenedor a contenedor.",
  foundingDate: "2010",
  email: CONTACT.emailGeneral,
  telephone: CONTACT.ve.phone,
  sameAs: [CONTACT.instagram.url],
  address: [
    {
      "@type": "PostalAddress",
      streetAddress: CONTACT.ve.address,
      addressLocality: "Valencia",
      addressRegion: "Carabobo",
      addressCountry: "VE",
    },
    {
      "@type": "PostalAddress",
      streetAddress: CONTACT.cn.address,
      addressLocality: "Yiwu",
      addressRegion: "Zhejiang",
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
      availableLanguage: ["es"],
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
      opens: "08:00",
      closes: "17:00",
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
      <body>{children}</body>
    </html>
  );
}
