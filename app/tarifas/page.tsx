import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { WebPageJsonLd } from "@/components/WebPageJsonLd";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { TarifasTabs } from "@/components/TarifasTabs";
import { CIUDADES } from "@/lib/calculadora";
import {
  getPublicCbmRate,
  getPublicCalculatorConfig,
  getPublicCalculatorCities,
} from "@/lib/public/rates-queries";

// ISR 300s como red de seguridad; las actions de /studio/tarifas hacen
// revalidatePath("/tarifas") para actualizar la tarifa pública casi al instante.
export const revalidate = 300;

const DESC =
  "Calcula tu envío China → Venezuela al instante: LCL por volumen (CBM) puerta a puerta DDP, o FCL de contenedor completo. Sin registro. El precio en firme lo cierra un asesor por WhatsApp.";

export const metadata: Metadata = {
  title: "Tarifas y calculadora de envíos (LCL · FCL)",
  description: DESC,
  keywords: [
    "calculadora envío China Venezuela",
    "tarifa CBM China Venezuela",
    "cotizar LCL DDP",
    "flete FCL contenedor China",
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
            <p className="lead mt-5 max-w-[56ch]">
              Dos formas de traer tu carga: <b>carga suelta (LCL)</b> por volumen,
              puerta a puerta y todo incluido, o <b>contenedor completo (FCL)</b>.
              Saca tu estimado al instante — la tarifa en firme la confirma un asesor
              por WhatsApp.
            </p>
          </div>
        </section>

        <section className="pt-8 pb-16 lg:pb-20">
          <div className="wrap max-w-[1100px]">
            <TarifasTabs
              serverRate={serverRate}
              serverConfig={serverConfig}
              ciudades={ciudades}
            />
          </div>
        </section>

        <RespuestaRapida
          id="respuesta-rapida"
          pregunta="¿Cuánto cuesta traer mercancía de China a Venezuela?"
          respuesta="El envío marítimo se cobra por volumen (CBM) y ciudad de destino en la modalidad LCL puerta a puerta, todo incluido (flete, aduana e impuestos); si tu carga llena un contenedor, la modalidad FCL se cotiza por contenedor y ruta. Calcula tu estimado al instante con la herramienta de arriba; la tarifa final la confirma un asesor por WhatsApp según el producto, el peso y el volumen reales."
        />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
