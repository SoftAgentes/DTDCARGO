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
import { PwaRegister } from "./_components/PwaRegister";
import { ToastProvider } from "@/app/studio/_components/ui/ToastProvider";

export const metadata: Metadata = {
  title: {
    template: "%s · DTD Operario",
    default: "DTD Operario",
  },
  description: "App de recepción de mercadería · DTD Cargo",
  manifest: "/m/manifest.json",
  applicationName: "DTD Operario",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DTD Operario",
    startupImage: ["/m/icon-512.png"],
  },
  icons: {
    icon: [
      { url: "/m/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/m/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/m/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
  // Legacy iOS < 13 espera `apple-mobile-web-app-capable` además del
  // moderno `mobile-web-app-capable` que Next genera por defecto.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  robots: {
    index: false,
    follow: false,
  },
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
      <PwaRegister />
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
