import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { buildOfferCatalog, isOfferable } from "@/lib/seo-offer-catalog";
import { getServiciosParaSitio } from "@/lib/public/servicios-queries";
import { SvpBand, type SvpPrincipal } from "@/components/servicios/SvpBand";
import { SvpMoments, type SvpMoment } from "@/components/servicios/SvpMoments";
import { HubRouter } from "@/components/servicios/HubRouter";
import { HUB_FICHAS } from "@/components/servicios/hub-fichas";

const SERVICE_META_DESC =
  "Servicios entre Yiwu y Valencia: puerta a puerta DDP, LCL, FCL, aduana, inspección, sourcing, registro de marca, visado y transporte terrestre.";

export const metadata: Metadata = {
  title: "Servicios",
  description: SERVICE_META_DESC,
  alternates: { canonical: "/servicios" },
  ...socialMeta({
    title: "Servicios · DTD Cargo",
    description: SERVICE_META_DESC,
    path: "/servicios",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/* ── Portada "el viaje" · copy transcrito del mockup Cloud Design ──────────
   Los 3 principales + la ficha de inspección enlazan a rutas reales; el resto
   de los items quedan en anclas provisionales `#svc/...` (se completan en la
   próxima pasada, cuando se construyan las fichas restantes). Los servicios
   "Próximamente" van deshabilitados (soon) — no clicables. */

const PRINCIPALES: SvpPrincipal[] = [
  {
    nm: "Puerta a Puerta",
    star: true,
    href: "/servicios/puerta-a-puerta",
    role: (
      <>
        Marítimo hasta la puerta de tu casa o negocio, <b>todo pagado</b>:
        nosotros nacionalizamos y pagamos los gastos del camino.
      </>
    ),
  },
  {
    nm: "Consolidado LCL",
    href: "/servicios/lcl",
    role: (
      <>
        Carga compartida hasta el puerto, <b>con tu propio BL</b>. Para empresas
        que legalizan a su nombre.
      </>
    ),
  },
  {
    nm: "FCL — Contenedor completo",
    href: "/servicios/fcl",
    role: (
      <>
        Solo tu carga: en bodega o directo fábrica. Recibes <b>todo pagado</b>{" "}
        (hasta tu puerta) <b>o hasta puerto</b> (tú desaduanizas).
      </>
    ),
  },
];

const MOMENTOS: SvpMoment[] = [
  {
    n: "01",
    t: "Origen",
    loc: "China · antes del embarque",
    items: [
      // Ficha de inspección en China → ruta real existente.
      { nm: "Inspección de calidad en fábrica", href: "/servicios/inspeccion" },
      { nm: "Verificación de proveedores", href: "#svc/verificacion-de-proveedores" },
      { nm: "Auditoría y control de calidad", href: "#svc/auditoria-de-calidad" },
      { nm: "Lab testing y permisología", href: "#svc/lab-testing" },
      { nm: "Compra asistida", href: "#svc/compra-asistida" },
      { nm: "Pago asistido", href: "#svc/pago-asistido" },
    ],
  },
  {
    n: "02",
    t: "Recepción en bodega",
    loc: "Yiwu · tu pre-alerta",
    items: [
      {
        nm: "Pre-alerta de compra",
        small: "Sin costo — es tu orden",
        href: "#svc/pre-alerta",
      },
      {
        nm: "Validación · verifica y valida al recibir",
        href: "#svc/validacion",
      },
      { nm: "Inspección de calidad al recibir", href: "#svc/inspeccion-al-recibir" },
      { nm: "Etiquetado de piezas", href: "#svc/etiquetado-de-piezas" },
      { nm: "HOLD — retener para consolidar", href: "#svc/hold" },
      { nm: "Re-Empaque", href: "#svc/re-empaque" },
    ],
  },
  {
    n: "03",
    t: "Transporte + Aduana",
    loc: "CN → VE",
    items: [
      { nm: "Puerta a Puerta", href: "/servicios/puerta-a-puerta" },
      { nm: "Consolidado LCL", href: "/servicios/lcl" },
      { nm: "FCL — Contenedor completo", href: "/servicios/fcl" },
      {
        nm: "Tránsito de aduana y desaduanaje",
        small: "documentación incluida",
        href: "#svc/transito-de-aduana",
      },
      { nm: "Envío aéreo", soon: true },
      { nm: "Transporte terrestre", soon: true },
      { nm: "Seguro de carga", soon: true },
    ],
  },
  {
    n: "04",
    t: "En cualquier punto",
    loc: "Transversales",
    items: [
      { nm: "Courier de muestras y documentos", href: "#svc/courier-de-muestras" },
      { nm: "Visado de negocios chino", href: "#svc/visado-de-negocios" },
      { nm: "Registro de marca en China", href: "#svc/registro-de-marca" },
      { nm: "Cursos de importación", soon: true },
    ],
  },
];

export default async function ServiciosPage() {
  // Servicios publicados en la DB (fallback estático). Solo se usan para el
  // OfferCatalog (schema.org) — la IA/Google leen el catálogo aunque la portada
  // sea el mapa visual "el viaje".
  const servicios = await getServiciosParaSitio();

  const serviciosJsonLd = {
    "@context": "https://schema.org",
    ...buildOfferCatalog({
      servicios: servicios.filter(isOfferable),
      siteUrl: SITE_URL,
      provider: { "@id": `${SITE_URL}/#organization` },
    }),
  };

  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviciosJsonLd).replace(/</g, "\\u003c") }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Servicios", path: "/servicios" },
        ]}
      />
      <main>
        {/* Hub hash-routed: portada "el viaje" ↔ fichas por #svc/<slug>.
            Todas las fichas quedan en el DOM (SEO/GEO); el HubRouter solo
            muestra la activa. */}
        <HubRouter
          fichas={HUB_FICHAS}
          portada={
            <>
              <section className="py-16 lg:py-24 bg-paper">
                <div className="wrap">
                  {/* Encabezado del viaje */}
                  <div className="max-w-[820px]">
                    <span className="eyebrow">Servicios</span>
                    <h1
                      className="h-display mt-5"
                      style={{ fontSize: "clamp(34px, 5vw, 60px)" }}
                    >
                      Un servicio para cada{" "}
                      <span style={{ color: "var(--color-wine)" }}>
                        momento del viaje.
                      </span>
                    </h1>
                    <p className="lead mt-6 max-w-[62ch]">
                      <b>Esto viaja con nosotros</b> (los tres principales).{" "}
                      <b>Esto se pide dentro de tu pre-alerta</b> (la llegada a
                      bodega). Y <b>esto se contrata aparte</b>, antes o fuera de
                      la carga. Toca cualquier servicio para ver su ficha
                      completa.
                    </p>
                  </div>

                  {/* Los 3 principales */}
                  <SvpBand items={PRINCIPALES} />

                  {/* Los 4 momentos del viaje */}
                  <SvpMoments moments={MOMENTOS} />
                </div>
              </section>

              <RespuestaRapida
                pregunta="¿Qué servicios ofrece DTD Cargo para importar de China a Venezuela?"
                respuesta="DTD Cargo lleva tu mercancía puerta a puerta de China a Venezuela en modalidad DDP —flete, aduana e impuestos incluidos— con consolidación e inspección en su bodega propia de Yiwu. Sobre esa base ofrece servicios complementarios: verificación de proveedores, compra asistida, control de calidad, laboratorio y permisología, registro de marca, visado de negocios, documentos de importación, desaduanaje y entrega final (last mile)."
              />
            </>
          }
        />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
