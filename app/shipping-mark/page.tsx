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

/**
 * `/shipping-mark` — página del sistema de marcaje Shipping Mark / 唛头.
 *
 * Rebuild fiel al mockup Cloud Design "Shipping Mark · DTD-Cargo.html"
 * (2026-07-20): hero con el panel visual del rótulo + respuesta rápida + los 8
 * pasos + guía de la dirección de Alibaba + FAQ en acordeón + CTA final wine.
 * Estilos scopeados en `.sm-surface` (app/globals.css) — cero hex inventado.
 *
 * La ruta se llamaba `/markbox`; se renombró al término VISIBLE para el cliente
 * ("Shipping Mark"). `markbox` sigue siendo el identificador interno del ERP.
 * La URL vieja hace 301 desde next.config.ts para no perder su SEO.
 *
 * Se conservan del build anterior (GEO/SEO): `<RespuestaRapida>` citable,
 * `<WebPageJsonLd>`, el JSON-LD de Service + FAQPage y `<HowWeWork>` (decisión
 * del founder) — el mockup no los contempla, así que van sin restarle nada.
 *
 * Reusa `<ShippingMark/>` (8 pasos) y `<AlibabaAddressGuide/>` (ya usada en
 * /faq) — una sola fuente de verdad de copy, sin datos inventados.
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
  alternates: { canonical: "/shipping-mark" },
  ...socialMeta({
    title: "Shipping Mark · DTD Cargo",
    description: DESC,
    path: "/shipping-mark",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

// FAQ enfocada en el Shipping Mark / bodega — subconjunto grounded del FAQ
// maestro (lib/faqs.ts, categoría "bodega-china-shipping-mark"). Misma categoría
// que agrupa /faq, así que no puede desalinearse con la fuente única.
const faqShippingMark = FAQS.filter(
  (f) => f.categoria === "bodega-china-shipping-mark",
);

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqShippingMark.map((f) => ({
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
  url: `${SITE_URL}/shipping-mark`,
};

const wa = buildWhatsAppLink(
  "Hola DTD Cargo, quiero registrarme y obtener mi Shipping Mark.",
);

export default function ShippingMarkPage() {
  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      {faqShippingMark.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <WebPageJsonLd
        path="/shipping-mark"
        speakableSelectors={["#respuesta-rapida"]}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Shipping Mark", path: "/shipping-mark" },
        ]}
      />

      <main className="sm-surface">
        {/* ── Hero ── */}
        <section className="sm-hero">
          <div className="sm-hero-in">
            <div>
              <div className="eyebrow-h">
                <span className="rule" aria-hidden />
                Identificación de carga · 唛头
              </div>
              <h1 className="sm-h1">
                Tu carga, identificada{" "}
                <span className="accent">de China a tu puerta.</span>
              </h1>
              <p className="sm-lead">
                El Shipping Mark es el código único que identifica cada una de tus
                cajas desde la fábrica en China hasta tu puerta en Venezuela — así
                se conoce este marcado a nivel internacional (唛头 en China). Con
                tu Shipping Mark en la caja, tu mercancía nunca se confunde con la
                de otro.
              </p>
              <div className="sm-hero-ctas">
                <Link href="/registro" className="btn btn-primary btn-lg">
                  Regístrate y obtén tu Shipping Mark
                </Link>
                <a href="#como-funciona" className="btn btn-ghost btn-lg">
                  Ver cómo funciona
                </a>
              </div>
              <div className="sm-hero-note">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 8v4l2.5 2.5" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                Gratis al registrarte · tu código único DTD-NNNN, al instante.
              </div>
            </div>

            {/* Panel visual: así se ve tu Shipping Mark en la caja */}
            <div className="sm-tag-wrap">
              <div
                className="sm-tag"
                role="img"
                aria-label="Ejemplo de Shipping Mark en una caja: código DTD-1014, destinatario DTD Canopy - DTD-1014, bodega en Yiwu, Zhejiang, China"
              >
                <div className="sm-tag-top">
                  <div className="sm-tag-code">
                    DTD-1014
                    <small>Shipping Mark · 唛头</small>
                  </div>
                  <span className="sm-tag-pill">Va en cada caja</span>
                </div>
                <div className="sm-tag-rows">
                  <div className="sm-tag-row">
                    <span className="sm-tag-row-lbl">Destinatario</span>
                    <span className="sm-tag-row-val">DTD Canopy - DTD-1014</span>
                  </div>
                  <div className="sm-tag-row">
                    <span className="sm-tag-row-lbl">Bodega</span>
                    <span className="sm-tag-row-val">
                      Yiwu, Zhejiang · China
                    </span>
                  </div>
                </div>
                <div className="sm-tag-handling">
                  <div className="sm-tag-hnd">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M7 3h10l-1 8a4 4 0 0 1-8 0z" />
                      <line x1="12" y1="15" x2="12" y2="20" />
                      <line x1="8.5" y1="20" x2="15.5" y2="20" />
                    </svg>
                    <span>Frágil</span>
                  </div>
                  <div className="sm-tag-hnd">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M6 13l6-6 6 6" />
                      <path d="M6 19l6-6 6 6" />
                    </svg>
                    <span>Este lado arriba</span>
                  </div>
                  <div className="sm-tag-hnd">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <circle cx="12" cy="9" r="3.2" />
                      <path d="M5.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" />
                      <line x1="4" y1="20" x2="20" y2="4" />
                    </svg>
                    <span>Sin datos personales</span>
                  </div>
                </div>
              </div>
              <p className="sm-tag-cap">
                Así se ve tu Shipping Mark en la caja — sin tu nombre, dirección
                ni teléfono personal.
              </p>
            </div>
          </div>
        </section>

        {/* Respuesta rápida (GEO) — citable por asistentes de voz / IA */}
        <RespuestaRapida
          id="respuesta-rapida"
          pregunta="¿Qué es el Shipping Mark de DTD Cargo?"
          respuesta="El Shipping Mark (唛头 en China) es el código único DTD-NNNN que identifica cada una de tus cajas desde que tu proveedor las despacha hasta que llegan a tu puerta en Venezuela. Sin tu Shipping Mark en la caja, la bodega no puede asociarla a tu cuenta."
        />

        {/* Cómo funciona · 8 pasos + beneficios */}
        <ShippingMark />

        {/* Guía destacada: dirección de la bodega en Alibaba — misma tarjeta
            compacta (AlibabaAddressGuide) que se usa como widget en la FAQ. */}
        <section id="guia-alibaba" className="sm-widget scroll-mt-24">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow-s">
                <span className="rule" aria-hidden />
                Guía destacada
              </div>
              <h2 className="h2">
                Cómo poner tu Shipping Mark en la dirección de Alibaba, 1688 o
                Taobao.
              </h2>
              <p className="sec-sub">
                Estos son los datos de nuestra bodega en Yiwu. Escribe tu Shipping
                Mark, copia y pega en Alibaba, 1688 o Taobao — o pásaselos directo
                a tu proveedor.
              </p>
            </div>
            <AlibabaAddressGuide />
          </div>
        </section>

        {/* FAQ enfocada · acordeón */}
        {faqShippingMark.length > 0 && (
          <section className="sm-faq">
            <div className="wrap">
              <div className="sec-head">
                <div className="eyebrow-s">
                  <span className="rule" aria-hidden />
                  Preguntas frecuentes
                </div>
                <h2 className="h2">
                  Shipping Mark: <span className="accent">dudas comunes.</span>
                </h2>
              </div>
              <div className="sm-faq-list">
                {faqShippingMark.map((f, i) => (
                  <details
                    key={f.pregunta}
                    className="sm-faq-item"
                    open={i === 0}
                  >
                    <summary>
                      {f.pregunta}
                      <svg
                        className="chev"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </summary>
                    <p>{f.respuesta}</p>
                  </details>
                ))}
              </div>
              <div className="sm-faq-more">
                <Link href="/faq">Ver todas las preguntas frecuentes →</Link>
              </div>
            </div>
          </section>
        )}

        <HowWeWork />

        {/* ── CTA final ── */}
        <section className="sm-final">
          <div className="sm-final-in">
            <div>
              <div className="eyebrow-f">Empieza ahora</div>
              <h2>¿Listo para identificar tu carga?</h2>
              <p>
                Regístrate, obtén tu Shipping Mark al instante y compártelo con tu
                proveedor desde el primer pedido. Con Confianza, de China a tu
                puerta.
              </p>
            </div>
            <div className="sm-final-ctas">
              <Link href="/registro" className="btn btn-onwine btn-lg">
                Regístrate gratis
              </Link>
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-lg"
              >
                Hablar con un asesor
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFAB />
    </>
  );
}
