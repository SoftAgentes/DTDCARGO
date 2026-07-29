import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { socialMeta } from "@/lib/seo-og";
import { ACUERDO_SERVICIOS, TERMINOS_LIVE } from "@/lib/legal-public";

/**
 * `/terminos` — página pública de Términos y Condiciones (el Acuerdo de Servicios
 * y Políticas Generales vigente). Sitio público: vive fuera del ERP, el contenido
 * viene de `@/lib/legal-public` (copia bundleada, NO de Supabase — frontera dura).
 *
 * Mientras `TERMINOS_LIVE` sea false (texto v3.0 con placeholders pendientes del
 * abogado), la página va `noindex` y el footer no la enlaza. Al montar v3.1 se
 * pone TERMINOS_LIVE=true → indexable + link visible.
 */

const DESC =
  "Términos y Condiciones de DTD Cargo — Acuerdo de Servicios y Políticas Generales del servicio de carga puerta a puerta China–Venezuela.";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: DESC,
  alternates: { canonical: "/terminos" },
  robots: TERMINOS_LIVE ? undefined : { index: false, follow: false },
  ...(TERMINOS_LIVE
    ? socialMeta({
        title: "Términos y Condiciones · DTD Cargo",
        description: DESC,
        path: "/terminos",
      })
    : {}),
};

function fmtFecha(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export default function TerminosPage() {
  const doc = ACUERDO_SERVICIOS;

  return (
    <>
      <Nav />
      {/* Reskin mínimo al Norte: hero navy `rp-*`. El clausulado, el gate
          TERMINOS_LIVE y el `noindex` no se tocan. */}
      <main className="rp-surface" style={{ ["--rp-w" as string]: "900px" }}>
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Legal · DTD Cargo
            </div>
            <h1>
              Términos y <span className="accent">Condiciones.</span>
            </h1>
            <p>
              El <strong>{doc.title}</strong> rige el servicio de carga
              consolidada puerta a puerta China–Venezuela de DTD Cargo. Al
              confirmar una cotización, el cliente acepta la versión vigente.
            </p>
            <p className="rp-hero-meta">
              <span>Versión {doc.version}</span>
              <span>En vigor desde el {fmtFecha(doc.effectiveDate)}</span>
            </p>
          </div>
        </section>

        {/* Cláusulas */}
        <section className="pb-24 pt-12 lg:pt-16">
          {/* Ver nota en /privacidad: `max-w-[900px]` pierde contra `.wrap`. */}
          <div className="wrap" style={{ maxWidth: 900 }}>
            <div className="flex flex-col gap-9">
              {doc.clauses.map((c, i) => (
                <article key={i}>
                  <h2 className="text-[17px] sm:text-[19px] font-extrabold text-ink tracking-[-0.01em]">
                    {c.heading}
                  </h2>
                  <p className="mt-2.5 text-[14.5px] leading-[1.7] text-grey-700">
                    {c.body}
                  </p>
                </article>
              ))}
            </div>

            <p className="mt-14 pt-8 border-t border-grey-200 text-[13px] leading-[1.6] text-grey-500 max-w-[68ch]">
              Este documento se acepta electrónicamente al confirmar cada
              cotización, conforme a la Ley sobre Mensajes de Datos y Firmas
              Electrónicas. Las versiones anteriores permanecen vinculadas a las
              operaciones aceptadas bajo ellas.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
