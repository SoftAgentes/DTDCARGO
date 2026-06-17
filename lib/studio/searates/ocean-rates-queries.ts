/**
 * Refresco de la caché de tarifas marítimas (SDD-0094 Fase 2 · lado ERP).
 *
 * `refreshOceanRates` recorre la matriz de rutas, consulta cada tarifa a SeaRates
 * y hace UPSERT en `ocean_rates`. Lo invoca el cron /api/cron/searates-refresh con
 * el admin client (service_role). El `fetchRate` se INYECTA (lo pasa el cron =
 * getOceanRate) → este módulo NO importa `server-only` y queda 100% testeable con
 * un fetcher fake + un admin fake.
 *
 * Mapeo del resultado de getOceanRate → fila:
 *   · ok            → status 'ok'      + tarifa/transit/carrier/validez/flags
 *   · error 'no_rate' → status 'no_rate' (la ruta no tuvo tarifa; se cachea igual)
 *   · cualquier otro  → status 'error'   + error_code (auth/http/network/…)
 * Cachear también no_rate/error evita reintentar rutas muertas en cada visita.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SeaRatesQuoteInput, SeaRatesRate } from "./searates-types";
import { OCEAN_RATES_MATRIX, type OceanMatrixRoute } from "./ocean-rates-matrix";

/** Firma del fetcher inyectado (la cumple `getOceanRate`). */
export type RateFetcher = (
  input: Partial<SeaRatesQuoteInput>,
) => Promise<SeaRatesRate>;

/** Fila que se escribe en `ocean_rates` (snake_case = columnas de la tabla). */
export type OceanRateRow = {
  point_from: string;
  point_to: string;
  shipping_type: string;
  container: string;
  status: "ok" | "no_rate" | "error";
  rate_usd: number | null;
  currency: string | null;
  transit_days: number | null;
  carrier: string | null;
  offers_count: number | null;
  valid_to: string | null;
  indicative: boolean | null;
  spot: boolean | null;
  error_code: string | null;
  fetched_at: string;
};

export type RefreshSummary = {
  total: number;
  ok: number;
  no_rate: number;
  error: number;
  upserted: boolean;
  errorMessage?: string;
};

/** Mapea el resultado de una consulta a la fila cacheable. */
export function mapRateToRow(
  route: OceanMatrixRoute,
  rate: SeaRatesRate,
  fetchedAt: string,
): OceanRateRow {
  const base = {
    point_from: route.pointIdFrom,
    point_to: route.pointIdTo,
    shipping_type: route.shippingType,
    container: route.container ?? "",
    fetched_at: fetchedAt,
  };

  if (rate.ok) {
    return {
      ...base,
      status: "ok",
      rate_usd: rate.rateUsd,
      currency: rate.currency,
      transit_days: rate.transitDays,
      carrier: rate.carrier,
      offers_count: rate.offersCount,
      valid_to: rate.validityTo,
      indicative: rate.indicative,
      spot: rate.spot,
      error_code: null,
    };
  }

  const isNoRate = rate.error === "no_rate";
  return {
    ...base,
    status: isNoRate ? "no_rate" : "error",
    rate_usd: null,
    currency: null,
    transit_days: null,
    carrier: null,
    offers_count: null,
    valid_to: null,
    indicative: null,
    spot: null,
    error_code: isNoRate ? null : rate.error,
  };
}

/**
 * Refresca la caché: consulta cada ruta de la matriz y hace UPSERT en bloque.
 * Gasta 1 llamada de rate por ruta (la matriz está dimensionada a la cuota).
 * NUNCA tira por una ruta: un fallo individual queda como status 'error' en su fila.
 */
export async function refreshOceanRates(
  admin: SupabaseClient,
  opts: { fetchRate: RateFetcher; matrix?: readonly OceanMatrixRoute[] },
): Promise<RefreshSummary> {
  const matrix = opts.matrix ?? OCEAN_RATES_MATRIX;
  const fetchedAt = new Date().toISOString();
  const rows: OceanRateRow[] = [];
  const summary: RefreshSummary = {
    total: matrix.length,
    ok: 0,
    no_rate: 0,
    error: 0,
    upserted: false,
  };

  for (const route of matrix) {
    let rate: SeaRatesRate;
    try {
      rate = await opts.fetchRate({
        pointIdFrom: route.pointIdFrom,
        pointIdTo: route.pointIdTo,
        shippingType: route.shippingType,
        container: route.container,
        volumeM3: route.volumeM3,
        weightKg: route.weightKg,
      });
    } catch (e) {
      // getOceanRate NO tira, pero por las dudas: una excepción = fila 'error'.
      rate = { ok: false, error: `network: ${e instanceof Error ? e.message : String(e)}` };
    }
    const row = mapRateToRow(route, rate, fetchedAt);
    rows.push(row);
    summary[row.status] += 1;
  }

  if (rows.length > 0) {
    const { error } = await admin
      .from("ocean_rates")
      .upsert(rows, { onConflict: "point_from,point_to,shipping_type,container" });
    if (error) {
      summary.errorMessage = error.message;
      return summary;
    }
  }
  summary.upserted = true;
  return summary;
}
