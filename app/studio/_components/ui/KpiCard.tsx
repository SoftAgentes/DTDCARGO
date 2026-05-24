/**
 * KpiCard primitive · DTD Studio (SDD-0014)
 *
 * Card con valor grande + label uppercase + sub-line opcional.
 * Border-top wine-soft 2px cuando value > 0 (convención visual del dashboard).
 *
 * Reusa tokens del sistema, light + dark theme aware.
 */

import type { CSSProperties, ReactNode } from "react";

interface KpiCardProps {
  value: number | string;
  label: string;
  /** Texto secundario debajo del label (ej: "8 enviadas · 3 aceptadas"). */
  sub?: ReactNode;
  /** Color del valor (default var(--ink)). Útil para diferenciar tonos
   *  semánticos: success/warning/danger/wine. */
  valueColor?: string;
  /** Si false, no muestra border-top wine-soft aunque value > 0. */
  highlightWhenPositive?: boolean;
  style?: CSSProperties;
}

export function KpiCard({
  value,
  label,
  sub,
  valueColor = "var(--ink)",
  highlightWhenPositive = true,
  style,
}: KpiCardProps) {
  const isPositive =
    typeof value === "number"
      ? value > 0
      : typeof value === "string" && value !== "0" && value !== "—" && value !== "";

  const showHighlight = highlightWhenPositive && isPositive;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderTop: showHighlight ? "2px solid var(--wine-soft)" : "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "18px 20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...style,
      }}
    >
      <div
        style={{
          font: "900 30px/1 var(--f-display)",
          color: valueColor,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          font: "600 11.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            font: "500 11px/1.4 var(--f-sans)",
            color: "var(--ink-mute)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
