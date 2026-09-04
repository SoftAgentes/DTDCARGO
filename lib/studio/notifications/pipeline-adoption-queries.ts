/**
 * Adopción del pipeline de captura en China (Motor de Crecimiento · F2-T04).
 *
 * Manómetro FUND-S3-01: de las recepciones en el galpón de Yiwu
 * (`warehouse_receipts_cn`), ¿cuántas entraron por el PIPELINE — pre-declaradas
 * y recibidas por escaneo, con `prealerta_id` — vs tipeadas a mano por el
 * operario (`prealerta_id` NULL)? El % de escaneadas mide la adopción real del
 * flujo de captura (0244/0245), no cuánto código existe.
 *
 * `warehouse_receipts_cn` tiene RLS por tenant → se lee con el cliente regular;
 * igual se filtra `tenant_id` explícito (regla de la casa). Best-effort: ante
 * error → ceros (un manómetro no rompe la página).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createComponentLogger,
  type StructuredLogger,
} from "@/lib/observability/structured-logger";

export interface PipelineAdoption {
  /** Recepciones no borradas del tenant. */
  total: number;
  /** Con `prealerta_id` — entraron por escaneo / pre-declaración. */
  scanned: number;
  /** Sin `prealerta_id` — tipeadas a mano. */
  typed: number;
  /** % escaneadas sobre el total (0–100, redondeado). 0 si no hay recepciones. */
  adoptionPct: number;
}

/**
 * Calcula el manómetro de adopción a partir de los conteos crudos. Puro y
 * defensivo: satura `scanned` a `[0, total]` y evita dividir por cero.
 */
export function computePipelineAdoption(input: {
  total: number;
  scanned: number;
}): PipelineAdoption {
  const total = Math.max(0, Math.trunc(input.total));
  const scanned = Math.max(0, Math.min(total, Math.trunc(input.scanned)));
  const typed = total - scanned;
  const adoptionPct = total === 0 ? 0 : Math.round((scanned / total) * 100);
  return { total, scanned, typed, adoptionPct };
}

/**
 * Lee los conteos de `warehouse_receipts_cn` (head-count, sin transferir filas)
 * y arma el manómetro de adopción. `typed = total − scanned`.
 */
export async function getPipelineAdoption(
  supabase: SupabaseClient,
  tenantId: string,
  logger: StructuredLogger = createComponentLogger(
    "internal.pipeline-adoption",
  ),
): Promise<PipelineAdoption> {
  try {
    const [totalRes, scannedRes] = await Promise.all([
      supabase
        .from("warehouse_receipts_cn")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      supabase
        .from("warehouse_receipts_cn")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("prealerta_id", "is", null),
    ]);
    if (totalRes.error || scannedRes.error) {
      return computePipelineAdoption({ total: 0, scanned: 0 });
    }
    return computePipelineAdoption({
      total: totalRes.count ?? 0,
      scanned: scannedRes.count ?? 0,
    });
  } catch (err) {
    logger.error("client_notification.query_failed", {
      error: err,
      operation: "pipeline_adoption",
      stage: "read",
    });
    return computePipelineAdoption({ total: 0, scanned: 0 });
  }
}
