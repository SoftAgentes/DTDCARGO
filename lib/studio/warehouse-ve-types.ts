/**
 * Tipos + labels + tones del módulo Almacén VE (SDD-0017).
 *
 * Modelado como vista derivada de `shipments`: cada "VE receipt" es un
 * shipment en cierto estado VE-relevant. Sin tabla nueva.
 *
 * Reusa el enum shipment_status existente — no creamos enum paralelo.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";
import type { Shipment, ShipmentStatus } from "./shipment-types";

// ─────────────────────────────────────────────────────────────
// Subset de status que califican como "VE receipt"
// ─────────────────────────────────────────────────────────────

export const VE_STATUSES = [
  "arrived_destination",
  "in_customs",
  "out_for_delivery",
  "last_mile",
  "delivered",
  "exception",
] as const satisfies readonly ShipmentStatus[];

export type VeStatus = (typeof VE_STATUSES)[number];

export function isVeStatus(s: string | null | undefined): s is VeStatus {
  return !!s && (VE_STATUSES as readonly string[]).includes(s);
}

// ─────────────────────────────────────────────────────────────
// Labels VE-friendly (distintos de los labels operativos generales)
// ─────────────────────────────────────────────────────────────

export const VE_STATUS_LABELS: Record<VeStatus, string> = {
  arrived_destination: "Listo retiro",
  in_customs: "En aduana SENIAT",
  out_for_delivery: "En reparto",
  last_mile: "Última milla",
  delivered: "Entregado · POD",
  exception: "Incidencia",
};

/**
 * Tonos de Badge para los 6 estados VE.
 * Convención color theory (SDD-0014 audit):
 * - warning = trámite que requiere atención (aduana)
 * - info = liberado, listo para próximo paso
 * - wine = acción del operario en curso (reparto)
 * - success = terminal positivo (entregado)
 * - danger = problema (incidencia)
 */
export const VE_STATUS_TONES: Record<VeStatus, BadgeTone> = {
  arrived_destination: "info",
  in_customs: "warning",
  out_for_delivery: "wine",
  last_mile: "wine",
  delivered: "success",
  exception: "danger",
};

export const VE_STATUS_OPTIONS: { value: VeStatus; label: string }[] =
  VE_STATUSES.map((s) => ({ value: s, label: VE_STATUS_LABELS[s] }));

// ─────────────────────────────────────────────────────────────
// Row type del listado VE
// ─────────────────────────────────────────────────────────────

/**
 * Subset de Shipment que se muestra en la tabla VE.
 * Incluye los 3 fields nuevos de SDD-0017 (delivery_address, delivered_at,
 * pod_signed_by).
 */
export type VeReceiptRow = Pick<
  Shipment,
  | "id"
  | "code"
  | "client_name"
  | "client_markbox"
  | "destination"
  | "destination_gps"
  | "delivery_address"
  | "shipment_service"
  | "status"
  | "weight_kg"
  | "volume_m3"
  | "arrived_destination_at"
  | "delivered_at"
  | "pod_signed_by"
  | "created_at"
>;

// ─────────────────────────────────────────────────────────────
// Action availability — qué acciones se muestran en menú según status
// ─────────────────────────────────────────────────────────────

export type VeAction =
  | "mark_customs_released"
  | "assign_delivery"
  | "mark_delivered"
  | "report_incident"
  | "view_detail";

export function availableActions(status: ShipmentStatus): VeAction[] {
  const actions: VeAction[] = [];
  if (status === "in_customs") actions.push("mark_customs_released");
  if (status === "arrived_destination") actions.push("assign_delivery");
  if (status === "out_for_delivery" || status === "last_mile") {
    actions.push("mark_delivered");
  }
  if (status !== "delivered" && status !== "exception") {
    actions.push("report_incident");
  }
  actions.push("view_detail");
  return actions;
}

export const VE_ACTION_LABELS: Record<VeAction, string> = {
  mark_customs_released: "Marcar liberado de aduana",
  assign_delivery: "Asignar reparto",
  mark_delivered: "Marcar entregado",
  report_incident: "Reportar incidencia",
  view_detail: "Ver detalle completo",
};
