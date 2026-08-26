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
  XrefF2,
} from "@/components/servicios/FichaF2";

const DESC =
  "Puerta a Puerta de China a Venezuela: marítimo todo pagado hasta tu puerta. Nosotros consolidamos, embarcamos, nacionalizamos y entregamos — pagas al llegar. Cotiza por volumen (CBM) y peso.";

export const metadata: Metadata = {
  title: "Puerta a Puerta — de China a tu puerta, todo pagado",
  description: DESC,
  alternates: { canonical: "/servicios/puerta-a-puerta" },
  keywords: [
    "puerta a puerta China Venezuela",
    "importar de China DDP",
    "todo pagado hasta tu puerta",
    "nacionalización incluida",
    "flete marítimo China Venezuela",
    "consolidado Yiwu",
  ],
  ...socialMeta({
    title: "Puerta a Puerta · DTD Cargo",
    description: DESC,
    path: "/servicios/puerta-a-puerta",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

const ctaHref = buildWhatsAppLink(
  "Hola DTD Cargo, quiero consultar la tarifa del servicio Puerta a Puerta.",
);

/** Service (schema.org) — white-label: solo DTD como proveedor, sin terceros. */
const servicioJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Puerta a Puerta — China a Venezuela",
  serviceType: "Freight forwarding (DDP door-to-door)",
  description: DESC,
  provider: { "@id": `${SITE_URL}/#organization` },
  areaServed: [
    { "@type": "Country", name: "Venezuela" },
    { "@type": "Country", name: "China" },
  ],
  url: `${SITE_URL}/servicios/puerta-a-puerta`,
};

export default function PuertaAPuertaPage() {
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
          { name: "Puerta a Puerta", path: "/servicios/puerta-a-puerta" },
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
                  <ChipF2>Servicio principal</ChipF2>
                  <ChipF2 variant="on">Activo</ChipF2>
                </>
              }
              hook="Un solo precio, hasta tu puerta."
              sub={
                <>
                  Traemos tu mercancía desde China hasta la puerta de tu casa o
                  negocio en Venezuela, sin que tengas que lidiar con{" "}
                  <b>puertos, aduanas ni intermediarios</b>.
                </>
              }
              seal={{ top: "PAGAS AL LLEGAR", sub: "nada de sorpresas" }}
              route={{
                stops: [
                  { lb: "Bodega Yiwu", sb: "tu proveedor entrega" },
                  { lb: "Barco", sb: "60–90 días", mid: true },
                  { lb: "Puerto VE", sb: "nacionalizamos", mid: true },
                  { lb: "Tu puerta", sb: "Venezuela" },
                ],
                segs: [true, true, true],
                cap: [
                  <b key="a">DTD se encarga de todo el camino</b>,
                  "incluida la nacionalización",
                ],
              }}
            >
              <SecF2 title="¿Qué es?">
                <p className="f2body">
                  Es nuestro servicio principal: llevamos tu compra{" "}
                  <b>desde que tu proveedor la entrega en nuestra bodega en Yiwu</b>{" "}
                  hasta tu dirección en Venezuela por vía marítima. Tú compras,{" "}
                  <b>nosotros nos encargamos de todo el camino</b> — incluida la{" "}
                  <b>nacionalización</b> y el pago de gastos hasta tu puerta{" "}
                  <span className="aclr">(por eso decimos «todo pagado»)</span>.
                </p>
                <XrefF2>
                  <b>
                    ¿Necesitas legalizar la mercancía a nombre de tu empresa?
                  </b>{" "}
                  Ese es otro servicio aparte: el{" "}
                  <Link href="/servicios/lcl">Consolidado LCL hasta puerto</Link>{" "}
                  (se pide en «Otros servicios», no en la pre-alerta), pensado
                  para empresas. Ahí llegamos hasta el puerto y tú manejas aduana
                  e impuestos.
                </XrefF2>
              </SecF2>

              <SecF2 title="¿Cómo funciona?">
                <StepsF2
                  steps={[
                    <>
                      <b>Compras en China</b> y avisas tu compra en el portal
                      (pre-alerta). Recibes un enlace para tu proveedor.
                    </>,
                    <>
                      Tu <b>proveedor</b> entrega la mercancía en nuestra bodega
                      en Yiwu y la etiqueta con el código que genera el sistema.
                    </>,
                    <>
                      Recibimos, revisamos y <b>consolidamos</b> tu carga con la
                      de otros clientes para que el flete te salga más barato.
                    </>,
                    <>
                      Tu carga <b>viaja por barco</b> hasta Venezuela{" "}
                      <span className="hi">(tránsito estimado: 60–90 días)</span>.
                    </>,
                    <>
                      <b>Nacionalizamos</b> y te la llevamos <b>hasta tu puerta</b>.
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="¿Por qué te conviene?">
                <BenesF2
                  items={[
                    <>
                      <b>Pagas al llegar</b>: nada de sorpresas en el camino.
                    </>,
                    <>
                      <b>Un solo canal de comunicación</b> de principio a fin — no
                      coordinas con tres empresas distintas.
                    </>,
                    <>
                      Equipo propio en <b>China (Yiwu)</b> y{" "}
                      <b>Venezuela (Valencia)</b>.
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="Reglas y condiciones">
                <RulesF2
                  items={[
                    <>
                      Se cotiza según <b>volumen (CBM) y peso</b> de tu carga.
                      Consulta la tarifa vigente con tu asesor o usa la{" "}
                      <b>calculadora</b> en la web. Tarifa especial para cargas{" "}
                      <b>desde 10 CBM</b> (con asesor).
                    </>,
                    <>
                      En un grupo de ciudades la{" "}
                      <b>entrega final va incluida</b>; en el resto del país el
                      tramo nacional se cobra <b>por metro cúbico</b>, según el
                      volumen de tu carga y no según la distancia. Lo estimas en
                      la <b>calculadora</b> antes de comprometerte.
                    </>,
                    <>
                      <b>Carga especial</b> (peligrosa / sobredimensionada) tiene
                      costo extra — consúltalo con tu asesor.
                    </>,
                    <>
                      El servicio <b>no incluye seguro de carga</b>.
                    </>,
                    <>
                      La identificación correcta de cada compra (
                      <b>Shipping Mark</b>) corre por cuenta del cliente — por eso
                      existe la pre-alerta.
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="Precio" price>
                <PriceF2
                  text="Según volumen y peso de tu carga."
                  sub="Consulta la tarifa vigente con tu asesor o en la calculadora de la web."
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
