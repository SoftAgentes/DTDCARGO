/**
 * Helpers de query reutilizables para el módulo Clientes (SDD-0010).
 *
 * RLS filtra por tenant_id automáticamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, ClientTier } from "./client-types";

export type ClientFilters = {
  tier?: ClientTier | "all";
  q?: string;
};

const CLIENT_COLUMNS =
  "id, tenant_id, markbox, name, email, phone, address, rif, tier, notes, created_at, updated_at, deleted_at";

/**
 * Lista de clientes con filtros opcionales. RLS filtra por tenant.
 * Hasta 200 ordenados por created_at DESC.
 */
export async function listClients(
  supabase: SupabaseClient,
  filters: ClientFilters = {},
): Promise<Client[]> {
  let query = supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.tier && filters.tier !== "all") {
    query = query.eq("tier", filters.tier);
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    query = query.or(
      [
        `name.ilike.%${q}%`,
        `markbox.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        `phone.ilike.%${q}%`,
        `rif.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Client[] | null) ?? [];
}

/** Cliente individual por markbox. RLS valida ownership. */
export async function getClientByMarkbox(
  supabase: SupabaseClient,
  markbox: string,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("markbox", markbox)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as Client | null) ?? null;
}

/**
 * Lista los shipments asociados a un MARKBOX. Lookup textual (sin FK).
 * Ordenados por created_at DESC. Hasta 200.
 *
 * Devuelve subset de campos suficientes para la tabla del histórico.
 */
export async function listShipmentsByMarkbox(
  supabase: SupabaseClient,
  markbox: string,
) {
  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, code, origin, destination, shipment_service, status, created_at",
    )
    .eq("client_markbox", markbox)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

/**
 * Parsea filtros desde searchParams del URL (?tier=&q=).
 */
export function parseClientFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ClientFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const tierRaw = single("tier");
  const tier: ClientFilters["tier"] =
    tierRaw === "regular" || tierRaw === "vip" || tierRaw === "premium"
      ? tierRaw
      : "all";

  return {
    tier,
    q: single("q") || undefined,
  };
}
