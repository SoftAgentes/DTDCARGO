/**
 * Queries de activos fijos (SDD-0105 · Activos fijos).
 *
 * Funciones puras que reciben un SupabaseClient. RLS filtra por tenant_id.
 * La cédula de depreciación (cálculo) vive en fixed-asset-types.ts
 * (`computeDepreciation`, PURA) — acá solo se leen activos y registros.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import type {
  AssetDepreciationRow,
  AssetMethod,
  AssetStatus,
  FixedAsset,
} from "./fixed-asset-types";

const ASSET_COLUMNS =
  "id, tenant_id, name, asset_account_id, accum_dep_account_id, expense_account_id, cost, salvage_value, acquired_on, useful_life_months, method, status, disposed_on, notes, created_at, updated_at";

function coerceAsset(row: Record<string, unknown>): FixedAsset {
  const acct = (row.accounts as { code?: string; name?: string } | null) ?? null;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    asset_account_id: String(row.asset_account_id),
    accum_dep_account_id: (row.accum_dep_account_id as string | null) ?? null,
    expense_account_id: (row.expense_account_id as string | null) ?? null,
    cost: Number(row.cost) || 0,
    salvage_value: Number(row.salvage_value) || 0,
    acquired_on: String(row.acquired_on),
    useful_life_months: Number(row.useful_life_months) || 0,
    method: (row.method as AssetMethod) ?? "linea_recta",
    status: row.status as AssetStatus,
    disposed_on: (row.disposed_on as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    asset_account_code: acct?.code,
    asset_account_name: acct?.name,
  };
}

/** Lista los activos del tenant con su cuenta hidratada, recientes 1º. */
export async function listAssets(
  supabase: SupabaseClient,
): Promise<FixedAsset[]> {
  const { data, error } = await supabase
    .from("fixed_assets")
    .select(`${ASSET_COLUMNS}, accounts!fixed_assets_asset_account_id_fkey ( code, name )`)
    .order("acquired_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceAsset);
}

/**
 * Filas de depreciación posteada del tenant (todas, o de un activo si se pasa).
 * Para mostrar el historial y para los KPIs de "ya depreciado este mes".
 */
export async function assetDepreciationRows(
  supabase: SupabaseClient,
  opts: { assetId?: string } = {},
): Promise<AssetDepreciationRow[]> {
  // Paginado: estas filas alimentan el KPI de "ya depreciado este mes", o sea
  // que se SUMAN. Con `.limit(5000)` PostgREST devolvía 1.000 y el acumulado
  // salía corto sin avisar. Se ordena también por `id` porque `period` repite
  // (todos los activos comparten el mismo mes) y sin desempate la paginación
  // puede repetir o saltear filas.
  const { rows, complete } = await fetchAllPaged<Record<string, unknown>>((from, to) => {
    let q = supabase
      .from("fixed_asset_depreciation")
      .select(
        "id, asset_id, tenant_id, period, amount, entry_id, posted_at, created_at, journal_entries ( entry_code )",
      )
      .order("period", { ascending: false })
      .order("id", { ascending: true });
    if (opts.assetId) q = q.eq("asset_id", opts.assetId);
    return q.range(from, to);
  });
  if (!complete) {
    throw new Error(
      "El historial de depreciación supera el tope de lectura; el acumulado no se puede calcular completo.",
    );
  }

  return rows.map((row) => {
    const je = (row.journal_entries as { entry_code?: string } | null) ?? null;
    return {
      id: String(row.id),
      asset_id: String(row.asset_id),
      tenant_id: String(row.tenant_id),
      period: String(row.period),
      amount: Number(row.amount) || 0,
      entry_id: (row.entry_id as string | null) ?? null,
      posted_at: String(row.posted_at),
      created_at: String(row.created_at),
      entry_code: je?.entry_code ?? null,
    };
  });
}
