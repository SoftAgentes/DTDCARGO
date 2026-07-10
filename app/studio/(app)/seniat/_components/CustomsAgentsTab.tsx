/**
 * CustomsAgentsTab — grid de cards de agentes aduanales (read-only V1).
 * UI CRUD diferida a SDD-0018.4.
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { CustomsAgent } from "@/lib/studio/customs-types";
import { vePortLabel } from "@/lib/studio/customs-types";

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function CustomsAgentsTab({ agents }: { agents: CustomsAgent[] }) {
  if (agents.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin agentes"
        title="Sin agentes aduanales registrados."
        description="El catálogo de agentes se mantiene via SQL en V1. UI CRUD viene en SDD futuro."
      />
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 14,
      }}
    >
      {agents.map((a) => (
        <AgentCard key={a.id} agent={a} />
      ))}
    </div>
  );
}

function AgentCard({ agent }: { agent: CustomsAgent }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "16px 18px",
      }}
    >
      {/* Header: avatar + name + port */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-3)",
          marginBottom: 14,
        }}
      >
        <Avatar
          initials={initialsFrom(agent.contact_name ?? agent.name)}
          size={42}
          color="wine"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="studio-display"
            style={{
              fontSize: 14,
              lineHeight: 1.2,
              color: "var(--ink)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {agent.name}
          </div>
          {agent.contact_name && (
            <div
              style={{
                font: "500 11.5px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {agent.contact_name}
            </div>
          )}
        </div>
        {agent.port_code && (
          <Badge tone="wine" size="sm">
            {agent.port_code}
          </Badge>
        )}
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--s-3)",
          paddingTop: "var(--s-3)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <Stat label="RIF" value={agent.rif ?? "—"} mono />
        <Stat label="Teléfono" value={agent.phone ?? "—"} mono />
        <Stat
          label="Puerto"
          value={agent.port_code ? vePortLabel(agent.port_code) : "—"}
        />
        <Stat
          label="Rating"
          value={agent.rating != null ? `★ ${agent.rating.toFixed(1)}` : "—"}
          accent={agent.rating != null}
        />
      </div>

      {/* Trámites count */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Trámites históricos
        </span>
        <span
          style={{
            font: "800 16px/1 var(--f-mono)",
            color: "var(--ink)",
          }}
        >
          {agent.shipments_count}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
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
          font: `${mono ? "700" : "600"} 12.5px/1.3 ${mono ? "var(--f-mono)" : "var(--f-sans)"}`,
          color: accent ? "var(--wine)" : "var(--ink)",
          marginTop: 5,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}
