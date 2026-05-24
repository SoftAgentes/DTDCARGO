/**
 * Helpers de query reutilizables para el módulo Cotizador (SDD-0011).
 *
 * RLS filtra por tenant_id automáticamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Quote, QuoteStatus } from "./quote-types";
import { findRateForDestination } from "./destination-change";
import type { Rate } from "./rate-types";
import type { ShipmentService } from "./shipment-types";

export type QuoteFilters = {
  status?: QuoteStatus | "all";
  q?: string;
  clientMarkbox?: string;
};

const QUOTE_COLUMNS =
  "id, tenant_id, quote_code, client_markbox, client_name, service, origin, destination, cbm, weight_kg, boxes, packaging, rate_per_cbm, flat_rate, rate_used_id, subtotal_usd, packaging_cost, total_usd, status, valid_until, sent_at, accepted_at, converted_to_shipment_id, notes, created_at, updated_at, deleted_at";

export async function listQuotes(
  supabase: SupabaseClient,
  filters: QuoteFilters = {},
): Promise<Quote[]> {
  let query = supabase
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.clientMarkbox) {
    query = query.eq("client_markbox", filters.clientMarkbox);
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    query = query.or(
      [
        `quote_code.ilike.%${q}%`,
        `client_name.ilike.%${q}%`,
        `client_markbox.ilike.%${q}%`,
        `origin.ilike.%${q}%`,
        `destination.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Quote[] | null) ?? [];
}

export async function getQuoteByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<Quote | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .eq("quote_code", code)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as Quote | null) ?? null;
}

/**
 * Sugiere una rate del catálogo para (servicio, destino).
 * Wrapper sobre findRateForDestination — para que el QuoteDrawer
 * pueda llamar via server action sin importar Supabase client-side.
 */
export async function suggestRateForQuote(
  supabase: SupabaseClient,
  service: ShipmentService,
  destination: string,
): Promise<Rate | null> {
  if (!destination?.trim()) return null;
  return findRateForDestination(supabase, service, destination);
}

export function parseQuoteFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): QuoteFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const statusRaw = single("status");
  const status: QuoteFilters["status"] =
    statusRaw === "draft" ||
    statusRaw === "sent" ||
    statusRaw === "accepted" ||
    statusRaw === "rejected" ||
    statusRaw === "expired"
      ? statusRaw
      : "all";

  return {
    status,
    q: single("q") || undefined,
    clientMarkbox: single("client") || undefined,
  };
}
