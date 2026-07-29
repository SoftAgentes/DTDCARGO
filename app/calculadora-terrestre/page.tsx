import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { UltimoKmCalculator } from "@/components/UltimoKmCalculator";

export const metadata: Metadata = {
  title: "Calculadora de flete terrestre en Venezuela",
  description:
    "Calcula el costo del último km en Venezuela: flete terrestre desde Puerto Cabello / Valencia hasta tu ciudad. Tarifa de referencia; la final la cierra tu asesor por WhatsApp.",
  alternates: { canonical: "/calculadora-terrestre" },
  ...socialMeta({
    title: "Calculadora de flete terrestre en Venezuela · DTD Cargo",
    description:
      "Calcula el costo del último km en Venezuela: flete terrestre desde Puerto Cabello / Valencia hasta tu ciudad. Tarifa de referencia; la final la cierra tu asesor por WhatsApp.",
    path: "/calculadora-terrestre",
  }),
};

export default function CalculadoraTerrestrePage() {
  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Calculadora terrestre", path: "/calculadora-terrestre" },
        ]}
      />
      {/* Revestido al Norte con la superficie de recursos (`.rp-surface`).
          Sin mockup propio: armazón `rp-*`, sin dirección visual nueva. */}
      <main
        className="rp-surface min-h-screen"
        style={{ ["--rp-w" as string]: "760px" }}
      >
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Último km
            </div>
            <h1>
              Flete terrestre <span className="accent">en Venezuela.</span>
            </h1>
            <p>
              Estima el costo de entrega desde el puerto hasta tu ciudad. Es una
              tarifa de referencia — la final te la cierra el asesor por WhatsApp.
            </p>
          </div>
        </section>

        <div className="rp-body">
          <div className="rp-card">
            <UltimoKmCalculator />
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
