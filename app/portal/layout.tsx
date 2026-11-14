import type { Metadata } from "next";
import { sora, nunitoSans } from "@/lib/fonts";
// SDD-0603 · tramo 3: claridad de controles, solo bajo `.portal-sys` (BD-037).
import "./claridad.css";

/**
 * Layout raíz de la 5ª superficie: Portal del Cliente (SDD-0042).
 *
 * Tipografía de CAPA SISTEMA (Norte v2.4): **Sora** (display) + **Nunito Sans**
 * (cuerpo) — igual que el ERP/portal del Norte. El resto del sitio público sigue
 * en Archivo. Las fuentes vienen del repositorio (`lib/fonts.ts`, SDD-0505: el
 * build ya no las baja de Google) y exponen `--font-sora` /
 * `--font-nunito`; el wrapper `.portal-sys` (ver `globals.css`) redefine las
 * variables que ya usan los componentes del portal (`--font-archivo` /
 * `--font-archivo-black`) para que toda la superficie migre sin tocar JSX.
 * Mono (JetBrains) y CJK quedan igual.
 *
 * `robots: noindex` — área autenticada de cliente, no marketing.
 *
 * **PWA propia del cliente.** `public/portal/manifest.json` (scope `/portal`)
 * es independiente del de operarios (`public/m/manifest.json`, scope `/m`,
 * "DTD Operario"): otra app, otra audiencia, otro ícono. Declararlo acá y no
 * en el layout raíz lo mantiene fuera del sitio público — la metadata de Next
 * sólo baja por el árbol, así que `/`, `/servicios` y compañía siguen sin
 * `<link rel="manifest">`. `appleWebApp` es lo que hace que iOS respete el
 * nombre y abra en standalone al "Agregar a pantalla de inicio" (sin eso el
 * cliente se lleva un marcador con una captura de pantalla por ícono).
 */
export const metadata: Metadata = {
  title: {
    default: "Portal del Cliente",
    template: "%s · Portal DTD Cargo",
  },
  manifest: "/portal/manifest.json",
  applicationName: "DTD Cargo",
  appleWebApp: {
    capable: true,
    // El shell del portal nace en tema oscuro (`data-portal-theme="dark"` en
    // `(app)/layout.tsx`) y la barra lateral es navy: `black-translucent` deja
    // que el contenido suba hasta el notch en vez de cortar con una franja.
    statusBarStyle: "black-translucent",
    title: "DTD Cargo",
    startupImage: ["/portal/icon-512.png"],
  },
  icons: {
    // Sólo `apple`: el favicon del tab lo sigue poniendo el layout raíz (los
    // mismos 16/32/.ico de todo el sitio). Lo que cambia acá es el ícono del
    // home screen de iOS, que tiene que ser el del portal y opaco — iOS no
    // renderiza transparencia y pintaría el fondo de negro.
    apple: [
      { url: "/portal/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  // Legacy iOS < 13 espera `apple-mobile-web-app-capable` además del moderno
  // `mobile-web-app-capable` que Next genera por defecto (mismo criterio que
  // `app/m/layout.tsx`).
  other: {
    "apple-mobile-web-app-capable": "yes",
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
