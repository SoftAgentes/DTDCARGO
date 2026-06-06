import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { CotizarForm } from "@/components/CotizarForm";

export const metadata: Metadata = {
  title: "Cotiza tu envío",
  description:
    "Cotización inicial DDP en ~24h hábiles. Ingresá origen, destino, peso y volumen y te devolvemos una estimación con todo incluido (sujeta a medidas reales).",
  alternates: { canonical: "/cotizar" },
  ...socialMeta({
    title: "Cotiza tu envío · DTD Cargo",
    description:
      "Cotización inicial DDP en ~24h hábiles. Ingresá origen, destino, peso y volumen y te devolvemos una estimación con todo incluido (sujeta a medidas reales).",
    path: "/cotizar",
  }),
};

export default function CotizarPage() {
  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Cotizar", path: "/cotizar" },
        ]}
      />
      <main className="py-16 lg:py-24 bg-paper min-h-screen">
        <div className="wrap grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
          <div>
            <span className="eyebrow">Cotiza</span>
            <h1
              className="h-display mt-5"
              style={{ fontSize: "clamp(36px, 5vw, 64px)" }}
            >
              Cotización inicial
              <br />
              <span style={{ color: "var(--color-wine)" }}>en ~24h hábiles.</span>
            </h1>
            <p className="lead mt-6">
              Recibe una estimación DDP con flete, aduana, impuestos y entrega
              incluidos. El precio final lo confirma tu asesor según el volumen
              y peso reales.
            </p>
            <div className="mt-8 flex flex-col gap-4 text-[15px] text-grey-700">
              <div className="flex items-start gap-3">
                <span
                  className="mt-1.5 inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: "var(--color-wine)" }}
                />
                <span>
                  <strong className="text-ink">¿No conocés el peso/volumen?</strong>{" "}
                  Pega el link de Alibaba y nuestro equipo lo calcula.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span
                  className="mt-1.5 inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: "var(--color-wine)" }}
                />
                <span>
                  <strong className="text-ink">¿Múltiples proveedores?</strong>{" "}
                  Lo consolidamos en Yiwu o Shenzhen sin costo extra.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span
                  className="mt-1.5 inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: "var(--color-wine)" }}
                />
                <span>
                  <strong className="text-ink">¿Pagás impuestos?</strong> Sí,
                  todo incluido en la tarifa final.
                </span>
              </div>
            </div>
          </div>

          <CotizarForm />
        </div>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
