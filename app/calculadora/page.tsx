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
        {/* Encabezado compacto — el form aparece casi inmediato al cargar.
            H1 mantenido para SEO/accesibilidad pero visualmente discreto. */}
        <section className="pt-8 pb-5 lg:pt-12 lg:pb-6">
          <div className="wrap max-w-[1100px]">
            <span className="eyebrow">Calculadora · LCL DDP · China → Venezuela</span>
            <h1 className="sr-only">Calculadora de envíos LCL DDP</h1>
            <p className="mt-2 text-[14px] text-grey-700 leading-[1.55] max-w-[60ch]">
              Tarifa base $800/CBM, hasta 500 kg/CBM sin recargo. Estimado
              inmediato — confirmá la tarifa final por WhatsApp.
            </p>
          </div>
        </section>

        {/* Form + Resultado — visible apenas se carga la página */}
        <section className="pb-16 lg:pb-20">
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
