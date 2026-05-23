"use client";

/**
 * Panel de acciones contextuales para cambiar el estado del envio.
 *
 * Muestra botones segun lib/studio/shipment-actions.ts → getNextActions().
 * Cada click llama a transitionShipment() server action.
 *
 * Para estados terminales (delivered, cancelled) muestra mensaje de cierre.
 */

import { useState, useTransition } from "react";
import { transitionShipment } from "../actions";
import {
  getNextActions,
  isTerminalStatus,
} from "@/lib/studio/shipment-actions";
import { STATUS_LABELS } from "@/lib/studio/shipment-types";
import type {
  ShipmentService,
  ShipmentStatus,
} from "@/lib/studio/shipment-types";

/**
 * Mapeo variant del action → clase del sistema de botones del Studio.
 * Garantiza consistencia con el resto de botones de la app.
 */
const VARIANT_CLASS: Record<"primary" | "warning" | "neutral", string> = {
  primary: "studio-btn studio-btn-dark studio-btn-sm",
  warning: "studio-btn studio-btn-warning studio-btn-sm",
  neutral: "studio-btn studio-btn-ghost studio-btn-sm",
};

export function StateActionsPanel({
  shipmentId,
  service,
  status,
}: {
  shipmentId: string;
  service: ShipmentService;
  status: ShipmentStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const actions = getNextActions(service, status);
  const terminal = isTerminalStatus(status);

  const handleTransition = (newStatus: ShipmentStatus) => {
    setError(null);
    startTransition(async () => {
      const result = await transitionShipment(shipmentId, newStatus);
      if (result.error) setError(result.error);
    });
  };

  if (terminal) {
    return (
      <div>
        <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
          Acciones
        </div>
        <p
          style={{
            font: "500 12.5px/1.5 Archivo, sans-serif",
            color: "#6B6B6B",
            margin: 0,
            padding: "12px 14px",
            background: "#F2F0EC",
            borderRadius: 6,
            border: "1px dashed #C9C5BE",
          }}
        >
          Envío {status === "delivered" ? "entregado" : "cancelado"}. Operación cerrada.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
        Acciones
      </div>

      {actions.length === 0 ? (
        <p
          style={{
            font: "500 12.5px/1.5 Archivo, sans-serif",
            color: "#6B6B6B",
            margin: 0,
          }}
        >
          Sin acciones sugeridas. Usá "Agregar evento manual" abajo.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {actions.map((a) => (
            <button
              key={a.status}
              type="button"
              onClick={() => handleTransition(a.status)}
              disabled={isPending}
              className={VARIANT_CLASS[a.variant]}
              style={{
                justifyContent: "flex-start",
                opacity: isPending ? 0.6 : 1,
              }}
              title={`Cambia estado a "${STATUS_LABELS[a.status]}"`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p
          style={{
            marginTop: 10,
            color: "#C2353F",
            font: "500 11.5px/1.4 Archivo, sans-serif",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
