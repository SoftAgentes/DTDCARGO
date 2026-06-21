import type { Metadata } from "next";
import Link from "next/link";
import { Sora, Nunito_Sans } from "next/font/google";
import { jetbrainsMono } from "@/lib/fonts";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { WebPageJsonLd } from "@/components/WebPageJsonLd";
import { CalculadoraForm } from "@/components/CalculadoraForm";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { CIUDADES } from "@/lib/calculadora";
import {
  getPublicCbmRate,
  getPublicCalculatorConfig,
  getPublicCalculatorCities,
} from "@/lib/public/rates-queries";

// Tipografía de CAPA SISTEMA (Norte v2.4) SOLO para la calculadora: Sora
// (display) + Nunito Sans (cuerpo) + JetBrains Mono (números, instancia única
// de lib/fonts.ts). El resto del sitio público sigue en Archivo. La clase
// `.calc-sys` (globals.css) redefine --font-archivo / --font-archivo-black →
// Nunito/Sora sin tocar el JSX del form; los números usan --font-mono directo.
// Decisión founder 2026-06-06.
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

// La tarifa pública cambia rara vez. ISR 300s como red de seguridad; además
// las actions de /studio/tarifas hacen revalidatePath("/calculadora") → update
// casi instantáneo cuando el admin marca/edita la tarifa pública.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Calculadora de envíos puerta a puerta (LCL · DDP)",
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
    title: "Calculadora de envíos puerta a puerta (LCL · DDP) · DTD Cargo",
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
  // Ciudades reales (de /studio/tarifas › Ciudades) o el array hardcoded. El
  // cálculo aplica el recargo por distancia a las de fuera del casco de forma
  // interna; no se expone en la UI (decisión founder 2026-06-06).
  const ciudades = serverCities.length > 0 ? serverCities : CIUDADES;

  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Calculadora", path: "/calculadora" },
        ]}
      />
      {/* WebPage + speakable (GEO): marca el bloque "Respuesta rápida" como citable. */}
      <WebPageJsonLd path="/calculadora" speakableSelectors={["#respuesta-rapida"]} />
      <main className="bg-paper min-h-screen">
        {/* H1 sr-only para SEO/accesibilidad — el título visible vive dentro de
            la card de la calculadora (header de la columna izquierda). */}
        <section className="pt-6 lg:pt-10">
          <div className="wrap max-w-[1100px]">
            <h1 className="sr-only">
              Calculadora de envíos puerta a puerta — China → Venezuela
            </h1>
          </div>
        </section>

        {/* Form + Resultado — visible apenas se carga la página. La calculadora
            usa la tipografía de SISTEMA (Sora/Nunito/Mono) vía `.calc-sys`; el
            resto de la página sigue en Archivo. */}
        <section className="pb-16 lg:pb-20">
          <div
            className={`wrap max-w-[1100px] ${sora.variable} ${nunito.variable} ${jetbrainsMono.variable} calc-sys`}
          >
            <CalculadoraForm
              serverRate={serverRate}
              serverConfig={serverConfig}
              ciudades={ciudades}
            />
            <p className="mt-6 text-[13px] text-grey-700">
              ¿Tu carga llena un contenedor completo?{" "}
              <Link
                href="/calculadora-fcl"
                className="text-wine font-semibold hover:underline"
              >
                Calcula tu FCL →
              </Link>
            </p>
          </div>
        </section>

        <RespuestaRapida
          id="respuesta-rapida"
          pregunta="¿Cuánto cuesta traer mercancía de China a Venezuela?"
          respuesta="El envío marítimo se cobra por volumen (CBM) y ciudad de destino, puerta a puerta y todo incluido (flete, aduana e impuestos). Calcula tu estimado al instante con la herramienta de arriba; la tarifa final la confirma un asesor por WhatsApp según el producto, el peso y el volumen reales."
        />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
