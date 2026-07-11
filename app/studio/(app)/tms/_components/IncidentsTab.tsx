import { Badge } from "@/app/studio/_components/ui/Badge";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPE_TONES,
  type TmsIncidentRow,
} from "@/lib/studio/tms-types";
import type { IncidentsKpis } from "@/lib/studio/tms-queries";

export function IncidentsTab({
  rows,
  kpis,
}: {
  rows: TmsIncidentRow[];
  kpis: IncidentsKpis;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Sub-KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard
          label="Total mes"
          value={`$${kpis.totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          sub={`${kpis.totalCount} ${kpis.totalCount === 1 ? "evento" : "eventos"}`}
          valueColor={kpis.totalCost > 0 ? "var(--warning)" : "var(--ink)"}
        />
        <KpiCard
          label="Combustible"
          value={`$${kpis.fuelCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          sub="Mensual"
          valueColor="var(--info)"
        />
        <KpiCard
          label="Mantenimientos"
          value={kpis.maintenanceCount}
          sub="Programados"
          valueColor={kpis.maintenanceCount > 0 ? "var(--wine-text)" : "var(--ink)"}
        />
        <KpiCard
          label="Multas"
          value={kpis.finesCount}
          sub={
            kpis.finesCount > 0
              ? `$${kpis.finesCost.toLocaleString("en-US", { maximumFractionDigits: 0 })} acumulado`
              : "Sin multas"
          }
          valueColor={kpis.finesCount > 0 ? "var(--danger)" : "var(--ink)"}
        />
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <EmptyState
          eyebrow="Sin incidencias"
          title="No hay incidencias registradas en los últimos 30 días."
          description="Cuando ocurra un mantenimiento, multa o gasto de combustible, registralo desde el botón del header."
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              className="studio-eyebrow"
              style={{ font: "700 10.5px/1 var(--f-sans)", color: "var(--wine-text)" }}
            >
              Incidencias · Últimos 30 días
            </div>
          </div>
          {rows.map((inc, i) => (
            <div
              key={inc.id}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 100px 110px minmax(0, 1fr) 100px 100px",
                gap: 14,
                padding: "14px 18px",
                alignItems: "center",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
              }}
            >
              <code
                style={{
                  font: "700 11.5px/1 var(--f-mono)",
                  color: "var(--ink)",
                }}
              >
                {inc.incident_code}
              </code>
              <code
                style={{
                  font: "700 11.5px/1 var(--f-mono)",
                  color: "var(--wine-text)",
                }}
              >
                {inc.truck?.plate ?? "—"}
              </code>
              <span
                className="mono"
                style={{
                  font: "500 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {new Date(inc.occurred_at).toLocaleDateString("es-VE", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                })}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <Badge
                  tone={INCIDENT_TYPE_TONES[inc.incident_type]}
                  size="sm"
                >
                  {INCIDENT_TYPE_LABELS[inc.incident_type]}
                </Badge>
                <span
                  style={{
                    font: "500 12px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={inc.description ?? undefined}
                >
                  {inc.description ?? "—"}
                </span>
              </div>
              <span
                className="mono"
                style={{
                  font: "800 13px/1 var(--f-mono)",
                  color: "var(--warning)",
                  textAlign: "right",
                }}
              >
                ${Number(inc.cost_usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
              <Badge tone="neutral" size="sm">
                {inc.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
