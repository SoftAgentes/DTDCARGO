/**
 * AgentKpisRow · 4 KPIs del módulo Agentes y Skills (SDD-0020 Fase 2B).
 *
 * Server component puro. Reusa el primitive KpiCard del Studio para
 * mantener el patrón visual del dashboard.
 */

import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { formatCostUsd, type AgentKpis } from "@/lib/studio/agent-types";

export function AgentKpisRow({ kpis }: { kpis: AgentKpis }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 14,
      }}
    >
      <KpiCard
        value={kpis.active}
        label="Activos"
        sub="agentes corriendo"
      />
      <KpiCard
        value={kpis.runsToday}
        label="Runs hoy"
        sub="ejecuciones desde las 00:00 VE"
      />
      <KpiCard
        value={kpis.approvalsPending}
        label="Aprobaciones"
        valueColor={kpis.approvalsPending > 0 ? "var(--wine)" : "var(--ink)"}
        sub={
          kpis.approvalsPending > 0
            ? "esperando revisión"
            : "ninguna pendiente"
        }
      />
      <KpiCard
        value={formatCostUsd(kpis.spendMtd)}
        label="Gasto MTD"
        valueColor={kpis.spendMtd > 0 ? "var(--wine)" : "var(--ink)"}
        sub={
          kpis.errors24h > 0
            ? `${kpis.errors24h} errores últimas 24h`
            : "sin errores recientes"
        }
      />
    </div>
  );
}
