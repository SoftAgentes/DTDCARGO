/**
 * Refresco de la caché de tarifas marítimas (SDD-0095 Fase 2 · lado ERP).
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

/**
 * Tope DURO de llamadas a SeaRates por corrida del cron.
 *
 * **20/semana ≈ 87/mes, cómodo bajo las 100 gratis** — incluso en meses de 5
 * lunes (100 exactas). La matriz de producción = grilla 4×5 = 20 rutas, así que
 * hoy el cap NO recorta nada: es un guard por si alguien suma puertos sin mirar
 * la cuota.
 *
 * Estuvo en 23 para que entrara Qingdao (founder 2026-06-21). Se bajó a 20 el
 * 2026-08-13 al quitarlo: medido en prod, SeaRates no tiene tarifas vigentes
 * Qingdao→Venezuela (ver el bloque ⛔ de `lib/shared/ocean-rate.ts`), así que
 * esas llamadas se gastaban sin mostrar precio y en meses de 5 lunes pasaban de
 * las 100 gratis.
 *
 * GUARD de cuota: el cron nunca consulta más de WEEKLY_CALL_CAP rutas/corrida.
 */
export const WEEKLY_CALL_CAP = 20;

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
  /** Rutas en la matriz ANTES del cap. */
  requested: number;
  /** Rutas efectivamente consultadas (= min(requested, cap)). */
  total: number;
  /** true si el cap de cuota recortó la matriz (señal de que hay que subir el plan). */
  capped: boolean;
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
    point_from: route.fromId,
    point_to: route.toId,
    shipping_type: route.shippingType,
    container: route.container,
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
 * Gasta 1 llamada de rate por ruta. Aplica un TOPE DURO de `WEEKLY_CALL_CAP`
 * rutas por corrida (guard de cuota) → nunca pasa de 100/mes aunque la matriz crezca.
 * NUNCA tira por una ruta: un fallo individual queda como status 'error' en su fila.
 */
export async function refreshOceanRates(
  admin: SupabaseClient,
  opts: { fetchRate: RateFetcher; matrix?: readonly OceanMatrixRoute[]; cap?: number },
): Promise<RefreshSummary> {
  const cap = opts.cap ?? WEEKLY_CALL_CAP;
  const fullMatrix = opts.matrix ?? OCEAN_RATES_MATRIX;
  // Guard de cuota: nunca consultamos más de `cap` rutas por corrida.
  const matrix = fullMatrix.slice(0, cap);
  const fetchedAt = new Date().toISOString();
  const rows: OceanRateRow[] = [];
  const summary: RefreshSummary = {
    requested: fullMatrix.length,
    total: matrix.length,
    capped: fullMatrix.length > cap,
    ok: 0,
    no_rate: 0,
    error: 0,
    upserted: false,
  };

  for (const route of matrix) {
    let rate: SeaRatesRate;
    try {
      rate = await opts.fetchRate({
        coordsFrom: route.coordsFrom,
        coordsTo: route.coordsTo,
        shippingType: route.shippingType,
        container: route.container,
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
