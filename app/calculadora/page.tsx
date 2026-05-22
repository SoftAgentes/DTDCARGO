import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { CalculadoraForm } from "@/components/CalculadoraForm";

export const metadata: Metadata = {
  title: "Calculadora de envíos LCL DDP",
  description:
    "Calcula tu envío China → Venezuela en segundos. Tarifa LCL DDP por CBM, peso, destino y tipo de embalaje. Sin registro, sin compromiso.",
  keywords: [
    "calculadora envío China",
    "tarifa CBM China Venezuela",
    "calcular flete marítimo",
    "cotizar LCL DDP",
    "precio envío China Valencia",
  ],
  alternates: { canonical: "/calculadora" },
  openGraph: {
    title: "Calculadora de envíos LCL DDP · DTD·CARGO",
    url: "/calculadora",
  },
};

export default function CalculadoraPage() {
  return (
    <>
      <Nav />
      <main className="bg-paper min-h-screen">
        {/* Hero */}
        <section className="py-16 lg:py-24">
          <div className="wrap max-w-[1100px]">
            <span className="eyebrow">Tarifa estimada en segundos</span>
            <h1
              className="h-display mt-5"
              style={{ fontSize: "clamp(40px, 5.5vw, 76px)" }}
            >
              Calculadora
              <br />
              <span style={{ color: "var(--color-wine)" }}>de envíos.</span>
            </h1>
            <p className="lead mt-6 max-w-[58ch]">
              Tarifa base $800 por CBM. Hasta 500 kg/CBM sin recargo.
              Embalaje, distancia desde Valencia y excedente de peso se calculan
              automáticamente. Es un estimado — escribinos por WhatsApp para
              cerrar la tarifa final.
            </p>
          </div>
        </section>

        {/* Form + Resultado */}
        <section className="pb-16 lg:pb-24">
          <div className="wrap max-w-[1100px]">
            <CalculadoraForm />
          </div>
        </section>

        {/* FAQ — Cómo se calcula */}
        <section className="pb-20">
          <div className="wrap max-w-[860px]">
            <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 lg:p-10">
              <span className="eyebrow inline-flex">¿Cómo funciona?</span>
              <h3
                className="mt-4 text-[24px] lg:text-[28px] leading-[1.15] tracking-[-0.01em] text-ink"
                style={{ fontFamily: "var(--font-archivo-black)" }}
              >
                Tarifa transparente, sin sorpresas.
              </h3>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-[14.5px] leading-[1.55] text-grey-700">
                <Bloque
                  titulo="$800 por CBM (m³)"
                  texto="Tarifa base de la modalidad LCL DDP (Less than Container Load, puerta a puerta con todo incluido). Aplica al volumen real de tu carga."
                />
                <Bloque
                  titulo="500 kg/CBM incluidos"
                  texto="Hasta ese peso por metro cúbico no hay recargo. Sobre eso, cobramos $1 por kilo de excedente. Si superás 600 kg/CBM, te orientamos a FCL."
                />
                <Bloque
                  titulo="Casco central sin recargo"
                  texto="Entregas en Valencia (-$50), Maracay y Caracas centro: tarifa plana. Para otras ciudades, sumamos $1/km desde el casco central."
                />
                <Bloque
                  titulo="Embalaje estándar incluido"
                  texto="Cajas de cartón sin recargo. Paletas o cajas de madera suman $60 por la manipulación adicional."
                />
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

function Bloque({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div>
      <div
        className="text-[15px] mb-1.5 text-ink"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        {titulo}
      </div>
      <p>{texto}</p>
    </div>
  );
}
