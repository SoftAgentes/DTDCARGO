import { Badge } from "@/app/studio/_components/ui/Badge";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { truckMileageColor, type TmsTruckRow } from "@/lib/studio/tms-types";
import { TruckStatusBadge } from "./TruckStatusBadge";

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function FleetTab({ rows }: { rows: TmsTruckRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Flota vacía"
        title="Aún no cargaste camiones en la flota."
        description="Usá '+ Nuevo camión' en el header para registrar el primer vehículo (propio o contratado)."
      />
    );
  }
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "110px minmax(180px, 1.4fr) 80px 110px 110px minmax(140px, 1fr) 78px 140px",
          gap: 12,
          padding: "12px 18px",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        <span>Patente</span>
        <span>Vehículo</span>
        <span>Hub</span>
        <span>Propiedad</span>
        <span>Capacidad</span>
        <span>Chofer</span>
        <span style={{ textAlign: "right" }}>Km</span>
        <span>Estado</span>
      </div>

      {rows.map((r, i) => (
        <div
          key={r.id}
          style={{
            display: "grid",
            gridTemplateColumns:
              "110px minmax(180px, 1.4fr) 80px 110px 110px minmax(140px, 1fr) 78px 140px",
            gap: 12,
            padding: "14px 18px",
            alignItems: "center",
            borderTop: i > 0 ? "1px solid var(--border)" : 0,
          }}
        >
          <code
            style={{
              font: "800 12.5px/1 var(--f-mono)",
              color: "var(--wine)",
              letterSpacing: "0.02em",
            }}
          >
            {r.plate}
          </code>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                font: "700 13px/1.2 var(--f-sans)",
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {r.brand ?? "—"}
            </div>
            <div
              style={{
                font: "500 11px/1.2 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 3,
              }}
            >
              {r.vehicle_type ?? "—"}
            </div>
          </div>

          {r.hub_code ? (
            <Badge tone="info" size="sm">
              {r.hub_code}
            </Badge>
          ) : (
            <span style={{ color: "var(--ink-mute)" }}>—</span>
          )}

          {r.owned ? (
            <Badge tone="success" size="sm">
              Propio
            </Badge>
          ) : (
            <Badge tone="warning" size="sm">
              Contratado
            </Badge>
          )}

          <div>
            <div
              className="mono"
              style={{
                font: "700 12px/1 var(--f-mono)",
                color: "var(--ink)",
              }}
            >
              {r.capacity_cbm != null ? `${r.capacity_cbm} CBM` : "—"}
            </div>
            <div
              style={{
                font: "500 10.5px/1 var(--f-mono)",
                color: "var(--ink-mute)",
                marginTop: 3,
              }}
            >
              {r.capacity_kg != null
                ? `${(Number(r.capacity_kg) / 1000).toFixed(0)}t`
                : "—"}
            </div>
          </div>

          {r.driver ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              <Avatar
                initials={initialsFrom(r.driver.name)}
                size={26}
                color="wine"
              />
              <span
                style={{
                  font: "500 12px/1 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.driver.name.split(" ")[0]}
              </span>
            </div>
          ) : (
            <span
              style={{
                font: "500 11.5px/1 var(--f-sans)",
                color: "var(--ink-mute)",
              }}
            >
              —
            </span>
          )}

          <span
            className="mono"
            style={{
              font: "600 11.5px/1 var(--f-mono)",
              color: truckMileageColor(r.km),
              textAlign: "right",
            }}
          >
            {(r.km / 1000).toFixed(0)}K
          </span>

          <span>
            <TruckStatusBadge status={r.status} />
          </span>
        </div>
      ))}
    </div>
  );
}
