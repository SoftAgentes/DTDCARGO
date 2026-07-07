/**
 * TrackingTimeline — vista operativa de los hitos del embarque (SDD-0013).
 *
 * Reusa el STATUS_FLOW desde tracking-progress. Pinta steps:
 *  - done    → bullet wine con ✓
 *  - active  → bullet wine con número actual
 *  - pending → bullet hueco con número
 *  - exception → bullet rojo
 */

import {
  buildTimeline,
  type TimelineStepState,
} from "@/lib/studio/tracking-progress";
import { STATUS_LABELS, type Shipment } from "@/lib/studio/shipment-types";

type Props = {
  shipment: Shipment;
};

function bulletFill(state: TimelineStepState): string {
  if (state === "done" || state === "active") return "var(--wine)";
  if (state === "exception") return "var(--danger)";
  return "var(--bg-elevated)";
}

function bulletBorder(state: TimelineStepState): string {
  if (state === "done" || state === "active") return "var(--wine)";
  if (state === "exception") return "var(--danger)";
  return "var(--border-strong)";
}

function bulletText(state: TimelineStepState): string {
  if (state === "done" || state === "active" || state === "exception")
    return "var(--bg-surface)";
  return "var(--ink-mute)";
}

function metaLabel(state: TimelineStepState): string {
  switch (state) {
    case "done":
      return "Completado";
    case "active":
      return "En curso · ahora";
    case "exception":
      return "Excepción activa";
    default:
      return "Pendiente";
  }
}

function metaColor(state: TimelineStepState): string {
  if (state === "active") return "var(--wine)";
  if (state === "exception") return "var(--danger)";
  return "var(--ink-soft)";
}

export function TrackingTimeline({ shipment }: Props) {
  const steps = buildTimeline(shipment.status, shipment.shipment_service);

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 20,
      }}
    >
      <div
        className="studio-eyebrow"
        style={{ color: "var(--wine)", marginBottom: 16 }}
      >
        Eventos del embarque
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const lineColor =
            step.state === "done" ? "var(--wine)" : "var(--border)";

          return (
            <div
              key={step.status}
              style={{
                display: "flex",
                gap: 14,
                position: "relative",
                padding: "10px 0",
              }}
            >
              {/* Línea vertical que conecta steps */}
              {!isLast && (
                <div
                  style={{
                    position: "absolute",
                    left: 9,
                    top: 22,
                    bottom: -4,
                    width: 2,
                    background: lineColor,
                  }}
                />
              )}

              {/* Bullet */}
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: bulletFill(step.state),
                  border: `2px solid ${bulletBorder(step.state)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: bulletText(step.state),
                  font: "700 10px/1 var(--f-sans)",
                  marginTop: 2,
                  position: "relative",
                  zIndex: 1,
                }}
                aria-hidden
              >
                {step.state === "done" ? "✓" : i + 1}
              </div>

              {/* Texto */}
              <div style={{ flex: 1, paddingBottom: 8 }}>
                <div
                  style={{
                    font: `${step.state === "active" ? "800" : "600"} 13.5px/1.2 var(--f-sans)`,
                    color:
                      step.state === "pending"
                        ? "var(--ink-mute)"
                        : "var(--ink)",
                  }}
                >
                  {STATUS_LABELS[step.status]}
                </div>
                <div
                  style={{
                    font: "500 11px/1 var(--f-sans)",
                    color: metaColor(step.state),
                    marginTop: 4,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {metaLabel(step.state)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
