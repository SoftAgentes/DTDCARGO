"use client";

/**
 * Barra de utilización CBM%/kg% del contenedor (SDD-0047, Slice B).
 *
 * No hay primitiva Progress en el repo → se construye simple con un track (div)
 * + un fill (div) cuyo width = min(pct, 100)% y cuyo color sale de un TOKEN:
 *   - var(--success) cuando < 80%   (sano)
 *   - var(--warning) cuando 80–100% (casi lleno)
 *   - var(--wine)    cuando > 100%  (sobre-capacidad · advisory §4.4)
 *
 * Solo tokens CSS var(--*), cero hex. El % puede pasar 100 (lo clampea el width
 * pero el color wine + el número avisan la sobre-capacidad).
 */

export function utilizationTone(pct: number): string {
  if (pct > 100) return "var(--wine)";
  if (pct >= 80) return "var(--warning)";
  return "var(--success)";
}

export function UtilizationBar({
  pct,
  height = 10,
}: {
  pct: number;
  height?: number;
}) {
  const safePct = Number.isFinite(pct) ? Math.max(0, pct) : 0;
  const width = Math.min(100, safePct);
  const tone = utilizationTone(safePct);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(safePct)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: "100%",
        height,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-pill)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${width}%`,
          height: "100%",
          background: tone,
          borderRadius: "var(--r-pill)",
          transition: "width var(--dur) var(--ease)",
        }}
      />
    </div>
  );
}
