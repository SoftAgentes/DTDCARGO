import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { TmsDriver } from "@/lib/studio/tms-types";
import { DriverStatusBadge } from "./DriverStatusBadge";

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DriversTab({ drivers }: { drivers: TmsDriver[] }) {
  if (drivers.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin choferes"
        title="Aún no hay choferes registrados."
        description="Usa '+ Nuevo chofer' en el header para dar de alta al primer conductor."
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
      {drivers.map((d) => (
        <DriverCard key={d.id} driver={d} />
      ))}
    </div>
  );
}

function DriverCard({ driver: d }: { driver: TmsDriver }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
        <Avatar initials={initialsFrom(d.name)} size={44} color="wine" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="studio-display"
            style={{
              fontSize: 14,
              lineHeight: 1.1,
              color: "var(--ink)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {d.name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 5,
              flexWrap: "wrap",
            }}
          >
            <DriverStatusBadge status={d.status} />
            <span
              style={{
                font: "500 10.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              · {d.exp_years}a exp
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="studio-display"
            style={{ fontSize: 16, color: "var(--wine-text)" }}
          >
            {d.rating != null ? `★ ${d.rating.toFixed(1)}` : "—"}
          </div>
          <div
            style={{
              font: "500 10.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: "var(--s-1)",
            }}
          >
            rating
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
        }}
      >
        <Stat label="Licencia" value={d.license_class ?? "—"} mono />
        <Stat label="Hub base" value={d.hub_code ?? "—"} />
        <Stat label="Viajes 30d" value={String(d.trips_30d)} mono accent />
        <Stat
          label="Teléfono"
          value={d.phone ?? "—"}
          mono
        />
      </div>

      {d.last_trip && (
        <div
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Último viaje:{" "}
          <span style={{ color: "var(--ink)" }}>
            {new Date(d.last_trip).toLocaleDateString("es-VE", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })}
          </span>
        </div>
      )}
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
          color: accent ? "var(--ink)" : "var(--ink)",
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
