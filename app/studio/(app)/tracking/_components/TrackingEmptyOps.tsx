/**
 * TrackingEmptyOps — empty state cuando no hay embarques activos (SDD-0013).
 */

import Link from "next/link";

export function TrackingEmptyOps() {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "2px dashed var(--border-strong)",
        borderRadius: 12,
        padding: "64px 28px",
        textAlign: "center",
      }}
    >
      <div
        className="studio-eyebrow"
        style={{ color: "var(--ink-soft)", marginBottom: 10 }}
      >
        Operación · en vivo
      </div>
      <div
        className="studio-display"
        style={{ fontSize: 26, color: "var(--ink)", marginBottom: 10 }}
      >
        Sin envíos en curso.
      </div>
      <p
        style={{
          font: "400 14px/1.55 var(--f-sans)",
          color: "var(--ink-soft)",
          maxWidth: "56ch",
          margin: "0 auto 20px",
        }}
      >
        Cuando crees un embarque o avance un draft a bodega, vas a ver acá
        su posición estimada y los próximos hitos operativos.
      </p>
      <Link
        href="/studio/tracking/nuevo"
        className="studio-btn studio-btn-primary"
      >
        + Envío
      </Link>
    </div>
  );
}
