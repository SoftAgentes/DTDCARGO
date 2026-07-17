import type { Metadata } from "next";
import Link from "next/link";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { HowWeWork } from "@/components/HowWeWork";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { ShippingMark } from "@/components/ShippingMark";
import { AlibabaAddressGuide } from "@/components/AlibabaAddressGuide";
import { WebPageJsonLd } from "@/components/WebPageJsonLd";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { FAQS } from "@/lib/faqs";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { jetbrainsMono } from "@/lib/fonts";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";

/**
 * `/markbox` — página SEO standalone del sistema de marcaje MARKBOX / Shipping
 * Mark / 唛头 (SDD-0064 Fase 6 · "páginas nuevas al final"). Hasta ahora
 * MARKBOX solo vivía como sección del home (`<ShippingMark/>`); esta ruta le
 * da una URL indexable propia con su propio <title>/description/JSON-LD.
 *
 * Reusa `<ShippingMark/>` (mismo flujo de 8 pasos que el home) + la guía de
 * dirección de Alibaba (`<AlibabaAddressGuide/>`, ya usada en /faq) — una sola
 * fuente de verdad de copy, sin datos inventados.
 */

const DESC =
  "El Shipping Mark (唛头) de DTD Cargo es el código único que identifica tus cajas desde el proveedor en China hasta tu puerta en Venezuela.";

export const metadata: Metadata = {
  title: "Shipping Mark · 唛头",
  description: DESC,
  keywords: [
    "Shipping Mark",
    "唛头",
    "código de bodega China",
    "casillero en China",
    "dirección bodega Yiwu",
    // Alias heredado por SEO — antes la marca pública era "MARKBOX" (SDD-0064).
    "MARKBOX",
  ],
  alternates: { canonical: "/markbox" },
  ...socialMeta({
    title: "Shipping Mark · DTD Cargo",
    description: DESC,
    path: "/markbox",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

// FAQ enfocada en MARKBOX/bodega — subconjunto grounded del FAQ maestro
// (lib/faqs.ts, categoría "bodega-china-shipping-mark"). Misma categoría que
// agrupa /faq, así que no puede desalinearse con la fuente única.
const faqMarkbox = FAQS.filter((f) => f.categoria === "bodega-china-shipping-mark");

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqMarkbox.map((f) => ({
    "@type": "Question",
    name: f.pregunta,
    acceptedAnswer: { "@type": "Answer", text: f.respuesta },
  })),
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Shipping Mark — sistema de marcaje logístico",
  serviceType: "Shipping mark / identificación de carga en bodega de consolidación",
  description: DESC,
  areaServed: [
    { "@type": "Country", name: "China" },
    { "@type": "Country", name: "Venezuela" },
  ],
  provider: { "@id": `${SITE_URL}/#organization` },
  url: `${SITE_URL}/markbox`,
};

const wa = buildWhatsAppLink(
  "Hola DTD Cargo, quiero registrarme y obtener mi Shipping Mark.",
);

export default function MarkboxPage() {
  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      {faqMarkbox.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <WebPageJsonLd path="/markbox" speakableSelectors={["#respuesta-rapida"]} />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Shipping Mark", path: "/markbox" },
        ]}
      />

      <main className={jetbrainsMono.variable}>
        {/* Hero */}
        <section className="py-16 lg:py-24 bg-paper">
          <div className="wrap max-w-[920px]">
            <span className="eyebrow">Shipping Mark · 唛头</span>
            <h1 className="h-display mt-5" style={{ fontSize: "clamp(34px, 5.5vw, 68px)" }}>
              Tu carga, identificada{" "}
              <span style={{ color: "var(--color-wine)" }}>de China a tu puerta.</span>
            </h1>
            <p className="lead mt-6 max-w-[60ch]">
              El Shipping Mark es el sistema de marcaje de DTD Cargo — así se
              conoce este marcado a nivel internacional (唛头 en China). Es el
              código que identifica tus cajas desde la fábrica hasta Venezuela,
              para que tu mercancía nunca se confunda con la de otro.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/registro" className="btn btn-primary">
                Regístrate y obtén tu Shipping Mark
              </Link>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <WhatsAppIcon size={18} /> Pregúntanos por WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* Respuesta rápida (GEO) — citable por asistentes de voz / IA */}
        <RespuestaRapida
          id="respuesta-rapida"
          pregunta="¿Qué es el Shipping Mark de DTD Cargo?"
          respuesta="El Shipping Mark (唛头 en China) es el código único DTD-NNNN que identifica cada una de tus cajas desde que tu proveedor las despacha hasta que llegan a tu puerta en Venezuela. Sin tu Shipping Mark en la caja, la bodega no puede asociarla a tu cuenta."
        />

        {/* Flujo de 8 pasos + beneficios — mismo componente que el home */}
        <ShippingMark />

        {/* Guía destacada: dirección de la bodega en Alibaba — mismo bloque
            que /faq (una sola fuente de verdad, AlibabaAddressGuide). */}
        <section id="guia-alibaba" className="py-16 lg:py-20 bg-paper scroll-mt-24">
          <div className="wrap max-w-[820px]">
            <span className="eyebrow">Guía destacada</span>
            <h2 className="h-section mt-4">
              Cómo poner tu Shipping Mark en la dirección de Alibaba, 1688 o Taobao.
            </h2>
            <p className="mt-3 mb-6 text-[14.5px] leading-[1.65] text-grey-700 max-w-[62ch]">
              Copia y pega cada campo tal cual (en chino, sin traducir) en el
              formulario de direcciones de Alibaba, 1688, Taobao u otra web — o
              pásaselo directo a tu proveedor. Con tu Shipping Mark en el
              destinatario, tu compra queda identificada apenas llega a nuestra
              bodega de Yiwu.
            </p>
            <AlibabaAddressGuide />
          </div>
        </section>

        {/* FAQ enfocada */}
        {faqMarkbox.length > 0 && (
          <section className="py-16 lg:py-20 bg-white">
            <div className="wrap max-w-[820px]">
              <span className="eyebrow">Preguntas frecuentes</span>
              <h2 className="h-section mt-4">Shipping Mark: dudas comunes.</h2>
              <dl className="mt-8 flex flex-col gap-6 m-0">
                {faqMarkbox.map((f) => (
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
              <p className="mt-8">
                <Link
                  href="/faq"
                  className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-wine hover:text-wine-deep transition-colors"
                >
                  Ver todas las preguntas frecuentes <ArrowIcon size={14} />
                </Link>
              </p>
            </div>
          </section>
        )}

        <HowWeWork />
      </main>

      <Footer />
      <WhatsAppFAB />
    </>
  );
}
