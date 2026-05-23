/**
 * Maquina de estados del modulo Tracking.
 *
 * Para cada servicio comercial, define que estados son APLICABLES.
 * El form de creacion/edicion usa esta info para mostrar solo opciones validas.
 *
 * La DB acepta cualquier transicion de status — esta capa es UI hint, no enforcement.
 * Si en algun momento queremos enforcement duro, agregamos un trigger SQL.
 *
 * Matriz completa documentada en SDD-0003 sec. 7.3.
 */

import type { ShipmentService, ShipmentStatus } from "./shipment-types";

export const STATE_MACHINE: Record<
  ShipmentService,
  {
    applicableStatuses: ShipmentStatus[];
    defaultInitial: ShipmentStatus;
  }
> = {
  consolidacion: {
    applicableStatuses: [
      "draft",
      "in_warehouse",
      "consolidating",
      "shipped",
      "in_transit",
      "in_customs",
      "arrived_destination",
      "delayed_warehouse",
      "out_for_delivery",
      "delivered",
      "exception",
      "cancelled",
    ],
    defaultInitial: "draft",
  },
  puerta_a_puerta_DDP: {
    applicableStatuses: [
      "draft",
      "in_warehouse",
      "consolidating",
      "shipped",
      "in_transit",
      "in_customs",
      "arrived_destination",
      "delayed_warehouse",
      "out_for_delivery",
      "delivered",
      "exception",
      "cancelled",
    ],
    defaultInitial: "draft",
  },
  reserva_FCL: {
    applicableStatuses: [
      "draft",
      "in_warehouse",
      "shipped",
      "in_transit",
      "in_customs",
      "last_mile",
      "delivered",
      "exception",
      "cancelled",
    ],
    defaultInitial: "draft",
  },
  transporte_terrestre: {
    applicableStatuses: [
      "draft",
      "in_warehouse",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "exception",
      "cancelled",
    ],
    defaultInitial: "draft",
  },
};

export function isValidStatusForService(
  service: ShipmentService,
  status: ShipmentStatus,
): boolean {
  return STATE_MACHINE[service].applicableStatuses.includes(status);
}

export function getApplicableStatuses(
  service: ShipmentService,
): ShipmentStatus[] {
  return STATE_MACHINE[service].applicableStatuses;
}

export function getDefaultInitialStatus(
  service: ShipmentService,
): ShipmentStatus {
  return STATE_MACHINE[service].defaultInitial;
}
