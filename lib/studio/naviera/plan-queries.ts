/**
 * SDD-0184 · Fase 3 — persistencia del plan de carga.
 *
 * El motor vive en `lib/shared/estiba-plan.ts` (puro, sin DB). Acá está lo único
 * que necesita la base: de dónde salen los LOTES, y cómo se guarda y se lee el
 * plan versionado.
 *
 * ── De dónde salen los lotes ───────────────────────────────────────────────
 * De `consolidation_items`, NO de `warehouse_boxes`. Es una decisión, no un
 * atajo: `warehouse_boxes.cbm` es NULL para toda caja nacida de una prealerta
 * (SDD-0153), así que planificar desde ahí daría lotes sin volumen y el reparto
 * saldría inútil EN SILENCIO. `consolidation_items` sí tiene el CBM asignado al
 * contenedor, que es exactamente lo que el plan reparte.
 *
 * Un item = un lote = la carga de un cliente en ese contenedor.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lote, PlanCarga } from "@/lib/shared/estiba-plan";

/** Fila persistida de `consolidation_plans` (migración 0298). */
export type ConsolidationPlan = {
  id: string;
  tenant_id: string;
  consolidation_id: string;
  version_no: number;
  is_current: boolean;
  container_type: string;
  cbm_capacity: number;
  zone_layout: unknown;
  input: Lote[];
  result: PlanCarga;
  algorithm_version: string;
  created_by: string | null;
  created_at: string;
};

/** Versión del motor que queda grabada en cada plan. Subirla si cambia el reparto. */
export const ALGORITHM_VERSION = "estiba-plan@1";

const PLAN_COLUMNS =
  "id, tenant_id, consolidation_id, version_no, is_current, container_type, cbm_capacity, zone_layout, input, result, algorithm_version, created_by, created_at";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function coercePlan(r: Record<string, unknown>): ConsolidationPlan {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    consolidation_id: String(r.consolidation_id),
    version_no: Math.round(num(r.version_no)),
    is_current: r.is_current === true,
    container_type: String(r.container_type ?? ""),
    cbm_capacity: num(r.cbm_capacity),
    zone_layout: r.zone_layout ?? null,
    input: (r.input as Lote[]) ?? [],
    result: r.result as PlanCarga,
    algorithm_version: String(r.algorithm_version ?? ""),
    created_by: r.created_by == null ? null : String(r.created_by),
    created_at: String(r.created_at),
  };
}

/**
 * Los lotes de una consolidación, listos para el motor.
 *
 * `ordenDescarga` sale del orden de asignación al contenedor: el primero que se
 * asignó es el que más tiempo lleva esperando, así que se descarga primero y va
 * cerca de la puerta. Es una heurística honesta, no un dato declarado — cuando
 * exista un orden de descarga real por ruta, se reemplaza acá y solo acá.
 */
export async function listLotesForPlan(
  supabase: SupabaseClient,
  consolidationId: string,
): Promise<Lote[]> {
  const { data, error } = await supabase
    .from("consolidation_items")
    .select("id, client_markbox, client_name, cbm, pieces, created_at")
    .eq("consolidation_id", consolidationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;

  const rows = (data as Record<string, unknown>[] | null) ?? [];

  return rows.map((r, i) => ({
    id: String(r.id),
    markbox: r.client_markbox == null ? null : String(r.client_markbox),
    clientName: r.client_name == null ? null : String(r.client_name),
    // `pieces` puede venir en 0 si nadie lo cargó: el lote existe igual y hay
    // que decirle al operario dónde ponerlo, así que se toma como 1 bulto.
    cajas: Math.max(1, Math.round(num(r.pieces))),
    cbm: num(r.cbm),
    // El primero asignado sale primero ⇒ el mayor ordenDescarga carga primero
    // (va al fondo). Ver `ordenarLotes` en estiba-plan.ts.
    ordenDescarga: rows.length - i,
    manejoEspecial: null,
  }));
}

/** El plan vigente de una consolidación, o null si nunca se calculó. */
export async function getCurrentPlan(
  supabase: SupabaseClient,
  consolidationId: string,
): Promise<ConsolidationPlan | null> {
  const { data, error } = await supabase
    .from("consolidation_plans")
    .select(PLAN_COLUMNS)
    .eq("consolidation_id", consolidationId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  return data ? coercePlan(data as Record<string, unknown>) : null;
}

/** Los planes vigentes de varias consolidaciones, para el listado. */
export async function listCurrentPlans(
  supabase: SupabaseClient,
  consolidationIds: string[],
): Promise<Record<string, ConsolidationPlan>> {
  if (consolidationIds.length === 0) return {};

  const { data, error } = await supabase
    .from("consolidation_plans")
    .select(PLAN_COLUMNS)
    .in("consolidation_id", consolidationIds)
    .eq("is_current", true)
    .limit(500);
  if (error) throw error;

  const out: Record<string, ConsolidationPlan> = {};
  for (const raw of (data as Record<string, unknown>[] | null) ?? []) {
    const plan = coercePlan(raw);
    out[plan.consolidation_id] = plan;
  }
  return out;
}

/** El historial completo de una consolidación, de la versión más nueva a la más vieja. */
export async function listPlanHistory(
  supabase: SupabaseClient,
  consolidationId: string,
): Promise<ConsolidationPlan[]> {
  const { data, error } = await supabase
    .from("consolidation_plans")
    .select(PLAN_COLUMNS)
    .eq("consolidation_id", consolidationId)
    .order("version_no", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coercePlan);
}
