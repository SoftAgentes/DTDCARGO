import type { Metadata } from "next";
import Link from "next/link";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ChipF2 } from "@/components/servicios/ChipF2";
import { svcHref } from "@/components/servicios/svcHref";
import { serializeJsonLd } from "@/lib/public/json-ld";
import {
  FichaF2,
  SecF2,
  StepsF2,
  BenesF2,
  RulesF2,
  PriceF2,
  XrefF2,
  RepmockF2,
} from "@/components/servicios/FichaF2";

const DESC =
  "Inspección de calidad en China antes de embarcar: pre-embarque (PSI) con muestreo AQL en la fábrica de tu proveedor, contra tu ficha técnica. Reporte DTD con fotos y resultados, en español.";

export const metadata: Metadata = {
  title: "Inspección de calidad en China",
  description: DESC,
  alternates: { canonical: "/servicios/inspeccion" },
  keywords: [
    "inspección en China",
    "control de calidad",
    "inspección pre-embarque",
    "PSI",
    "AQL",
    "inspección en Yiwu",
  ],
  ...socialMeta({
    title: "Inspección de calidad en China · DTD Cargo",
    description: DESC,
    path: "/servicios/inspeccion",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

const ctaHref = buildWhatsAppLink(
  "Hola DTD Cargo, quiero cotizar una Inspección de calidad en fábrica (PSI) en China.",
);

/** Service (schema.org) — white-label: solo DTD como proveedor. */
const servicioJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Inspección de calidad en fábrica (PSI / AQL) — China",
  serviceType: "Pre-shipment quality inspection",
  description: DESC,
  provider: { "@id": `${SITE_URL}/#organization` },
  areaServed: { "@type": "Country", name: "China" },
  url: `${SITE_URL}/servicios/inspeccion`,
};

export default function InspeccionPage() {
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
          { name: "Inspección en China", path: "/servicios/inspeccion" },
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
              capa="origen"
              chips={
                <>
                  <ChipF2 variant="wine">Se pide aparte — antes del embarque</ChipF2>
                  <ChipF2>Activo</ChipF2>
                </>
              }
              hook="Revisa tu pedido en la fábrica, antes de que embarque."
              sub={
                <>
                  Verificamos tu producto contra la ficha técnica{" "}
                  <b>cuando todavía hay tiempo de corregir</b> — no cuando ya cruzó el
                  océano.
                </>
              }
              seal={{ top: "PSI · AQL", sub: "reporte DTD · en español" }}
              route={{
                stops: [
                  { lb: "Producción lista", sb: "pedido terminado" },
                  { lb: "Agendamos", sb: "visita en fábrica" },
                  { lb: "Inspección AQL", sb: "contra tu ficha técnica" },
                  { lb: "Reporte DTD", sb: "decides antes de embarcar" },
                ],
                segs: [true, true, true],
                cap: [
                  <span key="a">
                    <b>EN FÁBRICA, antes de embarcar</b> — no es la inspección al
                    recibir
                  </span>,
                  "reporte DTD en ~7 días hábiles",
                ],
              }}
            >
              <SecF2 title="¿Qué es?">
                <p className="f2body">
                  La inspección pre-embarque (PSI): cuando tu pedido está terminado, lo
                  revisamos <b>en la fábrica de tu proveedor</b> contra tu{" "}
                  <b>ficha técnica</b> — cantidades, funcionamiento, acabado y empaque
                  — con muestreo bajo norma <b>AQL</b>. Recibes un{" "}
                  <b>reporte DTD con fotos y resultados, en español</b>, para decidir
                  con información clara antes de pagar el saldo o autorizar el embarque.
                </p>
                <RepmockF2
                  title="Inspección de Producto (PSI / AQL)"
                  sub="DTD Cargo · fotos + resultados · en español"
                />
                <XrefF2>
                  <b>No es la Inspección de calidad al recibir</b> (esa se hace en
                  nuestra bodega, cuando la mercancía ya llegó). Esta se hace{" "}
                  <b>en la fábrica del proveedor, antes de embarcar</b>.
                </XrefF2>
              </SecF2>

              <SecF2 title="¿Cómo funciona?">
                <StepsF2
                  steps={[
                    <>
                      Nos pasas por WhatsApp tu{" "}
                      <b>producto con su ficha técnica</b> y cotizas con tu asesor.
                    </>,
                    <>
                      <b>Coordinamos en China:</b> confirmamos la fecha y agendamos la
                      visita en la fábrica de tu proveedor.
                    </>,
                    <>
                      <b>Inspeccionamos en fábrica:</b> el pedido terminado se verifica
                      contra la ficha técnica y el estándar acordado (muestreo AQL).
                    </>,
                    <>
                      Recibes el{" "}
                      <b>reporte DTD con fotos y resultados, en español</b>.
                    </>,
                    <>
                      Con el resultado decides: pagar el saldo y embarcar, o reclamarle
                      al proveedor <b>a tiempo</b>.
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="¿Por qué te conviene?">
                <BenesF2
                  items={[
                    <>
                      Descubres defectos <b>antes de pagar el saldo o embarcar</b>,
                      cuando el proveedor todavía tiene que responder.
                    </>,
                    <>
                      No compras a ciegas: fotos y resultados de <b>tu pedido real</b>,
                      no de la muestra que te enseñaron.
                    </>,
                    <>
                      Un solo socio: la misma empresa que trae tu carga{" "}
                      <b>controla su calidad en origen</b>.
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="Reglas y condiciones">
                <RulesF2
                  items={[
                    <>
                      Necesitamos tu <b>ficha técnica</b> (especificaciones, medidas,
                      materiales, empaque): sin ella no hay contra qué inspeccionar.
                    </>,
                    <>
                      Pídela <b>con anticipación</b>, cuando el pedido esté por
                      terminarse: la visita se agenda antes del embarque.
                    </>,
                    <>
                      <b>No es la Inspección de calidad al recibir:</b> esa se hace en
                      nuestra bodega cuando la mercancía ya llegó. Esta se hace{" "}
                      <b>en la fábrica del proveedor, antes de embarcar</b>.
                    </>,
                    <>
                      ¿Tu producción apenas comienza? Mira{" "}
                      <a href={svcHref("auditoria-de-calidad")}>
                        Auditoría y control de calidad
                      </a>{" "}
                      (revisión durante la producción).
                    </>,
                    <>
                      Agendamos la visita en fábrica y entregamos el{" "}
                      <b>reporte DTD en ~7 días hábiles</b>.
                    </>,
                  ]}
                />
              </SecF2>

              <SecF2 title="Precio" price>
                <PriceF2
                  text="Consulta la tarifa vigente con tu asesor."
                  sub="Te comparte también un ejemplo del reporte."
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
