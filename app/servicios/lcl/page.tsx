import type { Metadata } from "next";
import Link from "next/link";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ChipF2 } from "@/components/servicios/ChipF2";
import { serializeJsonLd } from "@/lib/public/json-ld";
import {
  FichaF2,
  SecF2,
  StepsF2,
  BenesF2,
  RulesF2,
  PriceF2,
} from "@/components/servicios/FichaF2";

const DESC =
  "Consolidado LCL China a Venezuela: llevamos tu carga consolidada hasta el puerto con tu propio BL, para que nacionalices la mercancía a nombre de tu empresa. Pensado para importadores.";

export const metadata: Metadata = {
  title: "Consolidado LCL — hasta puerto, con tu propio BL",
  description: DESC,
  alternates: { canonical: "/servicios/lcl" },
  keywords: [
    "consolidado LCL China Venezuela",
    "importar a nombre de empresa",
    "BL propio",
    "carga consolidada hasta puerto",
    "LCL Yiwu",
  ],
  ...socialMeta({
    title: "Consolidado LCL · DTD Cargo",
    description: DESC,
    path: "/servicios/lcl",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

const ctaHref = buildWhatsAppLink(
  "Hola DTD Cargo, quiero consultar la tarifa del Consolidado LCL hasta puerto.",
);

const servicioJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Consolidado LCL — China a Venezuela (hasta puerto)",
  serviceType: "LCL ocean freight consolidation (to port)",
  description: DESC,
  provider: { "@id": `${SITE_URL}/#organization` },
  areaServed: [
    { "@type": "Country", name: "Venezuela" },
    { "@type": "Country", name: "China" },
  ],
  url: `${SITE_URL}/servicios/lcl`,
};

export default function LclPage() {
  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(servicioJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Servicios", path: "/servicios" },
          { name: "Consolidado LCL", path: "/servicios/lcl" },
        ]}
      />
      <main className="svc-surface bg-paper">
        <section className="py-16 lg:py-24">
          <div className="wrap">
            <Link
              href="/servicios"
              className="inline-flex items-center gap-2 text-[13px] font-bold text-grey-500 hover:text-wine mb-6"
            >
              ← Todos los servicios
            </Link>

            <FichaF2
              chips={
                <>
                  <ChipF2>Otros servicios</ChipF2>
                  <ChipF2 variant="wine">Para empresas</ChipF2>
                  <ChipF2 variant="on">Activo</ChipF2>
                </>
              }
              hook="Legaliza tu importación a nombre de tu empresa."
              sub={
                <>
                  Traemos tu carga consolidada desde China hasta el puerto en
                  Venezuela y la ponemos a la orden para que la{" "}
                  <b>nacionalices a tu nombre</b>.
                </>
              }
              seal={{ top: "TU PROPIO BL", sub: "hasta puerto" }}
              route={{
                stops: [
                  { lb: "Bodega Yiwu", sb: "consolidamos" },
                  { lb: "Barco", sb: "vía marítima", mid: true },
                  { lb: "Puerto VE", sb: "almacén fiscal" },
                  { lb: "Tu destino", sb: "aduana · impuestos · flete", mid: true },
                ],
                segs: [true, true, false],
                cap: [
                  <b key="a">DTD: hasta el puerto</b>,
                  "de ahí en adelante: tú — o lo sumas con nosotros",
                ],
              }}
            >
              <SecF2 title="¿Qué es?">
                <p className="f2body">
                  Es nuestro servicio para <b>empresas e importadores</b> que quieren
                  legalizar la mercancía a su propio nombre. Llevamos tu carga por vía
                  marítima <b>hasta el puerto</b> en Venezuela — <b>con tu propio BL</b>{" "}
                  — y la entregamos a un <b>almacén fiscal</b> para que se haga el
                  trámite de nacionalización. A diferencia del <b>Puerta a Puerta</b>,
                  aquí <b>nuestro servicio y nuestro cobro llegan hasta el puerto</b>.
                </p>
              </SecF2>

              <SecF2 title="¿Cómo funciona?">
                <StepsF2
                  steps={[
                    <>
                      Lo solicitas en el portal, en <b>«Otros servicios»</b> (no va
                      dentro de la pre-alerta de compra).
                    </>,
                    <>
                      Consolidamos tu carga y la enviamos{" "}
                      <b>por barco hasta el puerto</b> en Venezuela.
                    </>,
                    <>
                      Entregamos tu mercancía a un <b>almacén fiscal</b> para el
                      trámite de legalización.
                    </>,
                    <>
                      <b>Tú gestionas</b> la aduana, los impuestos y el envío final a
                      tu destino — y si lo prefieres, puedes contratar{" "}
                      <b>con nosotros</b> el{" "}
                      <span className="hi">Tránsito de aduana y desaduanaje</span> y el{" "}
                      <span className="hi">transporte hasta tu destino</span> como
                      servicios adicionales.
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="¿Por qué te conviene?">
                <BenesF2
                  items={[
                    <>
                      <b>Importas formalmente</b> a nombre de tu empresa (soportes,
                      factura, mercancía legalizada).
                    </>,
                    <>
                      Ideal para <b>volúmenes comerciales</b> y compras recurrentes.
                    </>,
                    <>
                      Cuentas con nuestro equipo para <b>coordinar los terceros</b> de
                      aduana y transporte.
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="Reglas y condiciones">
                <RulesF2
                  items={[
                    <>
                      <b>Nuestro servicio y cobro llegan hasta el puerto.</b> De ahí en
                      adelante, los costos son por cuenta del cliente:{" "}
                      <b>almacén fiscal, aduana, impuestos y el envío final</b> a tu
                      destino o puerta.
                    </>,
                    <>
                      Se solicita en <b>«Otros servicios»</b>, no en la casilla de la
                      pre-alerta.
                    </>,
                    <>
                      Está pensado para <b>empresas</b> que legalizan a su nombre; si
                      quieres que nosotros nos encarguemos de todo hasta tu puerta con
                      los gastos incluidos, ese es el{" "}
                      <Link href="/servicios/puerta-a-puerta">Puerta a Puerta</Link>.
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="Precio" price>
                <PriceF2
                  text="Hasta puerto, según volumen (CBM) y peso."
                  sub="No incluye almacén fiscal, aduana, impuestos ni el transporte final."
                  ctaLabel="Consulta la tarifa con tu asesor"
                  ctaHref={ctaHref}
                />
              </SecF2>
            </FichaF2>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
