import type { ReactNode } from "react";

/**
 * Layout del grupo (auth) del back. Render minimalista — solo la card
 * centrada sobre fondo navy. Sin nav, sin sidebar, sin footer.
 *
 * Aplica a /back/login (y futuros /back/reset-password, etc.).
 */
export default function BackAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0F1E3D",
        padding: 20,
        fontFamily: "var(--font-archivo), Archivo, system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
