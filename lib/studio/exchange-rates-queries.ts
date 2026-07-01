/**
 * Tasas de cambio (SDD-0126) — queries server-side.
 *
 * Reusa `getLastFxRate` (expense-queries) para leer la última tasa por par
 * desde `tenant_fx_history`. RLS filtra por tenant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLastFxRate } from "./expense-queries";
import { FX_PAIRS, type ExchangeRatesOverview, type FxRateLatest } from "./exchange-rates-types";

export async function getExchangeRatesOverview(
  supabase: SupabaseClient,
): Promise<ExchangeRatesOverview> {
  const latest: FxRateLatest[] = await Promise.all(
    FX_PAIRS.map(async (pair): Promise<FxRateLatest> => {
      const last = await getLastFxRate(supabase, pair);
      return { pair, rate: last?.rate ?? null, setAt: last?.setAt ?? null };
    }),
  );
  return { latest };
}
