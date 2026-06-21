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
import { FclCalculator } from "@/components/FclCalculator";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { getPublicFclRoutes } from "@/lib/public/rates-queries";

// Tipografía de CAPA SISTEMA (igual que /calculadora): Sora (display) + Nunito
// (cuerpo) + JetBrains Mono (números) SOLO en la calculadora, vía `.calc-sys`.
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

// La tarifa FCL pública cambia rara vez; las actions de /studio/tarifas hacen
// revalidatePath de las calculadoras. ISR 300s como red de seguridad.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Calculadora FCL — Contenedor completo China → Venezuela",
  description:
    "Calcula tu contenedor completo (FCL) China → Venezuela. Tarifa por ruta y cantidad de contenedores, al instante. La confirma un asesor por WhatsApp.",
  keywords: [
    "calculadora FCL",
    "contenedor completo China Venezuela",
    "tarifa FCL 40 pies",
    "reservar contenedor China",
    "flete FCL La Guaira Puerto Cabello",
  ],
  alternates: { canonical: "/calculadora-fcl" },
  ...socialMeta({
    title: "Calculadora FCL — Contenedor completo China → Venezuela · DTD Cargo",
    description:
      "Calcula tu contenedor completo (FCL) China → Venezuela. Tarifa por ruta y cantidad de contenedores, al instante.",
    path: "/calculadora-fcl",
  }),
};

export default async function CalculadoraFclPage() {
  // Rutas FCL públicas (marcadas is_public en /studio/tarifas). Si no hay ninguna
  // → [] y la calculadora muestra su estado vacío (deriva a WhatsApp). Cero regresión.
  const routes = await getPublicFclRoutes();

  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Calculadora FCL", path: "/calculadora-fcl" },
        ]}
      />
      <WebPageJsonLd path="/calculadora-fcl" speakableSelectors={["#respuesta-rapida"]} />
      <main className="bg-paper min-h-screen">
        <section className="pt-8 lg:pt-12">
          <div className="wrap max-w-[1100px]">
            <span className="eyebrow">Contenedor completo</span>
            <h1
              className="mt-3 text-[clamp(28px,4.5vw,44px)] leading-[1.05] text-ink"
              style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
            >
              Calculadora FCL.
            </h1>
            <p className="mt-3 text-[15px] text-grey-700 leading-[1.6] max-w-[60ch]">
              ¿Tu carga llena un contenedor? Elige la ruta y la cantidad de
              contenedores y mira el estimado al instante. Para consolidar carga
              suelta usa la{" "}
              <Link href="/calculadora" className="text-wine font-semibold hover:underline">
                calculadora LCL
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="pt-7 pb-16 lg:pb-20">
          <div
            className={`wrap max-w-[1100px] ${sora.variable} ${nunito.variable} ${jetbrainsMono.variable} calc-sys`}
          >
            <FclCalculator routes={routes} />
          </div>
        </section>

        <RespuestaRapida
          id="respuesta-rapida"
          pregunta="¿Cuánto cuesta un contenedor completo (FCL) de China a Venezuela?"
          respuesta="El FCL se cobra con una tarifa cerrada por contenedor según la ruta (puerto de origen en China → puerto de destino en Venezuela) y la naviera. Elige tu ruta en la calculadora de arriba para ver el estimado al instante; la tarifa final la confirma un asesor según el tipo de contenedor (20′, 40′ o 40′HC) y la disponibilidad."
        />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
