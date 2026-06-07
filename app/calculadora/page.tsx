import type { Metadata } from "next";
import { Sora, Nunito_Sans, JetBrains_Mono } from "next/font/google";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { CalculadoraForm } from "@/components/CalculadoraForm";
import { CONFIG, CIUDADES, DEFAULT_PARAMS } from "@/lib/calculadora";
import {
  getPublicCbmRate,
  getPublicCalculatorConfig,
  getPublicCalculatorCities,
} from "@/lib/public/rates-queries";

// Tipografía de CAPA SISTEMA (Norte v2.4) SOLO para la calculadora: Sora
// (display) + Nunito Sans (cuerpo) + JetBrains Mono (números). El resto del
// sitio público sigue en Archivo. La clase `.calc-sys` (globals.css) redefine
// --font-archivo / --font-archivo-black → Nunito/Sora sin tocar el JSX del form;
// los números usan --font-mono directo. Decisión founder 2026-06-06.
const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});
const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

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
  ...socialMeta({
    title: "Calculadora de envíos LCL DDP · DTD Cargo",
    description:
      "Calcula tu envío China → Venezuela en segundos. Tarifa LCL DDP por CBM, peso, destino y tipo de embalaje. Sin registro, sin compromiso.",
    path: "/calculadora",
  }),
};

export default async function CalculadoraPage() {
  // Tarifa pública real (base + piso) y reglas escalares (Fase 3), ambas
  // configuradas en /studio/tarifas. Vía RPCs anon de retorno mínimo. Si no hay
  // config, todo cae a los defaults de CONFIG/DEFAULT_PARAMS (cero regresión).
  const [serverRate, serverConfig, serverCities] = await Promise.all([
    getPublicCbmRate(),
    getPublicCalculatorConfig(),
    getPublicCalculatorCities(),
  ]);
  const baseRate = serverRate?.per_cbm && serverRate.per_cbm > 0
    ? serverRate.per_cbm
    : CONFIG.tarifaBaseCBM;
  // Reglas reales (peso incluido, $/kg, descuento, etc.) o defaults.
  const params = serverConfig ?? DEFAULT_PARAMS;
  // Ciudades reales (de /studio/tarifas › Ciudades) o el array hardcoded.
  // Selector público acotado al CASCO CENTRAL (sin recargo): el precio por km
  // de las demás ciudades está en revisión (tarifa cambiante), así que por
  // ahora solo ofrecemos la zona sin recargo. Las ciudades fuera del casco
  // siguen en la DB/CIUDADES (para el cálculo y el admin); acá solo no se
  // listan. Para reactivarlas, quitar este .filter. (pedido founder 2026-06-06)
  const ciudades = (serverCities.length > 0 ? serverCities : CIUDADES).filter(
    (c) => c.casco,
  );

  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Calculadora", path: "/calculadora" },
        ]}
      />
      <main className="bg-paper min-h-screen">
        {/* Encabezado compacto — el form aparece casi inmediato al cargar.
            H1 mantenido para SEO/accesibilidad pero visualmente discreto. */}
        <section className="pt-8 pb-5 lg:pt-12 lg:pb-6">
          <div className="wrap max-w-[1100px]">
            <span className="eyebrow">Calculadora · LCL DDP · China → Venezuela</span>
            <h1 className="sr-only">Calculadora de envíos LCL DDP</h1>
            <p className="mt-2 text-[14px] text-grey-700 leading-[1.55] max-w-[62ch]">
              Tarifa base ${baseRate}/CBM, hasta {params.pesoIncluidoKg} kg/CBM sin recargo.{" "}
              <strong className="text-ink">
                Financiamiento 100%: no pagás nada hasta que tu carga llegue a Venezuela.
              </strong>{" "}
              Estimado inmediato — confirmá la tarifa final por WhatsApp.
            </p>
          </div>
        </section>

        {/* Form + Resultado — visible apenas se carga la página. La calculadora
            usa la tipografía de SISTEMA (Sora/Nunito/Mono) vía `.calc-sys`; el
            resto de la página sigue en Archivo. */}
        <section className="pb-16 lg:pb-20">
          <div
            className={`wrap max-w-[1100px] ${sora.variable} ${nunito.variable} ${jetbrains.variable} calc-sys`}
          >
            <CalculadoraForm
              serverRate={serverRate}
              serverConfig={serverConfig}
              ciudades={ciudades}
            />
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
                  titulo={`${params.pesoIncluidoKg} kg/CBM incluidos`}
                  texto={`Hasta ese peso por metro cúbico no hay recargo. Sobre eso, cobramos $${params.recargoExcedenteKg} por kilo de excedente. Si superás ${params.pesoMaxKg} kg/CBM, te orientamos a FCL.`}
                />
                <Bloque
                  titulo="Casco central sin recargo"
                  texto={`${params.descuentoValencia > 0 ? `Entregas en Valencia (-$${params.descuentoValencia}), Maracay` : "Valencia, Maracay"} y Caracas centro: tarifa plana.`}
                />
                <Bloque
                  titulo="Embalaje incluido"
                  texto={`Caja estándar sin recargo. Caja especial (madera o paleta) suma $${params.recargoEmbalajeEspecial} por la manipulación adicional.`}
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
