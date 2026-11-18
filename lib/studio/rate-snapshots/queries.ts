/**
 * Lecturas de la tarifa congelada (SDD-0571). RLS filtra por tenant y rol: no
 * se pasa tenant_id. En una base sin la 0496, las lecturas lo dicen
 * (`disponible: false`) en vez de romper el Almacén CN.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RATE_SNAPSHOT_COLUMNS,
  isMissingRateSchema,
  normalizeSnapshot,
  type RateSnapshot,
} from "./types";

export type TarifasVivas =
  | { disponible: true; porRecepcion: Record<string, RateSnapshot> }
  | { disponible: false };

/** PostgREST arma el `in.(…)` en la URL: lotes chicos para no pasarse del largo. */
const LOTE = 150;

/** La tarifa viva de cada recepción pedida (las que no tienen, no aparecen). */
export async function listLiveRatesForReceipts(
  supabase: SupabaseClient,
  receiptIds: string[],
): Promise<TarifasVivas> {
  const porRecepcion: Record<string, RateSnapshot> = {};
  const ids = Array.from(new Set(receiptIds));
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await supabase
      .from("shipment_rate_snapshots")
      .select(RATE_SNAPSHOT_COLUMNS)
      .in("receipt_id", ids.slice(i, i + LOTE))
      .is("superseded_at", null);
    if (error) {
      if (isMissingRateSchema(error)) return { disponible: false };
      throw error;
    }
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const snapshot = normalizeSnapshot(row);
      porRecepcion[snapshot.receipt_id] = snapshot;
    }
  }
  return { disponible: true, porRecepcion };
}

/** Todas las tarifas de una recepción, la más reciente primero (historial). */
export async function listRateHistory(
  supabase: SupabaseClient,
  receiptId: string,
): Promise<RateSnapshot[] | null> {
  const { data, error } = await supabase
    .from("shipment_rate_snapshots")
    .select(RATE_SNAPSHOT_COLUMNS)
    .eq("receipt_id", receiptId)
    .order("frozen_at", { ascending: false });
  if (error) {
    if (isMissingRateSchema(error)) return null;
    throw error;
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeSnapshot);
}
