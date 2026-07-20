import type { Metadata } from "next";
import Link from "next/link";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { WebPageJsonLd } from "@/components/WebPageJsonLd";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { TarifasTabs } from "@/components/TarifasTabs";
import { CIUDADES } from "@/lib/calculadora";
import { ArrowIcon } from "@/components/Icon";
import {
  getPublicCbmRate,
  getPublicCalculatorConfig,
  getPublicCalculatorCities,
} from "@/lib/public/rates-queries";

// ISR 300s como red de seguridad; las actions de /studio/tarifas hacen
// revalidatePath("/tarifas") para actualizar la tarifa pública casi al instante.
export const revalidate = 300;

const DESC =
  "Calcula tu envío China → Venezuela por volumen (CBM) al instante: puerta a puerta DDP todo incluido, o LCL consolidado hasta puerto con tu propio Bill of Lading. Sin registro. El precio en firme lo cierra un asesor por WhatsApp.";

export const metadata: Metadata = {
  title: "Tarifas y calculadora de envíos (CBM · LCL)",
  description: DESC,
  keywords: [
    "calculadora envío China Venezuela",
    "tarifa CBM China Venezuela",
    "cotizar LCL DDP",
    "LCL consolidado China Venezuela",
    "precio envío China Valencia",
  ],
  alternates: { canonical: "/tarifas" },
  ...socialMeta({
    title: "Tarifas y calculadora de envíos · DTD Cargo",
    description: DESC,
    path: "/tarifas",
  }),
};

export default async function TarifasPage() {
  // Tarifa pública real (base + piso) + reglas escalares + ciudades, vía RPCs
  // anon de retorno mínimo. Sin config → defaults de CONFIG/DEFAULT_PARAMS.
  const [serverRate, serverConfig, serverCities] = await Promise.all([
    getPublicCbmRate(),
    getPublicCalculatorConfig(),
    getPublicCalculatorCities(),
  ]);
  const ciudades = serverCities.length > 0 ? serverCities : CIUDADES;

  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Tarifas", path: "/tarifas" },
        ]}
      />
      <WebPageJsonLd path="/tarifas" speakableSelectors={["#respuesta-rapida"]} />
      <main className="bg-paper min-h-screen">
        <section className="pt-10 lg:pt-14">
          <div className="wrap max-w-[1100px]">
            <span className="eyebrow">Tarifas</span>
            <h1
              className="h-display mt-4"
              style={{ fontSize: "clamp(30px, 4vw, 52px)" }}
            >
              Calcula tu envío,{" "}
              <span style={{ color: "var(--color-wine)" }}>China a tu puerta.</span>
            </h1>
            <p className="lead mt-5 max-w-[58ch]">
              Dos formas de traer tu carga por volumen (CBM):{" "}
              <b>puerta a puerta</b>, todo incluido hasta tu dirección, o{" "}
              <b>LCL consolidado</b>, hasta puerto y con tu propio Bill of Lading.
              Saca tu estimado al instante — la tarifa en firme la confirma un
              asesor por WhatsApp.
            </p>
          </div>
        </section>

        <section className="pt-8 pb-10 lg:pb-14">
          <div className="wrap max-w-[1100px]">
            <TarifasTabs
              serverRate={serverRate}
              serverConfig={serverConfig}
              ciudades={ciudades}
            />
          </div>
        </section>

        {/* Puente al cotizador de contenedor completo — no es la misma calc:
            el FCL vive en /fcl con su propio motor (SeaRates ocean-rate). */}
        <section className="pb-16 lg:pb-20">
          <div className="wrap max-w-[1100px]">
            <div className="rounded-[16px] border border-grey-200 bg-white px-5 py-4 lg:px-6 lg:py-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="flex-1 text-[14px] text-grey-700 leading-[1.5] m-0">
                <strong className="text-ink">
                  ¿Tu carga llena un contenedor?
                </strong>{" "}
                El flete de contenedor completo (FCL) se cotiza por ruta y tipo de
                contenedor, con su propia calculadora.
              </p>
              <Link href="/fcl" className="btn btn-ghost flex-shrink-0">
                Calcular flete FCL <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>

        <RespuestaRapida
          id="respuesta-rapida"
          pregunta="¿Cuánto cuesta traer mercancía de China a Venezuela?"
          respuesta="El envío marítimo de carga suelta se cobra por volumen (CBM). En la modalidad puerta a puerta el precio depende del volumen y de la ciudad de destino, e incluye flete, aduana, impuestos y entrega; en la modalidad LCL consolidado la carga viaja hasta puerto en Venezuela y te entregamos tu propio Bill of Lading, con la aduana e impuestos por cuenta del cliente. Calcula tu estimado al instante con la herramienta de arriba; la tarifa final la confirma un asesor por WhatsApp según el producto, el peso y el volumen reales."
        />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
