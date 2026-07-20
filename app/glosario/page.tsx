import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import {
  GLOSSARY_TERMS,
  GLOSSARY_CATEGORIES,
  buildWhatsAppLink,
  type GlossaryTerm,
} from "@/lib/design-tokens";
import { renderBolded } from "@/lib/text";
import { ArrowIcon } from "@/components/Icon";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export const metadata: Metadata = {
  title: "Glosario de comercio exterior",
  description:
    "Los términos de logística e importación China-Venezuela explicados sin jerga: DDP, FCL, LCL, Incoterms, BL, AWB, ETA, CBM, Shipping Mark y más.",
  keywords: [
    "glosario DDP",
    "Incoterms 2020",
    "FCL LCL",
    "Bill of Lading",
    "ETA CBM logística",
    "términos importación China",
  ],
  alternates: { canonical: "/glosario" },
  ...socialMeta({
    title: "Glosario de comercio exterior · DTD Cargo",
    description:
      "Los términos de logística e importación China-Venezuela explicados sin jerga: DDP, FCL, LCL, Incoterms, BL, AWB, ETA, CBM, Shipping Mark y más.",
    path: "/glosario",
  }),
};

export default function GlosarioPage() {
  // DefinedTermSet (schema.org) — convierte el glosario en fuente machine-readable
  // de definiciones (DDP, FCL, LCL, BL, CBM, MARKBOX…) para Google / motores de IA.
  // Alinea con el knowsAbout del #organization. SDD-0064 (profundización GEO).
  const definedTermSetJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${SITE_URL}/glosario#terminos`,
    name: "Glosario de comercio exterior — DTD Cargo",
    description:
      "Términos de logística e importación China–Venezuela explicados sin jerga: DDP, FCL, LCL, Incoterms, BL, AWB, ETA, CBM, Shipping Mark y más.",
    url: `${SITE_URL}/glosario`,
    inLanguage: "es-VE",
    hasDefinedTerm: GLOSSARY_TERMS.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${SITE_URL}/glosario#${t.id}`,
      name: t.term,
      alternateName: t.acronym,
      description: t.body.join(" ").replace(/<\/?b>/g, ""),
      url: `${SITE_URL}/glosario#${t.id}`,
      inDefinedTermSet: { "@id": `${SITE_URL}/glosario#terminos` },
    })),
  };

  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(definedTermSetJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Glosario", path: "/glosario" },
        ]}
      />
      {/* Revestido al Norte (`Glosario · DTD-Cargo.html`): banda navy en el
          hero + lista `gl-*` sobre papel. Se CONSERVA lo que producción tiene
          de más que el mockup (categorías, índice lateral, analogías y el
          DefinedTermSet de arriba) — el mockup es un glosario plano de 14
          términos y este es la fuente real. */}
      <main className="rp-surface" style={{ ["--rp-w" as string]: "1100px" }}>
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Recursos
            </div>
            <h1>Glosario de importación y logística</h1>
            <p>
              Los términos que vas a encontrar en tu cotización, tu pre-alerta y
              tu Shipping Mark — explicados simple, con ejemplos de tu día a
              día. Compártelo con tu contador o socio si lo necesitan.
            </p>
          </div>
        </section>

        <div className="rp-body">
          <div className="rp-cols">
            {/* Índice lateral (solo escritorio) */}
            <aside className="rp-toc">
              <p className="rp-toc-h">En esta página</p>
              <nav aria-label="Índice del glosario">
                {GLOSSARY_CATEGORIES.map((cat) => {
                  const termsInCat = GLOSSARY_TERMS.filter(
                    (t) => t.category === cat.id,
                  );
                  if (termsInCat.length === 0) return null;
                  return (
                    <div key={cat.id} className="rp-toc-g">
                      <span>{cat.label}</span>
                      <ul>
                        {termsInCat.map((term) => (
                          <li key={term.id}>
                            <a href={`#${term.id}`} className="rp-plain">
                              {term.term}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </nav>
            </aside>

            <div>
              {GLOSSARY_CATEGORIES.map((cat) => {
                const termsInCat = GLOSSARY_TERMS.filter(
                  (t) => t.category === cat.id,
                );
                if (termsInCat.length === 0) return null;
                return (
                  <section key={cat.id} className="gl-group">
                    <h2 className="gl-group-h" id={`cat-${cat.id}`}>
                      {cat.label}
                    </h2>
                    {termsInCat.map((term) => (
                      <GlossaryEntry key={term.id} term={term} />
                    ))}
                  </section>
                );
              })}
            </div>
          </div>
        </div>

        {/* CTA cierre */}
        <div className="rp-sec" style={{ ["--rp-w" as string]: "760px" }}>
          <div className="rp-cta">
            <p className="rp-kicker">
              <span className="rule" />
              ¿Te faltó un término?
            </p>
            <h2>Pregúntale a un asesor por WhatsApp.</h2>
            <p>
              Si hay alguna sigla, documento o concepto que no encontraste acá,
              escríbenos. Te lo explicamos en simple y, de paso, lo agregamos al
              glosario.
            </p>
            <a
              href={buildWhatsAppLink(
                "Hola DTD Cargo, tengo una duda sobre un término del glosario. ¿Pueden ayudarme?",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Preguntar por WhatsApp <ArrowIcon />
            </a>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function GlossaryEntry({ term }: { term: GlossaryTerm }) {
  return (
    <article id={term.id} className="gl-item">
      <h3 className="gl-term">
        {term.term}
        {term.acronym ? <span className="tag">{term.acronym}</span> : null}
      </h3>
      {term.body.map((paragraph, i) => (
        <p key={i} className="gl-def">
          {renderBolded(paragraph)}
        </p>
      ))}
      {term.analogy && (
        <div className="gl-analogy">
          <span className="lbl">{term.analogy.label}</span>
          <p>{term.analogy.text}</p>
        </div>
      )}
    </article>
  );
}
