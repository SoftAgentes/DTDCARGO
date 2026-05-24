import { Icon } from "@/app/studio/_components/icons";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { TmsRouteRow, TmsTruckRow } from "@/lib/studio/tms-types";
import { RouteStatusBadge } from "./RouteStatusBadge";

/**
 * GpsLiveTab V1 — sin mapa SVG (diferido a SDD-0019.1 cuando exista AIS real).
 * Muestra:
 * - Lista de rutas activas (igual JSX layout)
 * - Alertas de flota computadas simples (km >200K, mantenimiento, etc.)
 */
export function GpsLiveTab({
  activeRoutes,
  trucks,
}: {
  activeRoutes: TmsRouteRow[];
  trucks: TmsTruckRow[];
}) {
  // Alertas computadas simples
  const alerts: {
    icon: "cog" | "warn" | "clock";
    tone: "warning" | "info" | "wine";
    title: string;
    meta: string;
  }[] = [];

  for (const t of trucks) {
    if (t.status === "mantenimiento") {
      alerts.push({
        icon: "cog",
        tone: "warning",
        title: `${t.plate} en mantenimiento`,
        meta: t.next_service_at
          ? `Próximo service: ${new Date(t.next_service_at).toLocaleDateString("es-VE", {
              day: "2-digit",
              month: "short",
            })}`
          : "Sin fecha de próximo service",
      });
    } else if (t.km > 180000) {
      alerts.push({
        icon: "warn",
        tone: "info",
        title: `${t.plate} supera ${(t.km / 1000).toFixed(0)}K km`,
        meta: "Programar service mayor",
      });
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
      {/* Columna izquierda: rutas activas */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "16px 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              className="studio-eyebrow"
              style={{
                font: "700 10.5px/1 var(--f-sans)",
                color: "var(--wine)",
              }}
            >
              Rutas activas · {activeRoutes.length}{" "}
              {activeRoutes.length === 1 ? "vehículo" : "vehículos"}
            </div>
            <div
              className="studio-display"
              style={{
                fontSize: 16,
                color: "var(--ink)",
                marginTop: 6,
              }}
            >
              Venezuela · entrega DDP
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "500 11px/1 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--success)",
              }}
            />
            Sin mapa GPS · SDD-0019.1
          </div>
        </div>

        {activeRoutes.length === 0 ? (
          <div
            style={{
              padding: "30px 20px",
              textAlign: "center",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
              color: "var(--ink-soft)",
            }}
          >
            <div
              style={{
                font: "700 11px/1 var(--f-sans)",
                color: "var(--ink-mute)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Sin rutas en curso
            </div>
            <div
              style={{
                font: "500 12.5px/1.5 var(--f-sans)",
                maxWidth: "44ch",
                margin: "0 auto",
              }}
            >
              Cuando se asigne una ruta a un shipment liberado de aduana, aparece
              acá con progreso en vivo.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {activeRoutes.map((r) => (
              <ActiveRouteCard key={r.id} route={r} />
            ))}
          </div>
        )}
      </div>

      {/* Columna derecha: alertas */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "16px 18px",
        }}
      >
        <div
          className="studio-eyebrow"
          style={{
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--wine)",
            marginBottom: 14,
          }}
        >
          Alertas de flota
        </div>
        {alerts.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              background: "var(--success-bg)",
              border: "1px solid var(--success)",
              borderRadius: "var(--r-md)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ color: "var(--success)" }}>{Icon.check(14)}</span>
            <div
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              Toda la flota operativa · sin alertas
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {alerts.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 12px",
                  background: `var(--${a.tone}-bg)`,
                  borderRadius: "var(--r-sm)",
                  borderLeft: `3px solid var(--${a.tone})`,
                }}
              >
                <span style={{ color: `var(--${a.tone})`, flexShrink: 0 }}>
                  {Icon[a.icon](13)}
                </span>
                <div>
                  <div
                    style={{
                      font: "700 12px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                    }}
                  >
                    {a.title}
                  </div>
                  <div
                    style={{
                      font: "500 11px/1.3 var(--f-sans)",
                      color: "var(--ink-soft)",
                      marginTop: 2,
                    }}
                  >
                    {a.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveRouteCard({ route: r }: { route: TmsRouteRow }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <code
          style={{
            font: "800 11.5px/1 var(--f-mono)",
            color: "var(--ink)",
          }}
        >
          {r.truck?.plate ?? "—"}
        </code>
        <RouteStatusBadge status={r.status} />
      </div>
      <div
        style={{
          font: "600 12.5px/1.3 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {r.driver?.name ?? "Sin chofer asignado"}
      </div>
      <div
        style={{
          font: "500 11px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 4,
        }}
      >
        Embarque{" "}
        <code
          style={{
            font: "700 11px/1 var(--f-mono)",
            color: "var(--wine)",
          }}
        >
          {r.shipment?.code ?? "—"}
        </code>
      </div>

      <div
        style={{
          marginTop: 8,
          height: 4,
          background: "var(--bg-surface)",
          borderRadius: "var(--r-pill)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${r.progress_pct}%`,
            height: "100%",
            background: "var(--wine)",
            borderRadius: "var(--r-pill)",
            transition: "width var(--dur) var(--ease)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          font: "600 10.5px/1 var(--f-mono)",
          color: "var(--ink-mute)",
        }}
      >
        <span>
          {r.progress_pct}%
          {r.distance_km != null && ` · ${r.distance_km}km`}
        </span>
        {r.eta_at && (
          <span>
            ETA{" "}
            {new Date(r.eta_at).toLocaleTimeString("es-VE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
