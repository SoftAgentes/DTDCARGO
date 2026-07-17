import type { Metadata } from "next";
import { jetbrainsMono } from "@/lib/fonts";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { FAQS } from "@/lib/faqs";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { AlibabaAddressGuide } from "@/components/AlibabaAddressGuide";
import { FaqExplorer } from "@/components/FaqExplorer";

// JetBrains Mono (mono de marca) para los valores copiables de la guía Alibaba
// (Shipping Mark, teléfono, código postal, email): la página monta --font-mono
// con la instancia única de lib/fonts.ts y el componente la referencia vía
// FONT_MONO (lib/design-tokens). El resto sigue en Archivo.

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description:
    "Importar de China a Venezuela con DTD Cargo: qué es DDP puerta a puerta, cuándo se paga (pagas al llegar), consolidado vs contenedor, aduana y tiempos.",
  keywords: [
    "importar de China a Venezuela",
    "DDP puerta a puerta",
    "pagas al llegar",
    "consolidado LCL FCL",
    "cuánto tarda carga China Venezuela",
    "preguntas frecuentes importación",
    "casillero en China",
    "bodega en Yiwu",
    "dirección Alibaba bodega",
    "MARKBOX",
    "Shipping Mark",
  ],
  alternates: { canonical: "/faq" },
  ...socialMeta({
    title: "Preguntas frecuentes · DTD Cargo",
    description:
      "Importar de China a Venezuela con DTD Cargo: qué es DDP puerta a puerta, cuándo se paga (pagas al llegar), consolidado vs contenedor, aduana y tiempos.",
    path: "/faq",
  }),
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.pregunta,
    acceptedAnswer: { "@type": "Answer", text: f.respuesta },
  })),
};

const WA = buildWhatsAppLink(
  "Hola DTD Cargo, tengo una consulta sobre importar de China a Venezuela. ¿Me ayudan?",
);

export default function FaqPage() {
  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Preguntas frecuentes", path: "/faq" },
        ]}
      />

      <main className={`bg-paper ${jetbrainsMono.variable}`}>
        {/* Hero */}
        <section className="py-16 lg:py-20">
          <div className="wrap max-w-[820px]">
            <span className="eyebrow">Preguntas frecuentes</span>
            <h1 className="h-display mt-5" style={{ fontSize: "clamp(34px, 5vw, 60px)" }}>
              Importar de China,
              <br />
              <span style={{ color: "var(--color-wine)" }}>sin dudas.</span>
            </h1>
            <p className="lead mt-6 max-w-[60ch]">
              Las preguntas que más nos hacen los importadores, respondidas claro.
              Si te queda alguna, escríbenos por WhatsApp y te la resolvemos.
            </p>
          </div>
        </section>

        {/* Guía destacada: dirección de la bodega en Alibaba (F4 — lo más
            preguntado en el CRM: "¿tienen casillero en China?") */}
        <section id="guia-alibaba" className="pb-14 lg:pb-16 scroll-mt-24">
          <div className="wrap max-w-[820px]">
            <span className="eyebrow">Guía destacada</span>
            <h2 className="h-card mt-3">
              Cómo poner la dirección de la bodega en Alibaba, 1688 o Taobao
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

        {/* Explorador de FAQs (híbrido): buscador + filtro por categoría +
            acordeón en un solo flujo, con el CTA de WhatsApp fijo en el rail.
            El FAQPage schema de arriba sigue plano con TODAS las preguntas — no
            depende del filtrado de cliente de este módulo. */}
        <section className="pb-20 lg:pb-24 scroll-mt-24" id="preguntas">
          <FaqExplorer faqs={FAQS} waHref={WA} />
        </section>
      </main>

      <Footer />
      <WhatsAppFAB />
    </>
  );
}
