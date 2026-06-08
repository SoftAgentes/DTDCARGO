import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import {
  INSPECCION_HERO,
  INSPECCION_STEPS,
  INSPECCION_GROUPS,
  INSPECCION_SIGLAS,
  type InspeccionGroup,
} from "@/lib/inspeccion";
import {
  CheckIcon,
  ShieldIcon,
  DocIcon,
  ArrowIcon,
  WhatsAppIcon,
} from "@/components/Icon";

const iconMap = {
  Check: CheckIcon,
  Shield: ShieldIcon,
  Doc: DocIcon,
} as const;

// El sitio público no carga JetBrains Mono (es fuente de Studio/calc). Para
// códigos usamos el mismo stack mono genérico que el IncotermPill público.
const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";

const DESC =
  "Inspección de calidad en China antes de embarcar: pre-embarque (PSI), durante producción (DUPRO), auditoría de fábrica, cumplimiento social, laboratorio y preparación Amazon FBA. Reporte con fotos, en español.";

export const metadata: Metadata = {
  title: "Inspección de calidad en China",
  description: DESC,
  alternates: { canonical: "/servicios/inspeccion" },
  keywords: [
    "inspección en China",
    "control de calidad",
    "auditoría de fábrica",
    "inspección pre-embarque",
    "inspección en Yiwu",
    "Amazon FBA",
  ],
  ...socialMeta({
    title: "Inspección de calidad en China · DTD Cargo",
    description: DESC,
    path: "/servicios/inspeccion",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/** OfferCatalog (schema.org) — white-label: solo servicios DTD, sin proveedores. */
const inspeccionJsonLd = {
  "@context": "https://schema.org",
  "@type": "OfferCatalog",
  name: "Inspección de calidad en China — DTD Cargo",
  provider: { "@type": "LocalBusiness", name: "DTD Cargo", url: SITE_URL },
  itemListElement: INSPECCION_GROUPS.flatMap((g) =>
    g.items.map((it) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: it.title,
        description: it.copy,
        serviceType: "Quality inspection",
        areaServed: { "@type": "Country", name: "China" },
        provider: { "@type": "LocalBusiness", name: "DTD Cargo" },
      },
    })),
  ),
};

const ctaHref = buildWhatsAppLink(INSPECCION_HERO.ctaMessage);

export default function InspeccionPage() {
  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(inspeccionJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Servicios", path: "/servicios" },
          { name: "Inspección en China", path: "/servicios/inspeccion" },
        ]}
      />
      <main>
        {/* Hero */}
        <section className="py-16 lg:py-24 bg-paper">
          <div className="wrap grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-14 lg:items-center">
            <div>
              <span className="eyebrow">{INSPECCION_HERO.eyebrow}</span>
              <h1
                className="h-display mt-5"
                style={{ fontSize: "clamp(36px, 5.2vw, 64px)" }}
              >
                {INSPECCION_HERO.headline}
                <br />
                <span style={{ color: "var(--color-wine)" }}>
                  {INSPECCION_HERO.headlineAccent}
                </span>
              </h1>
              <p className="lead mt-6 max-w-[58ch]">{INSPECCION_HERO.lead}</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href={ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  <WhatsAppIcon size={18} />
                  {INSPECCION_HERO.ctaLabel}
                </a>
                <a href="#servicios" className="btn btn-ghost">
                  Ver los servicios <ArrowIcon size={15} />
                </a>
              </div>
            </div>

            {/* Beneficios */}
            <ul className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-8 flex flex-col gap-3 list-none m-0">
              {INSPECCION_HERO.benefits.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-0.5 w-5 h-5 rounded-full grid place-items-center flex-shrink-0 bg-wine/10 text-wine">
                    <CheckIcon size={13} />
                  </span>
                  <span className="text-[14.5px] leading-[1.5] text-grey-700">
                    {b}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Cómo funciona — 5 pasos */}
        <section className="py-16 lg:py-20" id="como-funciona">
          <div className="wrap">
            <span className="eyebrow">Cómo funciona</span>
            <h2
              className="h-section mt-4"
              style={{ fontSize: "clamp(26px, 3.6vw, 42px)" }}
            >
              Simple para vos,{" "}
              <span style={{ color: "var(--color-wine)" }}>
                coordinado por dentro.
              </span>
            </h2>
            <p className="lead mt-5 max-w-[54ch]">
              Vos solo elegís, cotizás y recibís el reporte. La coordinación con
              la red de inspectores en China la manejamos nosotros.
            </p>

            <ol className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
              {INSPECCION_STEPS.map((step) => (
                <li
                  key={step.n}
                  className="card-shadow bg-white border border-grey-200 rounded-[14px] p-6 lg:p-7"
                >
                  <span
                    className="inline-flex w-10 h-10 rounded-full bg-wine text-white items-center justify-center text-[15px] font-bold"
                    style={{ fontFamily: MONO }}
                    aria-hidden
                  >
                    {step.n}
                  </span>
                  <h3 className="mt-4 text-[18px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-[1.55] text-grey-700">
                    {step.copy}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Servicios de inspección — agrupados */}
        <section className="py-16 lg:py-20 bg-paper" id="servicios">
          <div className="wrap">
            <span className="eyebrow">Qué inspeccionamos</span>
            <h2
              className="h-section mt-4"
              style={{ fontSize: "clamp(26px, 3.6vw, 42px)" }}
            >
              Tres familias de servicios,{" "}
              <span style={{ color: "var(--color-wine)" }}>
                según lo que necesités.
              </span>
            </h2>
            <p className="lead mt-5 max-w-[54ch]">
              Desde una revisión puntual antes de embarcar hasta una auditoría
              completa de fábrica. Si no sabés cuál te conviene, te asesoramos.
            </p>

            <div className="mt-12 flex flex-col gap-10">
              {INSPECCION_GROUPS.map((group) => (
                <ServiceGroup key={group.id} group={group} />
              ))}
            </div>
          </div>
        </section>

        {/* Glosario de siglas — profundización opcional (native <details>) */}
        <section className="py-16 lg:py-20" id="glosario">
          <div className="wrap max-w-[860px]">
            <span className="eyebrow">Glosario de siglas</span>
            <h2
              className="h-section mt-4"
              style={{ fontSize: "clamp(24px, 3.2vw, 36px)" }}
            >
              ¿Querés el detalle técnico?
            </h2>
            <p className="lead mt-5 max-w-[54ch]">
              Las siglas de la industria, en palabras simples. Abrí solo lo que
              te interese.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <SiglasDetails
                summary="Siglas de servicios de inspección"
                siglas={INSPECCION_SIGLAS.servicios}
                defaultOpen
              />
              <SiglasDetails
                summary="Sellos de acreditación (confianza)"
                siglas={INSPECCION_SIGLAS.acreditaciones}
              />
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="pb-16 lg:pb-24">
          <div className="wrap">
            <div className="bg-ink text-white rounded-[20px] p-8 lg:p-12 text-center">
              <h2
                className="text-[26px] lg:text-[36px] leading-[1.1] tracking-[-0.01em]"
                style={{ fontFamily: "var(--font-archivo-black)" }}
              >
                Comprá en China con confianza.
              </h2>
              <p className="mt-4 text-[15px] lg:text-[17px] leading-[1.5] text-white/80 max-w-[52ch] mx-auto">
                Solicitá tu cotización de inspección hoy. Un asesor en español te
                responde con los pasos y el costo de tu caso.
              </p>
              <div className="mt-7 flex justify-center">
                <a
                  href={ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  <WhatsAppIcon size={18} />
                  {INSPECCION_HERO.ctaLabel}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function ServiceGroup({ group }: { group: InspeccionGroup }) {
  const Icon = iconMap[group.icon as keyof typeof iconMap] ?? CheckIcon;
  return (
    <div>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl grid place-items-center flex-shrink-0 bg-ink text-white">
          <Icon size={24} />
        </div>
        <div>
          <h3
            className="text-[22px] lg:text-[26px] leading-[1.1] tracking-[-0.01em] text-ink"
            style={{ fontFamily: "var(--font-archivo-black)" }}
          >
            {group.title}
          </h3>
          <p className="mt-1.5 text-[14px] leading-[1.45] text-grey-700 max-w-[56ch]">
            {group.blurb}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {group.items.map((it) => (
          <article
            key={it.code}
            className="card-shadow bg-white border border-grey-200 rounded-[14px] p-5 lg:p-6 transition-all hover:-translate-y-0.5 hover:border-ink"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[15.5px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink">
                {it.title}
              </h4>
              <span
                className="text-[11px] font-bold tracking-[0.06em] px-2 py-1 rounded-md bg-grey-100 text-grey-700 flex-shrink-0"
                style={{ fontFamily: MONO }}
              >
                {it.code}
              </span>
            </div>
            <p className="mt-2.5 text-[13.5px] leading-[1.5] text-grey-700">
              {it.copy}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function SiglasDetails({
  summary,
  siglas,
  defaultOpen = false,
}: {
  summary: string;
  siglas: { code: string; label: string; plain: string }[];
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="brochure-group card-shadow bg-white border border-grey-200 rounded-[14px] overflow-hidden group"
    >
      <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between gap-3 text-[15px] font-bold text-ink select-none">
        {summary}
        <span
          className="text-wine transition-transform group-open:rotate-180"
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <dl className="px-6 pb-5 pt-1 border-t border-grey-200 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 m-0">
        {siglas.map((s) => (
          <div key={s.code} className="flex flex-col">
            <dt className="flex items-baseline gap-2">
              <span
                className="text-[13px] font-bold text-wine"
                style={{ fontFamily: MONO }}
              >
                {s.code}
              </span>
              <span className="text-[11.5px] text-grey-500">{s.label}</span>
            </dt>
            <dd className="m-0 text-[13px] leading-[1.45] text-grey-700">
              {s.plain}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
