/**
 * Eventos/hitos de envío para el portal del cliente (SDD-0132).
 *
 * `shipment_events` (SDD-0013) la puebla la operación (auto por cambio de status
 * + manual/backdated). El portal la LEE por markbox (RLS portal self-read, migr
 * 0196) para poner la FECHA REAL en cada paso del stepper y en "actividad
 * reciente". Defensa en profundidad: embed `shipments!inner` + filtro explícito
 * por `client_markbox` (los eventos no tienen markbox propio).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShipmentStatus } from "@/lib/shared/shipment-public";

export type PortalShipmentEvent = {
  id: string;
  status: ShipmentStatus;
  /** Fecha real del hito (ISO). */
  occurredAt: string;
  note: string | null;
};

/** Una fila de "actividad reciente" del dashboard (evento + envío al que pertenece). */
export type PortalActivityItem = PortalShipmentEvent & {
  shipmentCode: string;
};

type EventRow = {
  id: string;
  status: string;
  occurred_at: string;
  note: string | null;
};

function mapEventRow(row: EventRow): PortalShipmentEvent {
  return {
    id: row.id,
    status: row.status as ShipmentStatus,
    occurredAt: row.occurred_at,
    note: row.note,
  };
}

/** Markbox del cliente logueado (RPC), o null si el principal no es del portal. */
async function portalMarkbox(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_portal_client_markbox");
  if (error || !data) return null;
  return String(data);
}

/**
 * Eventos de UN envío del cliente (más antiguos primero, para el stepper). Filtra
 * por shipment_id + markbox (embed `shipments!inner`). Sin markbox → [].
 */
export async function listMyShipmentEvents(
  supabase: SupabaseClient,
  shipmentId: string,
): Promise<PortalShipmentEvent[]> {
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return [];

  const { data, error } = await supabase
    .from("shipment_events")
    .select("id, status, occurred_at, note, shipments!inner(client_markbox)")
    .eq("shipment_id", shipmentId)
    .eq("shipments.client_markbox", markbox)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: true });

  if (error || !data) return [];
  return (data as unknown as EventRow[]).map(mapEventRow);
}

/**
 * Mapa status → fecha ISO del PRIMER evento de ese status (la fecha real del hito
 * que ve el cliente en el stepper). Función pura. Recibe eventos en orden
 * ascendente (el primero de cada status gana). Si un status se repite, se queda
 * con el más antiguo (cuándo se alcanzó por primera vez).
 */
export function stepDatesFromEvents(
  events: PortalShipmentEvent[],
): Partial<Record<ShipmentStatus, string>> {
  const map: Partial<Record<ShipmentStatus, string>> = {};
  for (const ev of events) {
    if (!map[ev.status]) {
      map[ev.status] = ev.occurredAt;
    }
  }
  return map;
}

/**
 * "Actividad reciente" del dashboard: últimos eventos del cliente cruzando sus
 * envíos, recientes primero. Filtra explícito por markbox (embed). Hasta `limit`.
 */
export async function listMyRecentActivity(
  supabase: SupabaseClient,
  limit = 8,
): Promise<PortalActivityItem[]> {
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return [];

  const { data, error } = await supabase
    .from("shipment_events")
    .select("id, status, occurred_at, note, shipments!inner(code, client_markbox)")
    .eq("shipments.client_markbox", markbox)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown as (EventRow & { shipments: { code: string } })[]).map(
    (row) => ({
      ...mapEventRow(row),
      shipmentCode: row.shipments?.code ?? "",
    }),
  );
}
