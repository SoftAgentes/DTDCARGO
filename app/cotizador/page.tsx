import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { CotizadorClient } from "./CotizadorClient";

/**
 * SDD-0473 · El cotizador público: subes tu proforma y tu packing list, y te
 * decimos cuánto cuesta traer eso a Venezuela.
 *
 * Es una pantalla NUEVA y aparte. La calculadora de `/tarifas` no se toca: ahí
 * el visitante escribe sus propios metros cúbicos, acá los saca de sus archivos.
 * Las dos terminan en el mismo motor (`calcularEnvioLCL`, del lado del servidor),
 * así que no pueden decir dos precios distintos para un mismo envío.
 *
 * La bandera `DOCUMENT_IMPORT_ENABLED` es el interruptor de seguridad: apagada,
 * esta ruta no existe. Se lee por petición (`force-dynamic`) y no en el build,
 * porque si no habría que redeployar para apagarla.
 */

const DESC =
  "Sube tu factura proforma y tu packing list: leemos productos, cajas, peso y volumen, te dejamos corregir lo que haga falta y te decimos cuánto cuesta traerlo de China a Venezuela, puerta a puerta. Sin registro. El precio en firme lo cierra un asesor por WhatsApp.";

export const metadata: Metadata = {
  title: "Cotizador con tus documentos (proforma y packing list)",
  description: DESC,
  alternates: { canonical: "/cotizador" },
  ...socialMeta({
    title: "Cotiza con tu proforma y tu packing list · DTD Cargo",
    description: DESC,
    path: "/cotizador",
  }),
};

export const dynamic = "force-dynamic";

export default function CotizadorPage() {
  if (process.env.DOCUMENT_IMPORT_ENABLED !== "true") notFound();

  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Cotizador", path: "/cotizador" },
        ]}
      />
      {/* Mismo armazón `rp-*` que /calculadora-terrestre: superficie de recursos
          ya revestida al Norte, sin dirección visual nueva para esta pantalla. */}
      <main
        className="rp-surface min-h-screen"
        style={{ ["--rp-w" as string]: "920px" }}
      >
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Cotizador con documentos
            </div>
            <h1>
              Sube tus archivos <span className="accent">y te decimos cuánto cuesta.</span>
            </h1>
            <p>
              Tu proveedor te mandó la factura proforma y el packing list. Súbelos
              acá: leemos productos, cajas, peso y volumen, te mostramos lo que
              entendimos para que lo corrijas, y calculamos el puerta a puerta
              hasta tu ciudad. No hace falta que transcribas nada.
            </p>
          </div>
        </section>

        <div className="rp-body">
          <div className="rp-card">
            <CotizadorClient />
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
