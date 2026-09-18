/**
 * Helpers de query reutilizables para el módulo Tarifas (SDD-0008).
 *
 * RLS filtra por tenant_id automáticamente — no se pasa tenant_id como param.
 * El módulo Estimados (SDD-0011) consume listRates() para sugerir precios.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rate, RateExpiryLevel } from "./rate-types";
import type { ShipmentService } from "./shipment-types";

export type RateFilters = {
  service?: ShipmentService | "all";
  q?: string;
  /** Solo tarifas con valid_until >= today. Default false. */
  onlyValid?: boolean;
  /**
   * Lista de precios (SDD-0269). Sin esto la pantalla mezclaría las tarifas de
   * la casa con las pactadas con cada aliado, que es justo lo que no se puede
   * confundir. La página lo resuelve a la lista de la casa cuando no viene una.
   */
  priceBookId?: string;
};

// ⚠️ NO agregar expiry_warn_sent_at/expiry_overdue_sent_at acá: este select
// alimenta /studio/tarifas (listRates/getRateById), que se sirve en cada
// carga de página. Esas columnas nacen con la migración 0257, que NO está
// aplicada a producción todavía (pendingBelowCutoff en
// supabase/migrations-baseline.json) — incluirlas acá rompería la pantalla
// en prod el día que este código se despliegue antes que la migración
// (mismo riesgo de orden que documenta SDD-0164). Solo las lee/escribe el
// cron aislado de abajo (RATE_EXPIRY_ALERT_COLUMNS), que puede fallar solo
// sin afectar la UI.
const RATE_COLUMNS =
  "id, tenant_id, service, origin, destination, per_cbm, flat_rate, min_charge, transit_days, valid_from, valid_until, is_public, status, notes, created_at, updated_at, deleted_at";

const RATE_EXPIRY_ALERT_COLUMNS =
  "id, tenant_id, service, origin, destination, valid_until, is_public, status, deleted_at, expiry_warn_sent_at, expiry_overdue_sent_at";

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

  // Sólo se filtra cuando hay lista resuelta. Si la migr 0382 todavía no está
  // aplicada, `listPriceBooks` falla, la página no manda `priceBookId` y esto
  // se comporta exactamente como antes de existir las listas.
  if (filters.priceBookId) {
    query = query.eq("price_book_id", filters.priceBookId);
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
 * La ranura PROGRAMADA de la calculadora (SDD-0478, migr 0459).
 *
 * Consulta APARTE a propósito, por la misma razón que el aviso de arriba sobre
 * RATE_COLUMNS: `publica_programada` nace con la 0459. Si este select viviera
 * en RATE_COLUMNS, desplegar el código antes que la migración rompería
 * /studio/tarifas entera. Así, si la columna no existe (o la consulta falla por
 * cualquier motivo), la pantalla carga igual y sólo esconde la opción de
 * programar: `disponible: false`.
 */
export type RateSchedules = {
  disponible: boolean;
  /** Tarifas programadas vivas: id y el día en que entran. */
  programadas: { id: string; valid_from: string | null }[];
};

export async function listRateSchedules(
  supabase: SupabaseClient,
): Promise<RateSchedules> {
  const { data, error } = await supabase
    .from("rates")
    .select("id, valid_from")
    .eq("publica_programada", true);
  if (error) return { disponible: false, programadas: [] };
  return {
    disponible: true,
    programadas: (data as RateSchedules["programadas"] | null) ?? [],
  };
}

export type RateExpiryCandidate = Pick<
  Rate,
  | "id"
  | "tenant_id"
  | "service"
  | "origin"
  | "destination"
  | "valid_until"
  | "is_public"
  | "status"
  | "deleted_at"
  | "expiry_warn_sent_at"
  | "expiry_overdue_sent_at"
>;

/**
 * Filas candidatas al cron de vencimiento de tarifas públicas (SDD-0164 ⭐1):
 * las mismas que alimentan `public_cbm_rate()` / `public_fcl_rates()`. Usa
 * cliente admin (service_role) — el cron corre para TODOS los tenants, sin
 * sesión de usuario que acote RLS.
 */
export async function listPublicRatesForExpiryAlert(
  admin: SupabaseClient,
  tenantId: string,
): Promise<RateExpiryCandidate[]> {
  const { data, error } = await admin
    .from("rates")
    .select(RATE_EXPIRY_ALERT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("is_public", true)
    .eq("status", "published")
    .is("deleted_at", null)
    .not("valid_until", "is", null);

  if (error) throw error;
  return (data as RateExpiryCandidate[] | null) ?? [];
}

/** Marca el sent_at del nivel avisado — dedup del cron (ver classifyRateExpiry). */
export async function markRateExpiryAlertSent(
  admin: SupabaseClient,
  rateId: string,
  level: RateExpiryLevel,
  sentAtIso: string,
): Promise<void> {
  const column = level === "overdue" ? "expiry_overdue_sent_at" : "expiry_warn_sent_at";
  const { error } = await admin
    .from("rates")
    .update({ [column]: sentAtIso })
    .eq("id", rateId);
  if (error) throw error;
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
    serviceRaw === "consolidado_lcl" ||
    serviceRaw === "puerta_a_puerta_DDP" ||
    serviceRaw === "fcl_directo" ||
    serviceRaw === "transporte_terrestre"
      ? serviceRaw
      : "all";

  return {
    service,
    q: single("q") || undefined,
    onlyValid: single("onlyValid") === "1" ? true : undefined,
    priceBookId: single("book") || undefined,
  };
}
