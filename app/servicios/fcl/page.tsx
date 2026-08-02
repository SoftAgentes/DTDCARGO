import type { Metadata } from "next";
import Link from "next/link";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ChipF2 } from "@/components/servicios/ChipF2";
import {
  FichaF2,
  SecF2,
  StepsF2,
  BenesF2,
  RulesF2,
  XrefF2,
  VersusF2,
  VscardF2,
  CtaF2,
} from "@/components/servicios/FichaF2";

const DESC =
  "FCL contenedor completo China a Venezuela: en bodega (MOD A) o directo fábrica (MOD B, con el BL emitido por DTD). Recibe todo pagado hasta tu puerta o hasta puerto para desaduanizar tú. 40–55 días.";

export const metadata: Metadata = {
  title: "FCL — Contenedor completo, solo para tu carga",
  description: DESC,
  alternates: { canonical: "/servicios/fcl" },
  keywords: [
    "FCL China Venezuela",
    "contenedor completo",
    "FCL directo fábrica",
    "BL emitido por DTD",
    "contenedor 40 HC",
    "reserva de contenedor",
  ],
  ...socialMeta({
    title: "FCL — Contenedor completo · DTD Cargo",
    description: DESC,
    path: "/servicios/fcl",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

const ctaAsesor = buildWhatsAppLink(
  "Hola DTD Cargo, quiero cotizar un FCL (contenedor completo).",
);

const servicioJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "FCL — Contenedor completo China a Venezuela",
  serviceType: "FCL ocean freight (full container load)",
  description: DESC,
  provider: { "@id": `${SITE_URL}/#organization` },
  areaServed: [
    { "@type": "Country", name: "Venezuela" },
    { "@type": "Country", name: "China" },
  ],
  url: `${SITE_URL}/servicios/fcl`,
};

// Iconos inline (trazados del mockup)
function HomeIc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11l8-7.5 8 7.5" />
      <path d="M6 9.3V20.5h12V9.3" />
    </svg>
  );
}
function AnchorIc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M12 7.5V21M8.5 10h7M4 13a8 8 0 0 0 16 0" />
    </svg>
  );
}

const RECEPCION_STEP = (
  <>
    En Venezuela recibes según tu <b>modalidad de recepción</b>: <b>todo pagado</b> →
    nacionalizamos y te entregamos en tu puerta (pagas antes de la entrega) ·{" "}
    <b>hasta puerto</b> → el contenedor llega al puerto que elegiste y desaduanizas tú
    (o sumas nuestro Tránsito de aduana como adicional).
  </>
);

export default function FclPage() {
  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicioJsonLd).replace(/</g, "\\u003c") }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Servicios", path: "/servicios" },
          { name: "FCL — Contenedor completo", path: "/servicios/fcl" },
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
                  <ChipF2 variant="wine">carga: 2 modalidades</ChipF2>
                  <ChipF2 variant="wine">recepción: puerta o puerto</ChipF2>
                  <ChipF2 variant="on">Activo</ChipF2>
                </>
              }
              hook="Un contenedor completo, solo para tu carga."
              sub={
                <>
                  Si tu volumen llena un contenedor, viaja solo, sin esperar la
                  próxima salida consolidada. Y si compras directo a la fábrica, el{" "}
                  <b>BL lo emitimos nosotros — no la fábrica</b>: tu proveedor{" "}
                  <b>no puede desviar, parar ni cambiar el contenedor</b>.
                </>
              }
              seal={{ top: "EL BL LO EMITE DTD", sub: "no la fábrica" }}
              route={{
                stops: [
                  { lb: "Bodega o fábrica", sb: "según modalidad" },
                  { lb: "Barco", sb: "40–55 días", mid: true },
                  { lb: "Puerto VE", sb: "contenedor completo" },
                  { lb: "Puerta o puerto", sb: "tú eliges la recepción" },
                ],
                segs: [true, true, false],
                cap: [
                  <b key="a">Sin compartir espacio con nadie</b>,
                  "más rápido que la salida consolidada",
                ],
              }}
            >
              <SecF2 title="¿Qué es?">
                <p className="f2body">
                  Es nuestro servicio de <b>contenedor completo (FCL)</b>: reservamos
                  el contenedor y el buque con la naviera y tu mercancía viaja sola,
                  sin compartir espacio con otros clientes. Lo ofrecemos en{" "}
                  <b>dos modalidades</b>, según dónde se cargue el contenedor:
                </p>
                <VersusF2>
                  <VscardF2 tag="MOD A" title="FCL Consolidado en bodega">
                    Compras a <b>muchos proveedores</b> y todos entregan en nuestra{" "}
                    <b>bodega de Yiwu</b>. Recibimos la mercancía, la preparamos y{" "}
                    <b>cargamos el contenedor completo en la bodega</b>, con el despacho
                    de exportación en China y la reserva del contenedor y el flete
                    incluidos.
                  </VscardF2>
                  <VscardF2 hero tag="MOD B" title="FCL Directo fábrica">
                    Compras <b>directo a tu proveedor</b> (uno o dos fabricantes) y el
                    contenedor <b>se carga en su fábrica</b>, sin pasar por nuestra
                    bodega. Nosotros ponemos el contenedor: hacemos la reserva con la
                    naviera y coordinamos la carga. Lo más importante: el{" "}
                    <b>Bill of Lading (BL) lo emitimos nosotros — no la fábrica</b>:
                    nuestra empresa en China aparece como <b>exportador (shipper)</b> y
                    tú como <b>consignatario (quien recibe)</b>. La fábrica no tiene
                    control sobre el BL: tu proveedor{" "}
                    <b>no puede cambiar el destino ni desviar el contenedor</b>.
                    Nosotros enviamos, tú recibes.
                  </VscardF2>
                </VersusF2>
                <p className="f2body" style={{ margin: "var(--s-5) 0 0" }}>
                  <b>En Venezuela, tú eliges cómo recibir:</b>
                </p>
                <VersusF2>
                  <VscardF2 hero icon={<HomeIc />} title="FCL todo pagado — hasta tu puerta">
                    Cubrimos <b>todo el camino</b>: aduana, impuestos y la{" "}
                    <b>entrega en tu puerta</b>. Pagas <b>antes de la entrega</b> — sin
                    sorpresas.
                  </VscardF2>
                  <VscardF2 icon={<AnchorIc />} title="FCL hasta puerto — tú desaduanizas">
                    Te enviamos el contenedor <b>al puerto que elijas</b>; la
                    desaduanización <b>corre por tu cuenta</b> (o sumas nuestro{" "}
                    <b>Tránsito de aduana</b> como servicio adicional). El{" "}
                    <b>flete lo pagas tú</b>, de dos formas: <b>durante el tránsito</b>{" "}
                    (el BL se entrega al completar el pago) o <b>adelantado</b>.
                  </VscardF2>
                </VersusF2>
                <XrefF2>
                  <b>¿Tu carga no llena un contenedor?</b> Mira el{" "}
                  <Link href="/servicios/puerta-a-puerta">Puerta a Puerta</Link> (hasta
                  tu puerta, todo pagado) o el{" "}
                  <Link href="/servicios/lcl">Consolidado LCL</Link> (empresas, hasta
                  puerto con tu propio BL).
                </XrefF2>
              </SecF2>

              <SecF2 title="¿Cómo funciona?">
                <div className="f2cols">
                  <div>
                    <div className="f2col-h">
                      <span className="k">MOD A</span>Consolidado en bodega
                    </div>
                    <StepsF2
                      steps={[
                        <>Cotizas tu contenedor con tu asesor y confirmas la reserva.</>,
                        <>
                          Tus <b>proveedores entregan</b> su mercancía en nuestra
                          bodega en Yiwu.
                        </>,
                        <>
                          Recibimos, preparamos y{" "}
                          <b>cargamos el contenedor completo</b> en la bodega.
                        </>,
                        <>
                          Hacemos el <b>despacho de exportación</b> en China y el
                          contenedor embarca.
                        </>,
                        RECEPCION_STEP,
                      ]}
                    />
                  </div>
                  <div>
                    <div className="f2col-h">
                      <span className="k">MOD B</span>Directo fábrica
                    </div>
                    <StepsF2
                      steps={[
                        <>
                          Cierras tu compra <b>directo con el fabricante</b>.
                        </>,
                        <>
                          Nosotros <b>reservamos el contenedor y el buque</b> con la
                          naviera.
                        </>,
                        <>
                          <b>Coordinamos la carga</b> del contenedor en la fábrica de
                          tu proveedor.
                        </>,
                        <>
                          <b>Emitimos el BL</b> — DTD como <b>exportador (shipper)</b>,
                          tú como <b>consignatario (quien recibe)</b> — y el contenedor
                          embarca.
                        </>,
                        RECEPCION_STEP,
                      ]}
                    />
                  </div>
                </div>
              </SecF2>

              <SecF2 title="¿Por qué te conviene?">
                <BenesF2
                  items={[
                    <>
                      <b>Más rápido:</b> al ser contenedor completo, no espera la
                      próxima salida consolidada (tránsito aproximado:{" "}
                      <b>40–55 días</b>).
                    </>,
                    <>
                      <b>Tú decides hasta dónde llegamos:</b> todo pagado hasta tu
                      puerta (aduana e impuestos incluidos), o hasta puerto para
                      desaduanizar tú.
                    </>,
                    <>
                      <b>Solo tu mercancía:</b> nadie comparte el contenedor contigo.
                    </>,
                    <>
                      <b>Seguridad en el directo fábrica:</b> el BL lo emite DTD, no la
                      fábrica — el proveedor{" "}
                      <b>no puede desviar, retener ni redirigir</b> tu contenedor.
                      Nosotros enviamos, tú recibes.
                    </>,
                    <>
                      <b>Un solo equipo de principio a fin:</b> propio en China (Yiwu) y
                      Venezuela (Valencia).
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="Reglas y condiciones">
                <RulesF2
                  items={[
                    <>
                      En la <b>modalidad todo pagado</b>, el precio cubre{" "}
                      <b>aduana, impuestos y la entrega hasta tu puerta</b>; el pago se
                      completa <b>antes de la entrega</b>.
                    </>,
                    <>
                      En la <b>modalidad hasta puerto</b>, la desaduanización{" "}
                      <b>corre por tu cuenta</b> (o sumas nuestro Tránsito de aduana
                      como servicio adicional) y el flete se paga{" "}
                      <b>durante el tránsito</b> — el BL se entrega al completar el pago
                      — o <b>adelantado</b>.
                    </>,
                    <>
                      En la <b>Modalidad A</b>, el almacenaje en la bodega de Yiwu es{" "}
                      <b>gratis los primeros 7 días</b>; después aplica un costo
                      adicional.
                    </>,
                    <>
                      En la <b>Modalidad B</b>, el contenedor se carga en la fábrica
                      (uno o dos fabricantes) y <b>no pasa por nuestra bodega</b>.
                    </>,
                    <>
                      La tarifa depende de la <b>ruta</b> (puerto de origen en China →
                      puerto de destino en Venezuela), el <b>tipo de contenedor</b>{" "}
                      (20′, 40′ o 40′HC) y la disponibilidad de la naviera.
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="Precio" price>
                <div className="f2price-row">
                  <div className="tx">
                    Tarifa cerrada por contenedor, según la ruta y el tipo de
                    contenedor.
                    <small>La tarifa final la confirma tu asesor.</small>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <CtaF2 label="Saca tu estimado al instante" href="/fcl" />
                    <CtaF2 label="Cotizar con tu asesor" href={ctaAsesor} ghost />
                  </div>
                </div>
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
