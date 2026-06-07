/**
 * Queries públicas de tarifas para la calculadora del sitio (Fase 2).
 *
 * Llama a la RPC `public_cbm_rate` (SECURITY DEFINER, grant anon) que vive
 * en `supabase/migrations/0101_rates_valid_from_is_public.sql`. Devuelve solo
 * la tarifa per_cbm marcada `is_public` del tenant dtd, con retorno MÍNIMO
 * (per_cbm + min_charge + valid_until) — sin filtrar info comercial.
 *
 * Si no hay tarifa pública marcada (o todo vencido / Supabase caído), devuelve
 * null y el calculador cae al default hardcodeado de `lib/calculadora.ts`
 * (cero regresión).
 */

import { getAnonClient } from "./supabase-anon";
import type { CalcParams, Ciudad } from "@/lib/calculadora";

export type PublicCbmRate = {
  /** Tarifa por CBM en USD (la base editable del calculador). */
  per_cbm: number;
  /** Mínimo cobrable LCL en USD (piso del calculador). null = sin piso comercial. */
  min_charge: number | null;
  /** Vigencia (ISO date YYYY-MM-DD). null = sin fecha de corte. */
  valid_until: string | null;
};

/**
 * Resuelve la tarifa pública del calculador (la marcada `is_public`).
 * @returns la tarifa, o `null` si no hay ninguna vigente / hubo error.
 */
export async function getPublicCbmRate(): Promise<PublicCbmRate | null> {
  // Nunca debe tirar: es una página pública de marketing. Cualquier falla
  // (env faltante, Supabase caído, RPC ausente) → null → fallback a CONFIG.
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_cbm_rate");

    if (error) {
      console.error("[getPublicCbmRate] RPC error:", error.message);
      return null;
    }

    // RPC retorna setof → array de 0 o 1 elemento.
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || row.per_cbm == null) return null;

    return {
      per_cbm: Number(row.per_cbm),
      min_charge: row.min_charge == null ? null : Number(row.min_charge),
      valid_until: row.valid_until ?? null,
    };
  } catch (e) {
    console.error(
      "[getPublicCbmRate] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

/**
 * Resuelve las REGLAS escalares del calculador (Fase 3 Slice A) que el admin
 * configura en /studio/tarifas › Parámetros (tabla calculator_settings).
 *
 * Llama a la RPC `public_calculator_config` (anon, security definer, grant anon)
 * de `supabase/migrations/0103_calculator_settings.sql`. Retorno MÍNIMO: solo
 * las 8 reglas, sin tenant_id ni timestamps.
 *
 * Si no hay fila configurada (o Supabase caído / RPC ausente) devuelve null y
 * el calculador cae a `DEFAULT_PARAMS` de `lib/calculadora.ts` (cero regresión).
 *
 * @returns las reglas como `CalcParams`, o `null` si no hay config / hubo error.
 */
export async function getPublicCalculatorConfig(): Promise<CalcParams | null> {
  // Nunca debe tirar: página pública de marketing. Cualquier falla → null.
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_calculator_config");

    if (error) {
      console.error("[getPublicCalculatorConfig] RPC error:", error.message);
      return null;
    }

    // RPC retorna setof → array de 0 o 1 elemento.
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return null;

    // Mapeo snake_case (DB) → camelCase (CalcParams). Cualquier campo no
    // numérico/ausente invalida la config entera → null (fallback seguro).
    const params: CalcParams = {
      pesoIncluidoKg: Number(row.peso_incluido_kg),
      pesoMaxKg: Number(row.peso_max_kg),
      recargoExcedenteKg: Number(row.recargo_excedente_kg),
      descuentoValencia: Number(row.descuento_valencia),
      recargoEmbalajeEspecial: Number(row.recargo_embalaje_especial),
      recargoBateriaMult: Number(row.recargo_bateria_mult),
      thresholdCascoKm: Number(row.threshold_casco_km),
      tarifaKmFueraCasco: Number(row.tarifa_km_fuera_casco),
      cbmMaxContenedor: Number(row.cbm_max_contenedor),
      pesoMaxContenedorKg: Number(row.peso_max_contenedor_kg),
    };
    if (Object.values(params).some((v) => !Number.isFinite(v))) return null;

    return params;
  } catch (e) {
    console.error(
      "[getPublicCalculatorConfig] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

/**
 * Resuelve las CIUDADES de destino del calculador (Fase 3 Slice B) que el admin
 * configura en /studio/tarifas › Ciudades (tabla calculator_cities).
 *
 * Llama a la RPC `public_calculator_cities` (anon, security definer, grant anon)
 * de `supabase/migrations/0104_calculator_cities_rate_status.sql`. Retorno
 * MÍNIMO: slug + label + km + casco, sin tenant_id ni columnas internas.
 *
 * Si no hay filas (o Supabase caído / RPC ausente) devuelve `[]` y el caller cae
 * al array `CIUDADES` de `lib/calculadora.ts` (cero regresión).
 *
 * @returns la lista como `Ciudad[]`, o `[]` si no hay config / hubo error.
 */
export async function getPublicCalculatorCities(): Promise<Ciudad[]> {
  // Nunca debe tirar: página pública de marketing. Cualquier falla → [].
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_calculator_cities");

    if (error) {
      console.error("[getPublicCalculatorCities] RPC error:", error.message);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    const ciudades: Ciudad[] = [];
    for (const row of rows) {
      // slug (DB) → id (Ciudad). Descartamos filas con slug/label vacíos o km
      // no numérico (defensa: una fila corrupta no debe romper el form).
      const id = typeof row?.slug === "string" ? row.slug.trim() : "";
      const label = typeof row?.label === "string" ? row.label.trim() : "";
      const km = Number(row?.km);
      if (!id || !label || !Number.isFinite(km)) continue;
      ciudades.push({ id, label, km, casco: Boolean(row?.casco) });
    }
    return ciudades;
  } catch (e) {
    console.error(
      "[getPublicCalculatorCities] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  }
}
