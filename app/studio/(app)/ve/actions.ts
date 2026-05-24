/**
 * Server actions del módulo Almacén VE (SDD-0017).
 *
 * Las 4 acciones operativas son cambios de status del shipment + insert de
 * event en shipment_events para timeline. Validan state machine (no permiten
 * salto a estados inválidos desde el actual).
 *
 * Reusan trigger set_delivered_at de la migration 0009 (setea delivered_at
 * automáticamente al pasar a delivered).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";

type ActionResult = { ok?: boolean; error?: string };

// ─────────────────────────────────────────────────────────────
// Helper genérico de transición + event
// ─────────────────────────────────────────────────────────────

async function transitionStatus(
  shipmentId: string,
  fromStatuses: ShipmentStatus[],
  toStatus: ShipmentStatus,
  options: {
    eventNote: string;
    extraFields?: Record<string, unknown>;
  },
): Promise<ActionResult> {
  if (!shipmentId) return { error: "shipment_id requerido" };

  const supabase = await createClient();

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { data: current, error: readErr } = await supabase
    .from("shipments")
    .select("status, code")
    .eq("id", shipmentId)
    .maybeSingle<{ status: ShipmentStatus; code: string }>();

  if (readErr || !current) return { error: "Shipment no encontrado." };

  if (!fromStatuses.includes(current.status)) {
    return {
      error: `Acción inválida desde estado "${current.status}". Estados permitidos: ${fromStatuses.join(", ")}.`,
    };
  }

  const { error: updateErr } = await supabase
    .from("shipments")
    .update({ status: toStatus, ...(options.extraFields ?? {}) })
    .eq("id", shipmentId);

  if (updateErr) {
    return { error: `No se pudo cambiar el estado: ${updateErr.message}` };
  }

  // Insertar event de timeline (best-effort, no rollback)
  await supabase.from("shipment_events").insert({
    tenant_id: link.tenant_id,
    shipment_id: shipmentId,
    status: toStatus,
    note: options.eventNote,
  });

  revalidatePath("/studio/ve");
  revalidatePath(`/studio/tracking/${shipmentId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// 4 acciones operativas VE
// ─────────────────────────────────────────────────────────────

export async function markCustomsReleasedAction(
  shipmentId: string,
): Promise<ActionResult> {
  return transitionStatus(
    shipmentId,
    ["in_customs"],
    "arrived_destination",
    {
      eventNote: "Liberado de aduana SENIAT · listo para retiro",
    },
  );
}

export async function assignDeliveryAction(
  shipmentId: string,
  params: { deliveryAddress?: string; note?: string } = {},
): Promise<ActionResult> {
  const extraFields: Record<string, unknown> = {};
  if (params.deliveryAddress?.trim()) {
    extraFields.delivery_address = params.deliveryAddress.trim();
  }

  const noteParts = ["Asignado para reparto DDP"];
  if (params.deliveryAddress?.trim()) {
    noteParts.push(`Destino final: ${params.deliveryAddress.trim()}`);
  }
  if (params.note?.trim()) {
    noteParts.push(params.note.trim());
  }

  return transitionStatus(
    shipmentId,
    ["arrived_destination"],
    "out_for_delivery",
    {
      eventNote: noteParts.join(" · "),
      extraFields,
    },
  );
}

export async function markDeliveredAction(
  shipmentId: string,
  params: { podSignedBy?: string } = {},
): Promise<ActionResult> {
  const extraFields: Record<string, unknown> = {};
  if (params.podSignedBy?.trim()) {
    extraFields.pod_signed_by = params.podSignedBy.trim();
  }
  // delivered_at se setea automáticamente por trigger set_delivered_at (0009)

  const eventNote = params.podSignedBy?.trim()
    ? `Entregado · POD firmado por ${params.podSignedBy.trim()}`
    : "Entregado · POD firmado";

  return transitionStatus(
    shipmentId,
    ["out_for_delivery", "last_mile"],
    "delivered",
    {
      eventNote,
      extraFields,
    },
  );
}

export async function reportIncidentAction(
  shipmentId: string,
  params: { reason: string },
): Promise<ActionResult> {
  const reason = params.reason?.trim();
  if (!reason) return { error: "Indicá la razón de la incidencia." };

  return transitionStatus(
    shipmentId,
    [
      "arrived_destination",
      "in_customs",
      "out_for_delivery",
      "last_mile",
    ],
    "exception",
    {
      eventNote: `Incidencia reportada: ${reason}`,
      extraFields: { cancellation_reason: reason },
    },
  );
}
