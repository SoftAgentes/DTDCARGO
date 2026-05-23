/**
 * Helpers para las acciones contextuales del Tracking.
 *
 * Dado un (service, status) actual, devuelve los botones de transicion
 * que mostramos en el panel "Acciones" del detalle.
 *
 * Reglas:
 * - Maximo 3-4 botones, los mas frecuentes primero
 * - "Excepcion" siempre disponible (salvo si ya es exception)
 * - Estados terminales (delivered, cancelled) no tienen acciones — operacion cerrada
 * - "Cancelar" no aparece aca — vive en el modal del footer con razon obligatoria
 *
 * Flujo natural por servicio definido en FLOWS.
 *
 * La matriz original sale del SDD-0003 sec. 7.3 + SDD-0006 sec. 4.1.
 */

import type { ShipmentService, ShipmentStatus } from "./shipment-types";

export type TransitionAction = {
  status: ShipmentStatus;
  label: string;
  variant: "primary" | "warning" | "neutral";
};

/**
 * Flujo natural lineal por servicio. Index alto = mas tarde en el ciclo.
 * No incluye estados side-branch (delayed_warehouse, exception, cancelled).
 */
const FLOWS: Record<ShipmentService, ShipmentStatus[]> = {
  consolidacion: [
    "draft",
    "in_warehouse",
    "consolidating",
    "shipped",
    "in_transit",
    "in_customs",
    "arrived_destination",
    "out_for_delivery",
    "delivered",
  ],
  puerta_a_puerta_DDP: [
    "draft",
    "in_warehouse",
    "consolidating",
    "shipped",
    "in_transit",
    "in_customs",
    "arrived_destination",
    "out_for_delivery",
    "delivered",
  ],
  reserva_FCL: [
    "draft",
    "in_warehouse",
    "shipped",
    "in_transit",
    "in_customs",
    "last_mile",
    "delivered",
  ],
  transporte_terrestre: [
    "draft",
    "in_warehouse",
    "in_transit",
    "out_for_delivery",
    "delivered",
  ],
};

/** Labels cortos para los botones (verbo de accion). */
const ACTION_LABELS: Record<ShipmentStatus, string> = {
  draft: "borrador",
  in_warehouse: "en bodega",
  consolidating: "consolidando",
  shipped: "embarcado",
  in_transit: "en tránsito",
  in_customs: "en aduana",
  arrived_destination: "llegado a bodega VE",
  delayed_warehouse: "bodegaje activo",
  out_for_delivery: "en reparto",
  last_mile: "última milla",
  delivered: "entregado",
  exception: "excepción",
  cancelled: "cancelado",
};

/**
 * Devuelve las acciones recomendadas para el estado actual.
 * Si el estado es terminal, devuelve [].
 */
export function getNextActions(
  service: ShipmentService,
  status: ShipmentStatus,
): TransitionAction[] {
  // Terminal — no hay acciones
  if (status === "delivered" || status === "cancelled") return [];

  const flow = FLOWS[service];
  const idx = flow.indexOf(status);
  const actions: TransitionAction[] = [];

  // 1. Proximo en el flujo natural
  if (idx >= 0 && idx < flow.length - 1) {
    const next = flow[idx + 1];
    actions.push({
      status: next,
      label: `→ Marcar ${ACTION_LABELS[next]}`,
      variant: "primary",
    });
  }

  // 2. Side branch: para LCL/DDP, arrived_destination → delayed_warehouse
  if (
    (service === "consolidacion" || service === "puerta_a_puerta_DDP") &&
    status === "arrived_destination"
  ) {
    actions.push({
      status: "delayed_warehouse",
      label: "⏳ Marcar bodegaje",
      variant: "warning",
    });
  }

  // 3. Volver de delayed_warehouse al flujo (sale al reparto)
  if (status === "delayed_warehouse") {
    actions.push({
      status: "out_for_delivery",
      label: "→ Marcar en reparto",
      variant: "primary",
    });
  }

  // 4. Excepcion siempre disponible (salvo si ya es exception)
  if (status !== "exception") {
    actions.push({
      status: "exception",
      label: "⚠ Marcar excepción",
      variant: "warning",
    });
  }

  // 5. Salir de excepcion: volver al estado anterior conocido del flujo.
  //    Sin historial completo en este helper, ofrecemos volver a in_warehouse
  //    como "punto de retorno seguro" para que el operador retome.
  if (status === "exception") {
    actions.push({
      status: "in_warehouse",
      label: "↩ Volver a en bodega",
      variant: "neutral",
    });
  }

  return actions;
}

/**
 * Indica si un estado es terminal (no admite cambios desde UI).
 */
export function isTerminalStatus(status: ShipmentStatus): boolean {
  return status === "delivered" || status === "cancelled";
}
