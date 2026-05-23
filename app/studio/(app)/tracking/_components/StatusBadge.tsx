/**
 * Badge del estado del envio.
 *
 * Refactor visual (post-audit gráfico):
 *   - Bordes más fuertes (alpha 40% en vez de 20%) para confidence visual.
 *   - Background ligeramente más fuerte (12% en vez de 8%).
 *   - Text color full (mantiene WCAG contrast adecuado).
 *
 * Status colors siguen la regla post-G1: wine queda fuera, ink/verde/dorado/rojo/gris.
 */

import { STATUS_COLORS, STATUS_LABELS, type ShipmentStatus } from "@/lib/studio/shipment-types";

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 11px",
        background: `${color}1F`,             // ~12% alpha (era ~8%)
        color,
        border: `1px solid ${color}66`,        // ~40% alpha (era ~20%)
        borderRadius: 4,
        font: "700 10.5px/1 Archivo, sans-serif",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
