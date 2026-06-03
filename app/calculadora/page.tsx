import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { CalculadoraForm } from "@/components/CalculadoraForm";
import { CONFIG } from "@/lib/calculadora";
import { getPublicCbmRate } from "@/lib/public/rates-queries";

// La tarifa pública cambia rara vez. ISR 300s como red de seguridad; además
// las actions de /studio/tarifas hacen revalidatePath("/calculadora") → update
// casi instantáneo cuando el admin marca/edita la tarifa pública.
export const revalidate = 300;

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
    title: "Calculadora de envíos LCL DDP · DTD Cargo",
    url: "/calculadora",
  },
};

export default async function CalculadoraPage() {
  // Tarifa pública real configurada en /studio/tarifas (o null → fallback al
  // default de CONFIG, cero regresión). Vía RPC anon de retorno mínimo.
  const serverRate = await getPublicCbmRate();
  const baseRate = serverRate?.per_cbm && serverRate.per_cbm > 0
    ? serverRate.per_cbm
    : CONFIG.tarifaBaseCBM;

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
            <p className="mt-2 text-[14px] text-grey-700 leading-[1.55] max-w-[62ch]">
              Tarifa base ${baseRate}/CBM, hasta {CONFIG.pesoIncluidoKg} kg/CBM sin recargo.{" "}
              <strong className="text-ink">
                Financiamiento 100%: no pagás nada hasta que tu carga llegue a Venezuela.
              </strong>{" "}
              Estimado inmediato — confirmá la tarifa final por WhatsApp.
            </p>
          </div>
        </section>

        {/* Form + Resultado — visible apenas se carga la página */}
        <section className="pb-16 lg:pb-20">
          <div className="wrap max-w-[1100px]">
            <CalculadoraForm serverRate={serverRate} />
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
                  titulo={`$${baseRate} por CBM (m³)`}
                  texto="Tarifa base de la modalidad LCL DDP (Less than Container Load, puerta a puerta con todo incluido). Aplica al volumen real de tu carga."
                />
                <Bloque
                  titulo={`${CONFIG.pesoIncluidoKg} kg/CBM incluidos`}
                  texto="Hasta ese peso por metro cúbico no hay recargo. Sobre eso, cobramos $1 por kilo de excedente. Si superás 600 kg/CBM, te orientamos a FCL."
                />
                <Bloque
                  titulo="Casco central sin recargo"
                  texto="Entregas en Valencia (-$50), Maracay y Caracas centro: tarifa plana. Para otras ciudades, sumamos $1/km desde el casco central."
                />
                <Bloque
                  titulo="Embalaje incluido"
                  texto="Caja estándar sin recargo. Caja especial (madera o paleta) suma $50 por la manipulación adicional."
                />
                <Bloque
                  titulo="Financiamiento 100%"
                  texto="No pagás nada mientras tu carga viaja. La cobranza arranca cuando llega a Venezuela y la entrega es contra pago — todo incluido, sin sorpresas en aduana.*"
                />
              </div>
              <p className="mt-6 text-[12px] text-grey-500">*Aplican restricciones.</p>
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
