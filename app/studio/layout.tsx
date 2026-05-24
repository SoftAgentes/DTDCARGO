/**
 * Layout raíz del Studio (DoorTuDoor).
 *
 * Wrapping mínimo: solo importa los estilos del Studio.
 * El <html> y <body> los provee app/layout.tsx (el root del sitio).
 *
 * Los route groups (auth) y (app) tienen sus propios sub-layouts.
 *
 * Script inline de FOUC: aplica `data-theme="dark"` antes del primer paint
 * cuando localStorage.studio_theme === "dark". Evita parpadeo light → dark.
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

const THEME_FOUC_SCRIPT = `
try {
  var t = localStorage.getItem('studio_theme');
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
} catch (e) {}
`.trim();

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_FOUC_SCRIPT }} />
      {children}
    </>
  );
}
