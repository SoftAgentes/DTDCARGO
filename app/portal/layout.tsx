import type { Metadata } from "next";
import { Sora, Nunito_Sans } from "next/font/google";

/**
 * Layout raíz de la 5ª superficie: Portal del Cliente (SDD-0042).
 *
 * Tipografía de CAPA SISTEMA (Norte v2.4): **Sora** (display) + **Nunito Sans**
 * (cuerpo) — igual que el ERP/portal del Norte. El resto del sitio público sigue
 * en Archivo. Cargamos las fuentes acá (next/font) y exponemos `--font-sora` /
 * `--font-nunito`; el wrapper `.portal-sys` (ver `globals.css`) redefine las
 * variables que ya usan los componentes del portal (`--font-archivo` /
 * `--font-archivo-black`) para que toda la superficie migre sin tocar JSX.
 * Mono (JetBrains) y CJK quedan igual.
 *
 * `robots: noindex` — área autenticada de cliente, no marketing.
 */
const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

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
  return (
    <div className={`${sora.variable} ${nunitoSans.variable} portal-sys`}>
      {children}
    </div>
  );
}
