/**
 * Lecturas del cache de tracking (SDD-0101 · Slice B.2). Funciones puras que
 * reciben un `SupabaseClient` (RLS en el ERP; admin scopeado en el portal). Los
 * UPSERTS (snapshot + usage) viven en la server action `refreshTracking`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrackingMilestone } from "./tracking-normalize";

/** Una fila del cache `tracking_snapshots` (mapeada a camelCase). */
export type TrackingSnapshotRow = {
  id: string;
  consolidationId: string | null;
  number: string;
  numberType: string | null;
  sealine: string | null;
  sealineName: string | null;
  status: string | null;
  vessel: string | null;
  polDate: string | null;
  polActual: boolean | null;
  podEta: string | null;
  podActual: boolean | null;
  lastLat: number | null;
  lastLng: number | null;
  milestones: TrackingMilestone[];
  fetchStatus: string;
  errorCode: string | null;
  apiRemaining: number | null;
  fetchedAt: string;
};

const SNAPSHOT_COLUMNS =
  "id, consolidation_id, number, number_type, sealine, sealine_name, status, vessel, pol_date, pol_actual, pod_eta, pod_actual, last_lat, last_lng, milestones, fetch_status, error_code, api_remaining, fetched_at";

function coerceSnapshot(r: Record<string, unknown>): TrackingSnapshotRow {
  return {
    id: String(r.id),
    consolidationId: (r.consolidation_id as string | null) ?? null,
    number: String(r.number),
    numberType: (r.number_type as string | null) ?? null,
    sealine: (r.sealine as string | null) ?? null,
    sealineName: (r.sealine_name as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    vessel: (r.vessel as string | null) ?? null,
    polDate: (r.pol_date as string | null) ?? null,
    polActual: (r.pol_actual as boolean | null) ?? null,
    podEta: (r.pod_eta as string | null) ?? null,
    podActual: (r.pod_actual as boolean | null) ?? null,
    lastLat: r.last_lat == null ? null : Number(r.last_lat),
    lastLng: r.last_lng == null ? null : Number(r.last_lng),
    milestones: Array.isArray(r.milestones)
      ? (r.milestones as TrackingMilestone[])
      : [],
    fetchStatus: String(r.fetch_status ?? "ok"),
    errorCode: (r.error_code as string | null) ?? null,
    apiRemaining: r.api_remaining == null ? null : Number(r.api_remaining),
    fetchedAt: String(r.fetched_at),
  };
}

/**
 * Snapshot cacheado de un número (contenedor/BL). RLS filtra por tenant en el ERP;
 * el portal pasa el admin client + el número de SU envío. null si nunca se trackeó.
 */
export async function getTrackingSnapshotByNumber(
  supabase: SupabaseClient,
  number: string,
): Promise<TrackingSnapshotRow | null> {
  const { data, error } = await supabase
    .from("tracking_snapshots")
    .select(SNAPSHOT_COLUMNS)
    .eq("number", number)
    .maybeSingle();
  if (error || !data) return null;
  return coerceSnapshot(data as Record<string, unknown>);
}

/**
 * Todos los snapshots cacheados del tenant (para mapear por consolidación en el
 * ERP). RLS filtra por tenant. Recientes primero. Hasta 500.
 */
export async function listTrackingSnapshots(
  supabase: SupabaseClient,
): Promise<TrackingSnapshotRow[]> {
  const { data, error } = await supabase
    .from("tracking_snapshots")
    .select(SNAPSHOT_COLUMNS)
    .order("fetched_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(coerceSnapshot);
}

/** Uso de cuota del tracking en un período ('YYYY-MM'). 0/null si no hay fila. */
export async function getTrackingUsage(
  supabase: SupabaseClient,
  tenantId: string,
  period: string,
): Promise<{ calls: number; lastRemaining: number | null }> {
  const { data, error } = await supabase
    .from("searates_tracking_usage")
    .select("calls, last_remaining")
    .eq("tenant_id", tenantId)
    .eq("period", period)
    .maybeSingle();
  if (error || !data) return { calls: 0, lastRemaining: null };
  return {
    calls: Number((data as Record<string, unknown>).calls ?? 0),
    lastRemaining:
      (data as Record<string, unknown>).last_remaining == null
        ? null
        : Number((data as Record<string, unknown>).last_remaining),
  };
}
