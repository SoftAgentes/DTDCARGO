/**
 * 6 KPIs header del módulo Despacho (SDD-0029 Vista 1).
 * Server component: recibe data computada de computeDispatchKpis.
 */

import type { DispatchKpis as KpisData } from "@/lib/studio/dispatch-queries";

export function DispatchKpis({ kpis }: { kpis: KpisData }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: 10,
      }}
    >
      <Kpi label="En cola" value={String(kpis.packagesInQueue)} sub="paquetes" tone="wine" />
      <Kpi label="ODs activas" value={String(kpis.activeOds)} sub="en proceso" tone="info" />
      <Kpi label="Creadas hoy" value={String(kpis.todayCreated)} sub="del día" tone="neutral" />
      <Kpi label="Entregadas hoy" value={String(kpis.todayCompleted)} sub="completadas" tone="success" />
      <Kpi
        label="Cap. promedio"
        value={`${kpis.avgCapacityUsagePct}%`}
        sub="kg o cbm"
        tone={kpis.avgCapacityUsagePct > 90 ? "warning" : "info"}
      />
      <Kpi
        label="Canceladas 7d"
        value={String(kpis.cancelledThisWeek)}
        sub="última semana"
        tone={kpis.cancelledThisWeek > 5 ? "danger" : "neutral"}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "wine" | "info" | "success" | "warning" | "danger" | "neutral";
}) {
  const color: Record<typeof tone, string> = {
    wine: "var(--wine)",
    info: "var(--info)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    neutral: "var(--ink-soft)",
  };
  return (
    <div
      style={{
        padding: 14,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: "900 22px/1 var(--f-display)",
          // Sora no es monoespaciada → tabular-nums estabiliza el ancho de
          // dígitos en esta vista Realtime (cobranzas/despacho cambian en vivo).
          fontVariantNumeric: "tabular-nums",
          color: color[tone],
          marginTop: 8,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          font: "500 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 4,
        }}
      >
        {sub}
      </div>
    </div>
  );
}
