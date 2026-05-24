/**
 * Badge del servicio comercial (4 productos DTD).
 *
 * Convencion de marca: "Puerta a Puerta DDP" siempre con "prepago" en chico.
 *
 * Refactor visual (post-audit gráfico):
 *   - Primary subido a 12px (era 11px) para mejor ratio jerárquico vs sub.
 *   - Sub mantenido a 9px con letter-spacing 0.04em (más legible).
 *   - Background más definido (rgba ink 0.05) para mejor lectura.
 */

import { SERVICE_LABELS, type ShipmentService } from "@/lib/studio/shipment-types";

export function ServiceBadge({ service }: { service: ShipmentService }) {
  const { primary, sub } = SERVICE_LABELS[service];

  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        padding: "6px 10px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 5,
        lineHeight: 1,
      }}
    >
      <span style={{ font: "700 12px/1.1 var(--f-sans)", color: "var(--ink)" }}>
        {primary}
      </span>
      {sub && (
        <span
          style={{
            font: "500 9px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 3,
            letterSpacing: "0.04em",
          }}
        >
          {sub}
        </span>
      )}
    </span>
  );
}
