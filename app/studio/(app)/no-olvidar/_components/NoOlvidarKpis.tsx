/**
 * <NoOlvidarKpis> — fila de 4 KPIs del No-Olvidar (SDD-0025 Fase 3).
 * Server component (sin estado). Reusa la primitiva KpiCard del sistema.
 */

import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import type { NoOlvidarKpis as Kpis } from "@/lib/studio/no-olvidar-types";

export function NoOlvidarKpis({ kpis }: { kpis: Kpis }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <KpiCard value={kpis.totalItems} label="Items guardados" />
      <KpiCard value={kpis.itemsLast30d} label="Nuevos · 30 días" />
      <KpiCard
        value={kpis.recoveryPending}
        label="Recovery pendiente"
        valueColor={kpis.recoveryPending > 0 ? "var(--warning)" : "var(--ink)"}
      />
      <KpiCard
        value={kpis.alerts24h}
        label="Alertas · 24 h"
        valueColor={kpis.alerts24h > 0 ? "var(--danger)" : "var(--ink)"}
      />
    </div>
  );
}
