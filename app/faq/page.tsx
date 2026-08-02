import type { Metadata } from "next";
import { jetbrainsMono } from "@/lib/fonts";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { FAQS } from "@/lib/faqs";
import { buildWhatsAppLink } from "@/lib/design-tokens";
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Preguntas frecuentes", path: "/faq" },
        ]}
      />

      {/* Revestido al Norte (`Preguntas Frecuentes · DTD-Cargo.html`): banda
          navy `rp-hero`. El bloque de preguntas NO se reemplaza por el
          `<details>` plano del mockup — producción tiene el explorador
          (buscador + filtro por categoría + widget de la guía Alibaba), que ya
          corre sobre los tokens de marca y es superior al mockup. */}
      <main className={`rp-surface ${jetbrainsMono.variable}`}>
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Recursos
            </div>
            <h1>
              Importar de China, <span className="accent">sin dudas.</span>
            </h1>
            <p>
              Cómo funciona el servicio, de la cotización a la entrega. Si no
              encuentras tu respuesta, escríbenos por WhatsApp y te la
              resolvemos.
            </p>
          </div>
        </section>

        {/* La guía de dirección de Alibaba dejó de ser sección destacada aparte:
            ahora es una FAQ más (widget "alibaba-guide" en lib/faqs.ts) que
            renderiza la guía interactiva al abrirse, dentro del explorador. */}

        {/* Explorador de FAQs (híbrido): buscador + filtro por categoría +
            acordeón en un solo flujo, con el CTA de WhatsApp fijo en el rail.
            El FAQPage schema de arriba sigue plano con TODAS las preguntas — no
            depende del filtrado de cliente de este módulo. */}
        <section className="pt-12 lg:pt-16 pb-20 lg:pb-24 scroll-mt-24" id="preguntas">
          <FaqExplorer faqs={FAQS} waHref={WA} />
        </section>
      </main>

      <Footer />
      <WhatsAppFAB />
    </>
  );
}
