import type { Metadata } from "next";
import { TarifasTabs } from "@/components/TarifasTabs";
import { CIUDADES } from "@/lib/calculadora";
import {
  getPublicCbmRate,
  getPublicCalculatorConfig,
  getPublicCalculatorCities,
} from "@/lib/public/rates-queries";

// Versión EMBEBIBLE de la calculadora CBM/LCL (Puerta a Puerta + Consolidado)
// para el iframe del FAB del portal (PortalCalcFab, ventana Norte). Solo el
// form: sin Nav/Footer/FAB. El framing SAMEORIGIN se habilita en next.config.ts
// (calcEmbedHeaders → /tarifas/embed). Reusa <TarifasTabs> → cero divergencia
// con /tarifas. Fuente Archivo.
//
// Tema: hereda del portal por `?theme=dark|light` (lo pasa el FAB según
// data-portal-theme del shell); se aplica SSR en el wrapper.

export const revalidate = 300;

export const metadata: Metadata = {
  // Artefacto interno del portal: nunca en el índice.
  robots: { index: false, follow: false },
};

export default async function TarifasEmbedPage({
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
      // data-portal-theme="dark" → globals.css redefine los --color-* y el form
      // cascadea a oscuro. En claro no se pone el atributo (tokens light).
      data-portal-theme={dark ? "dark" : undefined}
      className="min-h-screen"
      style={{ background: "var(--bg-glow)" }}
    >
      <div className="p-4">
        <TarifasTabs
          serverRate={serverRate}
          serverConfig={serverConfig}
          ciudades={ciudades}
        />
      </div>
    </div>
  );
}
