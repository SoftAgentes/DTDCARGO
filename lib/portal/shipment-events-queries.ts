/**
 * Eventos/hitos de envío para el portal del cliente (SDD-0132).
 *
 * `shipment_events` (SDD-0013) la puebla la operación (auto por cambio de status
 * + manual/backdated). La lectura propia resuelve el principal Portal y usa la
 * proyección atómica0502: legacy por tenant+marca; cohorte por tenant+client_id
 * del grupo Y envío. Los derechos Studio de una sesión híbrida no amplían esta
 * vista; un helper Studio NULL tampoco invalida un principal Portal-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUS_LABELS, type ShipmentStatus } from "@/lib/shared/shipment-public";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";

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

export class PortalEventsUnavailableError extends Error {
  constructor() { super("PORTAL_EVENTOS_NO_DISPONIBLES"); this.name = "PortalEventsUnavailableError"; }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
function status(value: unknown): value is ShipmentStatus {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(STATUS_LABELS, value);
}

/** No fallback to the generic table: a hybrid session may have wider team RLS. */
async function readOwnEvents(
  supabase: SupabaseClient,
  principal: { tenantId: string; client: { id: string; markbox: string } },
  shipmentId: string | null,
  limit: number | null,
): Promise<PortalActivityItem[]> {
  const view = shipmentId === null ? "recent" : "history";
  if (shipmentId !== null && (typeof shipmentId !== "string" || !shipmentId.trim() || limit !== null)
    || shipmentId === null && (limit === null || !Number.isSafeInteger(limit) || limit < 1 || limit > 2_147_483_647)) {
    throw new PortalEventsUnavailableError();
  }
  let data: unknown;
  try {
    const response = await supabase.rpc("client_consolidation_portal_events", { p_shipment_id: shipmentId, p_limit: limit });
    if (response.error) throw new PortalEventsUnavailableError();
    data = response.data;
  } catch {
    throw new PortalEventsUnavailableError();
  }
  if (!object(data) || data.available !== true || data.complete !== true || !object(data.principal)
    || data.principal.tenantId !== principal.tenantId || data.principal.clientId !== principal.client.id
    || data.principal.markbox !== principal.client.markbox || data.view !== view
    || data.shipmentId !== shipmentId || data.limit !== limit || !date(data.observedAt) || !Array.isArray(data.events)
    || (limit !== null && data.events.length > limit)) throw new PortalEventsUnavailableError();
  const seen = new Set<string>();
  const rows: PortalActivityItem[] = [];
  let previous: { id: string; occurredAt: string } | null = null;
  for (const row of data.events) {
    if (!object(row) || typeof row.id !== "string" || !row.id || seen.has(row.id)
      || typeof row.shipmentId !== "string" || !row.shipmentId || (shipmentId !== null && row.shipmentId !== shipmentId)
      || typeof row.shipmentCode !== "string" || !row.shipmentCode || row.tenantId !== principal.tenantId
      || row.clientId !== principal.client.id || !status(row.status) || !date(row.occurredAt)
      || !(row.note === null || typeof row.note === "string")) throw new PortalEventsUnavailableError();
    if (previous) {
      const difference = Date.parse(row.occurredAt) - Date.parse(previous.occurredAt);
      // SQL orders full timestamp precision. JS must not turn distinct SQL
      // microseconds within the same millisecond into a false id tie.
      const wrongTie = row.occurredAt === previous.occurredAt && (view === "history" ? row.id < previous.id : row.id > previous.id);
      if ((view === "history" ? difference < 0 : difference > 0) || wrongTie) throw new PortalEventsUnavailableError();
    }
    seen.add(row.id);
    rows.push({ id: row.id, status: row.status, occurredAt: row.occurredAt, note: row.note, shipmentCode: row.shipmentCode });
    previous = { id: row.id, occurredAt: row.occurredAt };
  }
  return rows;
}

/**
 * Historia COMPLETA de UN envío propio, más antiguos primero. El id es selector,
 * no autoridad; ajeno/inexistente es ausencia indistinguible. Sin principal → [].
 */
export async function listMyShipmentEvents(
  supabase: SupabaseClient,
  shipmentId: string,
): Promise<PortalShipmentEvent[]> {
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return [];

  return (await readOwnEvents(supabase, principal, shipmentId, null))
    .map(({ id, status, occurredAt, note }) => ({ id, status, occurredAt, note }));
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
 * envíos, recientes primero. TopN explícito, distinto de la historia completa.
 */
export async function listMyRecentActivity(
  supabase: SupabaseClient,
  limit = 8,
): Promise<PortalActivityItem[]> {
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return [];

  return readOwnEvents(supabase, principal, null, limit);
}
