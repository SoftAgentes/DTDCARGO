/**
 * Layout raíz del Studio (DTD Cargo).
 *
 * Wrapping mínimo: solo importa los estilos del Studio.
 * El <html> y <body> los provee app/layout.tsx (el root del sitio).
 *
 * Los route groups (auth) y (app) tienen sus propios sub-layouts.
 *
 * Script inline de FOUC: aplica tema y densidad antes del primer paint. Por defecto,
 * oscuro y compacto (BD-037), salvo que la persona haya elegido otra cosa.
 *
 * Los paneles que viven dentro de Chatwoot no reciben ni tema ni densidad: siguen a
 * Chatwoot (SDD-0603). Lo impreso pasa a claro por CSS, en `tokens.css`.
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
  var h = document.documentElement;
  var p = location.pathname;
  if (p.indexOf('/studio/ficha-chat') !== 0 && p.indexOf('/studio/cerrar-chat') !== 0) {
    if (localStorage.getItem('studio_theme') !== 'light') h.setAttribute('data-theme', 'dark');
    var d = localStorage.getItem('studio_density');
    if (d === 'spacious') h.setAttribute('data-density', 'spacious');
    else if (d !== 'normal') h.setAttribute('data-density', 'compact');
  }
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
