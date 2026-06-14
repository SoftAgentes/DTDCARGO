import type { Metadata } from "next";
import Link from "next/link";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { HowWeWork } from "@/components/HowWeWork";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import {
  SERVICES_OWNERSHIP,
  INCOTERMS,
  buildWhatsAppLink,
  FONT_MONO,
} from "@/lib/design-tokens";
import { ServiciosDetalle } from "@/components/ServiciosDetalle";
import { jetbrainsMono } from "@/lib/fonts";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { buildOfferCatalog, isOfferable } from "@/lib/seo-offer-catalog";
import { getServiciosParaSitio } from "@/lib/public/servicios-queries";
import {
  CheckIcon,
  ArrowIcon,
  FlagCN,
  FlagVE,
} from "@/components/Icon";

const SERVICE_META_DESC =
  "Servicios entre Yiwu y Valencia: puerta a puerta DDP, LCL, FCL, aduana, inspección, sourcing, registro de marca, visado y transporte terrestre.";

export const metadata: Metadata = {
  title: "Servicios",
  description: SERVICE_META_DESC,
  alternates: { canonical: "/servicios" },
  ...socialMeta({
    title: "Servicios · DTD Cargo",
    description: SERVICE_META_DESC,
    path: "/servicios",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export default async function ServiciosPage() {
  // Servicios para el sitio (SDD-0076 Fase 3): contenido publicado en la DB con
  // fallback al estático de servicios-detalle.ts. Hasta aplicar la migración 0130
  // + publicar, devuelve el estático tal cual (cero regresión).
  const servicios = await getServiciosParaSitio();

  // OfferCatalog (schema.org) para que Google/IA sepan qué ofrece la empresa.
  // Deriva de `servicios` (DB publicada + fallback) → el crawl del AI Agent de
  // Kommo toma info certera, ya editable desde el Studio. Mismo builder que el
  // `hasOfferCatalog` de la entidad (layout.tsx): un solo catálogo coherente,
  // ligado al proveedor por @id, sin listar lo no ofrecible (isOfferable).
  const serviciosJsonLd = {
    "@context": "https://schema.org",
    ...buildOfferCatalog({
      servicios: servicios.filter(isOfferable),
      siteUrl: SITE_URL,
      provider: { "@id": `${SITE_URL}/#organization` },
    }),
  };

  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviciosJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Servicios", path: "/servicios" },
        ]}
      />
      {/* jetbrainsMono.variable monta --font-mono (JetBrains) para que los
          códigos Incoterm (FONT_MONO) rendericen en la mono de marca. */}
      <main className={jetbrainsMono.variable}>
        {/* Hero */}
        <section className="py-16 lg:py-24 bg-paper">
          <div className="wrap">
            <span className="eyebrow">Servicios</span>
            <h1
              className="h-display mt-5"
              style={{ fontSize: "clamp(40px, 6vw, 80px)" }}
            >
              Una operación.
              <br />
              <span style={{ color: "var(--color-wine)" }}>Dos sedes.</span>
              <br />
              De la fábrica a tu puerta.
            </h1>
            <p className="lead mt-6 max-w-[56ch]">
              Cada servicio se ejecuta donde tiene mejor sentido operativo:
              control de fábrica y consolidación en Yiwu, trámites locales y
              entrega final desde Valencia. Tú hablas con un solo equipo.
            </p>
          </div>
        </section>

        <RespuestaRapida
          pregunta="¿Qué servicios ofrece DTD Cargo para importar de China a Venezuela?"
          respuesta="DTD Cargo lleva tu mercancía puerta a puerta de China a Venezuela en modalidad DDP —flete, aduana e impuestos incluidos— con consolidación e inspección en su bodega propia de Yiwu. Sobre esa base ofrece servicios complementarios: verificación de proveedores, compra asistida, control de calidad, laboratorio y permisología, registro de marca, visado de negocios, documentos de importación, desaduanaje y entrega final (last mile)."
        />

        {/* Inspección en China — línea destacada. Deep-dive en subpágina propia
            para sumar la categoría sin saturar el brochure de logística. */}
        <section className="pt-2 lg:pt-4" id="inspeccion">
          <div className="wrap">
            <Link
              href="/servicios/inspeccion"
              className="group block card-shadow bg-ink text-white rounded-[20px] p-7 lg:p-10 transition-all hover:-translate-y-0.5"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-7 lg:gap-12 lg:items-center">
                <div>
                  <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] uppercase text-wine-soft">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-wine-soft"
                      aria-hidden
                    />
                    Nuevo · Inspección en China
                  </span>
                  <h2
                    className="mt-4 text-[26px] lg:text-[36px] leading-[1.08] tracking-[-0.01em] text-white"
                    style={{ fontFamily: "var(--font-archivo-black)" }}
                  >
                    Verifica tu mercancía en la fábrica,
                    <br />
                    <span className="text-wine-soft">antes de embarcar.</span>
                  </h2>
                  <p className="mt-4 text-[14.5px] lg:text-[15.5px] leading-[1.55] text-white/80 max-w-[54ch]">
                    Inspección pre-embarque, auditoría de fábrica, laboratorio y
                    preparación para Amazon — con reporte en español y fotos. Un
                    solo socio para tu logística y tu control de calidad.
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-[14.5px] font-semibold text-white group-hover:text-wine-soft">
                    Conoce el servicio <ArrowIcon size={15} />
                  </span>
                </div>
                <ul className="flex flex-col gap-3 list-none m-0">
                  {[
                    "Revisamos en origen, antes de pagar el saldo",
                    "Reporte claro con fotos, en español",
                    "Atención en español desde Yiwu",
                  ].map((t) => (
                    <li
                      key={t}
                      className="flex items-start gap-3 text-[14px] leading-[1.45] text-white/85"
                    >
                      <span className="mt-0.5 w-5 h-5 rounded-full grid place-items-center flex-shrink-0 bg-white/10 text-white">
                        <CheckIcon size={13} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          </div>
        </section>

        {/* Servicios en detalle — fichas desplegables (SDD-0063).
            Reemplaza las dos grillas de tarjetas cortas (Sede CN / Sede VE) por
            fichas a fondo con incluye/no-incluye/precio/cómo/tiempos. */}
        <ServiciosDetalle servicios={servicios} />

        {/* Mapa de operación — dos oficinas + puente de coordinación */}
        <section className="py-16 lg:py-20" id="matriz">
          <div className="wrap">
            <SectionHeader
              eyebrow="Mapa de operación"
              title={
                <>
                  Una operación.
                  <br />
                  <span style={{ color: "var(--color-wine)" }}>Dos oficinas</span>{" "}
                  trabajando juntas.
                </>
              }
              lead="No eliges entre opciones. Tu envío pasa por dos oficinas que se coordinan internamente, y tú siempre hablas con una sola persona del equipo."
            />

            {/* Dos oficinas (peers) — cada una con los servicios que ejecuta sola */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
              <OfficeCard
                flag="cn"
                title="Yiwu"
                location="Tu equipo en China"
                role="Control de fábrica · pre-embarque"
                services={SERVICES_OWNERSHIP.onlyYiwu}
              />
              <OfficeCard
                flag="ve"
                title="Valencia"
                location="Tu equipo en Venezuela"
                role="Trámites locales · post-embarque"
                services={SERVICES_OWNERSHIP.onlyValencia}
              />
            </div>

            {/* Puente — servicios donde ambas oficinas colaboran */}
            <div className="relative mt-6 lg:mt-7">
              {/* Conectores visuales hacia arriba (solo desktop) */}
              <div
                aria-hidden
                className="hidden md:flex justify-center gap-[calc(50%-48px)] -mt-1 mb-2"
              >
                <span className="block w-px h-5 bg-grey-300" />
                <span className="block w-px h-5 bg-grey-300" />
              </div>

              <div className="bg-wine text-white rounded-[18px] p-7 lg:p-9 text-center">
                <span className="inline-block text-[10.5px] font-bold tracking-[0.14em] uppercase text-white/65">
                  {SERVICES_OWNERSHIP.both.length} servicios donde ambas oficinas colaboran
                </span>
                <p
                  className="mt-3 text-[15px] lg:text-[16.5px] leading-[1.5] text-white/85 max-w-[60ch] mx-auto"
                >
                  <strong className="text-white">Yiwu ejecuta</strong> el trabajo en
                  China, <strong className="text-white">Valencia te lo coordina</strong>{" "}
                  contigo. Los dos equipos hablan entre sí — tú solo hablas con uno.
                </p>
                <ul className="mt-5 flex flex-wrap justify-center gap-2 list-none p-0">
                  {SERVICES_OWNERSHIP.both.map((s) => (
                    <li
                      key={s}
                      className="inline-flex px-3 py-1.5 rounded-[8px] bg-white/10 text-[13px] font-semibold text-white"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Closing — el contrato con el cliente */}
            <div className="mt-10 lg:mt-12 text-center max-w-[52ch] mx-auto">
              <p className="text-[11.5px] font-bold tracking-[0.14em] uppercase text-wine">
                Un punto de contacto único
              </p>
              <p
                className="mt-3 text-[20px] lg:text-[24px] leading-[1.25] tracking-[-0.01em] text-ink"
                style={{ fontFamily: "var(--font-archivo-black)" }}
              >
                No te pasamos de área en área. Una persona del equipo coordina
                todo internamente.
              </p>
            </div>
          </div>
        </section>

        {/* Incoterms 2020 — demostración de competencia operativa */}
        <section className="pb-16 lg:pb-20" id="incoterms">
          <div className="wrap">
            <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-10 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 lg:items-center">
              <div>
                <span className="eyebrow">Incoterms 2020</span>
                <h3
                  className="mt-3 text-[24px] lg:text-[30px] leading-[1.1] tracking-[-0.01em] text-ink"
                  style={{ fontFamily: "var(--font-archivo-black)" }}
                >
                  Trabajamos con todos los
                  <br />
                  <span style={{ color: "var(--color-wine)" }}>
                    términos comerciales.
                  </span>
                </h3>
                <p className="mt-4 text-[14px] text-grey-700 leading-[1.55] max-w-[44ch]">
                  Adaptamos la operación al Incoterm que acuerdes con tu
                  proveedor en China. No te encasillamos: si tu proveedor
                  vende EXW y tú compras DDP, nosotros hacemos el puente.
                </p>
                <p className="mt-3 text-[12.5px] text-grey-500 leading-[1.5]">
                  ¿No sabes con qué término te conviene operar?{" "}
                  <a
                    href={buildWhatsAppLink(
                      "Hola DTD Cargo, quiero asesoría para elegir el Incoterm correcto para mi operación."
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-wine hover:text-wine-deep underline underline-offset-2"
                  >
                    Te asesoramos por WhatsApp →
                  </a>
                </p>
              </div>

              <div className="flex flex-col gap-5">
                <div>
                  <div className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-wine mb-3">
                    Principales en el corredor China-Venezuela
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {INCOTERMS.filter((t) => t.principal).map((t) => (
                      <IncotermPill key={t.code} term={t} variant="principal" />
                    ))}
                  </div>
                </div>

                <div className="pt-5 border-t border-grey-200">
                  <div className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-grey-500 mb-3">
                    También manejamos
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {INCOTERMS.filter((t) => !t.principal).map((t) => (
                      <IncotermPill key={t.code} term={t} variant="secondary" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <HowWeWork />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function SectionHeader({
  flag,
  eyebrow,
  title,
  lead,
}: {
  flag?: string;
  eyebrow: string;
  title: React.ReactNode;
  lead: string;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-8">
      <div>
        <span className="eyebrow">
          {flag && <span className="mr-1.5">{flag}</span>}
          {eyebrow}
        </span>
        <h2 className="h-section mt-4" style={{ fontSize: "clamp(28px, 4vw, 48px)" }}>
          {title}
        </h2>
      </div>
      <p className="lead max-w-[40ch]">{lead}</p>
    </div>
  );
}

/**
 * Card de una oficina (Yiwu o Valencia).
 *
 * Diseño plano "peer-to-peer": ambas cards usan exactamente el mismo
 * tratamiento visual. NO hay variant "featured" porque ya no estamos vendiendo
 * planes a elegir — son dos oficinas reales de la misma empresa.
 *
 * El layout 2-col + el "puente de coordinación" debajo es lo que comunica
 * que es UNA operación con DOS sedes (no tres opciones a elegir). La card
 * en sí solo muestra qué servicios ejecuta esa oficina sola.
 */
function OfficeCard({
  flag,
  title,
  location,
  role,
  services,
}: {
  flag: "cn" | "ve";
  title: string;
  location: string;
  role: string;
  services: readonly string[];
}) {
  return (
    <article className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9 transition-all hover:-translate-y-0.5 hover:border-ink">
      {/* Header: flag + título + ubicación */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          {flag === "cn" ? <FlagCN size={32} /> : <FlagVE size={32} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="text-[28px] lg:text-[32px] leading-[1] tracking-[-0.02em] text-ink"
            style={{ fontFamily: "var(--font-archivo-black)" }}
          >
            {title}
          </h3>
          <p className="text-[13px] text-grey-500 leading-[1.3] mt-1.5">
            {location}
          </p>
        </div>
      </div>

      {/* Rol — qué hace esta oficina en la cadena */}
      <p className="mt-5 text-[14px] text-wine font-semibold tracking-[0.02em]">
        {role}
      </p>

      <hr className="my-5 border-grey-200" />

      {/* Lista de servicios que ejecuta solo esta oficina */}
      <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-grey-500 block mb-3">
        {services.length} servicios que ejecuta solo
      </span>
      <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
        {services.map((s) => (
          <li
            key={s}
            className="flex items-start gap-2.5 text-[14.5px] leading-[1.4] text-grey-700"
          >
            <span
              className="mt-[8px] inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-wine"
              aria-hidden
            />
            {s}
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Pill de Incoterm con tooltip CSS-only en hover/focus.
 * Variant `principal` = wine filled con nombre completo visible.
 * Variant `secondary` = grey compact solo con el código.
 * El tooltip aparece arriba con definición simple en español.
 */
function IncotermPill({
  term,
  variant,
}: {
  term: (typeof INCOTERMS)[number];
  variant: "principal" | "secondary";
}) {
  return (
    <button
      type="button"
      className="group relative rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft cursor-help"
      aria-label={`${term.code} — ${term.name}: ${term.description}`}
    >
      {variant === "principal" ? (
        <span className="flex flex-col items-start px-3.5 py-2 rounded-[8px] bg-wine text-white">
          <span
            className="text-[14px] font-extrabold tracking-[0.06em]"
            style={{ fontFamily: FONT_MONO }}
          >
            {term.code}
          </span>
          <span className="text-[10.5px] font-medium opacity-85 leading-[1.2] mt-0.5">
            {term.name}
          </span>
        </span>
      ) : (
        <span
          className="inline-block px-2.5 py-1.5 rounded-[6px] bg-grey-100 text-grey-700 text-[12px] font-bold tracking-[0.06em]"
          style={{ fontFamily: FONT_MONO }}
        >
          {term.code}
        </span>
      )}

      {/* Tooltip arriba, CSS-only (hover + focus-visible) */}
      <span
        role="tooltip"
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+10px)] w-[240px] p-3.5 rounded-[10px] bg-ink text-left opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible transition-all duration-200 z-[60] shadow-[0_24px_48px_-12px_rgba(15,30,61,0.45)]"
      >
        <span className="block font-bold text-[12.5px] text-white mb-1.5">
          {term.name}
        </span>
        <span className="block text-[12px] leading-[1.5] text-white/85">
          {term.description}
        </span>
        {/* Flecha apuntando al pill */}
        <span className="absolute left-1/2 -translate-x-1/2 top-full w-3 h-3 rotate-45 bg-ink -mt-1.5" />
      </span>
    </button>
  );
}
