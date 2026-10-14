/**
 * Queries del módulo Almacén VE (SDD-0017).
 *
 * Modelado como vista derivada de shipments en estados VE-relevant.
 * Sin tabla nueva. RLS filtra por tenant_id automáticamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  VE_STATUSES,
  type VeReceiptRow,
  type VeStatus,
} from "./warehouse-ve-types";

// ─────────────────────────────────────────────────────────────
// Filtros del listado
// ─────────────────────────────────────────────────────────────

export type VeFilters = {
  q?: string;
  /** Substring sobre destination (texto libre del puerto). */
  port?: string;
  status?: VeStatus | "all";
};

const VE_SELECT_COLUMNS =
  "id, code, client_name, client_markbox, destination, destination_gps, delivery_address, shipment_service, status, weight_kg, volume_m3, arrived_destination_at, delivered_at, pod_signed_by, created_at";

// ─────────────────────────────────────────────────────────────
// Listado
// ─────────────────────────────────────────────────────────────

export async function listVeReceipts(
  supabase: SupabaseClient,
  filters: VeFilters = {},
): Promise<VeReceiptRow[]> {
  // SDD-0509: la RLS no excluye los eliminados; sin este filtro un envío
  // eliminado seguía en la bandeja de recepción VE.
  let query = supabase
    .from("shipments")
    .select(VE_SELECT_COLUMNS)
    .is("deleted_at", null)
    .in("status", VE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.port && filters.port.trim()) {
    query = query.ilike("destination", `%${filters.port.trim()}%`);
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q
      .trim()
      .replace(/[,()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    query = query.or(
      [
        `code.ilike.%${q}%`,
        `client_name.ilike.%${q}%`,
        `client_markbox.ilike.%${q}%`,
        `destination.ilike.%${q}%`,
        `delivery_address.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as VeReceiptRow[] | null) ?? [];
}

// ─────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────

export type VeKpis = {
  inCustoms: number;
  readyForPickup: number;
  outForDelivery: number;
  deliveredThisMonth: number;
};

/**
 * 4 contadores agregados del módulo VE.
 * - inCustoms: status = in_customs
 * - readyForPickup: status = arrived_destination
 * - outForDelivery: status IN (out_for_delivery, last_mile)
 * - deliveredThisMonth: status = delivered AND delivered_at >= primer día mes
 *
 * Los cuatro cuentan solo envíos vivos (SDD-0509): la RLS no excluye los
 * eliminados.
 */
export async function computeVeKpis(
  supabase: SupabaseClient,
): Promise<VeKpis> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [customsResult, readyResult, deliveryResult, deliveredResult] =
    await Promise.all([
      supabase
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "in_customs"),
      supabase
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "arrived_destination"),
      supabase
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["out_for_delivery", "last_mile"]),
      supabase
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "delivered")
        .gte("delivered_at", firstOfMonth),
    ]);

  return {
    inCustoms: customsResult.count ?? 0,
    readyForPickup: readyResult.count ?? 0,
    outForDelivery: deliveryResult.count ?? 0,
    deliveredThisMonth: deliveredResult.count ?? 0,
  };
}

/** Ejecuta el cierre manual R3 gobernado de SDD-0231. */
export async function completeVeDeliveryGoverned(
  supabase: SupabaseClient,
  input: {
    shipmentId: string;
    receivedBy: string;
    reason: string;
    requestRef: string;
  },
): Promise<"transitioned" | "replayed"> {
  const { data, error } = await supabase.rpc("complete_ve_delivery_governed", {
    p_shipment_id: input.shipmentId,
    p_received_by: input.receivedBy,
    p_reason: input.reason,
    p_request_ref: input.requestRef,
  });
  if (error) throw error;
  if (data !== "transitioned" && data !== "replayed") {
    throw new Error("Respuesta inválida del cierre gobernado de entrega.");
  }
  return data;
}

// ─────────────────────────────────────────────────────────────
// parseFiltersFromSearchParams
// ─────────────────────────────────────────────────────────────

export function parseVeFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): VeFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const statusRaw = single("status");
  const status: VeFilters["status"] =
    statusRaw && (VE_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as VeStatus)
      : "all";

  return {
    q: single("q") || undefined,
    port: single("port") || undefined,
    status,
  };
}
