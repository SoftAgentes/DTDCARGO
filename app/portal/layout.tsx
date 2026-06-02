import type { Metadata } from "next";

/**
 * Layout raíz de la 5ª superficie: Portal del Cliente (SDD-0042).
 *
 * Solo aporta metadata compartida (noindex — es un área autenticada de cliente,
 * no marketing) y delega el render a los grupos `(auth)` (login/callback) y
 * `(app)` (autenticado, con su propio guard + header). Hereda el root layout
 * (`app/layout.tsx`): globals.css + fuentes de marca (Archivo). NO usa el
 * sistema del Studio (tokens.css/studio.css).
 */
export const metadata: Metadata = {
  title: {
    default: "Portal del Cliente",
    template: "%s · Portal DTD Cargo",
  },
  robots: { index: false, follow: false, nocache: true },
};

export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
