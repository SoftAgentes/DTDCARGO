/**
 * Server actions del módulo TMS (SDD-0019).
 *
 * - createTruckAction: insert truck
 * - createDriverAction: insert driver
 * - createRouteAction: insert route + sync shipment status → out_for_delivery
 *   + truck/driver status → en_ruta + shipment_event
 * - markRouteCompletedAction: status=completado + sync shipment=last_mile +
 *   truck/driver → disponible
 * - markRouteStartedAction: planificado → en_ruta
 * - cancelRouteAction: → cancelado + libera truck/driver
 * - addIncidentAction: insert incident, opcionalmente truck → mantenimiento
 * - updateTruckStatusAction: cambio simple del status del truck
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateDriverInput,
  validateIncidentInput,
  validateRouteInput,
  validateTruckInput,
  type TmsActionState,
  type TmsDriverInput,
  type TmsIncidentInput,
  type TmsIncidentType,
  type TmsRouteInput,
  type TmsTruckInput,
  type TruckStatus,
} from "@/lib/studio/tms-types";

// ─────────────────────────────────────────────────────────────
// FormData helpers
// ─────────────────────────────────────────────────────────────

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function parseNumber(v: FormDataEntryValue | null): number {
  if (v == null) return 0;
  const s = String(v).trim();
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function parseBool(v: FormDataEntryValue | null): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "on";
}
function parseStops(v: FormDataEntryValue | null): string[] {
  if (v == null) return [];
  const raw = String(v).trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(String).map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// createTruck
// ─────────────────────────────────────────────────────────────

export async function createTruckAction(
  _prev: TmsActionState,
  formData: FormData,
): Promise<TmsActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tms");
  if (denial) return { error: denial };


  const partial: Partial<TmsTruckInput> = {
    plate: parseStringOrNull(formData.get("plate")) ?? undefined,
    brand: parseStringOrNull(formData.get("brand")),
    vehicle_type: parseStringOrNull(formData.get("vehicle_type")),
    hub_code: parseStringOrNull(formData.get("hub_code")),
    owned: parseBool(formData.get("owned")),
    capacity_cbm: parseNumber(formData.get("capacity_cbm")),
    capacity_kg: parseNumber(formData.get("capacity_kg")),
    km: parseNumber(formData.get("km")),
    fuel_type: parseStringOrNull(formData.get("fuel_type")),
    consumption_km_l: parseNumber(formData.get("consumption_km_l")),
    next_service_at: parseStringOrNull(formData.get("next_service_at")),
    notes: parseStringOrNull(formData.get("notes")),
  };

  const { input, fieldErrors } = validateTruckInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { data: created, error } = await supabase
    .from("tms_trucks")
    .insert({ tenant_id: link.tenant_id, ...input! })
    .select("id")
    .single<{ id: string }>();

  if (error || !created) {
    return { error: `No se pudo crear el camión: ${error?.message}` };
  }

  revalidatePath("/studio/tms");
  return { ok: true, createdId: created.id };
}

// ─────────────────────────────────────────────────────────────
// createDriver
// ─────────────────────────────────────────────────────────────

export async function createDriverAction(
  _prev: TmsActionState,
  formData: FormData,
): Promise<TmsActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tms");
  if (denial) return { error: denial };


  const partial: Partial<TmsDriverInput> = {
    name: parseStringOrNull(formData.get("name")) ?? undefined,
    cedula: parseStringOrNull(formData.get("cedula")),
    phone: parseStringOrNull(formData.get("phone")),
    email: parseStringOrNull(formData.get("email")),
    license_class: parseStringOrNull(formData.get("license_class")),
    license_expires: parseStringOrNull(formData.get("license_expires")),
    hub_code: parseStringOrNull(formData.get("hub_code")),
    exp_years: parseNumber(formData.get("exp_years")),
    address: parseStringOrNull(formData.get("address")),
    emergency_contact: parseStringOrNull(formData.get("emergency_contact")),
    safety_certified: parseBool(formData.get("safety_certified")),
    notes: parseStringOrNull(formData.get("notes")),
  };

  const { input, fieldErrors } = validateDriverInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { data: created, error } = await supabase
    .from("tms_drivers")
    .insert({ tenant_id: link.tenant_id, ...input! })
    .select("id")
    .single<{ id: string }>();

  if (error || !created) {
    return { error: `No se pudo crear el chofer: ${error?.message}` };
  }

  revalidatePath("/studio/tms");
  return { ok: true, createdId: created.id };
}

// ─────────────────────────────────────────────────────────────
// createRoute (con sync de status)
// ─────────────────────────────────────────────────────────────

export async function createRouteAction(
  _prev: TmsActionState,
  formData: FormData,
): Promise<TmsActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tms");
  if (denial) return { error: denial };


  const partial: Partial<TmsRouteInput> = {
    shipment_id: parseStringOrNull(formData.get("shipment_id")) ?? undefined,
    truck_id: parseStringOrNull(formData.get("truck_id")),
    driver_id: parseStringOrNull(formData.get("driver_id")),
    stops: parseStops(formData.get("stops_json")),
    distance_km: parseNumber(formData.get("distance_km")),
    eta_at: parseStringOrNull(formData.get("eta_at")),
    notes: parseStringOrNull(formData.get("notes")),
  };

  const { input, fieldErrors } = validateRouteInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  // Generar route_code
  const { data: codeData, error: codeErr } = await supabase.rpc("next_route_code", {
    p_tenant_id: link.tenant_id,
  });
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de ruta." };
  }
  const route_code = String(codeData);

  // Insert ruta
  const { data: created, error: insertErr } = await supabase
    .from("tms_routes")
    .insert({
      tenant_id: link.tenant_id,
      route_code,
      shipment_id: input!.shipment_id,
      truck_id: input!.truck_id,
      driver_id: input!.driver_id,
      stops: input!.stops,
      distance_km: input!.distance_km,
      eta_at: input!.eta_at,
      notes: input!.notes,
      status: "planificado",
    })
    .select("id")
    .single<{ id: string }>();

  if (insertErr || !created) {
    return { error: `No se pudo crear la ruta: ${insertErr?.message}` };
  }

  // Sync shipment.status → out_for_delivery + setear delivery_address si hay stop final
  const lastStop = input!.stops[input!.stops.length - 1];
  const shipmentUpdate: Record<string, unknown> = { status: "out_for_delivery" };
  if (lastStop) shipmentUpdate.delivery_address = lastStop;

  await supabase
    .from("shipments")
    .update(shipmentUpdate)
    .eq("id", input!.shipment_id)
    .in("status", ["arrived_destination", "out_for_delivery", "last_mile"]);

  // Sync truck.status → en_ruta
  if (input!.truck_id) {
    await supabase
      .from("tms_trucks")
      .update({ status: "en_ruta" })
      .eq("id", input!.truck_id);
  }

  // Sync driver.status → en_ruta
  if (input!.driver_id) {
    await supabase
      .from("tms_drivers")
      .update({ status: "en_ruta" })
      .eq("id", input!.driver_id);
  }

  // Event en shipment timeline
  await supabase.from("shipment_events").insert({
    tenant_id: link.tenant_id,
    shipment_id: input!.shipment_id,
    status: "out_for_delivery",
    note: `Ruta TMS asignada · ${route_code}${lastStop ? ` → ${lastStop}` : ""}`,
  });

  revalidatePath("/studio/tms");
  revalidatePath("/studio/ve");
  revalidatePath(`/studio/tracking/${input!.shipment_id}`);
  return { ok: true, createdId: created.id, createdCode: route_code };
}

// ─────────────────────────────────────────────────────────────
// markRouteStarted / Completed
// ─────────────────────────────────────────────────────────────

export async function markRouteStartedAction(
  routeId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tms");
  if (denial) return { error: denial };


  const { error } = await supabase
    .from("tms_routes")
    .update({ status: "en_ruta" })
    .eq("id", routeId)
    .eq("status", "planificado");

  if (error) return { error: error.message };
  revalidatePath("/studio/tms");
  return { ok: true };
}

export async function markRouteCompletedAction(
  routeId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tms");
  if (denial) return { error: denial };


  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  // Leer ruta para obtener shipment/truck/driver
  const { data: route, error: readErr } = await supabase
    .from("tms_routes")
    .select("shipment_id, truck_id, driver_id, route_code")
    .eq("id", routeId)
    .maybeSingle<{
      shipment_id: string;
      truck_id: string | null;
      driver_id: string | null;
      route_code: string;
    }>();
  if (readErr || !route) return { error: "Ruta no encontrada." };

  const { error: updateErr } = await supabase
    .from("tms_routes")
    .update({ status: "completado", progress_pct: 100 })
    .eq("id", routeId);
  if (updateErr) return { error: updateErr.message };

  // Liberar truck/driver
  if (route.truck_id) {
    await supabase
      .from("tms_trucks")
      .update({ status: "disponible" })
      .eq("id", route.truck_id);
  }
  if (route.driver_id) {
    await supabase
      .from("tms_drivers")
      .update({ status: "disponible" })
      .eq("id", route.driver_id);
  }

  // Sync shipment a last_mile (sigue siendo trabajo de Tracking confirmar delivered)
  await supabase
    .from("shipments")
    .update({ status: "last_mile" })
    .eq("id", route.shipment_id)
    .in("status", ["out_for_delivery"]);

  await supabase.from("shipment_events").insert({
    tenant_id: link.tenant_id,
    shipment_id: route.shipment_id,
    status: "last_mile",
    note: `Ruta ${route.route_code} completada · próximo paso: POD del cliente`,
  });

  revalidatePath("/studio/tms");
  revalidatePath("/studio/ve");
  revalidatePath(`/studio/tracking/${route.shipment_id}`);
  return { ok: true };
}

export async function cancelRouteAction(
  routeId: string,
  reason?: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tms");
  if (denial) return { error: denial };


  const { data: route } = await supabase
    .from("tms_routes")
    .select("truck_id, driver_id, shipment_id")
    .eq("id", routeId)
    .maybeSingle<{ truck_id: string | null; driver_id: string | null; shipment_id: string }>();

  if (!route) return { error: "Ruta no encontrada." };

  const { error } = await supabase
    .from("tms_routes")
    .update({
      status: "cancelado",
      cancellation_reason: reason?.trim() || null,
    })
    .eq("id", routeId);
  if (error) return { error: error.message };

  if (route.truck_id) {
    await supabase
      .from("tms_trucks")
      .update({ status: "disponible" })
      .eq("id", route.truck_id);
  }
  if (route.driver_id) {
    await supabase
      .from("tms_drivers")
      .update({ status: "disponible" })
      .eq("id", route.driver_id);
  }

  revalidatePath("/studio/tms");
  revalidatePath(`/studio/tracking/${route.shipment_id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// addIncident
// ─────────────────────────────────────────────────────────────

export async function addIncidentAction(
  _prev: TmsActionState,
  formData: FormData,
): Promise<TmsActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tms");
  if (denial) return { error: denial };


  const typeRaw = parseStringOrNull(formData.get("incident_type"));
  const partial: Partial<TmsIncidentInput> = {
    truck_id: parseStringOrNull(formData.get("truck_id")) ?? undefined,
    incident_type: (typeRaw as TmsIncidentType) ?? undefined,
    occurred_at: parseStringOrNull(formData.get("occurred_at")) ?? undefined,
    description: parseStringOrNull(formData.get("description")),
    cost_usd: parseNumber(formData.get("cost_usd")),
  };

  const { input, fieldErrors } = validateIncidentInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  // Generar incident_code
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_incident_code",
    { p_tenant_id: link.tenant_id },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de incidencia." };
  }
  const incident_code = String(codeData);

  const { data: created, error } = await supabase
    .from("tms_incidents")
    .insert({
      tenant_id: link.tenant_id,
      incident_code,
      truck_id: input!.truck_id,
      incident_type: input!.incident_type,
      occurred_at: input!.occurred_at,
      description: input!.description,
      cost_usd: input!.cost_usd,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !created) {
    return { error: `No se pudo registrar la incidencia: ${error?.message}` };
  }

  // Si es mantenimiento, opcionalmente cambiar truck.status
  if (input!.incident_type === "mantenimiento") {
    await supabase
      .from("tms_trucks")
      .update({ status: "mantenimiento" })
      .eq("id", input!.truck_id);
  }

  revalidatePath("/studio/tms");
  return { ok: true, createdId: created.id, createdCode: incident_code };
}

// ─────────────────────────────────────────────────────────────
// updateTruckStatusAction (cambio simple)
// ─────────────────────────────────────────────────────────────

const VALID_TRUCK_STATUSES: TruckStatus[] = [
  "disponible",
  "cargando",
  "en_ruta",
  "mantenimiento",
];

export async function updateTruckStatusAction(
  truckId: string,
  newStatus: TruckStatus,
): Promise<{ ok?: boolean; error?: string }> {
  if (!VALID_TRUCK_STATUSES.includes(newStatus)) {
    return { error: "Estado inválido." };
  }

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tms");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("tms_trucks")
    .update({ status: newStatus })
    .eq("id", truckId);
  if (error) return { error: error.message };

  revalidatePath("/studio/tms");
  return { ok: true };
}
