/**
 * Tasas de cambio (SDD-0126, SDD-0569) — queries server-side.
 *
 * La última tasa por moneda desde `fx_rates` (migración 0495), con su fecha de
 * valor y su fuente. RLS filtra por tenant. Sin la 0495, «sin tasa cargada».
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ultimaTasa } from "./fx-rates";
import { FX_PAIRS, fxPairCurrency, type ExchangeRatesOverview, type FxRateLatest } from "./exchange-rates-types";

export async function getExchangeRatesOverview(
  supabase: SupabaseClient,
): Promise<ExchangeRatesOverview> {
  const latest: FxRateLatest[] = await Promise.all(
    FX_PAIRS.map(async (pair): Promise<FxRateLatest> => {
      const last = await ultimaTasa(supabase, fxPairCurrency(pair));
      return { pair, rate: last?.rate ?? null, validOn: last?.validOn ?? null, source: last?.source ?? null };
    }),
  );
  return { latest };
}
