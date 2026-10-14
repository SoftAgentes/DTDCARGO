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
import { isShipmentService } from "./shipment-types";
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
  "id, code, client_name, client_markbox, origin, destination, shipment_service, status, weight_kg, volume_m3, created_at";

/** Campos para la sidebar del tracking operativo (SDD-0013). */
const ACTIVE_LIST_COLUMNS =
  "id, code, client_name, client_markbox, origin, destination, shipment_service, status, created_at, arrived_destination_at";

/** Status que se consideran "no activos" para el tracking operativo. */
const INACTIVE_STATUSES = ["delivered", "cancelled", "draft"];

/** Campos completos para la vista detalle. */
const DETAIL_COLUMNS =
  "id, tenant_id, code, client_name, client_markbox, origin, destination, destination_gps, shipment_service, status, weight_kg, volume_m3, vehicle_category, vehicle_model, arrived_destination_at, planned_departure_at, planned_arrival_at, planned_delivery_at, planning_timezone, planning_version, planning_updated_at, planning_updated_by, cancellation_reason, notes, deleted_at, created_at, updated_at";

/**
 * Lista de envios vivos con filtros opcionales. RLS filtra por tenant.
 * Devuelve hasta 100 mas recientes.
 *
 * SDD-0509: la RLS NO excluye los eliminados — la 0230 sacó `deleted_at is
 * null` de la policy FOR ALL porque bloqueaba el propio soft delete. El
 * `.is("deleted_at", null)` de abajo es lo único que los deja fuera.
 */
export async function listShipments(
  supabase: SupabaseClient,
  filters: ShipmentFilters = {},
) {
  let query = supabase
    .from("shipments")
    .select(LIST_COLUMNS)
    .is("deleted_at", null)
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

/**
 * Lista de envios activos para el tracking operativo (SDD-0013).
 * Excluye delivered / cancelled / draft y los eliminados (SDD-0509).
 * Hasta 200 mas recientes.
 */
export async function listActiveShipments(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("shipments")
    .select(ACTIVE_LIST_COLUMNS)
    .is("deleted_at", null)
    .not("status", "in", `(${INACTIVE_STATUSES.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(200);

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
 * RLS filtra por tenant, pero NO excluye soft-deleted (0230; ver SDD-0509).
 * Hoy solo la cascada al eliminar el envío pone `deleted_at` en un evento, así
 * que en un envío vivo no aparecen eventos eliminados.
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

/** Evento más reciente de un shipment (status real + cuándo ocurrió). */
export type LatestShipmentEvent = {
  status: ShipmentStatus;
  occurred_at: string;
};

/**
 * Reduce PURO: dada una lista de eventos ORDENADA por occurred_at desc,
 * devuelve el más reciente por shipment_id (el primero que aparece para
 * cada id). Separado para testear sin DB.
 */
export function pickLatestPerShipment(
  rows: { shipment_id: string; status: ShipmentStatus; occurred_at: string }[],
): Map<string, LatestShipmentEvent> {
  const out = new Map<string, LatestShipmentEvent>();
  for (const r of rows) {
    if (!out.has(r.shipment_id)) {
      out.set(r.shipment_id, { status: r.status, occurred_at: r.occurred_at });
    }
  }
  return out;
}

/**
 * Último evento REAL de tracking por cada shipment (tabla shipment_events ·
 * no el status estimado). Permite mostrar "actualizado hace X" con datos
 * reales. Query indexada por (shipment_id, occurred_at desc) where
 * deleted_at is null (migr 0002).
 */
export async function listLatestShipmentEvents(
  supabase: SupabaseClient,
  shipmentIds: string[],
): Promise<Map<string, LatestShipmentEvent>> {
  if (shipmentIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("shipment_events")
    .select("shipment_id, status, occurred_at")
    .in("shipment_id", shipmentIds)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false }); // desempate determinístico
  if (error) throw error;
  return pickLatestPerShipment(
    (data ?? []) as {
      shipment_id: string;
      status: ShipmentStatus;
      occurred_at: string;
    }[],
  );
}

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
    matches.add("fcl_directo");
  if (/\bconsolida|consolidacion|consolidación|\blcl\b/.test(lower))
    matches.add("consolidado_lcl");
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
 * Sanitiza valores invalidos: "consolidado_lcl-fake" → undefined.
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
    service: isShipmentService(service) ? service : undefined,
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

// ─────────────────────────────────────────────────────────────
// SDD-0012: helpers para vista comercial agrupada por cliente
// ─────────────────────────────────────────────────────────────

/** Subset mínimo necesario para Embarques (matchea LIST_COLUMNS). */
export type ShipmentListRow = {
  id: string;
  code: string;
  client_name: string | null;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: ShipmentStatus;
  weight_kg: number | null;
  volume_m3: number | null;
  created_at: string;
  /** Puede no estar si el SELECT del caller no lo pide. */
  client_markbox?: string | null;
};

export type ClientGroupStats = {
  count: number;
  activeCount: number;
  alertCount: number;
  totalCbm: number;
  totalWeight: number;
};

export type ClientShipmentGroup = {
  /** Key: MARKBOX si existe, sino el client_name, sino "Sin cliente". */
  groupKey: string;
  clientName: string;
  clientMarkbox: string | null;
  shipments: ShipmentListRow[];
  stats: ClientGroupStats;
};

const TERMINAL_STATUSES_SET = new Set<ShipmentStatus>([
  "delivered",
  "cancelled",
]);

/**
 * Calcula stats agregadas de un grupo de envíos del mismo cliente.
 */
export function computeClientStats(rows: ShipmentListRow[]): ClientGroupStats {
  let activeCount = 0;
  let alertCount = 0;
  let totalCbm = 0;
  let totalWeight = 0;
  for (const r of rows) {
    if (!TERMINAL_STATUSES_SET.has(r.status)) activeCount++;
    if (r.status === "exception") alertCount++;
    if (r.volume_m3 != null) totalCbm += Number(r.volume_m3);
    if (r.weight_kg != null) totalWeight += Number(r.weight_kg);
  }
  return {
    count: rows.length,
    activeCount,
    alertCount,
    totalCbm: Math.round(totalCbm * 1000) / 1000,
    totalWeight: Math.round(totalWeight * 100) / 100,
  };
}

/**
 * Agrupa shipments por cliente (MARKBOX si existe, sino client_name).
 * Grupos ordenados por: alertCount DESC, luego activeCount DESC, luego clientName ASC.
 * Children dentro del grupo: created_at DESC (ya viene así de listShipments).
 */
export function groupShipmentsByClient(
  rows: ShipmentListRow[],
): ClientShipmentGroup[] {
  const map = new Map<string, ClientShipmentGroup>();

  for (const r of rows) {
    const markbox = r.client_markbox?.trim() || null;
    const name = r.client_name?.trim() || "Sin cliente";
    const key = markbox || `__name:${name.toLowerCase()}`;

    let group = map.get(key);
    if (!group) {
      group = {
        groupKey: key,
        clientName: name,
        clientMarkbox: markbox,
        shipments: [],
        stats: {
          count: 0,
          activeCount: 0,
          alertCount: 0,
          totalCbm: 0,
          totalWeight: 0,
        },
      };
      map.set(key, group);
    }
    group.shipments.push(r);
  }

  const groups = Array.from(map.values());
  // Recalcular stats con todos los shipments asignados
  for (const g of groups) {
    g.stats = computeClientStats(g.shipments);
  }

  groups.sort((a, b) => {
    if (b.stats.alertCount !== a.stats.alertCount) {
      return b.stats.alertCount - a.stats.alertCount;
    }
    if (b.stats.activeCount !== a.stats.activeCount) {
      return b.stats.activeCount - a.stats.activeCount;
    }
    return a.clientName.localeCompare(b.clientName, "es");
  });

  return groups;
}
