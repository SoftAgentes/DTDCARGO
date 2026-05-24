/**
 * Helpers de query reutilizables para el módulo Tarifas (SDD-0008).
 *
 * RLS filtra por tenant_id automáticamente — no se pasa tenant_id como param.
 * El módulo Cotizador (SDD-0011) consumirá listRates() para sugerir precios.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rate } from "./rate-types";
import type { ShipmentService } from "./shipment-types";

export type RateFilters = {
  service?: ShipmentService | "all";
  q?: string;
  /** Solo tarifas con valid_until >= today. Default false. */
  onlyValid?: boolean;
};

const RATE_COLUMNS =
  "id, tenant_id, service, origin, destination, per_cbm, flat_rate, min_charge, transit_days, valid_until, notes, created_at, updated_at, deleted_at";

/**
 * Lista de tarifas con filtros opcionales. RLS filtra por tenant.
 * Devuelve hasta 200 ordenadas por servicio + origen + destino.
 */
export async function listRates(
  supabase: SupabaseClient,
  filters: RateFilters = {},
): Promise<Rate[]> {
  let query = supabase
    .from("rates")
    .select(RATE_COLUMNS)
    .order("service", { ascending: true })
    .order("origin", { ascending: true })
    .order("destination", { ascending: true })
    .limit(200);

  if (filters.service && filters.service !== "all") {
    query = query.eq("service", filters.service);
  }

  if (filters.onlyValid) {
    const today = new Date().toISOString().slice(0, 10);
    query = query.gte("valid_until", today);
  }

  if (filters.q && filters.q.trim().length > 0) {
    const rawQ = filters.q.trim();
    // Sanitizar separadores que rompen .or() de PostgREST
    const q = rawQ.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    query = query.or(
      [
        `origin.ilike.%${q}%`,
        `destination.ilike.%${q}%`,
        `notes.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Rate[] | null) ?? [];
}

/** Tarifa individual por id. RLS valida ownership. */
export async function getRateById(
  supabase: SupabaseClient,
  id: string,
): Promise<Rate | null> {
  const { data, error } = await supabase
    .from("rates")
    .select(RATE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as Rate | null) ?? null;
}

/**
 * Parsea filtros desde searchParams del URL (?service=&q=).
 */
export function parseRateFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): RateFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const serviceRaw = single("service");
  const service: RateFilters["service"] =
    serviceRaw === "consolidacion" ||
    serviceRaw === "puerta_a_puerta_DDP" ||
    serviceRaw === "reserva_FCL" ||
    serviceRaw === "transporte_terrestre"
      ? serviceRaw
      : "all";

  return {
    service,
    q: single("q") || undefined,
    onlyValid: single("onlyValid") === "1" ? true : undefined,
  };
}
