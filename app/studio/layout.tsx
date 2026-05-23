/**
 * Layout raíz del Studio (DoorTuDoor).
 *
 * Wrapping mínimo: solo importa los estilos del Studio.
 * El <html> y <body> los provee app/layout.tsx (el root del sitio).
 *
 * Los route groups (auth) y (app) tienen sus propios sub-layouts.
 */

import "./studio.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · DTD Studio",
    default: "DTD Studio · DoorTuDoor",
  },
  description: "Backend interno de DTD·CARGO.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
