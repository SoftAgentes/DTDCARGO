/**
 * Server actions del módulo Naviera & Consolidación (SDD-0047, Slice B).
 *
 * Patrón del Studio: "use server" + parsing/validación manual con los
 * `validate*Input()` de lib/studio/naviera/types (NO Zod) + resolución de
 * tenant desde user_tenants (RLS) + revalidatePath.
 *
 * Acciones:
 *  - createSailing / updateSailing          → alta/edición manual de itinerario.
 *  - createBooking / updateBooking          → reserva de espacio (BKG-YYYY-NNNN)
 *                                             + captura manual de bl_number.
 *  - createConsolidation                    → nuevo contenedor (DTD-CONSOL-NNNN).
 *  - assignLooseCargo / removeConsolidationItem → mover carga suelta a/desde un
 *                                             contenedor (guard de capacidad
 *                                             ADVISORY · §4.4, no bloquea).
 *  - changeSailingStatus / changeBookingStatus / changeConsolidationStatus
 *  - linkConsolidation                      → atar contenedor a booking/sailing.
 *
 * El guard de capacidad vive en `evaluateCapacity` (puro, testeable) y se reusa
 * en assignLooseCargo para devolver el aviso (warning) sin impedir la asignación.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  evaluateCapacity,
  normalizeContainerNo,
  validateBookingInput,
  validateConsolidationInput,
  validateConsolidationItemInput,
  validateSailingInput,
  type BookingInput,
  type BookingStatus,
  type ConsolidationInput,
  type ConsolidationItemInput,
  type ContainerStatus,
  type SailingInput,
  type SailingStatus,
  type StatItem,
} from "@/lib/studio/naviera/types";

type Result = { ok?: boolean; error?: string };

const VALID_SAILING_STATUS = new Set<string>([
  "abierto",
  "cutoff",
  "zarpado",
  "transito",
  "arribado",
]);
const VALID_BOOKING_STATUS = new Set<string>([
  "abierto",
  "solicitado",
  "confirmado",
  "cerrado",
  "zarpado",
  "transito",
]);
const VALID_CONTAINER_STATUS = new Set<string>([
  "consolidando",
  "cerrado",
  "zarpado",
  "arribado",
]);

/** Resuelve el tenant del usuario logueado (RLS). null si no se puede. */
async function resolveTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return link?.tenant_id ?? null;
}

function revalidate(): void {
  revalidatePath("/studio/naviera");
  revalidatePath("/studio/dashboard");
}

// ── Itinerarios (sailings) ─────────────────────────────────────

export async function createSailing(
  raw: Partial<SailingInput>,
): Promise<{ ok?: boolean; error?: string; sailingId?: string }> {
  const supabase = await createClient();
  const { input, fieldErrors } = validateSailingInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos del itinerario inválidos." };
  }
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: inserted, error } = await supabase
    .from("sailings")
    .insert({
      tenant_id: tenantId,
      carrier_id: input!.carrierId,
      vessel: input!.vessel,
      voyage: input!.voyage,
      pol: input!.pol,
      pod: input!.pod,
      etd: input!.etd,
      eta: input!.eta,
      cutoff: input!.cutoff,
      transit_days: input!.transitDays,
      status: input!.status,
      space: input!.space,
      notes: input!.notes,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { error: `No se pudo crear el itinerario: ${error?.message ?? "desconocido"}` };
  }
  revalidate();
  return { ok: true, sailingId: inserted.id };
}

export async function updateSailing(
  sailingId: string,
  raw: Partial<SailingInput>,
): Promise<Result> {
  const supabase = await createClient();
  const { input, fieldErrors } = validateSailingInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos del itinerario inválidos." };
  }
  const { error } = await supabase
    .from("sailings")
    .update({
      carrier_id: input!.carrierId,
      vessel: input!.vessel,
      voyage: input!.voyage,
      pol: input!.pol,
      pod: input!.pod,
      etd: input!.etd,
      eta: input!.eta,
      cutoff: input!.cutoff,
      transit_days: input!.transitDays,
      status: input!.status,
      space: input!.space,
      notes: input!.notes,
    })
    .eq("id", sailingId);
  if (error) return { error: `No se pudo actualizar el itinerario: ${error.message}` };
  revalidate();
  return { ok: true };
}

export async function changeSailingStatus(
  sailingId: string,
  status: SailingStatus,
): Promise<Result> {
  if (!VALID_SAILING_STATUS.has(status)) return { error: "Estado inválido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("sailings")
    .update({ status })
    .eq("id", sailingId);
  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };
  revalidate();
  return { ok: true };
}

// ── Reservas (bookings) ────────────────────────────────────────

export async function createBooking(
  raw: Partial<BookingInput>,
): Promise<{ ok?: boolean; error?: string; bookingCode?: string }> {
  const supabase = await createClient();
  const { input, fieldErrors } = validateBookingInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos de la reserva inválidos." };
  }
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_booking_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de la reserva." };
  }
  const bookingCode = String(codeData);

  const { error } = await supabase.from("bookings").insert({
    tenant_id: tenantId,
    code: bookingCode,
    carrier_id: input!.carrierId,
    sailing_id: input!.sailingId,
    bl_number: input!.blNumber,
    container_type: input!.containerType,
    mode: input!.mode,
    shipper: input!.shipper,
    commodity: input!.commodity,
    status: input!.status,
    notes: input!.notes,
  });
  if (error) return { error: `No se pudo crear la reserva: ${error.message}` };
  revalidate();
  return { ok: true, bookingCode };
}

export async function updateBooking(
  bookingId: string,
  raw: Partial<BookingInput>,
): Promise<Result> {
  const supabase = await createClient();
  const { input, fieldErrors } = validateBookingInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos de la reserva inválidos." };
  }
  const { error } = await supabase
    .from("bookings")
    .update({
      carrier_id: input!.carrierId,
      sailing_id: input!.sailingId,
      bl_number: input!.blNumber,
      container_type: input!.containerType,
      mode: input!.mode,
      shipper: input!.shipper,
      commodity: input!.commodity,
      status: input!.status,
      notes: input!.notes,
    })
    .eq("id", bookingId);
  if (error) return { error: `No se pudo actualizar la reserva: ${error.message}` };
  revalidate();
  return { ok: true };
}

export async function changeBookingStatus(
  bookingId: string,
  status: BookingStatus,
): Promise<Result> {
  if (!VALID_BOOKING_STATUS.has(status)) return { error: "Estado inválido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);
  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };
  revalidate();
  return { ok: true };
}

// ── Contenedores (consolidations) ──────────────────────────────

export async function createConsolidation(
  raw: Partial<ConsolidationInput>,
): Promise<{ ok?: boolean; error?: string; consolidationRef?: string }> {
  const supabase = await createClient();
  const { input, fieldErrors } = validateConsolidationInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos del contenedor inválidos." };
  }
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: refData, error: refErr } = await supabase.rpc(
    "next_consolidation_ref",
    { p_tenant_id: tenantId },
  );
  if (refErr || !refData) {
    return { error: "No se pudo generar la referencia del contenedor." };
  }
  const consolidationRef = String(refData);

  const { error } = await supabase.from("consolidations").insert({
    tenant_id: tenantId,
    ref: consolidationRef,
    booking_id: input!.bookingId,
    sailing_id: input!.sailingId,
    container_type: input!.containerType,
    container_no: input!.containerNo,
    status: input!.status,
    notes: input!.notes,
  });
  if (error) return { error: `No se pudo crear el contenedor: ${error.message}` };
  revalidate();
  return { ok: true, consolidationRef };
}

/**
 * Setea / actualiza el nº físico del contenedor (SDD-0101 · tracking). Se suele
 * cargar post-creación, cuando la naviera confirma el contenedor. Normaliza
 * (mayúsculas, sin espacios); vacío lo limpia a null. RLS filtra por tenant.
 */
export async function setConsolidationContainerNo(
  consolidationId: string,
  containerNoRaw: string,
): Promise<Result> {
  const supabase = await createClient();
  const containerNo = normalizeContainerNo(containerNoRaw);
  const { error } = await supabase
    .from("consolidations")
    .update({ container_no: containerNo })
    .eq("id", consolidationId);
  if (error) return { error: `No se pudo guardar el contenedor: ${error.message}` };
  revalidate();
  return { ok: true };
}

export async function changeConsolidationStatus(
  consolidationId: string,
  status: ContainerStatus,
): Promise<Result> {
  if (!VALID_CONTAINER_STATUS.has(status)) return { error: "Estado inválido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("consolidations")
    .update({ status })
    .eq("id", consolidationId);
  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };
  revalidate();
  return { ok: true };
}

/** Cerrar contenedor: consolidando → cerrado (atajo de changeConsolidationStatus). */
export async function closeConsolidation(
  consolidationId: string,
): Promise<Result> {
  return changeConsolidationStatus(consolidationId, "cerrado");
}

/** Atar un contenedor a una reserva y/o un itinerario. */
export async function linkConsolidation(
  consolidationId: string,
  link: { bookingId?: string | null; sailingId?: string | null },
): Promise<Result> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if ("bookingId" in link) patch.booking_id = link.bookingId || null;
  if ("sailingId" in link) patch.sailing_id = link.sailingId || null;
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabase
    .from("consolidations")
    .update(patch)
    .eq("id", consolidationId);
  if (error) return { error: `No se pudo vincular el contenedor: ${error.message}` };
  revalidate();
  return { ok: true };
}

// ── Asignación de carga suelta (guard advisory) ────────────────

/**
 * Asigna una pieza de carga suelta a un contenedor (loose_cargo →
 * consolidation_items). Guard de capacidad ADVISORY: si supera el CBM/kg del
 * tipo, igual asigna pero devuelve `warning` para que la UI lo muestre.
 */
export async function assignLooseCargo(
  consolidationId: string,
  raw: Partial<ConsolidationItemInput>,
): Promise<{ ok?: boolean; error?: string; warning?: string | null }> {
  const supabase = await createClient();

  const { input, fieldErrors } = validateConsolidationItemInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos de la pieza inválidos." };
  }
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Leer el contenedor (tipo) + items actuales para el guard advisory.
  const { data: consRow, error: consErr } = await supabase
    .from("consolidations")
    .select("id, container_type, status")
    .eq("id", consolidationId)
    .maybeSingle<{ id: string; container_type: string | null; status: string }>();
  if (consErr) return { error: `No se pudo leer el contenedor: ${consErr.message}` };
  if (!consRow) return { error: "El contenedor no existe o no es accesible." };
  if (consRow.status !== "consolidando") {
    return { error: "Solo se puede asignar carga a un contenedor en consolidación." };
  }

  const { data: existingRows, error: itemsErr } = await supabase
    .from("consolidation_items")
    .select("cbm, weight_kg, pieces")
    .eq("consolidation_id", consolidationId);
  if (itemsErr) return { error: `No se pudieron leer las piezas: ${itemsErr.message}` };

  const existing: StatItem[] = ((existingRows as Record<string, unknown>[] | null) ?? []).map(
    (r) => ({
      cbm: Number(r.cbm) || 0,
      weight_kg: Number(r.weight_kg) || 0,
      pieces: Number(r.pieces) || 0,
    }),
  );
  const incoming: StatItem = {
    cbm: input!.cbm,
    weight_kg: input!.weightKg,
    pieces: input!.pieces,
  };
  const guard = evaluateCapacity(existing, incoming, consRow.container_type);

  const { error } = await supabase.from("consolidation_items").insert({
    tenant_id: tenantId,
    consolidation_id: consolidationId,
    shipment_id: input!.shipmentId,
    client_markbox: input!.clientMarkbox,
    client_name: input!.clientName,
    supplier_name: input!.supplierName,
    cbm: input!.cbm,
    weight_kg: input!.weightKg,
    pieces: input!.pieces,
  });
  if (error) return { error: `No se pudo asignar la carga: ${error.message}` };

  revalidate();
  return { ok: true, warning: guard.message };
}

/** Quita una pieza asignada (vuelve a carga suelta si tenía shipment_id). */
export async function removeConsolidationItem(itemId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("consolidation_items")
    .delete()
    .eq("id", itemId);
  if (error) return { error: `No se pudo quitar la pieza: ${error.message}` };
  revalidate();
  return { ok: true };
}
