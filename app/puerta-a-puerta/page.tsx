import type { Metadata } from "next";
import Link from "next/link";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { PuertaAPuerta } from "@/components/PuertaAPuerta";
import { DdpHero } from "@/components/servicios/DdpHero";
import { WebPageJsonLd } from "@/components/WebPageJsonLd";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { FAQS } from "@/lib/faqs";
import { getServiciosParaSitio } from "@/lib/public/servicios-queries";
import { agruparPorViaje } from "@/lib/servicios-timeline";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { jetbrainsMono } from "@/lib/fonts";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";
import { serializeJsonLd } from "@/lib/public/json-ld";

/**
 * `/puerta-a-puerta` — página SEO standalone del concepto protagonista de DTD
 * Cargo (SDD-0064 Fase 6 · "páginas nuevas al final"). Hasta ahora "puerta a
 * puerta" solo vivía como secciones del home (`<PuertaAPuerta/>`) y de
 * `/servicios` (`<DdpHero/>`); esta ruta les da una URL indexable propia con su
 * propio <title>/description/JSON-LD, para que Google y los motores de IA
 * puedan enlazar directo al concepto sin pasar por el home.
 *
 * Reusa los MISMOS componentes que el home/servicios (una sola fuente de
 * verdad de copy) — no duplica contenido nuevo, solo los reordena bajo un
 * hero propio + FAQ enfocada.
 */

const DESC =
  "Puerta a puerta (DDP): tu mercancía de China llega a tu dirección en Venezuela con flete, aduana e impuestos incluidos. Pagas al llegar, sujeto a aprobación.";

/**
 * El mismo título va en `metadata` y en el nodo `WebPage`. SDD-0657: antes era
 * solo «Puerta a puerta»; ahora nombra la modalidad y el trayecto, que es lo
 * que se busca. Con el sufijo « · DTD Cargo» queda en 54 caracteres.
 */
const TITLE = "Puerta a puerta (DDP) de China a Venezuela";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "puerta a puerta China Venezuela",
    "DDP puerta a puerta",
    "importar de China puerta a puerta",
    "pagas al llegar",
    "flete aduana impuestos incluidos",
  ],
  alternates: { canonical: "/puerta-a-puerta" },
  ...socialMeta({
    title: `${TITLE} · DTD Cargo`,
    description: DESC,
    path: "/puerta-a-puerta",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

// FAQ enfocada en el concepto puerta a puerta — subconjunto grounded del FAQ
// maestro (lib/faqs.ts, categoría "precio-y-pago"). Selección explícita por
// texto de pregunta (no posicional) para no depender del orden del archivo.
const PUERTA_A_PUERTA_FAQ_MATCH = [
  "Qué significa DDP puerta a puerta",
  "Quién paga la aduana",
  "importación queda a mi nombre",
  "Cuándo pago mi mercancía",
  "Cuánto tarda en llegar mi carga",
  "qué ciudades de Venezuela entregan",
];

const faqPuertaAPuerta = FAQS.filter((f) =>
  PUERTA_A_PUERTA_FAQ_MATCH.some((frag) => f.pregunta.includes(frag)),
);

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqPuertaAPuerta.map((f) => ({
    "@type": "Question",
    name: f.pregunta,
    acceptedAnswer: { "@type": "Answer", text: f.respuesta },
  })),
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Puerta a puerta (DDP) China → Venezuela",
  serviceType: "Carga consolidada China → Venezuela puerta a puerta",
  description: DESC,
  areaServed: { "@type": "Country", name: "Venezuela" },
  provider: { "@id": `${SITE_URL}/#organization` },
  url: `${SITE_URL}/puerta-a-puerta`,
};

const wa = buildWhatsAppLink(
  "Hola DTD Cargo, quiero cotizar un envío puerta a puerta de China a Venezuela.",
);

export default async function PuertaAPuertaPage() {
  // Mismo servicio DDP que protagoniza /servicios — una sola fuente de verdad
  // (DB publicada + fallback estático), cero contenido inventado.
  const servicios = await getServiciosParaSitio();
  const { ddp } = agruparPorViaje(servicios);

  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }}
      />
      {faqPuertaAPuerta.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
        />
      )}
      <WebPageJsonLd
        path="/puerta-a-puerta"
        name={TITLE}
        description={DESC}
        speakableSelectors={["#respuesta-rapida"]}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Puerta a puerta", path: "/puerta-a-puerta" },
        ]}
      />

      {/* Revestido al Norte con la superficie de recursos (`.rp-surface`).
          Sin mockup propio: armazón `rp-*`, sin dirección visual nueva. El
          copy comercial y el bloque RespuestaRapida (citable por IA) no se
          tocan. */}
      <main
        className={`rp-surface ${jetbrainsMono.variable}`}
        style={{ ["--rp-w" as string]: "920px" }}
      >
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Puerta a puerta · Todo incluido
            </div>
            <h1>
              De la fábrica en China,{" "}
              <span className="accent">a tu puerta en Venezuela.</span>
            </h1>
            <p>
              Con el servicio puerta a puerta coordinamos flete, aduana e
              impuestos como un solo paquete y pagas cuando tu carga llega a
              Venezuela — sujeto a aprobación. Un solo equipo responsable, de
              principio a fin.
            </p>
            <div className="rp-hero-actions">
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <WhatsAppIcon size={18} /> Cotizar por WhatsApp
              </a>
              <Link href="/tarifas" className="btn btn-ghost">
                Calcular mi envío <ArrowIcon size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* Respuesta rápida (GEO) — citable por asistentes de voz / IA */}
        <RespuestaRapida
          id="respuesta-rapida"
          pregunta="¿Qué significa 'puerta a puerta' al importar de China?"
          respuesta="Significa que DTD Cargo lleva tu mercancía desde China hasta tu dirección en Venezuela como un solo servicio: coordina recepción, consolidación, flete internacional, aduana e impuestos y entrega final. Internacionalmente esta modalidad se conoce como DDP (Delivered Duty Paid). No tienes que coordinar puerto, nacionalización ni transporte interno por separado."
        />

        {/* El servicio en detalle — misma ficha completa que /servicios */}
        <DdpHero ddp={ddp} />

        {/* ¿Qué significa puerta a puerta? + tabla de transparencia */}
        <PuertaAPuerta />

        {/* FAQ enfocada */}
        {faqPuertaAPuerta.length > 0 && (
          <section className="py-16 lg:py-20 bg-white">
            <div className="wrap max-w-[820px]">
              <span className="eyebrow">Preguntas frecuentes</span>
              <h2 className="h-section mt-4">Puerta a puerta: dudas comunes.</h2>
              <dl className="mt-8 flex flex-col gap-6 m-0">
                {faqPuertaAPuerta.map((f) => (
                  <div key={f.pregunta}>
                    <dt className="text-[17px] font-extrabold leading-[1.25] tracking-[-0.01em] text-ink">
                      {f.pregunta}
                    </dt>
                    <dd className="mt-2 m-0 text-[15px] leading-[1.6] text-grey-700 max-w-[68ch]">
                      {f.respuesta}
                    </dd>
                  </div>
                ))}
              </dl>
              {/* SDD-0657 · Enlaces a la ficha del servicio y a las ciudades:
                  sin ellos esta página y el grupo /importar-de-china quedaban
                  aislados del resto del sitio. */}
              <p className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
                {[
                  { href: "/servicios/puerta-a-puerta", label: "Ver la ficha del servicio" },
                  { href: "/importar-de-china", label: "Entregas en tu ciudad" },
                  { href: "/faq", label: "Ver todas las preguntas frecuentes" },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accion-text hover:text-accion-hover transition-colors"
                  >
                    {label} <ArrowIcon size={14} />
                  </Link>
                ))}
              </p>
            </div>
          </section>
        )}
      </main>

      <Footer />
      <WhatsAppFAB />
    </>
  );
}
