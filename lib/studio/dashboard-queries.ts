/**
 * Queries agregadas para el Dashboard (SDD-0014).
 *
 * Todas reusan los queries existentes o hacen counts simples.
 * RLS filtra por tenant automáticamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShipmentStatus } from "./shipment-types";
import type { Quote } from "./quote-types";

const IN_TRANSIT_STATES: ShipmentStatus[] = [
  "shipped",
  "in_transit",
  "last_mile",
  "out_for_delivery",
];

const ALERT_STATES: ShipmentStatus[] = ["exception", "delayed_warehouse"];

export type OperationalCounts = {
  enTransito: number;
  enAduana: number;
  entregados: number;
  conAlerta: number;
  total: number;
};

export async function getOperationalCounts(
  supabase: SupabaseClient,
): Promise<OperationalCounts> {
  const { data } = await supabase.from("shipments").select("status");
  const counts: OperationalCounts = {
    enTransito: 0,
    enAduana: 0,
    entregados: 0,
    conAlerta: 0,
    total: 0,
  };
  for (const row of data ?? []) {
    counts.total++;
    const status = row.status as ShipmentStatus;
    if (IN_TRANSIT_STATES.includes(status)) counts.enTransito++;
    else if (status === "in_customs") counts.enAduana++;
    else if (status === "delivered") counts.entregados++;
    if (ALERT_STATES.includes(status)) counts.conAlerta++;
  }
  return counts;
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
