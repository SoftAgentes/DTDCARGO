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
  mark_delivered: "Confirmar entrega manual",
  report_incident: "Reportar incidencia",
  view_detail: "Ver detalle completo",
};

export type VeDeliveryCompletionInput = {
  shipment_id: string;
  from: "out_for_delivery" | "last_mile";
  received_by: string;
  reason: string;
  request_ref: string;
};

export type VeDeliveryCompletionValidation =
  | { ok: true; input: VeDeliveryCompletionInput }
  | { ok: false; error: string };

/** Contrato público del fallback manual R3 de entrega VE. */
export function validateVeDeliveryCompletionInput(
  raw: Record<string, unknown>,
): VeDeliveryCompletionValidation {
  const shipmentId = String(raw.shipment_id ?? "").trim();
  const from = String(raw.from ?? "").trim();
  const receivedBy = String(raw.received_by ?? "").trim();
  const reason = String(raw.reason ?? "").trim();
  const requestRef = String(raw.request_ref ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shipmentId)) {
    return { ok: false, error: "Embarque inválido." };
  }
  if (from !== "out_for_delivery" && from !== "last_mile") {
    return { ok: false, error: "El embarque cambió de estado. Actualiza la página." };
  }
  if (receivedBy.length < 2 || receivedBy.length > 200) {
    return { ok: false, error: "Indica el receptor con 2 a 200 caracteres." };
  }
  if (reason.length < 4 || reason.length > 1_000) {
    return { ok: false, error: "El motivo debe tener entre 4 y 1000 caracteres." };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(requestRef)) {
    return { ok: false, error: "La referencia de la operación es inválida." };
  }
  return {
    ok: true,
    input: {
      shipment_id: shipmentId,
      from,
      received_by: receivedBy,
      reason,
      request_ref: requestRef,
    },
  };
}
