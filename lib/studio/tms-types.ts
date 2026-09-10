/**
 * Tipos + labels + tones del módulo TMS (SDD-0019).
 * Matchea schema de supabase/migrations/0011_tms_schema.sql.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ─────────────────────────────────────────────────────────────
// Enums (matchean Postgres)
// ─────────────────────────────────────────────────────────────

export type TruckStatus =
  | "disponible"
  | "cargando"
  | "en_ruta"
  | "mantenimiento";

export type DriverStatus =
  | "disponible"
  | "cargando"
  | "en_ruta"
  | "descanso";

export type TmsRouteStatus =
  | "planificado"
  | "en_ruta"
  | "completado"
  | "cancelado";

export type TmsIncidentType =
  | "mantenimiento"
  | "multa"
  | "combustible"
  | "accidente";

// ─────────────────────────────────────────────────────────────
// Row types
// ─────────────────────────────────────────────────────────────

export type TmsTruck = {
  id: string;
  tenant_id: string;
  plate: string;
  brand: string | null;
  vehicle_type: string | null;
  hub_code: string | null;
  owned: boolean;
  capacity_cbm: number | null;
  capacity_kg: number | null;
  driver_id: string | null;
  km: number;
  fuel_type: string | null;
  consumption_km_l: number | null;
  next_service_at: string | null;
  status: TruckStatus;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TmsDriver = {
  id: string;
  tenant_id: string;
  name: string;
  cedula: string | null;
  phone: string | null;
  email: string | null;
  license_class: string | null;
  license_expires: string | null;
  hub_code: string | null;
  exp_years: number;
  rating: number | null;
  trips_30d: number;
  last_trip: string | null;
  address: string | null;
  emergency_contact: string | null;
  safety_certified: boolean;
  status: DriverStatus;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TmsRoute = {
  id: string;
  tenant_id: string;
  route_code: string;
  shipment_id: string;
  truck_id: string | null;
  driver_id: string | null;
  stops: string[];
  distance_km: number | null;
  progress_pct: number;
  eta_at: string | null;
  status: TmsRouteStatus;
  started_at: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TmsIncident = {
  id: string;
  tenant_id: string;
  incident_code: string;
  truck_id: string | null;
  route_id: string | null;
  incident_type: TmsIncidentType;
  occurred_at: string;
  description: string | null;
  cost_usd: number;
  status: string;
  created_at: string;
  updated_at: string;
};

/** Truck con driver joined (para tabla Flota). */
export type TmsTruckRow = TmsTruck & {
  driver: Pick<TmsDriver, "id" | "name"> | null;
};

/** Route con joins. */
export type TmsRouteRow = TmsRoute & {
  truck: Pick<TmsTruck, "id" | "plate" | "brand"> | null;
  driver: Pick<TmsDriver, "id" | "name" | "rating"> | null;
  shipment: {
    id: string;
    code: string;
    client_name: string | null;
    destination: string | null;
  } | null;
};

/** Incident con truck plate joined. */
export type TmsIncidentRow = TmsIncident & {
  truck: Pick<TmsTruck, "id" | "plate"> | null;
};

// ─────────────────────────────────────────────────────────────
// Labels + Tones
// ─────────────────────────────────────────────────────────────

export const TRUCK_STATUS_LABELS: Record<TruckStatus, string> = {
  disponible: "Disponible",
  cargando: "Cargando",
  en_ruta: "En ruta",
  mantenimiento: "Mantenimiento",
};

export const TRUCK_STATUS_TONES: Record<TruckStatus, BadgeTone> = {
  disponible: "info",
  cargando: "info",
  en_ruta: "info",
  mantenimiento: "warning",
};

export const TRUCK_STATUS_OPTIONS: { value: TruckStatus; label: string }[] = (
  Object.keys(TRUCK_STATUS_LABELS) as TruckStatus[]
).map((s) => ({ value: s, label: TRUCK_STATUS_LABELS[s] }));

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  disponible: "Disponible",
  cargando: "Cargando",
  en_ruta: "En ruta",
  descanso: "Descanso",
};

export const DRIVER_STATUS_TONES: Record<DriverStatus, BadgeTone> = {
  disponible: "info",
  cargando: "info",
  en_ruta: "info",
  descanso: "neutral",
};

export const ROUTE_STATUS_LABELS: Record<TmsRouteStatus, string> = {
  planificado: "Planificado",
  en_ruta: "En ruta",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const ROUTE_STATUS_TONES: Record<TmsRouteStatus, BadgeTone> = {
  planificado: "info",
  en_ruta: "info",
  completado: "success",
  cancelado: "neutral",
};

export const INCIDENT_TYPE_LABELS: Record<TmsIncidentType, string> = {
  mantenimiento: "Mantenimiento",
  multa: "Multa",
  combustible: "Combustible",
  accidente: "Accidente",
};

export const INCIDENT_TYPE_TONES: Record<TmsIncidentType, BadgeTone> = {
  mantenimiento: "warning",
  multa: "danger",
  combustible: "info",
  accidente: "danger",
};

// ─────────────────────────────────────────────────────────────
// Hubs VE (reusados del módulo SENIAT)
// ─────────────────────────────────────────────────────────────

export const TMS_HUBS: { code: string; name: string }[] = [
  { code: "PBL", name: "Puerto Cabello" },
  { code: "LGU", name: "La Guaira" },
  { code: "MAR", name: "Maracaibo" },
  { code: "PFI", name: "Punto Fijo" },
];

export const VEHICLE_TYPE_OPTIONS = [
  "Semi 40'",
  "Semi 40'HC",
  "Furgón 24'",
  "Furgón 18'",
  "Camión 350",
  "Camión 750",
  "Gandola",
];

export const FUEL_TYPE_OPTIONS = ["Diesel", "Gasolina 95", "Gasolina 91", "Gas (GNC/GLP)"];

export const LICENSE_CLASS_OPTIONS = [
  "A·B·C",
  "A·B·C·D",
  "A·B·C·D·E",
  "B·C·D",
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Color para el km del truck (warning si >180K). */
export function truckMileageColor(km: number): string {
  if (km > 200000) return "var(--danger)";
  if (km > 180000) return "var(--warning)";
  return "var(--ink-soft)";
}

// ─────────────────────────────────────────────────────────────
// Form inputs + validation
// ─────────────────────────────────────────────────────────────

export type TmsTruckInput = {
  plate: string;
  brand: string | null;
  vehicle_type: string | null;
  hub_code: string | null;
  owned: boolean;
  capacity_cbm: number | null;
  capacity_kg: number | null;
  km: number;
  fuel_type: string | null;
  consumption_km_l: number | null;
  next_service_at: string | null;
  notes: string | null;
};

export type TmsDriverInput = {
  name: string;
  cedula: string | null;
  phone: string | null;
  email: string | null;
  license_class: string | null;
  license_expires: string | null;
  hub_code: string | null;
  exp_years: number;
  address: string | null;
  emergency_contact: string | null;
  safety_certified: boolean;
  notes: string | null;
};

export type TmsRouteInput = {
  shipment_id: string;
  truck_id: string | null;
  driver_id: string | null;
  stops: string[];
  distance_km: number | null;
  eta_at: string | null;
  notes: string | null;
};

export type TmsIncidentInput = {
  truck_id: string;
  incident_type: TmsIncidentType;
  occurred_at: string;
  description: string | null;
  cost_usd: number;
};

export type TmsActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  createdId?: string;
  createdCode?: string;
};

export type TmsRouteCompletionInput = {
  route_id: string;
  from: "en_ruta";
  reason: string;
  request_ref: string;
};

export type TmsRouteCompletionValidation =
  | { ok: true; input: TmsRouteCompletionInput }
  | { ok: false; error: string };

/** Contrato público de la decisión R3 `en_ruta → completado`. */
export function validateTmsRouteCompletionInput(
  raw: Record<string, unknown>,
): TmsRouteCompletionValidation {
  const routeId = String(raw.route_id ?? "").trim();
  const from = String(raw.from ?? "").trim();
  const reason = String(raw.reason ?? "").trim();
  const requestRef = String(raw.request_ref ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(routeId)) {
    return { ok: false, error: "Ruta inválida." };
  }
  if (from !== "en_ruta") {
    return { ok: false, error: "La ruta cambió de estado. Actualiza la página." };
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
      route_id: routeId,
      from: "en_ruta",
      reason,
      request_ref: requestRef,
    },
  };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateTruckInput(
  input: Partial<TmsTruckInput>,
): { input?: TmsTruckInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const plate = input.plate?.trim() ?? "";
  if (!plate) errors.plate = "Indica la patente.";
  if (plate.length > 20) errors.plate = "Patente demasiado larga.";

  const km = Number(input.km ?? 0);
  if (!Number.isFinite(km) || km < 0) errors.km = "Km debe ser >= 0.";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      plate,
      brand: input.brand?.trim() || null,
      vehicle_type: input.vehicle_type?.trim() || null,
      hub_code: input.hub_code?.trim() || null,
      owned: !!input.owned,
      capacity_cbm:
        input.capacity_cbm != null && Number.isFinite(Number(input.capacity_cbm))
          ? Number(input.capacity_cbm)
          : null,
      capacity_kg:
        input.capacity_kg != null && Number.isFinite(Number(input.capacity_kg))
          ? Number(input.capacity_kg)
          : null,
      km: Math.round(km),
      fuel_type: input.fuel_type?.trim() || null,
      consumption_km_l:
        input.consumption_km_l != null &&
        Number.isFinite(Number(input.consumption_km_l))
          ? Number(input.consumption_km_l)
          : null,
      next_service_at:
        input.next_service_at && ISO_DATE_RE.test(input.next_service_at)
          ? input.next_service_at
          : null,
      notes: input.notes?.trim() || null,
    },
  };
}

export function validateDriverInput(
  input: Partial<TmsDriverInput>,
): { input?: TmsDriverInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = input.name?.trim() ?? "";
  if (!name) errors.name = "Indica el nombre.";
  if (name.length > 200) errors.name = "Nombre demasiado largo.";

  const cedula = input.cedula?.trim() || null;
  if (cedula && cedula.length > 30) errors.cedula = "Cédula demasiado larga.";

  const exp = Number(input.exp_years ?? 0);
  if (!Number.isFinite(exp) || exp < 0) errors.exp_years = "Experiencia debe ser >= 0.";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      name,
      cedula,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      license_class: input.license_class?.trim() || null,
      license_expires:
        input.license_expires && ISO_DATE_RE.test(input.license_expires)
          ? input.license_expires
          : null,
      hub_code: input.hub_code?.trim() || null,
      exp_years: Math.round(exp),
      address: input.address?.trim() || null,
      emergency_contact: input.emergency_contact?.trim() || null,
      safety_certified: !!input.safety_certified,
      notes: input.notes?.trim() || null,
    },
  };
}

export function validateRouteInput(
  input: Partial<TmsRouteInput>,
): { input?: TmsRouteInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const shipment_id = input.shipment_id?.trim() ?? "";
  if (!shipment_id) errors.shipment_id = "Indica el shipment.";

  const stops = (input.stops ?? []).map((s) => s.trim()).filter(Boolean);
  if (stops.length < 2) errors.stops = "La ruta requiere al menos 2 paradas (origen + destino).";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      shipment_id,
      truck_id: input.truck_id?.trim() || null,
      driver_id: input.driver_id?.trim() || null,
      stops,
      distance_km:
        input.distance_km != null && Number.isFinite(Number(input.distance_km))
          ? Math.round(Number(input.distance_km))
          : null,
      eta_at: input.eta_at?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  };
}

export function validateIncidentInput(
  input: Partial<TmsIncidentInput>,
): { input?: TmsIncidentInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!input.truck_id?.trim()) errors.truck_id = "Indica el camión.";
  if (!input.incident_type) errors.incident_type = "Indica el tipo.";

  const cost = Number(input.cost_usd ?? 0);
  if (!Number.isFinite(cost) || cost < 0) errors.cost_usd = "Costo debe ser >= 0.";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      truck_id: input.truck_id!.trim(),
      incident_type: input.incident_type!,
      occurred_at:
        input.occurred_at && ISO_DATE_RE.test(input.occurred_at)
          ? input.occurred_at
          : new Date().toISOString().slice(0, 10),
      description: input.description?.trim() || null,
      cost_usd: cost,
    },
  };
}
