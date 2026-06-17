/**
 * Lectura pública de la caché de fletes (SDD-0094 Fase 2 · lado público).
 *
 * Llama a la RPC `public_ocean_rate` (SECURITY DEFINER, grant anon, de la migración
 * 0145) con el cliente anon. Devuelve la tarifa CACHEADA — 0 llamadas a SeaRates por
 * visita (anti-scraping). NUNCA tira: cualquier falla (env faltante, Supabase caído,
 * RPC ausente, ruta no cacheada) → null → el sitio muestra "no disponible".
 *
 * Frontera: vive en `lib/public/` (única capa pública que puede usar @supabase) y
 * solo importa tipos de `@/lib/shared/*` (puente permitido). Cero código del ERP.
 */

import { getAnonClient } from "./supabase-anon";
import type {
  OceanRouteInput,
  OceanRateStatus,
  PublicOceanRate,
} from "@/lib/shared/ocean-rate";

export async function getPublicOceanRate(
  input: OceanRouteInput,
): Promise<PublicOceanRate | null> {
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_ocean_rate", {
      p_from: input.pointIdFrom,
      p_to: input.pointIdTo,
      p_type: input.shippingType,
      p_container: input.container ?? "",
    });

    if (error) {
      console.error("[getPublicOceanRate] RPC error:", error.message);
      return null;
    }

    // RPC retorna setof → array de 0 o 1 elemento.
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return null;

    return {
      rateUsd: row.rate_usd == null ? null : Number(row.rate_usd),
      currency: row.currency ?? null,
      transitDays: row.transit_days == null ? null : Number(row.transit_days),
      carrier: row.carrier ?? null,
      offersCount: row.offers_count == null ? null : Number(row.offers_count),
      validTo: row.valid_to ?? null,
      indicative: row.indicative ?? null,
      spot: row.spot ?? null,
      status: (row.status ?? "error") as OceanRateStatus,
      fetchedAt: row.fetched_at ?? null,
    };
  } catch (e) {
    console.error(
      "[getPublicOceanRate] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}
