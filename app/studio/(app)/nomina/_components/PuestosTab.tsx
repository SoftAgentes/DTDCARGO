"use client";

/**
 * PuestosTab — perfiles de puesto agrupados por área (SDD-0140 · Fase 1).
 * Cada card muestra el perfil establecido del cargo (rol RBAC, disparadores,
 * responsabilidades, KPI, titular referencial, candado de gobernanza), desacoplado
 * de quién lo ocupe hoy. Read = accounting/admin (gate del módulo nómina).
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Icon } from "@/app/studio/_components/icons";
import {
  groupPositionsByArea,
  positionRoleLabel,
  positionRoleBadgeTone,
  type Position,
} from "@/lib/studio/nomina/position-types";

export function PuestosTab({
  positions,
  onNew,
  onEdit,
}: {
  positions: Position[];
  onNew: () => void;
  onEdit: (p: Position) => void;
}) {
  const groups = groupPositionsByArea(positions);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--s-4)",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", maxWidth: "60ch" }}>
          El perfil de cada puesto, aparte de quién lo ocupe. Hoy lo ocupa alguien; mañana
          cambia — el perfil queda establecido. El rol de acceso es la plantilla del alta.
        </div>
        <button type="button" className="studio-btn studio-btn-primary" onClick={onNew}>
          + Nuevo puesto
        </button>
      </div>

      {positions.length === 0 ? (
        <EmptyState
          eyebrow="Sin puestos"
          title="Aún no hay perfiles de puesto."
          description="Define qué necesita cada cargo (área, rol de acceso, disparadores, responsabilidades y KPI), independiente de quién lo ocupe hoy."
          action={
            <button type="button" className="studio-btn studio-btn-primary" onClick={onNew}>
              + Nuevo puesto
            </button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}>
          {groups.map((g) => (
            <section key={g.area}>
              <div
                style={{
                  font: "700 9.5px/1 var(--f-sans)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  marginBottom: "var(--s-3)",
                }}
              >
                {g.area}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: "var(--s-4)",
                }}
              >
                {g.positions.map((p) => (
                  <PuestoCard key={p.id} p={p} onEdit={onEdit} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function PuestoCard({ p, onEdit }: { p: Position; onEdit: (p: Position) => void }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "16px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
        opacity: p.active ? 1 : 0.6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--s-3)" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "700 14px/1.25 var(--f-sans)", color: "var(--ink)" }}>
            {p.title}
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <Badge tone={positionRoleBadgeTone(p.rbac_role)} size="sm">
              {positionRoleLabel(p.rbac_role)}
            </Badge>
            {!p.active && (
              <Badge tone="neutral" size="sm">
                Inactivo
              </Badge>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onEdit(p)}
          aria-label="Editar puesto"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ padding: "8px 10px", minHeight: 32, flexShrink: 0 }}
        >
          {Icon.edit(13)}
        </button>
      </div>

      {p.responsibilities && (
        <CardBlock label="Responsabilidades">{p.responsibilities}</CardBlock>
      )}
      {p.triggers && <CardBlock label="Disparadores">{p.triggers}</CardBlock>}
      {p.kpi && <CardBlock label="KPI">{p.kpi}</CardBlock>}
      {p.owner_note && <CardBlock label="Titular / suplente">{p.owner_note}</CardBlock>}

      {p.governance_note && (
        <div
          style={{
            font: "500 11.5px/1.45 var(--f-sans)",
            color: "var(--wine)",
            background: "var(--wine-tint)",
            border: "1px solid var(--wine)",
            borderRadius: "var(--r-sm)",
            padding: "8px 10px",
          }}
        >
          <strong>Candado:</strong> {p.governance_note}
        </div>
      )}
    </div>
  );
}

function CardBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
        {children}
      </div>
    </div>
  );
}
