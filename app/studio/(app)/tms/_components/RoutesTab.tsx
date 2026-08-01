"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import type { TmsRouteRow } from "@/lib/studio/tms-types";
import { markRouteCompletedAction } from "../actions";
import { RouteStatusBadge } from "./RouteStatusBadge";

export function RoutesTab({ rows }: { rows: TmsRouteRow[] }) {
  const router = useRouter();
  const [decision, setDecision] = useState<TmsRouteRow | null>(null);
  const [requestRef, setRequestRef] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  if (rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin rutas"
        title="Aún no se asignaron rutas de entrega."
        description="Cuando crees una ruta desde '+ Nueva ruta', el shipment liberado de aduana pasa automáticamente a 'En reparto'."
      />
    );
  }

  const openCompletion = (route: TmsRouteRow) => {
    setDecision(route);
    setRequestRef(`tms-route-completion:${route.id}:${crypto.randomUUID()}`);
    setError(undefined);
  };

  const confirmCompletion = async (reason: string) => {
    if (!decision || pending) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await markRouteCompletedAction({
        routeId: decision.id,
        from: decision.status,
        reason,
        requestRef,
      });
      if (!result.ok) {
        setError(result.error ?? "No se pudo completar la ruta.");
        return;
      }
      setDecision(null);
      router.refresh();
    } catch {
      setError("No se pudo completar la ruta. Conservamos la referencia para reintentar.");
    } finally {
      setPending(false);
    }
  };

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
            "130px 130px minmax(220px, 1.5fr) 90px 110px 130px 120px",
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
        <span>Acción</span>
      </div>

      {rows.map((r, i) => (
        <div
          key={r.id}
          style={{
            display: "grid",
            gridTemplateColumns:
              "130px 130px minmax(220px, 1.5fr) 90px 110px 130px 120px",
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
                color: "var(--ink-soft)",
                marginTop: "var(--s-1)",
              }}
            >
              {r.truck?.plate ?? "—"}
            </div>
          </div>

          {/* Shipment code */}
          <code
            style={{
              font: "700 11.5px/1 var(--f-mono)",
              color: "var(--wine-text)",
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
                    <span style={{ color: "var(--wine-text)", fontWeight: 700 }}>
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
                color: "var(--ink-soft)",
                marginTop: "var(--s-1)",
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

          <div>
            {r.status === "en_ruta" ? (
              <button
                type="button"
                className="studio-btn studio-btn-dark studio-btn-sm"
                onClick={() => openCompletion(r)}
                aria-label={`Completar ruta ${r.route_code}`}
              >
                Completar
              </button>
            ) : (
              <span aria-hidden="true" style={{ color: "var(--ink-mute)" }}>
                —
              </span>
            )}
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={decision !== null}
        danger
        reason
        reasonRequired
        holdToConfirm
        initialFocus="safe"
        title="Completar ruta de última milla"
        message={
          decision
            ? `${decision.route_code} · embarque ${decision.shipment?.code ?? "sin código"} · camión ${decision.truck?.plate ?? "sin asignar"} · chofer ${decision.driver?.name ?? "sin asignar"}. Esta decisión cerrará la ruta, liberará sus recursos y moverá el embarque a Última milla para esperar el POD.`
            : ""
        }
        confirmLabel="Completar ruta"
        holdLabel="Mantén para completar"
        reasonLabel="Evidencia o motivo del cierre"
        reasonPlaceholder="Ej. Ruta finalizada y entrega enviada a validación de POD"
        pending={pending}
        error={error}
        onCancel={() => {
          if (pending) return;
          setDecision(null);
          setError(undefined);
        }}
        onConfirm={confirmCompletion}
      />
    </div>
  );
}
