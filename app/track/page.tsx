import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { TrackInput } from "@/components/TrackInput";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { WebPageJsonLd } from "@/components/WebPageJsonLd";

export const metadata: Metadata = {
  title: "Rastrear envío",
  description:
    "Ingresa tu BL o código DTDU y consulta el estado en tiempo real de tu envío DTD Cargo. Sin registro, sin fricción.",
  alternates: { canonical: "/track" },
  ...socialMeta({
    title: "Rastrear envío · DTD Cargo",
    description:
      "Ingresa tu BL o código DTDU y consulta el estado en tiempo real de tu envío DTD Cargo. Sin registro, sin fricción.",
    path: "/track",
  }),
};

export default function TrackPage() {
  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Rastrear envío", path: "/track" },
        ]}
      />
      {/* WebPage + speakable (GEO): marca el bloque "Respuesta rápida" como citable. */}
      <WebPageJsonLd path="/track" speakableSelectors={["#respuesta-rapida"]} />
      <main className="min-h-[70vh]">
        <section className="py-16 lg:py-24 bg-ink text-white">
          <div className="wrap max-w-[720px]">
            <span className="eyebrow" style={{ color: "rgba(255,255,255,0.5)" }}>
              Rastreo en vivo
            </span>
            <h1
              className="h-display mt-5"
              style={{
                color: "white",
                fontSize: "clamp(40px, 6vw, 80px)",
              }}
            >
              ¿Dónde está
              <br />
              <span style={{ color: "var(--color-wine-soft)" }}>tu envío?</span>
            </h1>
            <p
              className="text-[17px] leading-[1.55] mt-6 max-w-[48ch]"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Ingresa tu BL (Bill of Lading) o tu código DTDU.
              Eventos en tiempo real, sin registro, sin fricción.
            </p>
            <div className="mt-8">
              <TrackInput />
            </div>
            <p className="mt-6 text-[13px] text-white/50">
              ¿No tienes tu código?{" "}
              <a
                href="/contacto"
                className="underline hover:text-wine-soft"
              >
                Escríbenos
              </a>{" "}
              y te lo buscamos en menos de 1 hora.
            </p>
          </div>
        </section>

        <RespuestaRapida
          id="respuesta-rapida"
          pregunta="¿Cómo rastreo mi carga de China a Venezuela?"
          respuesta="Ingresa tu BL (Bill of Lading) o tu código DTDU en el rastreador y verás el estado de tu envío en tiempo real, sin registrarte. Si no tienes el código a mano, escríbenos por WhatsApp con tu Shipping Mark y un asesor te ubica el envío."
        />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
