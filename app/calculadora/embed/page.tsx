import type { Metadata } from "next";
import { Sora, Nunito_Sans } from "next/font/google";
import { jetbrainsMono } from "@/lib/fonts";
import { CalculadoraForm } from "@/components/CalculadoraForm";
import { CIUDADES } from "@/lib/calculadora";
import {
  getPublicCbmRate,
  getPublicCalculatorConfig,
  getPublicCalculatorCities,
} from "@/lib/public/rates-queries";

// Versión EMBEBIBLE de la calculadora CBM: solo el form (sin Nav/Footer/FAB),
// pensada para el iframe del FAB flotante del portal (ventana Norte
// arrastrable/redimensionable · PortalCalcFab). El framing SAMEORIGIN se habilita
// en next.config.ts (calcEmbedHeaders). Reusa exactamente los mismos datos y el
// mismo <CalculadoraForm> que /calculadora → cero divergencia de tarifa.
//
// Tema: hereda del portal por `?theme=dark|light` (lo pasa el FAB según
// data-portal-theme del shell). Se aplica SSR en el wrapper (data-portal-theme)
// → los tokens dark de globals.css cascadean al form, sin flash ni script.

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});
const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const revalidate = 300;

export const metadata: Metadata = {
  // Artefacto interno del portal: nunca en el índice.
  robots: { index: false, follow: false },
};

export default async function CalculadoraEmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const sp = await searchParams;
  const dark = sp.theme === "dark";

  const [serverRate, serverConfig, serverCities] = await Promise.all([
    getPublicCbmRate(),
    getPublicCalculatorConfig(),
    getPublicCalculatorCities(),
  ]);
  const ciudades = serverCities.length > 0 ? serverCities : CIUDADES;

  return (
    <div
      // data-portal-theme="dark" → globals.css redefine los --color-* (mismo
      // stylesheet global) y el form cascadea a oscuro. En claro no se pone el
      // atributo (tokens light por defecto).
      data-portal-theme={dark ? "dark" : undefined}
      // Glow de fondo (BD-030): glow radial tonal navy→ink (dark) / papel (claro)
      // en vez de fondo plano — da profundidad sin salir del sistema. Token
      // --bg-glow voltea por tema vía data-portal-theme (globals.css).
      className={`min-h-screen ${sora.variable} ${nunito.variable} ${jetbrainsMono.variable} calc-sys`}
      style={{ background: "var(--bg-glow)" }}
    >
      <div className="p-4">
        <CalculadoraForm
          serverRate={serverRate}
          serverConfig={serverConfig}
          ciudades={ciudades}
        />
      </div>
    </div>
  );
}
