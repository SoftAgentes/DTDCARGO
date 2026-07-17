import type { Metadata, Viewport } from "next";
import Image from "next/image";
import {
  BRAND_ASSETS,
  CONTACT,
  buildWhatsAppLink,
} from "@/lib/design-tokens";
import { jetbrainsMono } from "@/lib/fonts";
import { MapsRow } from "./MapsRow";

/**
 * /enlaces — Hub de Enlaces (link-in-bio de Instagram) de DTD Cargo.
 *
 * Página navy inmersiva, mobile-first, standalone (sin nav/footer del sitio):
 * agrupa todos los enlaces de DTD bajo UNA sola URL, para pegar en la bio de
 * Instagram (que solo permite un link). Handoff Norte:
 * docs/design/studio/_norte/handoff-enlaces/. Estilos: .enlaces-* en globals.css.
 *
 * Atribución de origen (para que el CRM/analítica sepan de qué botón vino):
 *  · WhatsApp → el mensaje pre-cargado termina con "(Vía: …/enlaces · <origen>)".
 *  · Web → parámetros UTM (utm_source=instagram&utm_medium=bio…) en la URL.
 *
 * Frontera pública: NO importa @/lib/studio ni Supabase — solo tokens de marca.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export const metadata: Metadata = {
  title: "Enlaces",
  description:
    "Todos los enlaces de DTD Cargo en un solo lugar: cotiza puerta a puerta por WhatsApp, calcula tu envío, rastrea tu carga y entra a tu portal. China → Venezuela, con Confianza.",
  alternates: { canonical: "/enlaces" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/enlaces`,
    siteName: "DTD Cargo",
    title: "DTD Cargo · Con Confianza, de China a tu puerta",
    description:
      "Cotiza puerta a puerta por WhatsApp, calcula tu envío, rastrea tu carga y entra a tu portal.",
    images: [
      {
        url: "/brand/og-enlaces.png",
        width: 1200,
        height: 630,
        alt: "DTD Cargo — Con Confianza, de China a tu puerta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DTD Cargo · Con Confianza, de China a tu puerta",
    description:
      "Cotiza puerta a puerta por WhatsApp, calcula tu envío, rastrea tu carga y entra a tu portal.",
    images: ["/brand/og-enlaces.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1E3D", // navy de marca
};

/**
 * Link de WhatsApp con mensaje pre-cargado + etiqueta de origen para el CRM.
 * Un solo número público (CONTACT.ve.whatsappRaw); el origen distingue el botón.
 */
function waLink(origen: string, mensaje: string): string {
  return buildWhatsAppLink(
    `${mensaje}\n\n(Vía: dtdcargo.com/enlaces · ${origen})`,
  );
}

/** Link web interno con UTM para la analítica del link-in-bio (GA4). */
function webLink(path: string, origen: string): string {
  const u = new URL(path, SITE_URL);
  u.searchParams.set("utm_source", "instagram");
  u.searchParams.set("utm_medium", "bio");
  u.searchParams.set("utm_campaign", "enlaces");
  u.searchParams.set("origen", origen);
  return u.toString();
}

// ── Iconografía (portada del handoff; trazo 1.6, viewBox 24) ──
type IconName =
  | "calc"
  | "box"
  | "radar"
  | "chat"
  | "truck"
  | "wa"
  | "chev"
  | "instagram"
  | "tiktok"
  | "youtube";

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  calc: (
    <>
      <path d="M5 3h14v18H5z" />
      <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
    </>
  ),
  box: (
    <>
      <path d="M3 8 12 3l9 5v8l-9 5-9-5V8z" />
      <path d="M3 8l9 5 9-5M12 13v10" />
    </>
  ),
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9l-4 4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
  truck: (
    <>
      <rect x="1" y="7" width="12" height="9" rx="1.4" />
      <path d="M13 10h5l3 4v2h-8z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  wa: (
    <>
      <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3z" />
      <path d="M8.5 8.6c-.2 0-.5.1-.7.4-.2.3-.8.8-.8 1.9s.8 2.2 1 2.4c.1.2 1.6 2.5 4 3.4 2 .8 2.4.6 2.8.6.4 0 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1l-.6-.3c-.3-.2-.9-.4-1-.5-.2-.1-.3-.1-.5.1l-.6.8c-.1.1-.3.2-.5.1-.3-.1-1.1-.4-2-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.3.1-.5l.4-.4c.1-.2.2-.3.2-.5l.1-.4c0-.2 0-.3-.1-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4z" />
    </>
  ),
  chev: <path d="M9 6l6 6-6 6" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  tiktok: (
    <path d="M14 4c.4 2.4 1.9 3.9 4.2 4.1v3c-1.5 0-2.9-.4-4.2-1.2v5.4a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v3.1a2.4 2.4 0 1 0 1.7 2.3V4z" />
  ),
  youtube: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="3.5" />
      <path d="M10.2 9.3l4.6 2.7-4.6 2.7z" fill="currentColor" stroke="none" />
    </>
  ),
};

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// ── CONFIG · datos reales DTD Cargo (editar acá cambia el render) ──
const PRIMARY = {
  label: "Cotizar puerta a puerta por WhatsApp",
  sub: "Te respondemos al toque · China → Venezuela",
  href: waLink(
    "cotizar-ddp",
    "Hola DTD Cargo, quiero cotizar un envío desde China (puerta a puerta).",
  ),
};

type LinkRow = {
  icon: IconName;
  wine?: boolean;
  label: string;
  sub: string;
  href: string;
  external?: boolean;
};

const LINKS: LinkRow[] = [
  {
    icon: "calc",
    wine: true,
    label: "Calcular tu envío (CBM)",
    sub: "Estima el costo en segundos",
    href: webLink("/calculadora", "calcular-cbm"),
  },
  {
    icon: "box",
    label: "Portal del Cliente",
    sub: "Tus compras, facturas y embarques",
    href: webLink("/portal", "portal"),
  },
  {
    icon: "radar",
    label: "Rastrear mi embarque",
    sub: "Sigue tu carga en tiempo real",
    href: webLink("/track", "rastreo"),
  },
  {
    icon: "chat",
    label: "Atención por WhatsApp",
    sub: "Dudas, soporte y postventa",
    href: waLink(
      "atencion",
      "Hola DTD Cargo, necesito ayuda con una consulta.",
    ),
    external: true,
  },
  {
    icon: "truck",
    label: "Servicios de importación",
    sub: "Puerta a puerta, consolidación, inspección",
    href: webLink("/servicios", "servicios"),
  },
];

// Ubicación / "Cómo llegar" — abre la app de mapas nativa por plataforma
// (Apple Maps en iPhone, Google Maps en el resto). El pin de Google es el
// verificado de DTD (CONTACT.ve.mapsUrl); Apple Maps busca por nombre+dirección.
const MAPS = {
  google: CONTACT.ve.mapsUrl,
  apple: `https://maps.apple.com/?q=${encodeURIComponent(
    `DTD Cargo, ${CONTACT.ve.addressFull}`,
  )}`,
};

const SOCIAL: { net: IconName; label: string; href: string }[] = [
  { net: "instagram", label: "Instagram", href: CONTACT.instagram.url },
  { net: "tiktok", label: "TikTok", href: CONTACT.tiktok.url },
  { net: "youtube", label: "YouTube", href: CONTACT.youtube.url },
];

// El CTA primario abre WhatsApp → siempre externo.
const PRIMARY_EXTERNAL = true;

export default function EnlacesPage() {
  return (
    <main className={`enlaces-page ${jetbrainsMono.variable}`}>
      <div className="enlaces-bio">
        <header className="enlaces-hero">
          <Image
            src="/brand/enlaces-hero.jpg"
            alt=""
            fill
            priority
            sizes="460px"
            className="enlaces-hero-photo"
          />
          <div className="enlaces-hero-scrim" />
          <div className="enlaces-hero-top">
            {/* Decorativo (alt=""): el wordmark de al lado ya aporta el nombre
                accesible "DTD Cargo" — evita que el lector lo anuncie dos veces. */}
            <Image
              src={BRAND_ASSETS.isologoReverse}
              alt=""
              width={60}
              height={62}
              priority
              className="enlaces-iso"
            />
            <div>
              {/* aria-label → el lector anuncia "DTD Cargo" (dos palabras); sin
                  él, el gap visual entre spans se leería "DTDCargo" pegado. */}
              <span className="enlaces-wordmark" aria-label="DTD Cargo">
                DTD
                <span className="gap" aria-hidden />
                Cargo
              </span>
              <div className="enlaces-handle">
                {CONTACT.instagram.handle} · dtdcargo.com
              </div>
            </div>
          </div>
          <p className="enlaces-tagline">
            Con <b>Confianza</b>, de China a tu puerta.
          </p>
        </header>

        <div className="enlaces-body">
          <a
            className="enlaces-primary"
            href={PRIMARY.href}
            {...(PRIMARY_EXTERNAL
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            <span className="ic">
              <Icon name="wa" size={20} />
            </span>
            <span className="tx">
              <b>{PRIMARY.label}</b>
              <span>{PRIMARY.sub}</span>
            </span>
            <span style={{ opacity: 0.7 }}>
              <Icon name="chev" size={18} />
            </span>
          </a>

          <div className="enlaces-label">Accesos rápidos</div>
          <div className="enlaces-rows">
            {LINKS.map((l) => (
              <a
                key={l.label}
                className={`enlaces-row${l.wine ? " is-wine" : ""}`}
                href={l.href}
                {...(l.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <span className="ic">
                  <Icon name={l.icon} size={20} />
                </span>
                <span className="tx">
                  <b>{l.label}</b>
                  <span>{l.sub}</span>
                </span>
                <span className="chev">
                  <Icon name="chev" size={16} />
                </span>
              </a>
            ))}
            <MapsRow
              googleMapsUrl={MAPS.google}
              appleMapsUrl={MAPS.apple}
              label="Cómo llegar"
              sub="Nuestra oficina en Valencia · abre el mapa"
            />
          </div>

          <div className="enlaces-label">Síguenos</div>
          <div className="enlaces-social">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="ic">
                  <Icon name={s.net} size={22} />
                </span>
                <span className="lbl">{s.label}</span>
              </a>
            ))}
          </div>

          <div className="enlaces-foot">
            <div className="web">dtdcargo.com</div>
            <div className="legal">
              DTD Cargo · RIF{" "}
              <span className="mono">{CONTACT.legalEntity.taxID}</span>
              <br />
              {CONTACT.ve.addressFull}
              <br />
              {CONTACT.emailGeneral} · {CONTACT.ve.phone}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
