"use client";

/**
 * Encabezado «Administración» (SDD-0708).
 *
 * Solo se pinta en `/studio/admin`. En las subrutas (`/studio/admin/ia`, `/rutas`, …) cada página trae su propio
 * `h1`: repetir «Administración» arriba daría dos títulos por pantalla. El menú lateral ya dice dónde está uno.
 */
import { usePathname } from "next/navigation";

export function AdminHeader() {
  const pathname = (usePathname() ?? "/studio/admin").replace(/\/+$/, "");
  if (pathname !== "/studio/admin") return null;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
          Configuración · Studio
        </div>
        <h1
          className="studio-display"
          style={{ fontSize: 28, margin: "0 0 6px", color: "var(--ink)", letterSpacing: "-0.01em" }}
        >
          Administración
        </h1>
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "72ch" }}>
          Configuración global del Studio. Solo accesible para rol Admin.
        </p>
      </div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "var(--bg-elevated)",
          color: "var(--ink)",
          borderRadius: "var(--r-pill)",
          font: "700 11px/1 var(--f-sans)",
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ink-soft)" }} />
        Acceso restringido · Admin
      </span>
    </header>
  );
}
