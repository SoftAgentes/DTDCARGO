"use client";

/**
 * Mini-charts SVG tokenizados del módulo Reportes (SDD-0052 · Slice A).
 *
 * Simples, sin libs, solo `var(--*)` (marca). Reusables entre las 4 vistas.
 *  - <VolumeBars>  serie mensual de embarques (barra) + CBM (línea overlay).
 *  - <Donut>       repartición (mix de servicios) con leyenda.
 *  - <Progress>    barra de progreso horizontal (reusada en tablas).
 *  - <HeaderRow>   cabecera de tabla tokenizada (reusada por todas las vistas).
 */

import type { MonthlyVolumePoint } from "@/lib/studio/reports/types";

// ── Cabecera de tabla (reusable) ───────────────────────────────
// Grid de rótulos de columna; alinea a la derecha el rango [rightFrom, rightTo].
export function HeaderRow({
  cols,
  labels,
  rightFrom,
  rightTo,
}: {
  cols: string;
  labels: string[];
  rightFrom?: number;
  rightTo?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        padding: "10px 18px",
        gap: 14,
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {labels.map((h, i) => {
        const right =
          rightFrom != null && rightTo != null && i >= rightFrom && i <= rightTo;
        return (
          <span
            key={`${i}-${h}`}
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textAlign: right ? "right" : "left",
            }}
          >
            {h}
          </span>
        );
      })}
    </div>
  );
}

// ── Barra de progreso (reusable) ───────────────────────────────
export function Progress({
  value, // 0..100
  tone = "var(--wine)",
  height = 8,
}: {
  value: number;
  tone?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      style={{
        height,
        background: "var(--bg-elevated)",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: tone,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

// ── Volumen mensual: barras (embarques) + línea (CBM) ──────────
export function VolumeBars({ points }: { points: MonthlyVolumePoint[] }) {
  if (points.length === 0) {
    return (
      <div
        style={{
          font: "500 12.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          padding: "var(--s-4) 0",
        }}
      >
        Sin embarques en el período.
      </div>
    );
  }

  const W = 720;
  const H = 200;
  const pad = 28;
  const maxCount = Math.max(1, ...points.map((p) => p.count));
  const maxCbm = Math.max(1, ...points.map((p) => p.cbm));
  const bw = (W - pad * 2) / points.length;
  const plotH = H - 24;

  // Línea de CBM (escala propia, normalizada a maxCbm).
  const cbmPath = points
    .map((p, i) => {
      const x = pad + i * bw + bw / 2;
      const y = H - (p.cbm / maxCbm) * plotH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 36}`}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Volumen mensual de embarques y CBM"
    >
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line
          key={i}
          x1={pad}
          x2={W - pad}
          y1={H - p * plotH}
          y2={H - p * plotH}
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray={i === 0 ? "0" : "2 4"}
        />
      ))}

      {/* barras de embarques */}
      {points.map((p, i) => {
        const h = (p.count / maxCount) * plotH;
        const x = pad + i * bw;
        return (
          <g key={p.month}>
            <rect
              x={x + bw * 0.24}
              y={H - h}
              width={bw * 0.52}
              height={Math.max(0, h)}
              fill="var(--wine)"
              rx="2"
            />
            <text
              x={x + bw / 2}
              y={H + 16}
              fontFamily="var(--f-sans)"
              fontSize="9"
              fontWeight="600"
              fill="var(--ink-soft)"
              textAnchor="middle"
            >
              {p.label}
            </text>
          </g>
        );
      })}

      {/* línea de CBM */}
      <path d={cbmPath} fill="none" stroke="var(--wine-soft)" strokeWidth="2" />
      {points.map((p, i) => {
        const x = pad + i * bw + bw / 2;
        const y = H - (p.cbm / maxCbm) * plotH;
        return (
          <circle
            key={`c-${p.month}`}
            cx={x}
            cy={y}
            r="2.5"
            fill="var(--wine-soft)"
          />
        );
      })}

      {/* leyenda */}
      <g transform={`translate(${pad}, ${H + 30})`}>
        <rect width="10" height="10" fill="var(--wine)" rx="1" />
        <text
          x="16"
          y="9"
          fontFamily="var(--f-sans)"
          fontSize="10"
          fontWeight="600"
          fill="var(--ink-soft)"
        >
          Embarques
        </text>
        <line x1="120" x2="134" y1="5" y2="5" stroke="var(--wine-soft)" strokeWidth="2" />
        <text
          x="140"
          y="9"
          fontFamily="var(--f-sans)"
          fontSize="10"
          fontWeight="600"
          fill="var(--ink-soft)"
        >
          CBM
        </text>
      </g>
    </svg>
  );
}

// ── Donut con leyenda ──────────────────────────────────────────
export type DonutSlice = { label: string; value: number; color: string };

export function Donut({
  data,
  centerLabel = "EMBARQUES",
}: {
  data: DonutSlice[];
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return (
      <div
        style={{
          font: "500 12.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
        }}
      >
        Sin datos para el período.
      </div>
    );
  }

  const cx = 90;
  const cy = 90;
  const R = 80;
  const r = 50;
  let acc = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg viewBox="0 0 180 180" style={{ width: 180, height: 180 }} role="img" aria-label="Mix de servicios">
        {data.map((d, i) => {
          const a0 = (acc / total) * 2 * Math.PI - Math.PI / 2;
          acc += d.value;
          const a1 = (acc / total) * 2 * Math.PI - Math.PI / 2;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          // Slice completo (un solo dato) → anillo entero.
          if (data.length === 1) {
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={R} fill={d.color} />
                <circle cx={cx} cy={cy} r={r} fill="var(--bg-surface)" />
              </g>
            );
          }
          const path = `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)}
            A ${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}
            L ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}
            A ${r} ${r} 0 ${large} 0 ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} Z`;
          return <path key={i} d={path} fill={d.color} />;
        })}
        <text
          x={cx}
          y={cy - 2}
          fontFamily="var(--f-display)"
          fontSize="22"
          fontWeight="900"
          fill="var(--ink)"
          textAnchor="middle"
          letterSpacing="-0.02em"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 14}
          fontFamily="var(--f-sans)"
          fontSize="9"
          fontWeight="600"
          fill="var(--ink-soft)"
          textAnchor="middle"
          letterSpacing="0.1em"
        >
          {centerLabel}
        </text>
      </svg>

      <div style={{ flex: 1, minWidth: 180 }}>
        {data.map((d) => (
          <div
            key={d.label}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: d.color,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, font: "600 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>
              {d.label}
            </span>
            <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
              {d.value}
            </span>
            <span
              style={{
                font: "700 11.5px/1 var(--f-mono)",
                color: "var(--ink-soft)",
                minWidth: 40,
                textAlign: "right",
              }}
            >
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
