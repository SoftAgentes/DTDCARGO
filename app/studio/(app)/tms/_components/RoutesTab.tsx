import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { TmsRouteRow } from "@/lib/studio/tms-types";
import { RouteStatusBadge } from "./RouteStatusBadge";

export function RoutesTab({ rows }: { rows: TmsRouteRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin rutas"
        title="Aún no se asignaron rutas de entrega."
        description="Cuando crees una ruta desde '+ Nueva ruta', el shipment liberado de aduana pasa automáticamente a 'En reparto'."
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "130px 130px minmax(220px, 1.5fr) 90px 110px 130px",
          gap: 14,
          padding: "12px 18px",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          font: "700 10px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span>Ruta</span>
        <span>Embarque</span>
        <span>Paradas</span>
        <span style={{ textAlign: "right" }}>Distancia</span>
        <span>Progreso</span>
        <span>Estado</span>
      </div>

      {rows.map((r, i) => (
        <div
          key={r.id}
          style={{
            display: "grid",
            gridTemplateColumns:
              "130px 130px minmax(220px, 1.5fr) 90px 110px 130px",
            gap: 14,
            padding: "14px 18px",
            alignItems: "center",
            borderTop: i > 0 ? "1px solid var(--border)" : 0,
          }}
        >
          {/* Route code + truck */}
          <div>
            <code
              style={{
                font: "800 11.5px/1 var(--f-mono)",
                color: "var(--ink)",
              }}
            >
              {r.route_code}
            </code>
            <div
              style={{
                font: "500 10.5px/1 var(--f-mono)",
                color: "var(--ink-mute)",
                marginTop: 4,
              }}
            >
              {r.truck?.plate ?? "—"}
            </div>
          </div>

          {/* Shipment code */}
          <code
            style={{
              font: "700 11.5px/1 var(--f-mono)",
              color: "var(--wine)",
            }}
          >
            {r.shipment?.code ?? "—"}
          </code>

          {/* Stops chips */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {r.stops.length === 0 ? (
              <span style={{ color: "var(--ink-mute)" }}>—</span>
            ) : (
              r.stops.map((s, j) => (
                <span
                  key={j}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    font: "500 11.5px/1.2 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {j > 0 && (
                    <span style={{ color: "var(--wine)", fontWeight: 700 }}>
                      →
                    </span>
                  )}
                  <span
                    style={{
                      maxWidth: 140,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={s}
                  >
                    {s}
                  </span>
                </span>
              ))
            )}
          </div>

          {/* Distance */}
          <span
            className="mono"
            style={{
              font: "700 12px/1 var(--f-mono)",
              color: r.distance_km != null ? "var(--ink-soft)" : "var(--ink-mute)",
              textAlign: "right",
            }}
          >
            {r.distance_km != null ? `${r.distance_km} km` : "—"}
          </span>

          {/* Progress */}
          <div>
            <div
              style={{
                height: 6,
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-pill)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${r.progress_pct}%`,
                  height: "100%",
                  background:
                    r.progress_pct === 100 ? "var(--success)" : "var(--wine)",
                  borderRadius: "var(--r-pill)",
                  transition: "width var(--dur) var(--ease)",
                }}
              />
            </div>
            <div
              style={{
                font: "600 10px/1 var(--f-mono)",
                color: "var(--ink-mute)",
                marginTop: 4,
                textAlign: "right",
              }}
            >
              {r.progress_pct}%
            </div>
          </div>

          {/* Status */}
          <span>
            <RouteStatusBadge status={r.status} />
          </span>
        </div>
      ))}
    </div>
  );
}
