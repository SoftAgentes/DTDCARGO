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
  /**
   * KPI DESTACADO (BD-034): relleno degradado vino + marca de agua "D" (isotipo
   * mono-light, wallpaper) + texto cream. Para el KPI primario del dashboard.
   */
  feature?: boolean;
  style?: CSSProperties;
}

export function KpiCard({
  value,
  label,
  sub,
  valueColor = "var(--ink)",
  highlightWhenPositive = true,
  feature = false,
  style,
}: KpiCardProps) {
  const isPositive =
    typeof value === "number"
      ? value > 0
      : typeof value === "string" && value !== "0" && value !== "—" && value !== "";

  const showHighlight = highlightWhenPositive && isPositive;

  // En feature el texto va sobre el vino → cream (AA). El valor mantiene su color
  // salvo que sea feature (ahí va cream/blanco para leer sobre el degradado).
  const valColor = feature ? "var(--ink-inv)" : valueColor;
  const labelColor = feature ? "var(--ink-inv)" : "var(--ink)";
  const subColor = feature ? "var(--ink-inv-soft)" : "var(--ink-soft)";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: feature ? "var(--grad-wine)" : "var(--grad-card)",
        border: feature ? "1px solid transparent" : "1px solid var(--border)",
        borderTop: feature
          ? "1px solid transparent"
          : showHighlight
            ? "2px solid var(--wine-soft)"
            : "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-5)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: feature ? "0 12px 32px -14px rgba(127,15,26,0.6)" : undefined,
        ...style,
      }}
    >
      {feature && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: "-18%",
            bottom: "-60%",
            width: "64%",
            height: "200%",
            background:
              "url('/brand/dtdcargo-isologo-mono-light.png') right bottom / contain no-repeat",
            opacity: 0.1,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          font: "900 var(--kpi-fs) / 1 var(--f-display)",
          // Sora no es monoespaciada → tabular-nums estabiliza el ancho de
          // dígitos (KPIs que cambian en vivo vía Realtime no hacen jitter).
          fontVariantNumeric: "tabular-nums",
          color: valColor,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          position: "relative",
          font: "600 14px/1.2 var(--f-sans)",
          color: labelColor,
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            position: "relative",
            font: "400 13px/1.4 var(--f-sans)",
            color: subColor,
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
