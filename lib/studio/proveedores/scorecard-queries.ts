/**
 * SDD-0111 · Scorecard de proveedores — queries puras.
 *
 * Funciones PURAS que reciben un SupabaseClient. La RLS por tenant (migr 0236)
 * decide qué filas vuelven. El scorecard se lee de la VIEW supplier_scorecard_v
 * (fuente de verdad EN VIVO, §6.5); los reclamos de supplier_claims.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SupplierClaimKind,
  SupplierClaimStatus,
  SupplierGrade,
} from "./scorecard-types";

/**
 * ¿El error es "la relación no existe" (migr 0236 aún sin aplicar a prod)?
 * En ese caso las lecturas del scorecard degradan a vacío en vez de tumbar la
 * página del módulo. Cualquier otro error se propaga (bug real).
 */
function isMissingRelation(error: { code?: string; message?: string }): boolean {
  return (
    error?.code === "42P01" ||
    /relation .* does not exist|could not find the table/i.test(
      error?.message ?? "",
    )
  );
}

/** Una fila de la VIEW supplier_scorecard_v (rating por ficha). */
export interface SupplierScorecard {
  supplier_cn_id: string;
  tenant_id: string;
  client_markbox: string;
  supplier_seq: number;
  name: string;
  city: string | null;
  industry: string | null;
  orders_count: number;
  on_time_count: number;
  conforming_count: number;
  claims_count: number;
  open_claims_count: number;
  on_time_pct: number | null;
  quality_pct: number | null;
  defect_pct: number | null;
  score: number | null;
  grade: SupplierGrade;
}

/** Un reclamo al proveedor (supplier_claims) enriquecido con datos de la ficha. */
export interface SupplierClaimRow {
  id: string;
  tenant_id: string;
  claim_code: string;
  supplier_cn_id: string;
  supplier_name: string | null;
  supplier_seq: number | null;
  purchase_order_id: string | null;
  purchase_order_code: string | null;
  client_markbox: string | null;
  kind: SupplierClaimKind;
  status: SupplierClaimStatus;
  amount_usd: number;
  description: string;
  offset_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** KPIs del scorecard (barra de arriba del tab). */
export interface SupplierScorecardStats {
  supplierCount: number; // proveedores con historial (orders_count > 0)
  avgScore: number | null; // rating promedio sobre 100
  avgOnTime: number | null; // on-time promedio %
  openClaims: number; // reclamos abiertos + en revisión
}

/**
 * Lista TODAS las fichas del tenant con su rating derivado (incluye las sin
 * historial, grade null). Ordenadas por score desc (las sin datos al final).
 */
export async function listSupplierScorecards(
  supabase: SupabaseClient,
): Promise<SupplierScorecard[]> {
  const { data, error } = await supabase
    .from("supplier_scorecard_v")
    .select("*");
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as SupplierScorecard[];
  return rows.sort((a, b) => {
    // Con datos primero (score desc); sin datos (score null) al final por nombre.
    if (a.score == null && b.score == null) return a.name.localeCompare(b.name);
    if (a.score == null) return 1;
    if (b.score == null) return -1;
    return b.score - a.score || a.name.localeCompare(b.name);
  });
}

/** Una ficha por id (o null). */
export async function getSupplierScorecard(
  supabase: SupabaseClient,
  supplierCnId: string,
): Promise<SupplierScorecard | null> {
  const { data, error } = await supabase
    .from("supplier_scorecard_v")
    .select("*")
    .eq("supplier_cn_id", supplierCnId)
    .maybeSingle<SupplierScorecard>();
  if (error) throw error;
  return data ?? null;
}

/** KPIs agregados a partir de las fichas con historial. */
export function supplierScorecardStats(
  rows: SupplierScorecard[],
): SupplierScorecardStats {
  const withData = rows.filter((r) => r.orders_count > 0 && r.score != null);
  const supplierCount = withData.length;
  const openClaims = rows.reduce((acc, r) => acc + (r.open_claims_count ?? 0), 0);
  if (supplierCount === 0) {
    return { supplierCount: 0, avgScore: null, avgOnTime: null, openClaims };
  }
  const avgScore = Math.round(
    withData.reduce((acc, r) => acc + (r.score ?? 0), 0) / supplierCount,
  );
  const onTimeVals = withData.filter((r) => r.on_time_pct != null);
  const avgOnTime =
    onTimeVals.length > 0
      ? Math.round(
          onTimeVals.reduce((acc, r) => acc + (r.on_time_pct ?? 0), 0) /
            onTimeVals.length,
        )
      : null;
  return { supplierCount, avgScore, avgOnTime, openClaims };
}

type ClaimJoinRow = {
  id: string;
  tenant_id: string;
  claim_code: string;
  supplier_cn_id: string;
  purchase_order_id: string | null;
  client_markbox: string | null;
  kind: SupplierClaimKind;
  status: SupplierClaimStatus;
  amount_usd: number | string;
  description: string;
  offset_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  suppliers_cn?: { name: string | null; supplier_seq: number | null } | null;
  purchase_orders?: { purchase_order_code: string | null } | null;
};

/** Lista los reclamos vivos del tenant (join de nombre de proveedor + código de OC). */
export async function listSupplierClaims(
  supabase: SupabaseClient,
): Promise<SupplierClaimRow[]> {
  const { data, error } = await supabase
    .from("supplier_claims")
    .select(
      "id, tenant_id, claim_code, supplier_cn_id, purchase_order_id, client_markbox, kind, status, amount_usd, description, offset_id, resolved_at, created_at, updated_at, suppliers_cn(name, supplier_seq), purchase_orders(purchase_order_code)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  // PostgREST devuelve un objeto (no array) para los embeds to-one; el inferidor
  // sin tipos generados los ve como array → cast vía unknown.
  return ((data ?? []) as unknown as ClaimJoinRow[]).map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    claim_code: r.claim_code,
    supplier_cn_id: r.supplier_cn_id,
    supplier_name: r.suppliers_cn?.name ?? null,
    supplier_seq: r.suppliers_cn?.supplier_seq ?? null,
    purchase_order_id: r.purchase_order_id,
    purchase_order_code: r.purchase_orders?.purchase_order_code ?? null,
    client_markbox: r.client_markbox,
    kind: r.kind,
    status: r.status,
    amount_usd: Number(r.amount_usd ?? 0),
    description: r.description,
    offset_id: r.offset_id,
    resolved_at: r.resolved_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}
