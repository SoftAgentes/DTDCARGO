/**
 * Query del módulo Parámetros del calculador (Fase 3 Slice A).
 *
 * RLS filtra por tenant_id automáticamente — no se pasa tenant_id como param.
 * Consumido por app/studio/(app)/tarifas/page.tsx para poblar la pestaña
 * Parámetros.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalculatorSettings } from "./calculator-settings-types";

type SettingsRow = {
  tenant_id: string;
  peso_incluido_kg: number | string;
  peso_max_kg: number | string;
  recargo_excedente_kg: number | string;
  descuento_valencia: number | string;
  recargo_embalaje_especial: number | string;
  recargo_bateria_mult: number | string;
  threshold_casco_km: number | string;
  tarifa_km_fuera_casco: number | string;
  updated_at: string;
  updated_by: string | null;
};

/**
 * Lee la config del calculador del tenant logueado (singleton).
 * Devuelve `null` si el tenant todavía no guardó config — el caller usa
 * `DEFAULT_CALCULATOR_SETTINGS` para poblar el form en ese caso.
 *
 * Postgres devuelve numeric como string vía PostgREST; lo normalizamos a number.
 */
export async function getCalculatorSettings(
  supabase: SupabaseClient,
): Promise<CalculatorSettings | null> {
  const { data, error } = await supabase
    .from("calculator_settings")
    .select(
      "tenant_id, peso_incluido_kg, peso_max_kg, recargo_excedente_kg, descuento_valencia, recargo_embalaje_especial, recargo_bateria_mult, threshold_casco_km, tarifa_km_fuera_casco, updated_at, updated_by",
    )
    .maybeSingle<SettingsRow>();

  if (error || !data) return null;

  return {
    tenant_id: data.tenant_id,
    pesoIncluidoKg: Number(data.peso_incluido_kg),
    pesoMaxKg: Number(data.peso_max_kg),
    recargoExcedenteKg: Number(data.recargo_excedente_kg),
    descuentoValencia: Number(data.descuento_valencia),
    recargoEmbalajeEspecial: Number(data.recargo_embalaje_especial),
    recargoBateriaMult: Number(data.recargo_bateria_mult),
    thresholdCascoKm: Number(data.threshold_casco_km),
    tarifaKmFueraCasco: Number(data.tarifa_km_fuera_casco),
    updated_at: data.updated_at,
    updated_by: data.updated_by,
  };
}
