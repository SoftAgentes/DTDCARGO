/**
 * Server actions del detalle de envio.
 *
 * - updateShipment: PATCH de campos editables (no toca code, service, status)
 * - deleteShipment: borrado auditado con motivo (RPC de la 0476, SDD-0522) + redirect a lista si borró
 * - cancelShipment: cancelar con razon obligatoria → status='cancelled' + event
 * - transitionShipment: cambio de estado por boton → update status + event
 * - addShipmentEvent: agregar evento manual (status + nota + occurred_at)
 * - changeDestination: cambia destino del envio + registra fee en timeline (SDD-0009)
 * - previewReassignShipmentClient / reassignShipmentClient: pasar a otro cliente,
 *   con vista previa y motivo (RPC de la 0551, SDD-0645)
 *
 * Todas validan sesion via Supabase. RLS filtra por tenant_id automaticamente.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { capabilityDenial, moduleEditDenial, moduleViewDenial } from "@/lib/studio/rbac-guard";
import { validateAuditReason } from "@/lib/studio/audit/reason";
import {
  mensajeResultadoEmbarques,
  normalizarLote,
  shipmentDeleteBlockReason,
} from "@/lib/studio/borrado/reglas";
import { RUTAS_EMBARQUES, eliminarEmbarques } from "@/lib/studio/borrado/servidor";
import { createAdminClient } from "@/lib/db/admin";
import { getUser, getUserTenantId } from "@/lib/auth/session";
import { isValidStatusForService } from "@/lib/studio/shipment-state-machine";
import { formatChangeNote, findRateForDestination } from "@/lib/studio/destination-change";
import type { Rate } from "@/lib/studio/rate-types";
import type { ShipmentService, ShipmentStatus } from "@/lib/studio/shipment-types";
import { scheduleClientNotifications } from "@/lib/studio/notifications/schedule-client-notifications";
import { statusEvent } from "@/lib/studio/notifications/client-notification-types";
import {
  faltaLaFuncion,
  mensajeErrorReasignar,
  parseReasignarResultado,
  type ReasignarResultado,
} from "@/lib/studio/reasignar-embarque";
import {
  faltaLaFuncionMedidas,
  leerNumero,
  mensajeErrorMedidas,
  parseCorregirResultado,
  parsePartirResultado,
  validarGrupo,
  type CorregirResultado,
  type PartirResultado,
} from "@/lib/studio/medidas-embarque";
import { estaEnContenedor } from "@/lib/studio/medidas-embarque-queries";

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
  const update: Record<string, string | number | null> = {
    origin: parseString(formData.get("origin")),
    destination: parseString(formData.get("destination")),
    destination_gps: parseString(formData.get("destination_gps")),
    weight_kg: parseNumber(formData.get("weight_kg")),
    volume_m3: parseNumber(formData.get("volume_m3")),
    vehicle_category: parseString(formData.get("vehicle_category")),
    vehicle_model: parseString(formData.get("vehicle_model")),
    notes: parseString(formData.get("notes")),
  };
  // SDD-0673: en un embarque de contenedor el peso y el CBM se corrigen con
  // «Corregir medidas» (las tres tablas a la vez, con motivo). Acá no se tocan,
  // aunque el formulario los mande.
  if (await estaEnContenedor(supabase, id)) {
    delete update.weight_kg;
    delete update.volume_m3;
  }

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
 * Elimina el envío (SDD-0522): la misma RPC, regla y motivo que Embarques.
 * Redirige al listado sólo cuando el borrado ocurrió de verdad.
 *
 * Antes (SDD-0497) ponía `deleted_at` con un UPDATE por RLS y el permiso de
 * editar Tracking: sin motivo, sin evento de auditoría y sin mirar si el envío
 * tenía facturas, gastos o aduana. Desde la 0476 la base rechaza ese UPDATE
 * directo a `authenticated`; borrar es de admin (`delete_shipments`) por
 * `soft_delete_shipments_with_audit_reason`, que escribe `shipment_deleted`,
 * cancela los avisos pendientes y no borra si algo depende del envío.
 */
export async function deleteShipment(
  id: string,
  reason = "",
): Promise<ActionState & { /** SDD-0560: lo bloquean dependencias vivas; la UI ofrece el asistente. */ bloqueado?: boolean }> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "delete_shipments");
  if (denial) return { error: denial };

  const lote = normalizarLote([id]);
  if (!lote.ok) return { error: "Este envío no es válido. Recarga la página." };

  const motivo = validateAuditReason(reason);
  if (!motivo.ok) return { error: motivo.error };

  const resultado = await eliminarEmbarques(supabase, lote.ids, motivo.reason);
  if (resultado.estado === "eliminado") {
    for (const ruta of RUTAS_EMBARQUES) revalidatePath(ruta);
    redirect("/studio/tracking");
  }
  if (resultado.estado === "rechazado") {
    const fila = resultado.bloqueadas[0];
    if (!fila) return { error: "Este envío ya no existe o ya se eliminó. Recarga la página." };
    return {
      error: shipmentDeleteBlockReason({ bloqueos: fila.bloqueos, avisos: {} }) ?? "No se pudo eliminar el envío.",
      // SDD-0560: «ya eliminado» no tiene pasos; el resto sí abre el asistente.
      ...(fila.bloqueos.already_deleted ? {} : { bloqueado: true }),
    };
  }
  if (resultado.tipo === "sin_confirmar") for (const ruta of RUTAS_EMBARQUES) revalidatePath(ruta);
  const mensaje = mensajeResultadoEmbarques(resultado);
  return { error: "error" in mensaje ? mensaje.error : "No se pudo eliminar el envío." };
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

  // SDD-0156: motor configurable de avisos al cliente. Programa según las reglas
  // del tenant (canal · offset · texto · visibilidad); el drain (inline + cron)
  // despacha. `arrived_destination` NO entra acá: el aviso de arribo es CANÓNICO
  // por `received_ve` (se dispara al crear el recibo del contenedor en Venezuela
  // — el hecho físico del operario), no por la transición de status. Antes esta
  // transición mandaba el mail `shipment_arrived`; se quitó para no duplicar con
  // received_ve (decisión founder 2026-07-19). Best-effort: nunca rompe el cambio.
  if (shipment.status !== newStatus && newStatus !== "arrived_destination") {
    const admin = createAdminClient();
    await scheduleClientNotifications(admin, tenantId, {
      ancla: { kind: "shipment", shipmentId: id, shipmentCode: shipment.code },
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
  // SDD-0622: cambiar el destino es editar el envío, y la tarifa es precio.
  // Pide editar Tracking y, además, ver el Cotizador O la CN: el mismo criterio
  // con que la RLS de `rates` (0540) deja leer tarifas (la CN las lee para la
  // propuesta de la recepción). Así Almacén conserva la tarifa sugerida que ya
  // recibía, y quien no ve ninguno de los dos (p. ej. marketing) no la recibe.
  if (await moduleEditDenial(supabase, "tracking")) return { rate: null };
  const sinPrecio =
    (await moduleViewDenial(supabase, "quotes")) !== null &&
    (await moduleViewDenial(supabase, "cn")) !== null;
  if (sinPrecio) return { rate: null };
  try {
    const rate = await findRateForDestination(supabase, service, destination);
    return { rate };
  } catch {
    return { rate: null };
  }
}

// ─── Pasar a otro cliente (SDD-0645) ────────────────────────────────────────

export type ReasignarActionResult =
  | { ok: true; resultado: ReasignarResultado }
  | { ok: false; error: string; noDisponible?: boolean };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function llamarReasignar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shipmentId: string,
  clientId: string,
  reason: string | null,
  dryRun: boolean,
): Promise<ReasignarActionResult> {
  const { data, error } = await supabase.rpc("reassign_shipment_client", {
    p_shipment_id: shipmentId,
    p_client_id: clientId,
    p_reason: reason,
    p_dry_run: dryRun,
  });
  if (error) {
    return { ok: false, error: mensajeErrorReasignar(error), noDisponible: faltaLaFuncion(error) || undefined };
  }
  const resultado = parseReasignarResultado(data);
  if (!resultado) return { ok: false, error: "No pudimos leer la respuesta. Recarga la página." };
  return { ok: true, resultado };
}

/**
 * Vista previa de «Pasar a otro cliente»: lo mismo que decidiría el cambio
 * (qué se mueve y qué lo bloquea), sin escribir. La RPC de la 0551 repite el
 * rol y el tenant.
 */
export async function previewReassignShipmentClient(
  shipmentId: string,
  clientId: string,
): Promise<ReasignarActionResult> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "reassign_shipment_owner");
  if (denial) return { ok: false, error: denial };
  if (!UUID_RE.test(shipmentId ?? "") || !UUID_RE.test(clientId ?? "")) {
    return { ok: false, error: "Elige un cliente de la lista." };
  }
  return llamarReasignar(supabase, shipmentId, clientId, null, true);
}

/**
 * Pasa el embarque (y sus recepciones, borradores, consolidación, documentos
 * y avisos pendientes) a otro cliente, con motivo. Todo o nada en la 0551.
 */
export async function reassignShipmentClient(
  shipmentId: string,
  clientId: string,
  reason: string,
): Promise<ReasignarActionResult> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "reassign_shipment_owner");
  if (denial) return { ok: false, error: denial };
  if (!UUID_RE.test(shipmentId ?? "") || !UUID_RE.test(clientId ?? "")) {
    return { ok: false, error: "Elige un cliente de la lista." };
  }
  const motivo = validateAuditReason(reason);
  if (!motivo.ok) return { ok: false, error: motivo.error };

  const res = await llamarReasignar(supabase, shipmentId, clientId, motivo.reason, false);
  if (res.ok && res.resultado.outcome === "reassigned") {
    revalidatePath(`/studio/tracking/${shipmentId}`);
    for (const ruta of RUTAS_EMBARQUES) revalidatePath(ruta);
  }
  return res;
}

// ─── Corregir medidas y partir el embarque (SDD-0673) ──────────────────────

export type MedidasInput = { boxes?: unknown; cbm?: unknown; weightKg?: unknown };

export type CorregirActionResult =
  | { ok: true; resultado: CorregirResultado }
  | { ok: false; error: string; noDisponible?: boolean };

export type PartirActionResult =
  | { ok: true; resultado: PartirResultado }
  | { ok: false; error: string; noDisponible?: boolean };

function medidasDe(m: MedidasInput) {
  const boxes = leerNumero(m.boxes);
  return {
    boxes: boxes === null ? null : Number.isInteger(boxes) ? boxes : Number.NaN,
    cbm: leerNumero(m.cbm),
    weightKg: leerNumero(m.weightKg),
  };
}

async function llamarCorregir(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shipmentId: string,
  medidas: MedidasInput,
  reason: string | null,
  dryRun: boolean,
): Promise<CorregirActionResult> {
  const m = medidasDe(medidas);
  if (Number.isNaN(m.boxes)) return { ok: false, error: "Las cajas van en números enteros." };
  const { data, error } = await supabase.rpc("correct_shipment_measures", {
    p_shipment_id: shipmentId,
    p_boxes: m.boxes,
    p_cbm: m.cbm,
    p_weight_kg: m.weightKg,
    p_reason: reason,
    p_dry_run: dryRun,
  });
  if (error) {
    return { ok: false, error: mensajeErrorMedidas(error), noDisponible: faltaLaFuncionMedidas(error) || undefined };
  }
  const resultado = parseCorregirResultado(data);
  if (!resultado) return { ok: false, error: "No pudimos leer la respuesta. Recarga la página." };
  return { ok: true, resultado };
}

/** Vista previa de «Corregir medidas»: qué cambia en cada lugar y qué lo impide, sin escribir. */
export async function previewCorrectShipmentMeasures(
  shipmentId: string,
  medidas: MedidasInput,
): Promise<CorregirActionResult> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "correct_shipment_measures");
  if (denial) return { ok: false, error: denial };
  if (!UUID_RE.test(shipmentId ?? "")) return { ok: false, error: "Este embarque no es válido. Recarga la página." };
  return llamarCorregir(supabase, shipmentId, medidas, null, true);
}

/**
 * Corrige cajas, CBM y peso a la vez en el embarque, su línea del contenedor y
 * su recepción CN, con motivo. Todo o nada en la 0563.
 */
export async function correctShipmentMeasures(
  shipmentId: string,
  medidas: MedidasInput,
  reason: string,
): Promise<CorregirActionResult> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "correct_shipment_measures");
  if (denial) return { ok: false, error: denial };
  if (!UUID_RE.test(shipmentId ?? "")) return { ok: false, error: "Este embarque no es válido. Recarga la página." };
  const motivo = validateAuditReason(reason);
  if (!motivo.ok) return { ok: false, error: motivo.error };

  const res = await llamarCorregir(supabase, shipmentId, medidas, motivo.reason, false);
  if (res.ok && res.resultado.outcome === "corrected") {
    revalidatePath(`/studio/tracking/${shipmentId}`);
    for (const ruta of RUTAS_EMBARQUES) revalidatePath(ruta);
  }
  return res;
}

async function llamarPartir(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shipmentId: string,
  clientId: string,
  parte: MedidasInput,
  reason: string | null,
  dryRun: boolean,
): Promise<PartirActionResult> {
  const m = medidasDe(parte);
  if (m.boxes === null || Number.isNaN(m.boxes) || m.cbm === null || m.weightKg === null) {
    return { ok: false, error: "Indica las cajas (enteras), el CBM y el peso de la parte nueva." };
  }
  const { data, error } = await supabase.rpc("split_shipment", {
    p_shipment_id: shipmentId,
    p_client_id: clientId,
    p_boxes: m.boxes,
    p_cbm: m.cbm,
    p_weight_kg: m.weightKg,
    p_reason: reason,
    p_box_codes: null,
    p_dry_run: dryRun,
  });
  if (error) {
    return { ok: false, error: mensajeErrorMedidas(error), noDisponible: faltaLaFuncionMedidas(error) || undefined };
  }
  const resultado = parsePartirResultado(data);
  if (!resultado) return { ok: false, error: "No pudimos leer la respuesta. Recarga la página." };
  return { ok: true, resultado };
}

/** Vista previa de «Partir embarque»: las dos partes, el código nuevo y qué lo impide. */
export async function previewSplitShipment(
  shipmentId: string,
  clientId: string,
  parte: MedidasInput,
): Promise<PartirActionResult> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "split_shipment");
  if (denial) return { ok: false, error: denial };
  if (!UUID_RE.test(shipmentId ?? "") || !UUID_RE.test(clientId ?? "")) {
    return { ok: false, error: "Elige un cliente de la lista." };
  }
  return llamarPartir(supabase, shipmentId, clientId, parte, null, true);
}

/** Parte el embarque en dos con motivo; el total del contenedor no cambia (0563). */
export async function splitShipment(
  shipmentId: string,
  clientId: string,
  parte: MedidasInput,
  reason: string,
): Promise<PartirActionResult> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "split_shipment");
  if (denial) return { ok: false, error: denial };
  if (!UUID_RE.test(shipmentId ?? "") || !UUID_RE.test(clientId ?? "")) {
    return { ok: false, error: "Elige un cliente de la lista." };
  }
  const motivo = validateAuditReason(reason);
  if (!motivo.ok) return { ok: false, error: motivo.error };

  const res = await llamarPartir(supabase, shipmentId, clientId, parte, motivo.reason, false);
  if (res.ok && res.resultado.outcome === "split") {
    revalidatePath(`/studio/tracking/${shipmentId}`);
    revalidatePath("/studio/tracking");
    for (const ruta of RUTAS_EMBARQUES) revalidatePath(ruta);
  }
  return res;
}

/**
 * «Grupo de WeChat» (SDD-0673 §6): nota libre del embarque, con el permiso de
 * editar Tracking. No decide el dueño ni se ve en el Portal.
 */
export async function updateShipmentGroupReference(
  shipmentId: string,
  value: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { ok: false, error: denial };
  if (!UUID_RE.test(shipmentId ?? "")) return { ok: false, error: "Este embarque no es válido. Recarga la página." };
  const grupo = validarGrupo(value);
  if (!grupo.ok) return { ok: false, error: grupo.error };

  const { data: filas, error } = await supabase
    .from("shipments")
    .update({ group_reference: grupo.valor })
    .eq("id", shipmentId)
    .select("id");
  if (!error && (filas ?? []).length === 0) {
    return { ok: false, error: "No encontramos este embarque o no puedes editarlo. Recarga la página." };
  }
  if (error) {
    // Sin la 0563 la columna no existe (PGRST204 / 42703).
    if (error.code === "PGRST204" || error.code === "42703") {
      return { ok: false, error: "Esta acción todavía no está disponible." };
    }
    return { ok: false, error: "No pudimos guardar el grupo. Intenta de nuevo." };
  }
  revalidatePath(`/studio/tracking/${shipmentId}`);
  return { ok: true };
}
