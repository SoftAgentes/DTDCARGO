/**
 * Server actions del detalle de envio.
 *
 * - updateShipment: PATCH de campos editables (no toca code, service, status)
 * - deleteShipment: soft delete (deleted_at = now) + redirect a lista
 * - cancelShipment: cancelar con razon obligatoria → status='cancelled' + event
 * - transitionShipment: cambio de estado por boton → update status + event
 * - addShipmentEvent: agregar evento manual (status + nota + occurred_at)
 * - changeDestination: cambia destino del envio + registra fee en timeline (SDD-0009)
 *
 * Todas validan sesion via Supabase. RLS filtra por tenant_id automaticamente.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { createAdminClient } from "@/lib/db/admin";
import { getUser, getUserTenantId } from "@/lib/auth/session";
import { isValidStatusForService } from "@/lib/studio/shipment-state-machine";
import { formatChangeNote, findRateForDestination } from "@/lib/studio/destination-change";
import type { Rate } from "@/lib/studio/rate-types";
import type { ShipmentService, ShipmentStatus } from "@/lib/studio/shipment-types";
import { fireMailEvent } from "@/lib/studio/mail/mail-rule-engine";
import { scheduleClientNotifications } from "@/lib/studio/notifications/schedule-client-notifications";
import { statusEvent } from "@/lib/studio/notifications/client-notification-types";

/** Estados terminales en los que no se puede cambiar el destino. */
const TERMINAL_STATUSES: ShipmentStatus[] = ["delivered", "cancelled"];

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseIsoInstant(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Reprograma el plan sin alterar los hitos reales del embarque (SDD-0223). */
export async function updateShipmentPlan(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };

  const version = Number(formData.get("planning_version"));
  const reason = String(formData.get("planning_reason") ?? "").trim();
  const timezone = String(formData.get("planning_timezone") ?? "").trim();
  if (!Number.isInteger(version) || version < 0) {
    return { error: "La versión del plan es inválida. Recarga la página." };
  }
  if (reason.length < 4) {
    return { error: "Indica un motivo de al menos 4 caracteres." };
  }

  const { error } = await supabase.rpc("update_shipment_plan", {
    p_shipment_id: id,
    p_expected_version: version,
    p_departure_at: parseIsoInstant(formData.get("planned_departure_at")),
    p_arrival_at: parseIsoInstant(formData.get("planned_arrival_at")),
    p_delivery_at: parseIsoInstant(formData.get("planned_delivery_at")),
    p_timezone: timezone,
    p_reason: reason,
  });
  if (error) {
    const conflict = error.code === "40001";
    return {
      error: conflict
        ? "El plan cambió en otra sesión. Recarga antes de guardar."
        : error.message.includes("cronológica")
          ? "La salida, llegada y entrega deben conservar el orden cronológico."
          : "No pudimos guardar la planificación.",
    };
  }
  revalidatePath(`/studio/tracking/${id}`);
  revalidatePath("/studio/calendario");
  return { ok: true };
}

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
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };


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

  // client_name y client_markbox NO se actualizan desde edicion del detalle —
  // vienen de la base de clientes externa. Defensa server-side: aunque alguien
  // edite el HTML, el server no procesa esos campos.
  const update = {
    origin: parseString(formData.get("origin")),
    destination: parseString(formData.get("destination")),
    destination_gps: parseString(formData.get("destination_gps")),
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
    return { error: "No pudimos guardar. Intenta de nuevo." };
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
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };

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
  if (newStatus === "delivered") {
    return {
      error: "Confirma la entrega manual desde Almacén VE o usa el POD sellado de Despacho.",
    };
  }
  const tenantId = await getUserTenantId();
  if (!tenantId) return { error: "Sin tenant asignado." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };


  const { data: shipment, error: readError } = await supabase
    .from("shipments")
    .select(
      "shipment_service, status, code, client_name, client_markbox, destination",
    )
    .eq("id", id)
    .maybeSingle<{
      shipment_service: ShipmentService;
      status: ShipmentStatus;
      code: string;
      client_name: string | null;
      client_markbox: string | null;
      destination: string | null;
    }>();

  if (readError || !shipment) {
    return { error: "Envío no encontrado." };
  }

  const service = shipment.shipment_service;
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

  // Solo el arribo a destino dispara el evento de mail. Otros transitions
  // (in_warehouse, in_transit, etc) son ruido si se notifica cada uno.
  if (newStatus === "arrived_destination" && shipment.status !== newStatus) {
    const admin = createAdminClient();
    await fireMailEvent(admin, tenantId, {
      event: "shipment_arrived",
      vars: {
        customer_name: shipment.client_name ?? "cliente",
        shipment_code: shipment.code,
        destination: shipment.destination ?? "—",
        arrival_date: new Date().toLocaleDateString("es-VE", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        customs_eta_days: "—",
      },
      clientMarkbox: shipment.client_markbox,
      clientName: shipment.client_name,
      sourceRef: { kind: "shipment", id },
    });
  }

  // SDD-0156: motor configurable de avisos al cliente (reemplaza el aviso inline
  // de SDD-0132). Programa según las reglas del tenant (canal · offset · texto ·
  // visibilidad); el drain (inline + cron) despacha. arrived_destination NO entra
  // acá: sigue por su template shipment_arrived (arriba) para no duplicar.
  // Best-effort: nunca rompe el cambio de estado.
  if (shipment.status !== newStatus && newStatus !== "arrived_destination") {
    const admin = createAdminClient();
    await scheduleClientNotifications(admin, tenantId, {
      shipmentId: id,
      shipmentCode: shipment.code,
      clientMarkbox: shipment.client_markbox,
      clientName: shipment.client_name,
      event: statusEvent(newStatus),
      eventTime: new Date(),
    });
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

  if (!status) return { error: "Elige un estado." };

  const tenantId = await getUserTenantId();
  if (!tenantId) return { error: "Sin tenant asignado." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };

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

/**
 * SDD-0009: cambio de destino + registro de fee en el timeline.
 *
 * - Update shipments.destination (y destination_gps si se pasó)
 * - Insert shipment_event con note estructurada (parseable para Facturación futura)
 * - El estado del envío NO cambia
 * - Validación: envío NO terminal, motivo >=5 chars, fee >=0
 */
export async function changeDestination(
  id: string,
  input: {
    newDestination: string;
    newGps?: string | null;
    fee: number;
    reason: string;
  },
): Promise<ActionState> {
  const newDest = input.newDestination?.trim() ?? "";
  const newGps = input.newGps?.trim() || null;
  const fee = Number.isFinite(input.fee) ? input.fee : NaN;
  const reason = input.reason?.trim() ?? "";

  const fieldErrors: Record<string, string> = {};
  if (!newDest) fieldErrors.newDestination = "Indica el nuevo destino.";
  if (!Number.isFinite(fee) || fee < 0)
    fieldErrors.fee = "El fee debe ser 0 o positivo.";
  if (reason.length < 5)
    fieldErrors.reason = "El motivo debe tener al menos 5 caracteres.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const tenantId = await getUserTenantId();
  if (!tenantId) return { error: "Sin tenant asignado." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };


  // 1) Leer envío actual (destino actual + status)
  const { data: shipment, error: readError } = await supabase
    .from("shipments")
    .select("destination, status")
    .eq("id", id)
    .maybeSingle();

  if (readError || !shipment) {
    return { error: "Envío no encontrado." };
  }

  const status = shipment.status as ShipmentStatus;
  if (TERMINAL_STATUSES.includes(status)) {
    return { error: "No se puede cambiar el destino de un envío entregado o cancelado." };
  }

  const fromDest = (shipment.destination as string | null)?.trim() || "—";

  // Defensa contra "cambio" a sí mismo (UX should prevent it, but server safety)
  if (fromDest.toLowerCase() === newDest.toLowerCase()) {
    return {
      fieldErrors: { newDestination: "El nuevo destino es igual al actual." },
    };
  }

  // 2) Update shipments
  const updatePayload: Record<string, string | null> = { destination: newDest };
  if (newGps !== null) updatePayload.destination_gps = newGps;

  const { error: updateError } = await supabase
    .from("shipments")
    .update(updatePayload)
    .eq("id", id);

  if (updateError) {
    return { error: "No pudimos actualizar el destino." };
  }

  // 3) Insert event con nota estructurada
  const note = formatChangeNote({ from: fromDest, to: newDest, fee, reason });
  const user = await getUser();

  const { error: eventError } = await supabase.from("shipment_events").insert({
    tenant_id: tenantId,
    shipment_id: id,
    status, // mantiene el estado actual del envío
    note,
    occurred_at: new Date().toISOString(),
    created_by: user?.id ?? null,
  });

  if (eventError) {
    return { error: "Destino cambiado pero el evento falló al registrarse." };
  }

  revalidatePath(`/studio/tracking/${id}`);
  revalidatePath("/studio/tracking");
  return { ok: true };
}

/**
 * Lookup helper que el modal de cambio de destino llama on blur del input
 * destino. Retorna la rate matching para sugerir el fee.
 */
export async function lookupRateForNewDestination(
  service: ShipmentService,
  destination: string,
): Promise<{ rate: Rate | null }> {
  if (!destination?.trim()) return { rate: null };

  const supabase = await createClient();
  try {
    const rate = await findRateForDestination(supabase, service, destination);
    return { rate };
  } catch {
    return { rate: null };
  }
}
