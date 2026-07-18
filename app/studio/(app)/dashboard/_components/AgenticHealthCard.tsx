/**
 * AgenticHealthCard · Dashboard (SDD-0020 Fase 2A)
 *
 * Reemplaza el placeholder "Dashboard salud agentic" por una card real
 * alimentada por `computeAgentKpis()`. Server component.
 *
 * Estados:
 *  - active === 0 → border dashed + CTA "Instala tu primer agente"
 *  - active > 0   → border sólido + 4 mini-KPIs (Activos / Runs hoy /
 *                   Aprobaciones / Gasto MTD)
 *
 * Link siempre a /studio/admin/agentes (ya existe el placeholder de admin,
 * será reemplazado por el hub real en Fase 2A).
 */

import Link from "next/link";
import { formatCostUsd, type AgentKpis } from "@/lib/studio/agent-types";

export function AgenticHealthCard({ kpis }: { kpis: AgentKpis }) {
  if (kpis.installed === 0) {
    return <EmptyAgenticCard pendingApprovals={kpis.approvalsPending} />;
  }

  const noneActive = kpis.active === 0;

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            className="studio-display"
            style={{
              fontSize: 18,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Salud agentic
          </div>
          <p
            style={{
              font: "400 13px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "62ch",
            }}
          >
            {noneActive ? (
              <>
                Tienes <strong style={{ color: "var(--ink)" }}>{kpis.installed}</strong>{" "}
                {kpis.installed === 1 ? "agente instalado" : "agentes instalados"}{" "}
                pero ninguno activo. Activalos desde{" "}
                <strong style={{ color: "var(--ink)" }}>Instalados</strong>.
              </>
            ) : (
              <>Vista rápida de tus agentes activos, runs del día y gasto MTD.</>
            )}
          </p>
        </div>
        <Link
          href="/studio/admin/agentes?tab=installed"
          className="studio-btn studio-btn-ghost studio-btn-sm"
        >
          Ver agentes →
        </Link>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
          paddingTop: 14,
          borderTop: "1px solid var(--border)",
        }}
      >
        <MiniKpi
          label="Activos"
          value={`${kpis.active}/${kpis.installed}`}
          tone={noneActive ? "wine" : "neutral"}
        />
        <MiniKpi label="Runs hoy" value={String(kpis.runsToday)} />
        <MiniKpi
          label="Aprobaciones"
          value={String(kpis.approvalsPending)}
          tone={kpis.approvalsPending > 0 ? "wine" : "neutral"}
        />
        <MiniKpi
          label="Gasto MTD"
          value={formatCostUsd(kpis.spendMtd)}
          mono
        />
      </div>
    </section>
  );
}

function MiniKpi({
  label,
  value,
  tone = "neutral",
  mono = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "wine";
  mono?: boolean;
}) {
  const color = tone === "wine" ? "var(--wine)" : "var(--ink)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        className="studio-display"
        style={{
          fontSize: 22,
          color,
          letterSpacing: "-0.01em",
          fontFamily: mono ? "var(--f-mono)" : undefined,
        }}
      >
        {value}
      </div>
      <div
        style={{
          font: "700 10px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function EmptyAgenticCard({ pendingApprovals }: { pendingApprovals: number }) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "2px dashed var(--border-strong)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
          minWidth: 280,
        }}
      >
        <div
          style={{
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--wine-text)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Sprint 4 · SDD-0020
        </div>
        <div
          className="studio-display"
          style={{
            fontSize: 18,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          Todavía no tienes agentes instalados.
        </div>
        <p
          style={{
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            maxWidth: "62ch",
            margin: 0,
          }}
        >
          Empieza con <strong style={{ color: "var(--ink)" }}>Tracking Concierge</strong>
          {" "}— responde consultas de carga en español-VE usando el tracking real
          del Studio. Read-only, sin riesgo de escritura.
          {pendingApprovals > 0 && (
            <>
              {" · "}
              <strong style={{ color: "var(--wine-text)" }}>
                {pendingApprovals} aprobaciones pendientes
              </strong>
              {" en cola."}
            </>
          )}
        </p>
      </div>
      <Link
        href="/studio/admin/agentes"
        className="studio-btn studio-btn-primary studio-btn-sm"
      >
        Instala tu primer agente →
      </Link>
    </section>
  );
}
