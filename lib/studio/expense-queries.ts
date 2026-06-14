/**
 * Queries del módulo Expenses · gastos rápidos del Mobile ERP.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { EXPENSE_CATEGORY_ACCOUNT_CODE } from "./expense-types";
import type {
  Expense,
  ExpenseCategory,
  ExpenseCurrency,
  ExpenseScope,
} from "./expense-types";

const EXPENSE_COLUMNS =
  "id, tenant_id, user_id, expense_code, amount, currency, amount_usd, fx_rate, category, scope, method, shipment_id, note, location, billable, receipt_path, account_id, occurred_at, created_at, updated_at, deleted_at";

/**
 * Resuelve la cuenta del plan a la que se imputa un gasto, según su categoría
 * (mapeo EXPENSE_CATEGORY_ACCOUNT_CODE → code → account.id del tenant). Devuelve
 * null si el tenant no sembró esa cuenta (graceful). SDD-0077.
 */
export async function resolveExpenseAccountId(
  supabase: SupabaseClient,
  tenantId: string,
  category: ExpenseCategory,
): Promise<string | null> {
  const code = EXPENSE_CATEGORY_ACCOUNT_CODE[category];
  if (!code) return null;
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("code", code)
    .eq("is_postable", true)
    .maybeSingle<{ id: string }>();
  if (error || !data) return null;
  return data.id;
}

/** Mis gastos · ordenados por occurred_at desc. RLS filtra por user_id. */
export async function listMyExpenses(
  supabase: SupabaseClient,
  opts: { limit?: number; sinceDays?: number } = {},
): Promise<Expense[]> {
  const limit = opts.limit ?? 100;
  let query = supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (opts.sinceDays != null) {
    const since = new Date(
      Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    query = query.gte("occurred_at", since);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Expense[] | null) ?? [];
}

/**
 * Suma total de mis gastos del día actual en USD (conversión mock).
 * Para el KPI "Gastos hoy" del HomeScreen.
 *
 * TODO: cuando exista módulo Rates real (BCV/Paralelo), usar tasa
 * vigente del día. Por ahora: USD=1, VES≈36 (BCV mock), CNY≈7.18.
 */
const RATE_VES_PER_USD = 36;
const RATE_CNY_PER_USD = 7.18;

export function convertToUsd(amount: number, currency: ExpenseCurrency): number {
  if (currency === "USD") return amount;
  if (currency === "VES") return amount / RATE_VES_PER_USD;
  if (currency === "CNY") return amount / RATE_CNY_PER_USD;
  return amount;
}

/**
 * Genera signed URLs para todos los expenses con receipt_path.
 * TTL 1h. Devuelve un map { receipt_path: signed_url }.
 * Pensado para uso server-side en el page que monta el Mobile ERP.
 */
export async function signReceiptUrls(
  supabase: SupabaseClient,
  expenses: Pick<Expense, "receipt_path">[],
  ttlSeconds = 60 * 60,
): Promise<Record<string, string>> {
  const paths = expenses
    .map((e) => e.receipt_path)
    .filter((p): p is string => !!p);
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from("expense-receipts")
    .createSignedUrls(paths, ttlSeconds);

  if (error || !data) return {};

  const out: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) {
      out[item.path] = item.signedUrl;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Módulo web /studio/gastos (SDD-0039) · vista tenant-wide
// ─────────────────────────────────────────────────────────────

export interface ExpenseFilters {
  scope: ExpenseScope;
  /** Mes en formato 'YYYY-MM'. Si undefined, mes actual. */
  month?: string;
  search?: string;
}

/** Rango [inicio, fin) ISO de un mes 'YYYY-MM' (o mes actual). */
function monthRange(month?: string): { start: string; end: string } {
  const now = new Date();
  const [y, m] = month
    ? month.split("-").map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();
  return { start, end };
}

/**
 * Gastos del tenant filtrados por scope + mes + search. RLS (policies
 * expenses_cn_team / expenses_ve_accounting de 0074) decide qué ve cada rol.
 */
export async function listTenantExpenses(
  supabase: SupabaseClient,
  filters: ExpenseFilters,
): Promise<Expense[]> {
  const { start, end } = monthRange(filters.month);
  let query = supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .is("deleted_at", null)
    .eq("scope", filters.scope)
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (filters.search?.trim()) {
    const s = `%${filters.search.trim()}%`;
    query = query.or(`expense_code.ilike.${s},note.ilike.${s},location.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Expense[] | null) ?? [];
}

export interface ExportRow extends Expense {
  shipment_code: string | null;
}

/**
 * Todos los gastos del mes (ambos scopes) + código de contenedor, para el
 * export CSV. Ordenado cronológico. RLS scopea al tenant/rol.
 */
export async function listMonthExpensesForExport(
  supabase: SupabaseClient,
  month?: string,
): Promise<ExportRow[]> {
  const { start, end } = monthRange(month);
  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS + ", shipments(code)")
    .is("deleted_at", null)
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: true })
    .limit(5000);
  if (error) throw error;

  type Raw = Expense & {
    shipments: { code: string | null } | { code: string | null }[] | null;
  };
  return ((data as unknown as Raw[] | null) ?? []).map((r) => {
    const ship = Array.isArray(r.shipments) ? r.shipments[0] : r.shipments;
    const { shipments: _drop, ...rest } = r;
    void _drop;
    return { ...(rest as Expense), shipment_code: ship?.code ?? null };
  });
}

export interface ExpenseKpis {
  shipmentTotalUsd: number;
  externalTotalUsd: number;
  count: number;
}

/** KPIs del mes · suma por scope usando amount_usd (ya normalizado). */
export async function computeExpenseKpis(
  supabase: SupabaseClient,
  month?: string,
): Promise<ExpenseKpis> {
  const { start, end } = monthRange(month);
  const { data, error } = await supabase
    .from("expenses")
    .select("scope, amount_usd")
    .is("deleted_at", null)
    .gte("occurred_at", start)
    .lt("occurred_at", end);
  if (error) throw error;

  const rows = (data as { scope: ExpenseScope; amount_usd: number }[] | null) ?? [];
  let shipmentTotalUsd = 0;
  let externalTotalUsd = 0;
  for (const r of rows) {
    if (r.scope === "shipment") shipmentTotalUsd += Number(r.amount_usd);
    else externalTotalUsd += Number(r.amount_usd);
  }
  return {
    shipmentTotalUsd: Math.round(shipmentTotalUsd),
    externalTotalUsd: Math.round(externalTotalUsd),
    count: rows.length,
  };
}

export interface ShipmentPick {
  id: string;
  code: string;
  status: string;
}

/** Shipments del tenant para el picker del drawer (scope=shipment). */
export async function listShipmentsForPicker(
  supabase: SupabaseClient,
): Promise<ShipmentPick[]> {
  const { data, error } = await supabase
    .from("shipments")
    .select("id, code, status")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    // shipments puede no tener deleted_at en algunos esquemas viejos · retry sin el filtro
    const retry = await supabase
      .from("shipments")
      .select("id, code, status")
      .order("created_at", { ascending: false })
      .limit(200);
    if (retry.error) throw retry.error;
    return (retry.data as ShipmentPick[] | null) ?? [];
  }
  return (data as ShipmentPick[] | null) ?? [];
}

/** Último fx_rate cargado por el tenant para un par (prefill del drawer). */
export async function getLastFxRate(
  supabase: SupabaseClient,
  currencyPair: string,
): Promise<{ rate: number; setAt: string } | null> {
  const { data, error } = await supabase
    .from("tenant_fx_history")
    .select("rate, set_at")
    .eq("currency_pair", currencyPair)
    .order("set_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ rate: number; set_at: string }>();
  if (error || !data) return null;
  return { rate: Number(data.rate), setAt: data.set_at };
}

export async function sumMyExpensesTodayUsd(
  supabase: SupabaseClient,
): Promise<{ total: number; count: number }> {
  // 'today' en VE timezone
  const todayVE = new Date();
  todayVE.setHours(0, 0, 0, 0);
  const todayIso = todayVE.toISOString();

  const { data, error } = await supabase
    .from("expenses")
    .select("amount, currency")
    .is("deleted_at", null)
    .gte("occurred_at", todayIso);

  if (error) throw error;

  const rows = (data as { amount: number; currency: ExpenseCurrency }[] | null) ?? [];
  const total = rows.reduce((s, r) => s + convertToUsd(Number(r.amount), r.currency), 0);
  return { total: Math.round(total), count: rows.length };
}
