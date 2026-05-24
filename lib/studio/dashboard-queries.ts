/**
 * Queries agregadas para el Dashboard (SDD-0014).
 *
 * Todas reusan los queries existentes o hacen counts simples.
 * RLS filtra por tenant automáticamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Quote } from "./quote-types";

export type OperationalCounts = {
  enTransito: number;
  enAduana: number;
  entregados: number;
  conAlerta: number;
  total: number;
};

const EMPTY_COUNTS: OperationalCounts = {
  enTransito: 0,
  enAduana: 0,
  entregados: 0,
  conAlerta: 0,
  total: 0,
};

/**
 * Counts del dashboard operacional. Usa RPC shipments_dashboard_counts()
 * (migration 0014) que agrega con count(*) filter (where status in ...) en
 * SQL, sin traer rows al cliente. RLS filtra por tenant automaticamente.
 */
export async function getOperationalCounts(
  supabase: SupabaseClient,
): Promise<OperationalCounts> {
  const { data, error } = await supabase.rpc("shipments_dashboard_counts");
  if (error || !data) return EMPTY_COUNTS;
  // jsonb llega como objeto JS — castear con defensiva si falta algun key
  const j = data as Partial<OperationalCounts>;
  return {
    enTransito: j.enTransito ?? 0,
    enAduana: j.enAduana ?? 0,
    entregados: j.entregados ?? 0,
    conAlerta: j.conAlerta ?? 0,
    total: j.total ?? 0,
  };
}

export async function getClientCount(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function getActiveRateCount(
  supabase: SupabaseClient,
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("rates")
    .select("id", { count: "exact", head: true })
    .gte("valid_until", today);
  return count ?? 0;
}

export type QuoteStatsThisMonth = {
  countSent: number;        // status = sent (todavía no aceptada/rechazada)
  countAccepted: number;    // status = accepted
  totalSentAndAccepted: number;     // suma $ de sent + accepted
  totalAccepted: number;            // suma $ solo de accepted
};

export async function getQuoteStatsThisMonth(
  supabase: SupabaseClient,
): Promise<QuoteStatsThisMonth> {
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  const firstIso = firstOfMonth.toISOString();

  const { data } = await supabase
    .from("quotes")
    .select("status, total_usd")
    .in("status", ["sent", "accepted"])
    .gte("created_at", firstIso);

  const stats: QuoteStatsThisMonth = {
    countSent: 0,
    countAccepted: 0,
    totalSentAndAccepted: 0,
    totalAccepted: 0,
  };
  for (const row of data ?? []) {
    const total = Number(row.total_usd) || 0;
    stats.totalSentAndAccepted += total;
    if (row.status === "sent") stats.countSent++;
    if (row.status === "accepted") {
      stats.countAccepted++;
      stats.totalAccepted += total;
    }
  }
  // Redondear a 2 decimales
  stats.totalSentAndAccepted = Math.round(stats.totalSentAndAccepted * 100) / 100;
  stats.totalAccepted = Math.round(stats.totalAccepted * 100) / 100;
  return stats;
}

export type RecentQuoteRow = Pick<
  Quote,
  | "id"
  | "quote_code"
  | "client_name"
  | "client_markbox"
  | "status"
  | "total_usd"
  | "created_at"
>;

export async function getRecentQuotes(
  supabase: SupabaseClient,
  limit = 5,
): Promise<RecentQuoteRow[]> {
  const { data } = await supabase
    .from("quotes")
    .select("id, quote_code, client_name, client_markbox, status, total_usd, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as RecentQuoteRow[] | null) ?? [];
}
