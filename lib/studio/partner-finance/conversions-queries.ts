/**
 * Queries de conversión de divisa + spread forex (SDD-0059 · Slice A).
 * Funciones PURAS que reciben un SupabaseClient; RLS filtra por tenant_id.
 *
 * El spread (effective vs market) y la comisión captada se COMPUTAN en lib
 * (computeConversionSpread) y se persisten para auditoría histórica. El spread
 * es REVENUE (cuenta 4.6 del plan; ver posting.ts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeConversionSpread,
  num,
  type ConversionInput,
  type CurrencyConversion,
} from "./types";

const CONVERSION_COLUMNS =
  "id, tenant_id, from_currency, to_currency, from_amount, to_amount, effective_rate, market_rate, spread_pct, commission_amount, shipment_id, client_id, converted_on, journal_entry_id, notes, created_at, deleted_at";

function coerceConversion(r: Record<string, unknown>): CurrencyConversion {
  return {
    ...(r as unknown as CurrencyConversion),
    from_amount: num(r.from_amount),
    to_amount: num(r.to_amount),
    effective_rate: num(r.effective_rate),
    market_rate: r.market_rate == null ? null : num(r.market_rate),
    spread_pct: r.spread_pct == null ? null : num(r.spread_pct),
    commission_amount: num(r.commission_amount),
  };
}

/** Lista las conversiones (más reciente primero). RLS por tenant. */
export async function listConversions(
  supabase: SupabaseClient,
): Promise<CurrencyConversion[]> {
  const { data, error } = await supabase
    .from("currency_conversions")
    .select(CONVERSION_COLUMNS)
    .order("converted_on", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceConversion,
  );
}

/**
 * Registra una conversión calculando spread_pct + commission_amount con
 * `computeConversionSpread`. Devuelve la fila persistida. RLS por tenant.
 */
export async function addConversion(
  supabase: SupabaseClient,
  tenantId: string,
  input: ConversionInput,
): Promise<CurrencyConversion> {
  const { spread_pct, commission_amount } = computeConversionSpread({
    fromAmount: input.from_amount,
    effectiveRate: input.effective_rate,
    marketRate: input.market_rate,
    commissionAmount: input.commission_amount,
  });

  const { data, error } = await supabase
    .from("currency_conversions")
    .insert({
      tenant_id: tenantId,
      from_currency: input.from_currency,
      to_currency: input.to_currency,
      from_amount: input.from_amount,
      to_amount: input.to_amount,
      effective_rate: input.effective_rate,
      market_rate: input.market_rate,
      spread_pct,
      commission_amount,
      shipment_id: input.shipment_id,
      client_id: input.client_id,
      converted_on: input.converted_on ?? undefined,
      notes: input.notes,
    })
    .select(CONVERSION_COLUMNS)
    .single();
  if (error) throw error;
  return coerceConversion(data as Record<string, unknown>);
}

/**
 * Total de comisión forex captada (revenue) en un set de conversiones vivas.
 * Útil para el KPI de Slice C (acá sólo el agregado puro vía query).
 */
export async function getForexRevenue(
  supabase: SupabaseClient,
): Promise<{ total_commission: number; count: number }> {
  const { data, error } = await supabase
    .from("currency_conversions")
    .select("commission_amount, deleted_at")
    .is("deleted_at", null)
    .limit(20000);
  if (error) throw error;

  const rows = (data as Record<string, unknown>[] | null) ?? [];
  const total = rows.reduce((acc, r) => acc + num(r.commission_amount), 0);
  return {
    total_commission: Math.round((total + Number.EPSILON) * 100) / 100,
    count: rows.length,
  };
}
