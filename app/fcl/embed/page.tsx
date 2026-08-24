import type { Metadata } from "next";
import { FclCalculator } from "@/components/FclCalculator";
import { getPublicFclRoutes } from "@/lib/public/rates-queries";

// Versión EMBEBIBLE del cotizador FCL (contenedor completo) para el iframe del
// FAB del portal (PortalCalcFab). Solo el form: sin Nav/Footer/FAB. El framing
// SAMEORIGIN se habilita en next.config.ts (calcEmbedHeaders → /fcl/embed).
// Reusa <FclCalculator> → cero divergencia con /fcl. Fuente Archivo.
//
// Tema: hereda del portal por `?theme=dark|light` (lo pasa el FAB según
// data-portal-theme del shell); se aplica SSR en el wrapper.

export const metadata: Metadata = {
  // Artefacto interno del portal: nunca en el índice.
  robots: { index: false, follow: false },
};

// Mismo ISR que /fcl: el embed no puede quedarse con tarifas más viejas que la
// página, o el cliente ve dos precios distintos según por dónde entre.
export const revalidate = 300;

export default async function FclEmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const [sp, routes] = await Promise.all([searchParams, getPublicFclRoutes()]);
  const dark = sp.theme === "dark";

  return (
    <div
      data-portal-theme={dark ? "dark" : undefined}
      className="min-h-screen"
      style={{ background: "var(--bg-glow)" }}
    >
      <div className="p-4">
        <FclCalculator routes={routes} />
      </div>
    </div>
  );
}
