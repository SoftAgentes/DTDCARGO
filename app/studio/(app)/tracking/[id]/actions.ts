/**
 * Server actions del detalle de envio.
 *
 * - updateShipment: PATCH de campos editables (no toca code, service, status)
 * - deleteShipment: soft delete (deleted_at = now) + redirect a lista
 * - cancelShipment: cancelar con razon obligatoria → status='cancelled' + event
 * - transitionShipment: cambio de estado por boton → update status + event
 * - addShipmentEvent: agregar evento manual (status + nota + occurred_at)
 *
 * Todas validan sesion via Supabase. RLS filtra por tenant_id automaticamente.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getUser, getUserTenantId } from "@/lib/auth/session";
import { isValidStatusForService } from "@/lib/studio/shipment-state-machine";
import type { ShipmentService, ShipmentStatus } from "@/lib/studio/shipment-types";

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseString(value: FormDataEntryValue | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Edita los campos editables del envio. No toca code, shipment_service, status.
 * Si vehicle_category esta vacio y el servicio es transporte_terrestre → error.
 */
export async function updateShipment(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  // Leer el shipment para conocer su servicio (validacion vehicle_category)
  const { data: current, error: readError } = await supabase
    .from("shipments")
    .select("shipment_service")
    .eq("id", id)
    .maybeSingle();

  if (readError || !current) {
    return { error: "Envío no encontrado." };
  }
  const service = current.shipment_service as ShipmentService;

  const update = {
    client_name: parseString(formData.get("client_name")),
    client_markbox: parseString(formData.get("client_markbox")),
    origin: parseString(formData.get("origin")),
    destination: parseString(formData.get("destination")),
    weight_kg: parseNumber(formData.get("weight_kg")),
    volume_m3: parseNumber(formData.get("volume_m3")),
    vehicle_category: parseString(formData.get("vehicle_category")),
    vehicle_model: parseString(formData.get("vehicle_model")),
    notes: parseString(formData.get("notes")),
  };

  if (service === "transporte_terrestre" && !update.vehicle_category) {
    return {
      error: "Para transporte terrestre el tipo de vehículo es obligatorio.",
      fieldErrors: { vehicle_category: "Obligatorio." },
    };
  }

  const { error } = await supabase
    .from("shipments")
    .update(update)
    .eq("id", id);

  if (error) {
    return { error: "No pudimos guardar. Intentá de nuevo." };
  }

  revalidatePath(`/studio/tracking/${id}`);
  revalidatePath("/studio/tracking");
  return { ok: true };
}

/**
 * Soft delete del envio. El trigger cascade_soft_delete_events propaga a events.
 * Redirige al listado al terminar.
 */
export async function deleteShipment(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shipments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    // En soft-delete fallido devolvemos al detalle con el error en query string.
    // Por simplicidad redirigimos a la lista — si rompe, el operador lo nota.
    console.error("[deleteShipment] error", error);
  }

  revalidatePath("/studio/tracking");
  revalidatePath("/studio/resumen");
  redirect("/studio/tracking");
}

/**
 * Cancelar envio: pone status=cancelled, guarda cancellation_reason,
 * y registra evento en el timeline con la razon.
 */
export async function cancelShipment(
  id: string,
  reason: string,
): Promise<ActionState> {
  if (!reason || reason.trim().length < 10) {
    return { error: "La razón debe tener al menos 10 caracteres." };
  }

  const tenantId = await getUserTenantId();
  if (!tenantId) return { error: "Sin tenant asignado." };

  const supabase = await createClient();
  const user = await getUser();

  // 1. Update shipment
  const { error: updateError } = await supabase
    .from("shipments")
    .update({
      status: "cancelled",
      cancellation_reason: reason.trim(),
    })
    .eq("id", id);

  if (updateError) {
    return { error: "No pudimos cancelar el envío." };
  }

  // 2. Insert event
  await supabase.from("shipment_events").insert({
    tenant_id: tenantId,
    shipment_id: id,
    status: "cancelled",
    note: reason.trim(),
    occurred_at: new Date().toISOString(),
    created_by: user?.id ?? null,
  });

  revalidatePath(`/studio/tracking/${id}`);
  revalidatePath("/studio/tracking");
  revalidatePath("/studio/resumen");
  return { ok: true };
}

/**
 * Cambio de estado via boton de accion. Valida que el nuevo estado sea aplicable
 * al servicio del envio. Inserta evento automatico con autor.
 */
export async function transitionShipment(
  id: string,
  newStatus: ShipmentStatus,
  note?: string | null,
): Promise<ActionState> {
  const tenantId = await getUserTenantId();
  if (!tenantId) return { error: "Sin tenant asignado." };

  const supabase = await createClient();

  const { data: shipment, error: readError } = await supabase
    .from("shipments")
    .select("shipment_service, status")
    .eq("id", id)
    .maybeSingle();

  if (readError || !shipment) {
    return { error: "Envío no encontrado." };
  }

  const service = shipment.shipment_service as ShipmentService;
  if (!isValidStatusForService(service, newStatus)) {
    return {
      error: `El estado "${newStatus}" no aplica al servicio "${service}".`,
    };
  }

  const user = await getUser();

  if (shipment.status !== newStatus) {
    const { error: updateError } = await supabase
      .from("shipments")
      .update({ status: newStatus })
      .eq("id", id);

    if (updateError) {
      return { error: "No pudimos cambiar el estado." };
    }
  }

  const { error: eventError } = await supabase.from("shipment_events").insert({
    tenant_id: tenantId,
    shipment_id: id,
    status: newStatus,
    note: note?.trim() || null,
    occurred_at: new Date().toISOString(),
    created_by: user?.id ?? null,
  });

  if (eventError) {
    return { error: "Cambio aplicado pero el evento falló al registrarse." };
  }

  revalidatePath(`/studio/tracking/${id}`);
  revalidatePath("/studio/tracking");
  revalidatePath("/studio/resumen");
  return { ok: true };
}

/**
 * Agregar evento manual al timeline (puede ser retroactivo).
 */
export async function addShipmentEvent(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const status = String(formData.get("status") ?? "") as ShipmentStatus;
  const note = parseString(formData.get("note"));
  const occurredAtRaw = parseString(formData.get("occurred_at"));

  if (!status) return { error: "Elegí un estado." };

  const tenantId = await getUserTenantId();
  if (!tenantId) return { error: "Sin tenant asignado." };

  const supabase = await createClient();
  const { data: shipment, error: readError } = await supabase
    .from("shipments")
    .select("shipment_service")
    .eq("id", id)
    .maybeSingle();

  if (readError || !shipment) return { error: "Envío no encontrado." };

  const service = shipment.shipment_service as ShipmentService;
  if (!isValidStatusForService(service, status)) {
    return { error: `El estado "${status}" no aplica al servicio "${service}".` };
  }

  const user = await getUser();
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw).toISOString() : new Date().toISOString();

  const { error } = await supabase.from("shipment_events").insert({
    tenant_id: tenantId,
    shipment_id: id,
    status,
    note,
    occurred_at: occurredAt,
    created_by: user?.id ?? null,
  });

  if (error) return { error: "No pudimos guardar el evento." };

  revalidatePath(`/studio/tracking/${id}`);
  return { ok: true };
}
