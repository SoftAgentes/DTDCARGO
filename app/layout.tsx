import type { Metadata } from "next";
// Fuentes desde el repositorio (tipografía SDD-0505, 2026-10-13): solo Archivo + Archivo Black
// aquí; JetBrains Mono la montan las superficies que la usan. El chino usa la
// fuente del sistema (`html.dtd-cjk-sistema` en globals.css).
import { archivo, archivoBlack } from "@/lib/fonts";
import { BRAND_ASSETS, CONTACT } from "@/lib/design-tokens";
import { SERVICIOS_DETALLE } from "@/lib/servicios-detalle";
import { buildOfferCatalog, isOfferable } from "@/lib/seo-offer-catalog";
import { Analytics } from "@/components/Analytics";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { Agentation } from "agentation";
import "./globals.css";
// Superficie "recursos" (`.rp-surface`) de la web pública — glosario, FAQ,
// noticias, academia, nosotros, puerta a puerta, landings SEO y legales.
// Va en archivo aparte porque globals.css ya supera las 4.300 líneas.
import "./recursos.css";
import "./noticias/noticias.css";
// Superficie de `/pre-alertas` (`.pa-surface`) — mismo criterio que recursos.css.
import "./prealertas.css";
import { serializeJsonLd } from "@/lib/public/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DTD Cargo — Con Confianza, de China a tu puerta.",
    template: "%s · DTD Cargo",
  },
  description:
    "Logística de punta a punta China → Venezuela desde 2015. Carga puerta a puerta todo incluido (DDP), agente de compra, inspección de fábrica. Equipo propio Yiwu/Valencia.",
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
    title: "DTD Cargo — Con Confianza, de China a tu puerta.",
    description:
      "Logística de punta a punta China → Venezuela operando desde 2015. Construyendo confianza cliente a cliente, contenedor a contenedor.",
    images: [
      {
        url: BRAND_ASSETS.ogImage,
        width: 1200,
        height: 630,
        alt: "DTD Cargo — Con Confianza, de China a tu puerta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DTD Cargo — Con Confianza, de China a tu puerta.",
    description:
      "Logística de punta a punta China → Venezuela operando desde 2015. Construyendo confianza cliente a cliente, contenedor a contenedor.",
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
      // Identidad legal real — solo en el schema, nunca en texto visible.
      legalName: CONTACT.legalEntity.legalName,
      taxID: CONTACT.legalEntity.taxID,
      founder: { "@type": "Person", name: CONTACT.legalEntity.founder },
      url: SITE_URL,
      // Para Google Knowledge Panel usamos el isólogo oficial (brand book) variante primary
      // (navy + wine sobre fondo claro — el más universal).
      // logo como ImageObject (con dimensiones) en vez de string → señal más
      // fuerte para el Google Knowledge Panel. El isólogo primary es 741×764.
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}${BRAND_ASSETS.isologoPrimary}`,
        width: 741,
        height: 764,
      },
      image: `${SITE_URL}${BRAND_ASSETS.ogImage}`,
      slogan: "Con Confianza, de China a tu puerta.",
      description:
        "Operación logística integral China–Venezuela desde 2015: carga consolidada puerta a puerta, agente de compra e inspección de fábrica en origen. Equipo propio en Yiwu y Valencia. Con Confianza, de China a tu puerta.",
      // priceRange es opcional; en freight no hay tier fijo → texto honesto (no "$$").
      priceRange: "Cotización a medida según volumen y ruta",
      // 2015 = fundación e inauguración en Venezuela = año de fundación (founder
      // 2026-07-20). 2008 = inicio del comercio con China y sustenta experiencia;
      // 2010 = primera oficina propia en China. Ninguno de esos hitos es fundación.
      foundingDate: "2015",
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
      geo: {
        "@type": "GeoCoordinates",
        latitude: CONTACT.ve.geo.lat,
        longitude: CONTACT.ve.geo.lng,
      },
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
      // knowsAbout — temas de expertise de la empresa (señal de autoridad para
      // GEO/IA). `sameAs` a artículos de Wikipedia (verificados, sin 404) para
      // desambiguar los términos estándar; los propios de DTD / sin artículo
      // limpio van como DefinedTerm sin sameAs. SDD-0064 (profundización GEO).
      knowsAbout: [
        {
          "@type": "Thing",
          name: "Logística internacional China–Venezuela",
          sameAs: "https://en.wikipedia.org/wiki/Logistics",
        },
        {
          "@type": "Thing",
          name: "Comercio entre China y Venezuela",
          sameAs:
            "https://en.wikipedia.org/wiki/China%E2%80%93Venezuela_relations",
        },
        {
          "@type": "Thing",
          name: "Transporte marítimo de carga en contenedor (FCL y LCL)",
          sameAs: "https://en.wikipedia.org/wiki/Containerization",
        },
        {
          "@type": "Thing",
          name: "Incoterms 2020",
          sameAs: "https://en.wikipedia.org/wiki/Incoterms",
        },
        {
          "@type": "Thing",
          name: "Agente de carga internacional (freight forwarding)",
          sameAs: "https://en.wikipedia.org/wiki/Freight_forwarder",
        },
        {
          "@type": "Thing",
          name: "Desaduanaje y trámites de aduana",
          sameAs: "https://en.wikipedia.org/wiki/Customs",
        },
        {
          "@type": "Thing",
          name: "Compra asistida y sourcing en China",
          sameAs: "https://en.wikipedia.org/wiki/Procurement",
        },
        {
          "@type": "Thing",
          name: "Inspección y control de calidad en fábrica",
          sameAs: "https://en.wikipedia.org/wiki/Quality_control",
        },
        {
          "@type": "Thing",
          name: "Yiwu, Zhejiang (mercado mayorista de China)",
          sameAs: "https://en.wikipedia.org/wiki/Yiwu",
        },
        {
          "@type": "DefinedTerm",
          // El nombre del servicio es "Puerta a puerta"; DDP queda como
          // aclaración del Incoterm, que es lo que la regla de marca permite.
          name: "Servicio puerta a puerta (DDP · Delivered Duty Paid)",
        },
        { "@type": "DefinedTerm", name: "Consolidación de carga (grupaje LCL)" },
        {
          "@type": "DefinedTerm",
          name: "Shipping Mark — marca de envío (唛头)",
        },
      ],
      // hasOfferCatalog — qué ofrece la empresa, machine-readable, ligado a la
      // entidad por @id. Fuente = SERVICIOS_DETALLE filtrado por isOfferable
      // (excluye suspendido/proximamente → anti-invención). Mismo builder que
      // /servicios (lib/seo-offer-catalog) → un solo catálogo coherente.
      hasOfferCatalog: buildOfferCatalog({
        servicios: SERVICIOS_DETALLE.filter(isOfferable),
        siteUrl: SITE_URL,
        provider: { "@id": ORG_ID },
      }),
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
      className={`${archivo.variable} ${archivoBlack.variable} dtd-cjk-sistema`}
      // Token de marca INMUNE: captura la familia real de Archivo Black (next/font)
      // como literal, sin pasar por --font-archivo-black. Así el wordmark del logo
      // sigue en Archivo Black en TODA la app (capa branding ≠ capa sistema · regla
      // del Norte), aunque una superficie redefina sus tokens de título.
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
            __html: serializeJsonLd(jsonLd),
          }}
        />
      </head>
      <body>
        {children}
        <Analytics />
        <CookieConsentBanner />
        {process.env.NODE_ENV === "development" &&
          process.env.E2E_ENVIRONMENT_KIND !== "ephemeral" && <Agentation />}
      </body>
    </html>
  );
}
