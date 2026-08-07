/**
 * Layout del namespace `/acceso/*` · página pública para recuperar el acceso
 * al Studio (SDD-0250).
 *
 * Vive FUERA de `/studio` a propósito, igual que `/invitar`: quien llega acá no
 * tiene sesión —crear una es justamente el punto— y el proxy rebota todo
 * `/studio/**` sin sesión al login. Colgarla de `/studio` obligaría a abrirle
 * un hueco al gate; mejor que no lo toque.
 *
 * Importa `studio.css` (trae tokens.css) para que los `var(--*)` y las clases
 * `.studio-btn` resuelvan; sin eso el form queda sin estilo (mismo hallazgo que
 * en `/invitar` y `/m`).
 */

import type { Metadata } from "next";
import "@/app/studio/studio.css";

export const metadata: Metadata = {
  title: "Recupera tu acceso · DTD Studio",
  description: "Crea tu contraseña para entrar al Studio de DTD Cargo.",
  robots: { index: false, follow: false },
};

export default function AccesoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
