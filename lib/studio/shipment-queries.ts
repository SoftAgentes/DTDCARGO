/**
 * Helpers de query reutilizables para el modulo Tracking.
 *
 * Lista de envios con filtros: servicio, estado, busqueda por codigo/cliente.
 * Detalle envio + eventos del timeline (mas reciente arriba).
 *
 * Todas las queries asumen sesion Supabase valida — RLS filtra por tenant_id
 * automaticamente. No se pasa tenant_id como param.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Shipment,
  ShipmentService,
  ShipmentStatus,
} from "./shipment-types";

export type ShipmentFilters = {
  service?: ShipmentService | "all";
  status?: ShipmentStatus | "all";
  q?: string;
  // Filtros avanzados (panel "Mas filtros")
  createdFrom?: string;       // ISO date (YYYY-MM-DD)
  createdTo?: string;         // ISO date
  origin?: string;            // substring ilike sobre el campo origin
  destination?: string;       // substring ilike sobre el campo destination
  vehicleCategory?: string;   // exact match sobre vehicle_category
  onlyAlert?: boolean;        // equivalente a status=exception
};

/** Campos que se devuelven en el listado (los necesarios para la fila). */
const LIST_COLUMNS =
  "id, code, client_name, origin, destination, shipment_service, status, weight_kg, volume_m3, created_at";

/** Campos completos para la vista detalle. */
const DETAIL_COLUMNS =
  "id, tenant_id, code, client_name, client_markbox, origin, destination, destination_gps, shipment_service, status, weight_kg, volume_m3, vehicle_category, vehicle_model, arrived_destination_at, cancellation_reason, notes, deleted_at, created_at, updated_at";

/**
 * Lista de envios con filtros opcionales. RLS filtra por tenant.
 * Devuelve hasta 100 mas recientes.
 */
export async function listShipments(
  supabase: SupabaseClient,
  filters: ShipmentFilters = {},
) {
  let query = supabase
    .from("shipments")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.service && filters.service !== "all") {
    query = query.eq("shipment_service", filters.service);
  }
  // onlyAlert tiene prioridad sobre el dropdown status (mismo enum target)
  if (filters.onlyAlert) {
    query = query.eq("status", "exception");
  } else if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.createdFrom) {
    query = query.gte("created_at", `${filters.createdFrom}T00:00:00`);
  }
  if (filters.createdTo) {
    // incluye el dia completo del "hasta"
    query = query.lte("created_at", `${filters.createdTo}T23:59:59`);
  }
  if (filters.origin && filters.origin.trim()) {
    query = query.ilike("origin", `%${filters.origin.trim()}%`);
  }
  if (filters.destination && filters.destination.trim()) {
    query = query.ilike("destination", `%${filters.destination.trim()}%`);
  }
  if (filters.vehicleCategory && filters.vehicleCategory.trim()) {
    query = query.eq("vehicle_category", filters.vehicleCategory);
  }
  if (filters.q && filters.q.trim().length > 0) {
    const rawQ = filters.q.trim();
    // Sanitizamos: las comas y parentesis rompen el separador del .or() de PostgREST.
    // Como es busqueda fuzzy, reemplazar por espacio no afecta la usabilidad.
    const q = rawQ.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();

    const orConditions: string[] = [
      `code.ilike.%${q}%`,
      `client_name.ilike.%${q}%`,
      `client_markbox.ilike.%${q}%`,
      `origin.ilike.%${q}%`,
      `destination.ilike.%${q}%`,
      `notes.ilike.%${q}%`,
    ];

    // Deteccion inteligente: si el query matchea palabras clave de servicio/estado,
    // agregamos las condiciones .eq para que aparezcan en los resultados.
    for (const svc of matchesServices(q)) {
      orConditions.push(`shipment_service.eq.${svc}`);
    }
    for (const st of matchesStatuses(q)) {
      orConditions.push(`status.eq.${st}`);
    }

    query = query.or(orConditions.join(","));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Detalle envio individual por id. RLS valida ownership. */
export async function getShipmentById(
  supabase: SupabaseClient,
  id: string,
): Promise<Shipment | null> {
  const { data, error } = await supabase
    .from("shipments")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw error;
  }
  return (data as Shipment | null) ?? null;
}

/**
 * Eventos del timeline para un envio. Orden mas reciente arriba.
 * RLS filtra por tenant y excluye soft-deleted.
 */
export async function getShipmentEvents(
  supabase: SupabaseClient,
  shipmentId: string,
) {
  const { data, error } = await supabase
    .from("shipment_events")
    .select("id, status, note, occurred_at, created_by, created_at")
    .eq("shipment_id", shipmentId)
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

/** Tipo de un event tal como sale del select de getShipmentEvents. */
export type ShipmentEventRow = {
  id: string;
  status: ShipmentStatus;
  note: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
};

/**
 * Lista de TODOS los status validos (para validar params crudos).
 * Mantenida sincronizada con el enum shipment_status en supabase/migrations/0002.
 */
const ALL_VALID_STATUSES: ShipmentStatus[] = [
  "draft",
  "in_warehouse",
  "consolidating",
  "shipped",
  "in_transit",
  "in_customs",
  "arrived_destination",
  "delayed_warehouse",
  "out_for_delivery",
  "last_mile",
  "delivered",
  "exception",
  "cancelled",
];

const ALL_VALID_SERVICES: ShipmentService[] = [
  "consolidacion",
  "puerta_a_puerta_DDP",
  "reserva_FCL",
  "transporte_terrestre",
];

/**
 * Detecta palabras clave del query y devuelve servicios que matchean.
 * Permite que "terrestre", "DDP", "fcl", etc. amplien la busqueda al servicio.
 *
 * Tildes opcionales — usuario tipea como puede.
 */
function matchesServices(q: string): ShipmentService[] {
  const lower = q.toLowerCase();
  const matches = new Set<ShipmentService>();
  if (/\bterrestre\b|\bground\b|\bcami[oó]n\b|\bcamiones\b/.test(lower))
    matches.add("transporte_terrestre");
  if (/\bddp\b|\bprepago\b|\bpuerta a puerta\b|\bpuerta\b/.test(lower))
    matches.add("puerta_a_puerta_DDP");
  if (/\bfcl\b|\bcontainer\b|\bcontenedor\b|\breserva\b/.test(lower))
    matches.add("reserva_FCL");
  if (/\bconsolida|consolidacion|consolidación|\blcl\b/.test(lower))
    matches.add("consolidacion");
  return Array.from(matches);
}

/**
 * Detecta palabras clave del query y devuelve estados que matchean.
 * Soporta los labels en espanol-VE del STATUS_LABELS (con y sin tildes).
 */
function matchesStatuses(q: string): ShipmentStatus[] {
  const lower = q.toLowerCase();
  const matches = new Set<ShipmentStatus>();
  if (/\btransito\b|\btránsito\b|\btransit\b|\bruta\b/.test(lower))
    matches.add("in_transit");
  if (/\baduana\b|\bcustoms\b/.test(lower)) matches.add("in_customs");
  if (/\bentregad/.test(lower)) matches.add("delivered");
  if (/\bcancelad/.test(lower)) matches.add("cancelled");
  if (/\bexcepci[oó]n\b|\balerta\b/.test(lower)) matches.add("exception");
  if (/\breparto\b/.test(lower)) matches.add("out_for_delivery");
  if (/\bbodegaje\b/.test(lower)) matches.add("delayed_warehouse");
  if (/\bembarcad/.test(lower)) matches.add("shipped");
  if (/\bconsolidand/.test(lower)) matches.add("consolidating");
  if (/\b[uú]ltima milla\b|\blast mile\b/.test(lower))
    matches.add("last_mile");
  if (/\bborrador\b|\bdraft\b/.test(lower)) matches.add("draft");
  // "bodega VE" o solo "bodega" → considerar ambas bodegas (origen y destino)
  if (/\bbodega\s+ve\b|\bbodega\s+venezuela\b/.test(lower)) {
    matches.add("arrived_destination");
  } else if (/\bbodega\b/.test(lower)) {
    matches.add("in_warehouse");
    matches.add("arrived_destination");
  }
  return Array.from(matches);
}

/**
 * Convierte searchParams crudos en un objeto ShipmentFilters tipado.
 * Sanitiza valores invalidos: "consolidacion-fake" → undefined.
 *
 * Server-safe: pura, sin hooks. Importable desde server components.
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VEHICLE_CATEGORIES = [
  "contenedor_maritimo",
  "camion_chico",
  "camion_pesado",
  "gandola",
  "aereo",
];

export function parseFiltersFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): ShipmentFilters {
  const service = typeof sp.service === "string" ? sp.service : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  // Filtros avanzados
  const createdFrom = typeof sp.from === "string" ? sp.from : undefined;
  const createdTo = typeof sp.to === "string" ? sp.to : undefined;
  const origin = typeof sp.origin === "string" ? sp.origin : undefined;
  const destination = typeof sp.dest === "string" ? sp.dest : undefined;
  const vehicleCategory = typeof sp.veh === "string" ? sp.veh : undefined;
  const onlyAlert = sp.alert === "1" || sp.alert === "true";

  return {
    service:
      service && ALL_VALID_SERVICES.includes(service as ShipmentService)
        ? (service as ShipmentService)
        : undefined,
    status:
      status && ALL_VALID_STATUSES.includes(status as ShipmentStatus)
        ? (status as ShipmentStatus)
        : undefined,
    q,
    createdFrom: createdFrom && ISO_DATE_RE.test(createdFrom) ? createdFrom : undefined,
    createdTo: createdTo && ISO_DATE_RE.test(createdTo) ? createdTo : undefined,
    origin,
    destination,
    vehicleCategory:
      vehicleCategory && VEHICLE_CATEGORIES.includes(vehicleCategory)
        ? vehicleCategory
        : undefined,
    onlyAlert,
  };
}
