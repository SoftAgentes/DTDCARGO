/**
 * SDD-0184 · Fase 5 — /llenado, calculadora pública de llenado de contenedor.
 *
 * "Tengo N cajas y X CBM: ¿cuánto contenedor ocupo?" con el dibujo del reparto.
 * Mismo rol de captación que /tarifas y /calculadora-terrestre.
 *
 * FRONTERA: el motor viene de `lib/shared/estiba-plan`, el único puente
 * público↔ERP permitido. Esta página no importa nada del Studio.
 */

import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { LlenadoCalculator } from "@/components/LlenadoCalculator";

const TITULO = "¿Cuánto contenedor ocupa tu carga?";
const DESCRIPCION =
  "Calcula cuánto de un contenedor de 20' o 40' High Cube ocupa tu mercancía y mira en qué parte quedaría. Solo necesitas las cajas y el CBM.";

export const metadata: Metadata = {
  title: "Calculadora de llenado de contenedor",
  description: DESCRIPCION,
  alternates: { canonical: "/llenado" },
  ...socialMeta({
    title: `${TITULO} · DTD Cargo`,
    description: DESCRIPCION,
    path: "/llenado",
  }),
};

export default function LlenadoPage() {
  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Llenado de contenedor", path: "/llenado" },
        ]}
      />
      <main
        className="rp-surface min-h-screen"
        style={{ ["--rp-w" as string]: "760px" }}
      >
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Llenado
            </div>
            <h1>
              ¿Cuánto contenedor <span className="accent">ocupa tu carga?</span>
            </h1>
            <p className="rp-body">
              Pon tus cajas y su CBM y mira cuánto de un contenedor ocupas, y en qué
              parte quedaría cada cosa. Es la misma lógica que usamos en el galpón
              para saber dónde está la mercancía de cada cliente sin tener que bajar
              el contenedor entero.
            </p>
          </div>
        </section>

        <section className="rp-body" style={{ paddingBottom: 48 }}>
          <LlenadoCalculator />

          <div style={{ marginTop: 28 }}>
            <h2 style={{ font: "800 20px/1.3 inherit", margin: "0 0 10px" }}>
              ¿Y si no sé mi CBM?
            </h2>
            <p style={{ margin: 0, font: "500 15px/1.7 inherit", opacity: 0.85 }}>
              El CBM sale de multiplicar largo × ancho × alto de una caja en metros, y
              luego por la cantidad de cajas. Si tienes las medidas en centímetros,
              divide entre un millón. En{" "}
              <a href="/tarifas" style={{ color: "var(--color-wine)", fontWeight: 700 }}>
                nuestra calculadora de tarifas
              </a>{" "}
              lo haces sin sacar la cuenta a mano.
            </p>
          </div>
        </section>
      </main>
      <WhatsAppFAB />
      <Footer />
    </>
  );
}
