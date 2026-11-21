/**
 * KpiCard primitive · DTD Studio (SDD-0014)
 *
 * Card con valor grande + label + sub-line opcional.
 * Border-top de tinta 2px cuando value > 0 (cifras en tinta, BD-076 · SDD-0686).
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
   *  semánticos: success/warning/danger. */
  valueColor?: string;
  /** Si false, no muestra el border-top de tinta aunque value > 0. */
  highlightWhenPositive?: boolean;
  /**
   * KPI DESTACADO (BD-034): relleno degradado navy (cifras en tinta, BD-076; antes vino) + marca de agua "D" (isotipo
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

  // En feature el texto va sobre el degradado navy, oscuro en los dos temas: --ink-side*,
  // que no voltea (SDD-0603; el relleno pasó de vino a navy con BD-076).
  const valColor = feature ? "var(--ink-side-strong)" : valueColor;
  const labelColor = feature ? "var(--ink-side-strong)" : "var(--ink)";
  const subColor = feature ? "var(--ink-side)" : "var(--ink-soft)";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: feature ? "var(--grad-navy)" : "var(--grad-card)",
        border: feature ? "1px solid transparent" : "1px solid var(--border)",
        borderTop: feature
          ? "1px solid transparent"
          : showHighlight
            ? "2px solid var(--ink-soft)"
            : "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-5)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: feature ? "var(--shadow-md)" : undefined,
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
