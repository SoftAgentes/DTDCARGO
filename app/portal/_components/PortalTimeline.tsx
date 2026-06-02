import {
  buildTimeline,
  STATUS_LABELS,
  type ShipmentService,
  type ShipmentStatus,
  type TimelineStepState,
} from "@/lib/portal/portal-types";

/**
 * Timeline de estado del envío (read-only) para el portal del cliente.
 *
 * REUSA la derivación canónica `buildTimeline(status, service)` de
 * `lib/studio/tracking-progress` (vía el re-export de portal-types) — la misma
 * que pinta el Studio y el tracking público. Acá sólo cambia la PIEL: clases
 * brand del sitio público (paper/wine/Archivo, tokens var(--*)), no el sistema
 * dark del Studio. Muestra el paso actual resaltado + los cumplidos vs pendientes.
 */

/** Copy del meta-estado de cada paso, en voseo VE. */
function stepMeta(state: TimelineStepState, status: ShipmentStatus): string {
  switch (state) {
    case "done":
      return "Cumplido";
    case "active":
      // El estado terminal "delivered" llega como "active" (es el status
      // actual) — pero para el cliente es un hecho cumplido, no algo en curso.
      return status === "delivered" ? "Entregado" : "En curso · ahora";
    case "exception":
      return "Atención";
    default:
      return "Pendiente";
  }
}

export function PortalTimeline({
  status,
  service,
}: {
  status: ShipmentStatus;
  service: ShipmentService;
}) {
  const steps = buildTimeline(status, service);

  return (
    <div className="flex flex-col">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const reached = step.state === "done" || step.state === "active";
        const isException = step.state === "exception";
        // Color del nodo y la línea: wine para alcanzado, danger para excepción,
        // gris para pendiente.
        // El envío entregado se "celebra" en verde (cierra el loop con el
        // StatusBadge, que ya es success para delivered).
        const isDeliveredFinal =
          step.status === "delivered" && step.state === "active";
        const dotColor = isException
          ? "var(--color-status-danger)"
          : isDeliveredFinal
            ? "var(--color-status-success)"
            : reached
              ? "var(--color-wine)"
              : "var(--color-grey-300)";
        // La línea hacia el siguiente paso se "llena" sólo si ESTE paso ya está
        // cumplido (el tramo recorrido).
        const lineColor =
          step.state === "done"
            ? "var(--color-wine)"
            : "var(--color-grey-200)";

        return (
          <div
            key={step.status}
            className="grid grid-cols-[24px_1fr] gap-4"
            style={{ position: "relative" }}
          >
            {/* Línea vertical que conecta con el siguiente nodo */}
            {!isLast ? (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 11,
                  top: 20,
                  bottom: -4,
                  width: 2,
                  background: lineColor,
                }}
              />
            ) : null}

            {/* Nodo */}
            <span
              aria-hidden
              className="rounded-full"
              style={{
                width: 14,
                height: 14,
                marginTop: 4,
                marginLeft: 5,
                background: reached || isException ? dotColor : "var(--color-paper)",
                border: `2px solid ${dotColor}`,
                boxShadow:
                  step.state === "active"
                    ? "0 0 0 4px rgba(127,15,26,0.18)"
                    : undefined,
                zIndex: 1,
                position: "relative",
                flexShrink: 0,
              }}
            />

            {/* Texto */}
            <div className="pb-6">
              <div
                className={`text-[14.5px] leading-[1.3] ${
                  step.state === "pending"
                    ? "text-grey-500 font-medium"
                    : "text-ink font-semibold"
                }`}
                style={
                  step.state === "active"
                    ? { fontFamily: "var(--font-archivo-black)" }
                    : undefined
                }
              >
                {STATUS_LABELS[step.status]}
              </div>
              <div
                className="mt-1 text-[11px] font-semibold tracking-[0.08em] uppercase"
                style={{
                  color: isException
                    ? "var(--color-status-danger)"
                    : isDeliveredFinal
                      ? "var(--color-status-success)"
                      : step.state === "active"
                        ? "var(--color-wine)"
                        : "var(--color-grey-500)",
                }}
              >
                {stepMeta(step.state, step.status)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
