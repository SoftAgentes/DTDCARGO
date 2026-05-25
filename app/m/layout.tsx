/**
 * Layout raíz del namespace mobile `/m/*` (PWA del operario CN).
 *
 * Independiente del Studio: NO incluye sidebar, NO requiere auth Supabase
 * regular (el operario entra con PIN custom — SDD-0027 pendiente).
 *
 * Importa los tokens del Studio (`tokens.css` via `studio.css`) para
 * tener la misma paleta brand. Define viewport mobile-first +
 * theme-color = ink navy para el browser chrome.
 */

import type { Metadata, Viewport } from "next";
import "@/app/studio/studio.css";
import "./m.css";

export const metadata: Metadata = {
  title: {
    template: "%s · DTD Operario",
    default: "DTD Operario · DoorTuDoor",
  },
  description: "App de recepción de mercadería · DTD·CARGO",
  robots: {
    index: false,
    follow: false,
  },
  // Manifest viene en una iteración futura (SDD-0028 PWA install).
  // manifest: "/m/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0F1E3D",
  viewportFit: "cover",
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="m-root" data-theme="light">
      {children}
    </div>
  );
}
