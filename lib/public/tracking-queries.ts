/**
 * Queries públicas del Portal Cliente Tracking (Sprint A v2).
 *
 * Llama a la RPC `public_track_shipment` (SECURITY DEFINER, grant anon)
 * que vive en `supabase/migrations/0059_public_track_rpc.sql`.
 *
 * El cliente externo NO está autenticado — usa el cliente Supabase anon.
 * El RPC limita la data retornada para no filtrar info comercial.
 */

import { getAnonClient } from "./supabase-anon";
import type {
  ShipmentService,
  ShipmentStatus,
} from "@/lib/shared/shipment-public";

export type PublicTrackEvent = {
  status: ShipmentStatus;
  note: string | null;
  occurred_at: string;
};

export type PublicTrackResult =
  | {
      found: true;
      code: string;
      status: ShipmentStatus;
      shipment_service: ShipmentService;
      origin: string | null;
      destination: string | null;
      weight_kg: number | null;
      volume_m3: number | null;
      vehicle_category: string | null;
      arrived_destination_at: string | null;
      delivered_at: string | null;
      pod_signed_by: string | null;
      created_at: string;
      events: PublicTrackEvent[];
    }
  | { found: false };

/**
 * Resuelve un código de tracking público.
 *
 * @param code código del shipment (formato S-YYYY-NNNN).
 * @param ip opcional — IP del request para audit log.
 */
export async function publicTrackShipment(
  code: string,
  ip?: string | null,
): Promise<PublicTrackResult> {
  const supabase = getAnonClient();
  const { data, error } = await supabase.rpc("public_track_shipment", {
    p_code: code,
    p_ip: ip ?? null,
  });

  if (error) {
    console.error("[publicTrackShipment] RPC error:", error.message);
    return { found: false };
  }

  // RPC retorna setof → array de 1 elemento
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || !row.found) {
    return { found: false };
  }

  return {
    found: true,
    code: row.code,
    status: row.status,
    shipment_service: row.shipment_service,
    origin: row.origin,
    destination: row.destination,
    weight_kg: row.weight_kg,
    volume_m3: row.volume_m3,
    vehicle_category: row.vehicle_category,
    arrived_destination_at: row.arrived_destination_at,
    delivered_at: row.delivered_at,
    pod_signed_by: row.pod_signed_by,
    created_at: row.created_at,
    events: Array.isArray(row.events) ? row.events : [],
  };
}

/**
 * Calcula el ETA estimado del shipment.
 * - Si está entregado → null (ya llegó).
 * - Si tiene arrived_destination_at → ese es el ETA real (cumplido).
 * - Si está in_transit/shipped/etc → suma heurística sobre created_at + estimado
 *   por tipo de servicio. V1 placeholder; V2 puede leer de tabla `shipping_routes`.
 */
export function estimateEta(result: Extract<PublicTrackResult, { found: true }>): string | null {
  if (result.status === "delivered" || result.delivered_at) return null;
  if (result.arrived_destination_at) return result.arrived_destination_at;

  // Heurística simple por servicio. ETA = created_at + N días.
  const createdAt = new Date(result.created_at);
  const daysByService: Record<ShipmentService, number> = {
    consolidado_lcl: 45,
    puerta_a_puerta_DDP: 50,
    fcl_directo: 35,
    fcl_bodega: 35,
    transporte_terrestre: 5,
  };
  const days = daysByService[result.shipment_service] ?? 45;
  const eta = new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
  return eta.toISOString();
}
