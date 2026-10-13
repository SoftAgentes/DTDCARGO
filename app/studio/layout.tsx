/**
 * Layout raíz del Studio (DTD Cargo).
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

/**
 * Tipografía: desde SDD-0505 (decisión de Sam del 2026-10-13) el Studio usa
 * **Archivo** + **Archivo Black** como todo el sitio; Sora + Nunito Sans (BD-035,
 * 2026-06-11) salieron. Las fuentes las carga el layout raíz desde el repositorio
 * (`lib/fonts.ts`). El wrapper `.studio-sys` se conserva por sus estilos de
 * superficie; ya no remapea la tipografía (ver `globals.css`).
 */
export const metadata: Metadata = {
  title: {
    template: "%s · DTD Studio",
    default: "DTD Studio",
  },
  description: "Backend interno de DTD Cargo.",
  robots: {
    index: false,
    follow: false,
  },
};

const THEME_FOUC_SCRIPT = `
try {
  var t = localStorage.getItem('studio_theme');
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  var d = localStorage.getItem('studio_density');
  if (d === 'compact' || d === 'spacious') document.documentElement.setAttribute('data-density', d);
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
      <div className="studio-sys">
        {children}
      </div>
    </>
  );
}
