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
      <main className="bg-paper">
        {/* Hero */}
        <section className="py-16 lg:py-24">
          <div className="wrap max-w-[900px]">
            <span className="eyebrow">Legal · DTD Cargo</span>
            <h1
              className="h-display mt-5"
              style={{ fontSize: "clamp(36px, 5vw, 64px)" }}
            >
              Términos y{" "}
              <span style={{ color: "var(--color-wine)" }}>Condiciones.</span>
            </h1>
            <p className="lead mt-6 max-w-[60ch]">
              El <strong>{doc.title}</strong> rige el servicio de carga
              consolidada puerta a puerta China–Venezuela de DTD Cargo. Al
              confirmar una cotización, el cliente acepta la versión vigente.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-grey-700">
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold"
                style={{
                  background: "var(--color-wine-tint, rgba(127,15,26,0.08))",
                  color: "var(--color-wine)",
                }}
              >
                Versión {doc.version}
              </span>
              <span>En vigor desde el {fmtFecha(doc.effectiveDate)}</span>
            </div>
          </div>
        </section>

        {/* Cláusulas */}
        <section className="pb-24">
          <div className="wrap max-w-[900px]">
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
