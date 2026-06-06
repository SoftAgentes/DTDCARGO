import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { FAQS } from "@/lib/faqs";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { WhatsAppIcon, ArrowIcon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description:
    "Todo sobre importar de China a Venezuela con DTD Cargo: qué es DDP puerta a puerta, cuándo se paga (Financiamiento 100%), consolidado vs contenedor, aduana, tiempos y seguimiento.",
  keywords: [
    "importar de China a Venezuela",
    "DDP puerta a puerta",
    "Financiamiento 100%",
    "consolidado LCL FCL",
    "cuánto tarda carga China Venezuela",
    "preguntas frecuentes importación",
  ],
  alternates: { canonical: "/faq" },
  ...socialMeta({
    title: "Preguntas frecuentes · DTD Cargo",
    description:
      "Todo sobre importar de China a Venezuela con DTD Cargo: qué es DDP puerta a puerta, cuándo se paga (Financiamiento 100%), consolidado vs contenedor, aduana, tiempos y seguimiento.",
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

      <main className="bg-paper">
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
              Si te queda alguna, escribinos por WhatsApp y te la resolvemos.
            </p>
          </div>
        </section>

        {/* Acordeón de FAQs (details nativo — sin JS) */}
        <section className="pb-16 lg:pb-20">
          <div className="wrap max-w-[820px]">
            {FAQS.map((f, i) => (
              <details
                key={i}
                className="group mb-3 rounded-[14px] border border-grey-200 bg-white px-5 card-shadow"
              >
                <summary className="flex items-start justify-between gap-4 cursor-pointer list-none py-5 rounded-[14px] [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft">
                  <span className="text-[16px] lg:text-[17px] font-extrabold leading-[1.35] text-ink">
                    {f.pregunta}
                  </span>
                  <span className="mt-0.5 flex-shrink-0 text-[22px] leading-none text-wine transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="-mt-1 pb-5 text-[14.5px] leading-[1.65] text-grey-700">
                  {f.respuesta}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="pb-20">
          <div className="wrap max-w-[820px]">
            <div className="card-shadow rounded-[18px] bg-ink text-white p-8 lg:p-10 text-center">
              <h2 className="h-card text-white">¿Te quedó otra duda?</h2>
              <p className="mt-3 text-[15px] leading-[1.55] text-white/75 max-w-[46ch] mx-auto">
                Un asesor humano te responde por WhatsApp, sin compromiso — y te
                arma la cotización de tu envío de China a Venezuela.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                <a href={WA} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  <WhatsAppIcon size={18} /> Escribinos por WhatsApp
                </a>
                <a
                  href="/calculadora"
                  className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white/85 hover:text-white underline underline-offset-4 decoration-1"
                >
                  Calcular mi envío <ArrowIcon size={16} />
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
