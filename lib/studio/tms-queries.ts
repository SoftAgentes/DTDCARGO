/**
 * Queries del módulo TMS (SDD-0019).
 * RLS por tenant en las 4 tablas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TmsDriver,
  TmsIncidentRow,
  TmsIncidentType,
  TmsRouteRow,
  TmsRouteStatus,
  TmsTruck,
  TmsTruckRow,
  TruckStatus,
  DriverStatus,
} from "./tms-types";

// ─────────────────────────────────────────────────────────────
// Filtros
// ─────────────────────────────────────────────────────────────

export type TruckFilters = {
  hub?: string;
  status?: TruckStatus | "all";
  owned?: boolean;
};

export type DriverFilters = {
  hub?: string;
  status?: DriverStatus | "all";
};

export type RouteFilters = {
  status?: TmsRouteStatus | "all";
};

export type IncidentFilters = {
  type?: TmsIncidentType | "all";
  /** Filtrar a últimos N días desde hoy (default 30). */
  recentDays?: number;
};

// ─────────────────────────────────────────────────────────────
// Trucks
// ─────────────────────────────────────────────────────────────

const TRUCK_COLUMNS =
  "id, tenant_id, plate, brand, vehicle_type, hub_code, owned, capacity_cbm, capacity_kg, driver_id, km, fuel_type, consumption_km_l, next_service_at, status, notes, deleted_at, created_at, updated_at";

const TRUCK_WITH_DRIVER_SELECT = `
  ${TRUCK_COLUMNS},
  driver:tms_drivers!driver_id ( id, name )
`;

export async function listTrucks(
  supabase: SupabaseClient,
  filters: TruckFilters = {},
): Promise<TmsTruckRow[]> {
  let query = supabase
    .from("tms_trucks")
    .select(TRUCK_WITH_DRIVER_SELECT)
    .order("plate", { ascending: true })
    .limit(200);

  if (filters.hub) query = query.eq("hub_code", filters.hub);
  if (filters.status && filters.status !== "all")
    query = query.eq("status", filters.status);
  if (filters.owned != null) query = query.eq("owned", filters.owned);

  const { data, error } = await query;
  if (error) throw error;

  // Normalizar driver join
  type Raw = Omit<TmsTruckRow, "driver"> & {
    driver:
      | Pick<TmsDriver, "id" | "name">
      | Pick<TmsDriver, "id" | "name">[]
      | null;
  };

  const rows = (data ?? []) as unknown as Raw[];
  return rows.map((r) => ({
    ...r,
    driver: Array.isArray(r.driver) ? r.driver[0] ?? null : r.driver,
  }));
}

export async function listAvailableTrucks(
  supabase: SupabaseClient,
): Promise<TmsTruck[]> {
  const { data, error } = await supabase
    .from("tms_trucks")
    .select(TRUCK_COLUMNS)
    .eq("status", "disponible")
    .order("plate", { ascending: true });
  if (error) throw error;
  return (data as TmsTruck[] | null) ?? [];
}

// ─────────────────────────────────────────────────────────────
// Drivers
// ─────────────────────────────────────────────────────────────

const DRIVER_COLUMNS =
  "id, tenant_id, name, cedula, phone, email, license_class, license_expires, hub_code, exp_years, rating, trips_30d, last_trip, address, emergency_contact, safety_certified, status, notes, deleted_at, created_at, updated_at";

export async function listDrivers(
  supabase: SupabaseClient,
  filters: DriverFilters = {},
): Promise<TmsDriver[]> {
  let query = supabase
    .from("tms_drivers")
    .select(DRIVER_COLUMNS)
    .order("name", { ascending: true })
    .limit(200);

  if (filters.hub) query = query.eq("hub_code", filters.hub);
  if (filters.status && filters.status !== "all")
    query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data as TmsDriver[] | null) ?? [];
}

export async function listAvailableDrivers(
  supabase: SupabaseClient,
): Promise<TmsDriver[]> {
  const { data, error } = await supabase
    .from("tms_drivers")
    .select(DRIVER_COLUMNS)
    .eq("status", "disponible")
    .order("rating", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as TmsDriver[] | null) ?? [];
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

const ROUTE_LIST_SELECT = `
  id, tenant_id, route_code, shipment_id, truck_id, driver_id, stops,
  distance_km, progress_pct, eta_at, status, started_at, completed_at,
  cancellation_reason, notes, deleted_at, created_at, updated_at,
  truck:tms_trucks!truck_id ( id, plate, brand ),
  driver:tms_drivers!driver_id ( id, name, rating ),
  shipment:shipments!shipment_id ( id, code, client_name, destination )
`;

export async function listRoutes(
  supabase: SupabaseClient,
  filters: RouteFilters = {},
): Promise<TmsRouteRow[]> {
  let query = supabase
    .from("tms_routes")
    .select(ROUTE_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status && filters.status !== "all")
    query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;

  type Raw = Omit<TmsRouteRow, "truck" | "driver" | "shipment"> & {
    truck:
      | Pick<TmsTruck, "id" | "plate" | "brand">
      | Pick<TmsTruck, "id" | "plate" | "brand">[]
      | null;
    driver:
      | Pick<TmsDriver, "id" | "name" | "rating">
      | Pick<TmsDriver, "id" | "name" | "rating">[]
      | null;
    shipment:
      | {
          id: string;
          code: string;
          client_name: string | null;
          destination: string | null;
        }
      | {
          id: string;
          code: string;
          client_name: string | null;
          destination: string | null;
        }[]
      | null;
  };

  const rows = (data ?? []) as unknown as Raw[];
  return rows.map((r) => ({
    ...r,
    truck: Array.isArray(r.truck) ? r.truck[0] ?? null : r.truck,
    driver: Array.isArray(r.driver) ? r.driver[0] ?? null : r.driver,
    shipment: Array.isArray(r.shipment) ? r.shipment[0] ?? null : r.shipment,
  }));
}

export async function listActiveRoutes(
  supabase: SupabaseClient,
): Promise<TmsRouteRow[]> {
  return listRoutes(supabase, { status: "en_ruta" });
}

// ─────────────────────────────────────────────────────────────
// Shipments elegibles para nueva ruta (liberados aduana sin ruta)
// ─────────────────────────────────────────────────────────────

export type EligibleShipmentForRoute = {
  id: string;
  code: string;
  client_name: string | null;
  client_markbox: string | null;
  destination: string | null;
  delivery_address: string | null;
  arrived_destination_at: string | null;
};

export async function listEligibleShipmentsForRoute(
  supabase: SupabaseClient,
): Promise<EligibleShipmentForRoute[]> {
  const { data: shipments, error } = await supabase
    .from("shipments")
    .select(
      "id, code, client_name, client_markbox, destination, delivery_address, arrived_destination_at",
    )
    .in("status", ["arrived_destination", "out_for_delivery", "last_mile"])
    .order("arrived_destination_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const all = (shipments as EligibleShipmentForRoute[] | null) ?? [];

  if (all.length === 0) return [];

  // Excluir los que ya tienen ruta activa (no cancelada/completada)
  const { data: existingRoutes } = await supabase
    .from("tms_routes")
    .select("shipment_id, status")
    .in(
      "shipment_id",
      all.map((s) => s.id),
    );

  const withActiveRoute = new Set(
    ((existingRoutes as { shipment_id: string; status: TmsRouteStatus }[] | null) ?? [])
      .filter((r) => r.status === "planificado" || r.status === "en_ruta")
      .map((r) => r.shipment_id),
  );

  return all.filter((s) => !withActiveRoute.has(s.id));
}

// ─────────────────────────────────────────────────────────────
// Incidents
// ─────────────────────────────────────────────────────────────

const INCIDENT_COLUMNS =
  "id, tenant_id, incident_code, truck_id, route_id, incident_type, occurred_at, description, cost_usd, status, created_at, updated_at";

const INCIDENT_LIST_SELECT = `
  ${INCIDENT_COLUMNS},
  truck:tms_trucks!truck_id ( id, plate )
`;

export async function listIncidents(
  supabase: SupabaseClient,
  filters: IncidentFilters = {},
): Promise<TmsIncidentRow[]> {
  let query = supabase
    .from("tms_incidents")
    .select(INCIDENT_LIST_SELECT)
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (filters.type && filters.type !== "all")
    query = query.eq("incident_type", filters.type);

  if (filters.recentDays != null) {
    const since = new Date();
    since.setDate(since.getDate() - filters.recentDays);
    query = query.gte("occurred_at", since.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) throw error;

  type Raw = Omit<TmsIncidentRow, "truck"> & {
    truck:
      | Pick<TmsTruck, "id" | "plate">
      | Pick<TmsTruck, "id" | "plate">[]
      | null;
  };

  const rows = (data ?? []) as unknown as Raw[];
  return rows.map((r) => ({
    ...r,
    truck: Array.isArray(r.truck) ? r.truck[0] ?? null : r.truck,
  }));
}

// ─────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────

export type TmsKpis = {
  fleetTotal: number;
  fleetOwned: number;
  fleetContracted: number;
  inRoute: number;
  driversInRoute: number;
  available: number;
  maintenance: number;
};

export async function computeTmsKpis(
  supabase: SupabaseClient,
): Promise<TmsKpis> {
  const [
    totalResult,
    ownedResult,
    inRouteResult,
    availableResult,
    maintenanceResult,
    driversInRouteResult,
  ] = await Promise.all([
    supabase.from("tms_trucks").select("id", { count: "exact", head: true }),
    supabase
      .from("tms_trucks")
      .select("id", { count: "exact", head: true })
      .eq("owned", true),
    supabase
      .from("tms_trucks")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_ruta"),
    supabase
      .from("tms_trucks")
      .select("id", { count: "exact", head: true })
      .eq("status", "disponible"),
    supabase
      .from("tms_trucks")
      .select("id", { count: "exact", head: true })
      .eq("status", "mantenimiento"),
    supabase
      .from("tms_drivers")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_ruta"),
  ]);

  const fleetTotal = totalResult.count ?? 0;
  const fleetOwned = ownedResult.count ?? 0;

  return {
    fleetTotal,
    fleetOwned,
    fleetContracted: fleetTotal - fleetOwned,
    inRoute: inRouteResult.count ?? 0,
    driversInRoute: driversInRouteResult.count ?? 0,
    available: availableResult.count ?? 0,
    maintenance: maintenanceResult.count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Incidents KPIs
// ─────────────────────────────────────────────────────────────

export type IncidentsKpis = {
  totalCost: number;
  totalCount: number;
  fuelCost: number;
  maintenanceCount: number;
  finesCount: number;
  finesCost: number;
};

export async function computeIncidentsKpis(
  supabase: SupabaseClient,
): Promise<IncidentsKpis> {
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("tms_incidents")
    .select("incident_type, cost_usd")
    .gte("occurred_at", monthStart)
    .limit(2000);

  if (error) throw error;
  const rows =
    (data as { incident_type: TmsIncidentType; cost_usd: number | string }[] | null) ??
    [];

  let totalCost = 0;
  let fuelCost = 0;
  let maintenanceCount = 0;
  let finesCount = 0;
  let finesCost = 0;

  for (const r of rows) {
    const cost = Number(r.cost_usd || 0);
    totalCost += cost;
    if (r.incident_type === "combustible") fuelCost += cost;
    if (r.incident_type === "mantenimiento") maintenanceCount++;
    if (r.incident_type === "multa") {
      finesCount++;
      finesCost += cost;
    }
  }

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalCount: rows.length,
    fuelCost: Math.round(fuelCost * 100) / 100,
    maintenanceCount,
    finesCount,
    finesCost: Math.round(finesCost * 100) / 100,
  };
}

// ─────────────────────────────────────────────────────────────
// parseFiltersFromSearchParams
// ─────────────────────────────────────────────────────────────

const VALID_TRUCK_STATUSES: TruckStatus[] = [
  "disponible",
  "cargando",
  "en_ruta",
  "mantenimiento",
];

const VALID_DRIVER_STATUSES: DriverStatus[] = [
  "disponible",
  "cargando",
  "en_ruta",
  "descanso",
];

const VALID_ROUTE_STATUSES: TmsRouteStatus[] = [
  "planificado",
  "en_ruta",
  "completado",
  "cancelado",
];

const VALID_INCIDENT_TYPES: TmsIncidentType[] = [
  "mantenimiento",
  "multa",
  "combustible",
  "accidente",
];

export type TmsTab = "overview" | "fleet" | "drivers" | "routes" | "incidents";

export function parseTmsTab(raw: string | null | undefined): TmsTab {
  if (raw === "fleet" || raw === "drivers" || raw === "routes" || raw === "incidents")
    return raw;
  return "overview";
}

export function parseTruckFilters(
  raw: Record<string, string | string[] | undefined>,
): TruckFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const statusRaw = single("status");
  return {
    hub: single("hub"),
    status:
      statusRaw && VALID_TRUCK_STATUSES.includes(statusRaw as TruckStatus)
        ? (statusRaw as TruckStatus)
        : "all",
  };
}

export function parseDriverFilters(
  raw: Record<string, string | string[] | undefined>,
): DriverFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const statusRaw = single("status");
  return {
    hub: single("hub"),
    status:
      statusRaw && VALID_DRIVER_STATUSES.includes(statusRaw as DriverStatus)
        ? (statusRaw as DriverStatus)
        : "all",
  };
}

export function parseRouteFilters(
  raw: Record<string, string | string[] | undefined>,
): RouteFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const statusRaw = single("status");
  return {
    status:
      statusRaw && VALID_ROUTE_STATUSES.includes(statusRaw as TmsRouteStatus)
        ? (statusRaw as TmsRouteStatus)
        : "all",
  };
}

export function parseIncidentFilters(
  raw: Record<string, string | string[] | undefined>,
): IncidentFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const typeRaw = single("type");
  return {
    type:
      typeRaw && VALID_INCIDENT_TYPES.includes(typeRaw as TmsIncidentType)
        ? (typeRaw as TmsIncidentType)
        : "all",
    recentDays: 30,
  };
}
