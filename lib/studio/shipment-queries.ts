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
};

/** Campos que se devuelven en el listado (los necesarios para la fila). */
const LIST_COLUMNS =
  "id, code, client_name, origin, destination, shipment_service, status, weight_kg, volume_m3, created_at";

/** Campos completos para la vista detalle. */
const DETAIL_COLUMNS =
  "id, tenant_id, code, client_name, client_markbox, origin, destination, shipment_service, status, weight_kg, volume_m3, vehicle_category, vehicle_model, arrived_destination_at, cancellation_reason, notes, deleted_at, created_at, updated_at";

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
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.q && filters.q.trim().length > 0) {
    const q = filters.q.trim();
    // Busqueda en code OR client_name OR client_markbox (case-insensitive).
    // El .or() de PostgREST acepta condiciones encadenadas con coma.
    query = query.or(
      `code.ilike.%${q}%,client_name.ilike.%${q}%,client_markbox.ilike.%${q}%`,
    );
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
