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
import { DEFAULT_PARAMS } from "@/lib/calculadora";
import type { CalcParams, Ciudad } from "@/lib/calculadora";

/** Una ruta FCL pública (contenedor completo) para la calculadora FCL del sitio. */
export type PublicFclRoute = {
  origin: string;
  destination: string;
  /** Tarifa flat por contenedor en USD. */
  flatRate: number;
  /** Piso comercial USD, o null. */
  minCharge: number | null;
  /** Días de tránsito estimados, o null. */
  transitDays: number | null;
  /** Vigencia (ISO date), o null. */
  validUntil: string | null;
};

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

    // Mapeo snake_case (DB) → camelCase (CalcParams). Cualquier campo CORE no
    // numérico/ausente invalida la config entera → null (fallback seguro).
    const core = {
      pesoIncluidoKg: Number(row.peso_incluido_kg),
      recargoExcedenteKg: Number(row.recargo_excedente_kg),
      descuentoValencia: Number(row.descuento_valencia),
      recargoEmbalajeEspecial: Number(row.recargo_embalaje_especial),
      recargoBateriaMult: Number(row.recargo_bateria_mult),
      thresholdCascoKm: Number(row.threshold_casco_km),
      tarifaKmFueraCasco: Number(row.tarifa_km_fuera_casco),
      cbmMaxContenedor: Number(row.cbm_max_contenedor),
      pesoMaxContenedorKg: Number(row.peso_max_contenedor_kg),
    };
    if (Object.values(core).some((v) => !Number.isFinite(v))) return null;

    // pesoMaxEnvioKg se agregó después (migración 0223). Es RESILIENTE al rollout:
    // si el RPC viejo no lo trae (deploy antes de la migración), cae al default
    // (9.000) en vez de invalidar toda la config → cero regresión de pricing.
    const pmev = Number(row.peso_max_envio_kg);
    const params: CalcParams = {
      ...core,
      pesoMaxEnvioKg: Number.isFinite(pmev) ? pmev : DEFAULT_PARAMS.pesoMaxEnvioKg,
    };

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

/**
 * Resuelve las RUTAS FCL públicas (contenedor completo) para `/calculadora-fcl`.
 *
 * Llama a la RPC `public_fcl_rates` (anon, security definer, grant anon) de
 * `supabase/migrations/0157_public_fcl_rates.sql`. Retorno MÍNIMO: origin +
 * destination + flat_rate + min_charge + transit_days + valid_until, solo de las
 * rutas fcl_directo marcadas is_public del tenant dtd.
 *
 * Si no hay rutas públicas (o Supabase caído / RPC ausente) devuelve `[]` y la
 * calculadora muestra su estado vacío ("pídela por WhatsApp"). Nunca tira: es una
 * página pública de marketing.
 */
export async function getPublicFclRoutes(): Promise<PublicFclRoute[]> {
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_fcl_rates");

    if (error) {
      console.error("[getPublicFclRoutes] RPC error:", error.message);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    const routes: PublicFclRoute[] = [];
    for (const row of rows) {
      const origin = typeof row?.origin === "string" ? row.origin.trim() : "";
      const destination =
        typeof row?.destination === "string" ? row.destination.trim() : "";
      const flatRate = Number(row?.flat_rate);
      // Defensa: una fila sin ruta o sin tarifa válida no debe romper el form.
      if (!origin || !destination || !Number.isFinite(flatRate) || flatRate <= 0) {
        continue;
      }
      routes.push({
        origin,
        destination,
        flatRate,
        minCharge: row?.min_charge == null ? null : Number(row.min_charge),
        transitDays: row?.transit_days == null ? null : Number(row.transit_days),
        validUntil: row?.valid_until ?? null,
      });
    }
    return routes;
  } catch (e) {
    console.error(
      "[getPublicFclRoutes] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  }
}
