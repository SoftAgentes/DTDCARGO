import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { CotizarForm } from "@/components/CotizarForm";

export const metadata: Metadata = {
  title: "Cotiza tu envío",
  description:
    "Cotización cerrada DDP en 24 horas. Ingresa origen, destino, peso y volumen y te devolvemos una estimación con todo incluido.",
  alternates: { canonical: "/cotizar" },
  openGraph: {
    title: "Cotiza tu envío · DTD·CARGO",
    url: "/cotizar",
  },
};

export default function CotizarPage() {
  return (
    <>
      <Nav />
      <main className="py-16 lg:py-24 bg-paper min-h-screen">
        <div className="wrap grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
          <div>
            <span className="eyebrow">Cotiza</span>
            <h1
              className="h-display mt-5"
              style={{ fontSize: "clamp(36px, 5vw, 64px)" }}
            >
              Tarifa cerrada
              <br />
              <span style={{ color: "var(--color-wine)" }}>en 24 horas.</span>
            </h1>
            <p className="lead mt-6">
              Recibe una cotización DDP con flete, aduana, impuestos y entrega
              incluidos. Sin letra chica. Sin sorpresas.
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
