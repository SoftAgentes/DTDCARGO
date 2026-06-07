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
    "Calculá el costo del último km en Venezuela: flete terrestre desde Puerto Cabello / Valencia hasta tu ciudad. Tarifa de referencia; la final la cierra tu asesor por WhatsApp.",
  alternates: { canonical: "/calculadora-terrestre" },
  ...socialMeta({
    title: "Calculadora de flete terrestre en Venezuela · DTD Cargo",
    description:
      "Calculá el costo del último km en Venezuela: flete terrestre desde Puerto Cabello / Valencia hasta tu ciudad. Tarifa de referencia; la final la cierra tu asesor por WhatsApp.",
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
      <main className="py-16 lg:py-24 bg-paper min-h-screen">
        <div className="wrap max-w-[760px]">
          <span className="eyebrow">Último km</span>
          <h1
            className="h-display mt-5"
            style={{ fontSize: "clamp(32px, 4.5vw, 52px)" }}
          >
            Flete terrestre
            <br />
            <span style={{ color: "var(--color-wine)" }}>en Venezuela.</span>
          </h1>
          <p className="lead mt-6">
            Estimá el costo de entrega desde el puerto hasta tu ciudad. Es una
            tarifa de referencia — la final te la cierra el asesor por WhatsApp.
          </p>

          <div className="mt-10 card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9">
            <UltimoKmCalculator />
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
