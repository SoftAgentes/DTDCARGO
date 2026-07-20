import type { Metadata } from "next";
import { CotizadorFletes } from "@/components/CotizadorFletes";

// Versión EMBEBIBLE del cotizador FCL (contenedor completo) para el iframe del
// FAB del portal (PortalCalcFab). Solo el form: sin Nav/Footer/FAB. El framing
// SAMEORIGIN se habilita en next.config.ts (calcEmbedHeaders → /fcl/embed).
// Reusa <CotizadorFletes> → cero divergencia con /fcl. Fuente Archivo.
//
// Tema: hereda del portal por `?theme=dark|light` (lo pasa el FAB según
// data-portal-theme del shell); se aplica SSR en el wrapper.

export const metadata: Metadata = {
  // Artefacto interno del portal: nunca en el índice.
  robots: { index: false, follow: false },
};

export default async function FclEmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const sp = await searchParams;
  const dark = sp.theme === "dark";

  return (
    <div
      data-portal-theme={dark ? "dark" : undefined}
      className="min-h-screen"
      style={{ background: "var(--bg-glow)" }}
    >
      <div className="p-4">
        <CotizadorFletes />
      </div>
    </div>
  );
}
