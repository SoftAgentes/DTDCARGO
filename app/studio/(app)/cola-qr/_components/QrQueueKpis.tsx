/**
 * 4 KPIs header del módulo Cola de QR (SDD-0033).
 */

import type { QrQueueKpis as KpisData } from "@/lib/studio/qr-queue-queries";

export function QrQueueKpis({ kpis }: { kpis: KpisData }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "var(--s-3)",
      }}
    >
      <Kpi
        label="Pendientes"
        value={String(kpis.pendientes)}
        sub={kpis.urgentes > 0 ? `${kpis.urgentes} urgentes` : "en cola"}
        tone={kpis.urgentes > 0 ? "warning" : "wine"}
      />
      <Kpi
        label="Imprimiendo"
        value={String(kpis.imprimiendo)}
        sub="en cola activa"
        tone="info"
      />
      <Kpi
        label="Bultos en cola"
        value={String(kpis.bultosCola)}
        sub="etiquetas pendientes"
        tone="neutral"
      />
      <Kpi
        label="Impresos hoy"
        value={String(kpis.impresosHoy)}
        sub="del día"
        tone="success"
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
  tone: "wine" | "info" | "success" | "warning" | "neutral";
}) {
  const color: Record<typeof tone, string> = {
    wine: "var(--wine)",
    info: "var(--info)",
    success: "var(--success)",
    warning: "var(--warning)",
    neutral: "var(--ink-soft)",
  };
  return (
    <div
      style={{
        padding: "var(--s-4)",
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
          font: "900 26px/1 var(--f-display)",
          color: color[tone],
          marginTop: 10,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          font: "500 11px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 6,
        }}
      >
        {sub}
      </div>
    </div>
  );
}
