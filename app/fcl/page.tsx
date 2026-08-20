import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { WebPageJsonLd } from "@/components/WebPageJsonLd";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { CotizadorFletes } from "@/components/CotizadorFletes";

const DESC =
  "Calcula tu flete de contenedor completo (FCL) China → Venezuela al instante: elige ciudad/puerto de origen, destino y tipo de contenedor. Estimado referencial; el precio en firme lo cierra un asesor por WhatsApp.";

export const metadata: Metadata = {
  title: "Calculadora de flete FCL — contenedor completo China a Venezuela",
  description: DESC,
  keywords: [
    "flete FCL China Venezuela",
    "calculadora contenedor completo",
    "cotizar contenedor China",
    "flete marítimo 40 HC",
    "precio contenedor China Valencia",
  ],
  alternates: { canonical: "/fcl" },
  ...socialMeta({
    title: "Calculadora de flete FCL · DTD Cargo",
    description: DESC,
    path: "/fcl",
  }),
};

export default function FclCalcPage() {
  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Flete FCL", path: "/fcl" },
        ]}
      />
      <WebPageJsonLd path="/fcl" speakableSelectors={["#respuesta-rapida"]} />
      <main className="bg-paper min-h-screen">
        <section className="py-16 lg:py-24">
          <div className="wrap grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16 items-start">
            <div>
              <span className="eyebrow">Flete FCL</span>
              <h1
                className="h-display mt-5"
                style={{ fontSize: "clamp(34px, 5vw, 60px)" }}
              >
                Tu contenedor,
                <br />
                <span style={{ color: "var(--color-wine)" }}>China a tu puerto.</span>
              </h1>
              <p className="lead mt-6 max-w-[46ch]">
                Elige tu ciudad o puerto de origen en China y tu destino en Venezuela,
                y mira un flete estimado al instante. Es referencial; tu asesor lo
                cierra en firme con cupo y fecha.
              </p>
              <ul className="mt-8 flex flex-col gap-4 text-[15px] text-grey-700 list-none p-0">
                {[
                  ["Contenedor completo (FCL).", "Estimado al instante en 40' High Cube; otras medidas con tu asesor."],
                  ["Desde tu ciudad.", "Elige tu ciudad de China (Yiwu, Guangzhou, Shenzhen…) y calculamos desde su puerto."],
                  ["¿Puerta a puerta?", "El FCL todo pagado hasta tu puerta lo arma tu asesor por WhatsApp."],
                ].map(([t, d]) => (
                  <li key={t} className="flex items-start gap-3">
                    <span
                      className="mt-1.5 inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: "var(--color-wine)" }}
                      aria-hidden
                    />
                    <span>
                      <strong className="text-ink">{t}</strong> {d}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <CotizadorFletes />
          </div>
        </section>

        <RespuestaRapida
          id="respuesta-rapida"
          glosarioEnNuevaPestana
          pregunta="¿Cuánto cuesta un contenedor completo (FCL) de China a Venezuela?"
          respuesta="El flete de contenedor completo (FCL) se cotiza por contenedor y ruta (puerto de origen en China → puerto de destino en Venezuela) y tipo de contenedor (20', 40' o 40'HC). Saca un estimado referencial al instante con la herramienta de arriba; la tarifa en firme, con cupo y fecha, la confirma un asesor por WhatsApp. Si tu carga no llena un contenedor, se consolida por volumen (LCL)."
        />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
