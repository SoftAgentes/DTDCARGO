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
import { sora, nunitoSans } from "@/lib/fonts";

/**
 * Tipografía de CAPA SISTEMA (Norte): **Sora** (títulos) + **Nunito Sans**
 * (cuerpo) — igual que el portal/calculadora. Decisión founder 2026-06-11:
 * alinear el Studio ERP con su propia fuente de diseño (el Norte). Las fuentes
 * vienen del repositorio (`lib/fonts.ts`, SDD-0505) y exponen `--font-sora` / `--font-nunito`; el wrapper
 * `.studio-sys` (ver `globals.css`) redefine las variables que ya consumen los
 * componentes (`--font-archivo` / `--font-archivo-black` / `--font-sans`) para
 * que toda la superficie migre sin tocar JSX. El wordmark `<BrandMark>` NO migra
 * (usa `--font-brand-display`, inmune). Mono (JetBrains) y CJK (Noto SC) igual.
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
      <div className={`${sora.variable} ${nunitoSans.variable} studio-sys`}>
        {children}
      </div>
    </>
  );
}
