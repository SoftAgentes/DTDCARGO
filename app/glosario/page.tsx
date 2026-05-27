import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import {
  GLOSSARY_TERMS,
  GLOSSARY_CATEGORIES,
  buildWhatsAppLink,
  type GlossaryTerm,
} from "@/lib/design-tokens";
import { renderBolded } from "@/lib/text";
import { ArrowIcon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Glosario de comercio exterior",
  description:
    "Los términos de logística e importación China-Venezuela explicados sin jerga: DDP, FCL, LCL, Incoterms, BL, AWB, ETA, CBM, MARKBOX y más.",
  keywords: [
    "glosario DDP",
    "Incoterms 2020",
    "FCL LCL",
    "Bill of Lading",
    "ETA CBM logística",
    "términos importación China",
  ],
  alternates: { canonical: "/glosario" },
  openGraph: {
    title: "Glosario de comercio exterior · DTD Cargo",
    url: "/glosario",
  },
};

export default function GlosarioPage() {
  return (
    <>
      <Nav />
      <main className="bg-paper">
        {/* Hero */}
        <section className="py-16 lg:py-24">
          <div className="wrap max-w-[1100px]">
            <span className="eyebrow">Recursos · DTD Cargo</span>
            <h1
              className="h-display mt-5"
              style={{ fontSize: "clamp(40px, 5.5vw, 76px)" }}
            >
              Glosario de
              <br />
              <span style={{ color: "var(--color-wine)" }}>
                comercio exterior.
              </span>
            </h1>
            <p className="lead mt-6 max-w-[58ch]">
              Los términos que vas a escuchar al importar de China — explicados
              sin jerga, con ejemplos de tu día a día. Compartilo con tu
              contador o socio si lo necesitan.
            </p>
          </div>
        </section>

        {/* Layout 2-col: TOC sticky + entries */}
        <section className="pb-20">
          <div className="wrap max-w-[1100px]">
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10 lg:gap-14">
              {/* TOC */}
              <aside className="hidden lg:block">
                <div className="sticky top-[100px]">
                  <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500 mb-4">
                    En esta página
                  </div>
                  <nav className="flex flex-col gap-6">
                    {GLOSSARY_CATEGORIES.map((cat) => {
                      const termsInCat = GLOSSARY_TERMS.filter(
                        (t) => t.category === cat.id,
                      );
                      if (termsInCat.length === 0) return null;
                      return (
                        <div key={cat.id}>
                          <div className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-wine mb-2">
                            {cat.label}
                          </div>
                          <ul className="flex flex-col gap-1 list-none p-0 border-l border-grey-200 pl-3">
                            {termsInCat.map((term) => (
                              <li key={term.id}>
                                <a
                                  href={`#${term.id}`}
                                  className="text-[13.5px] text-grey-700 hover:text-wine transition-colors block py-0.5"
                                >
                                  {term.term}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </nav>
                </div>
              </aside>

              {/* Entries */}
              <div className="flex flex-col">
                {GLOSSARY_CATEGORIES.map((cat) => {
                  const termsInCat = GLOSSARY_TERMS.filter(
                    (t) => t.category === cat.id,
                  );
                  if (termsInCat.length === 0) return null;
                  return (
                    <div key={cat.id} className="mb-12 last:mb-0">
                      <h2
                        className="text-[12px] font-bold tracking-[0.14em] uppercase text-wine mb-6 pb-3 border-b border-grey-200"
                        id={`cat-${cat.id}`}
                      >
                        {cat.label}
                      </h2>
                      <div className="flex flex-col gap-10">
                        {termsInCat.map((term) => (
                          <GlossaryEntry key={term.id} term={term} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* CTA cierre */}
        <section className="pb-20">
          <div className="wrap max-w-[760px]">
            <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 lg:p-10 text-center">
              <span className="eyebrow inline-flex">¿Te faltó un término?</span>
              <h3
                className="mt-4 text-[24px] lg:text-[28px] leading-[1.15] tracking-[-0.01em] text-ink"
                style={{ fontFamily: "var(--font-archivo-black)" }}
              >
                Preguntale a un asesor por WhatsApp.
              </h3>
              <p className="mt-3 text-[14.5px] text-grey-700 leading-[1.55] max-w-[48ch] mx-auto">
                Si hay alguna sigla, documento o concepto que no encontraste
                acá, escribinos. Te lo explicamos en simple y, de paso, lo
                agregamos al glosario.
              </p>
              <a
                href={buildWhatsAppLink(
                  "Hola DTD Cargo, tengo una duda sobre un término del glosario. ¿Pueden ayudarme?",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary mt-6 inline-flex"
              >
                Preguntar por WhatsApp <ArrowIcon />
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

function GlossaryEntry({ term }: { term: GlossaryTerm }) {
  return (
    <article
      id={term.id}
      className="scroll-mt-24 pb-8 border-b border-grey-200 last:border-b-0"
    >
      <h3
        className="text-[26px] lg:text-[30px] leading-[1.1] tracking-[-0.02em] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        {term.term}
      </h3>
      <div className="mt-1.5 text-[13px] text-grey-500 font-medium">
        {term.acronym}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {term.body.map((paragraph, i) => (
          <p
            key={i}
            className="text-[15px] leading-[1.65] text-grey-700"
          >
            {renderBolded(paragraph)}
          </p>
        ))}
      </div>
      {term.analogy && (
        <div
          className="mt-5 p-4 lg:p-5 rounded-[12px] bg-paper border-l-[3px]"
          style={{ borderLeftColor: "var(--color-wine)" }}
        >
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine mb-1.5">
            {term.analogy.label}
          </div>
          <p className="text-[14px] leading-[1.55] text-grey-700">
            {term.analogy.text}
          </p>
        </div>
      )}
    </article>
  );
}
