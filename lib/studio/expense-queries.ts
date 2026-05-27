/**
 * Queries del módulo Expenses · gastos rápidos del Mobile ERP.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Expense, ExpenseCurrency } from "./expense-types";

const EXPENSE_COLUMNS =
  "id, tenant_id, user_id, expense_code, amount, currency, category, method, shipment_id, note, location, billable, receipt_path, occurred_at, created_at, updated_at, deleted_at";

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
): Promise<Record<string, string>> {
  const paths = expenses
    .map((e) => e.receipt_path)
    .filter((p): p is string => !!p);
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from("expense-receipts")
    .createSignedUrls(paths, 60 * 60);

  if (error || !data) return {};

  const out: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) {
      out[item.path] = item.signedUrl;
    }
  }
  return out;
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
