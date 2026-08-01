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
import { ArrowIcon } from "@/components/Icon";
// Nombre visible de los servicios: fuente ÚNICA desde SDD-0164 — nunca se
// escribe la etiqueta a mano en la página.
import { SERVICE_LABELS } from "@/lib/shared/shipment-public";
import {
  getPublicCbmRate,
  getPublicCalculatorConfig,
  getPublicCalculatorCities,
  getPublicCarrierTariffs,
  combinarDestinos,
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
  const [serverRate, serverConfig, serverCities, serverTariffs] = await Promise.all([
    getPublicCbmRate(),
    getPublicCalculatorConfig(),
    getPublicCalculatorCities(),
    getPublicCarrierTariffs(),
  ]);
  // El precio de la entrega nacional lo manda la DB; si la RPC no devuelve
  // nada, combinarDestinos cae al respaldo de lib/data/destinos-nacionales
  // (SDD-0237) y la calculadora sigue cobrando bien.
  const ciudades = combinarDestinos(serverCities, serverTariffs);

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
      {/* Revestido al Norte (`Tarifas · DTD-Cargo.html`): banda navy +
          las TRES tarjetas de modalidad que el mockup abre antes de la
          calculadora y que producción no tenía. */}
      <main
        className="rp-surface min-h-screen"
        style={{ ["--rp-w" as string]: "1180px" }}
      >
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Tarifas vigentes China → Venezuela
            </div>
            <h1>
              Calcula tu envío,{" "}
              <span className="accent">China a tu puerta.</span>
            </h1>
            <p>
              Dos formas de traer tu carga por volumen (CBM):{" "}
              <b>puerta a puerta</b>, todo incluido hasta tu dirección, o{" "}
              <b>LCL consolidado</b>, hasta puerto y con tu propio Bill of Lading.
              Saca tu estimado al instante — la tarifa en firme la confirma un
              asesor por WhatsApp.
            </p>
          </div>
        </section>

        {/* Modalidades — bloque del mockup. Los nombres de servicio salen de
            SERVICE_LABELS (lib/shared/shipment-public.ts), nunca a mano.
            tf-modalidades = banda navy full-bleed (mismo patrón rp-hero/
            rp-hero-in: el fondo va en la sección exterior, el max-width en
            el div interior) — continúa el rp-hero sin costura. */}
        <section className="tf-modalidades">
          <div className="rp-body" style={{ paddingBottom: "var(--s-10)" }}>
          <div className="tf-cards">
            <article className="tf-card feat">
              <span className="tf-badge">El más solicitado</span>
              <span className="tf-mod">
                Marítimo
                <b className="tf-svc">
                  {SERVICE_LABELS.puerta_a_puerta_DDP.primary}
                </b>
              </span>
              <ul className="tf-feats">
                <li>
                  Flete, impuestos arancelarios y entrega final en un solo precio
                </li>
                <li>Un solo canal de comunicación, de punta a punta</li>
                <li>Pagas al llegar a Venezuela</li>
              </ul>
              <a href="#calculadora" className="btn btn-primary">
                Calculadora
              </a>
            </article>

            <article className="tf-card">
              <span className="tf-badge b-warning">El segundo más solicitado</span>
              <span className="tf-mod">
                Marítimo
                <b className="tf-svc">
                  <span className="tf-ac">LCL</span> consolidado
                </b>
              </span>
              <ul className="tf-feats">
                <li>Consolidamos tu carga con la de otros importadores</li>
                <li>Nuestro precio incluye hasta el puerto · Almacén Fiscal</li>
                <li>Te apoyamos con el resto del trámite de terceros</li>
                <li>Válido para cargas comerciales, con fines empresariales</li>
              </ul>
              <a href="#calculadora" className="btn btn-ghost">
                Calculadora LCL
              </a>
            </article>

            <article className="tf-card">
              <span className="tf-badge b-success">El tercero más solicitado</span>
              <span className="tf-mod">
                Marítimo
                <b className="tf-svc">
                  <span className="tf-ac">FCL</span> contenedor
                </b>
              </span>
              <p className="tf-pnote">
                Tipos de contenedor frecuentes · 20&apos; / 40&apos; HQ
              </p>
              <ul className="tf-feats">
                <li>Contenedor completo para ti, puerta a puerta (DDP)</li>
                <li>Ideal para alto volumen o carga de un solo cliente</li>
                <li>Un asesor arma tu cotización a medida</li>
                <li>
                  Tarifa a estudiar según tu factura y los aranceles aduanales,
                  por eso no la fijamos aquí
                </li>
              </ul>
              <Link href="/fcl" className="btn btn-ghost">
                Calcular flete FCL <ArrowIcon size={16} />
              </Link>
            </article>
          </div>
          </div>
        </section>

        <section id="calculadora" className="pt-8 pb-10 lg:pb-14 scroll-mt-24">
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
