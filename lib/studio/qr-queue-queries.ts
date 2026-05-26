/**
 * Queries del módulo Cola de QR (SDD-0033).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  QrOrder,
  QrOrderStatus,
  QrQueueFilters,
} from "./qr-queue-types";

const QR_COLUMNS =
  "id, tenant_id, order_code, warehouse_id, markbox, client_name, supplier_name, " +
  "bultos, sent_by_operario_id, sent_by_name, sent_by_phone, sent_at, priority, status, " +
  "assigned_printer, printed_at, printed_by, delivered_at, delivered_by, " +
  "cancelled_at, cancelled_by, cancel_reason, notes, created_at, updated_at";

const ACTIVE_STATUSES: QrOrderStatus[] = ["pendiente", "imprimiendo"];
const HISTORY_STATUSES: QrOrderStatus[] = ["impreso", "entregado", "cancelado"];

export async function listQrOrders(
  supabase: SupabaseClient,
  filters: QrQueueFilters,
): Promise<QrOrder[]> {
  const statuses = filters.tab === "cola" ? ACTIVE_STATUSES : HISTORY_STATUSES;

  let query = supabase
    .from("qr_print_orders")
    .select(QR_COLUMNS)
    .in("status", statuses)
    .order("priority", { ascending: false })  // 'urgent' > 'normal' por orden alfabético
    .order("sent_at", { ascending: false })
    .limit(200);

  if (filters.warehouse) query = query.eq("warehouse_id", filters.warehouse);
  if (filters.priority && filters.priority !== "all") {
    query = query.eq("priority", filters.priority);
  }
  if (filters.search) {
    const q = filters.search.trim();
    query = query.or(
      `order_code.ilike.%${q}%,markbox.ilike.%${q}%,client_name.ilike.%${q}%,supplier_name.ilike.%${q}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as QrOrder[] | null) ?? [];
}

// ─────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────

export type QrQueueKpis = {
  pendientes: number;
  urgentes: number;
  imprimiendo: number;
  impresosHoy: number;
  bultosCola: number;
};

export async function computeQrQueueKpis(
  supabase: SupabaseClient,
): Promise<QrQueueKpis> {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [pendientesRes, urgentesRes, imprimiendoRes, impresosHoyRes, bultosRes] =
    await Promise.all([
      supabase
        .from("qr_print_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendiente"),
      supabase
        .from("qr_print_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendiente")
        .eq("priority", "urgent"),
      supabase
        .from("qr_print_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "imprimiendo"),
      supabase
        .from("qr_print_orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["impreso", "entregado"])
        .gte("printed_at", `${todayIso}T00:00:00`),
      supabase
        .from("qr_print_orders")
        .select("bultos")
        .in("status", ["pendiente", "imprimiendo"])
        .limit(500),
    ]);

  const bultosCola = ((bultosRes.data as Array<{ bultos: number }> | null) ?? []).reduce(
    (s, r) => s + (r.bultos ?? 0),
    0,
  );

  return {
    pendientes: pendientesRes.count ?? 0,
    urgentes: urgentesRes.count ?? 0,
    imprimiendo: imprimiendoRes.count ?? 0,
    impresosHoy: impresosHoyRes.count ?? 0,
    bultosCola,
  };
}
