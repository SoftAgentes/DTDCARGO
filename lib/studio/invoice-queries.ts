/**
 * Helpers de query reutilizables para el módulo Facturación (SDD-0021).
 *
 * RLS filtra por tenant_id automáticamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeBalance,
  isInvoiceIvaMode,
  isOverdue,
  type Invoice,
  type InvoiceStatus,
} from "./invoice-types";

/** Tab del listado. Mapea a los filtros visuales del header. */
export type InvoiceTab = "all" | "pending" | "overdue" | "paid";

export type InvoiceFilters = {
  tab?: InvoiceTab;
  q?: string;
  clientMarkbox?: string;
};

const INVOICE_COLUMNS =
  "id, tenant_id, invoice_code, client_markbox, client_name, shipment_id, shipment_code, currency, fx_rate, iva_rate, iva_mode, base_amount, iva_amount, total_amount, status, issued_at, due_date, paid_amount, last_payment_at, lines, notes, created_at, updated_at, deleted_at";

/** Coacciona los campos numéricos (Supabase devuelve numeric como string). */
function coerce(row: Record<string, unknown>): Invoice {
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const numOrNull = (v: unknown): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const lines = Array.isArray(row.lines)
    ? (row.lines as Invoice["lines"]).map((l) => ({
        desc: String((l as { desc?: unknown }).desc ?? ""),
        qty: num((l as { qty?: unknown }).qty),
        unitPrice: num((l as { unitPrice?: unknown }).unitPrice),
      }))
    : [];

  return {
    ...(row as unknown as Invoice),
    fx_rate: numOrNull(row.fx_rate),
    iva_rate: num(row.iva_rate),
    iva_mode: isInvoiceIvaMode(row.iva_mode) ? row.iva_mode : null,
    base_amount: num(row.base_amount),
    iva_amount: num(row.iva_amount),
    total_amount: num(row.total_amount),
    paid_amount: num(row.paid_amount),
    lines,
  };
}

/**
 * Lista facturas con filtros.
 *
 * `tab` se resuelve client-side porque `pending`/`overdue` dependen de
 * `due_date < today` y de `balance > 0`, que no son columnas directas.
 * El tenant casi nunca tiene > 200 facturas vivas a la vez (cap del query).
 */
export async function listInvoices(
  supabase: SupabaseClient,
  filters: InvoiceFilters = {},
): Promise<Invoice[]> {
  let query = supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.clientMarkbox) {
    query = query.eq("client_markbox", filters.clientMarkbox);
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    query = query.or(
      [
        `invoice_code.ilike.%${q}%`,
        `client_name.ilike.%${q}%`,
        `client_markbox.ilike.%${q}%`,
        `shipment_code.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = ((data as Record<string, unknown>[] | null) ?? []).map(coerce);
  return filterByTab(rows, filters.tab ?? "all");
}

/** Aplica el filtro de tab in-memory (deriva vencidas y por-cobrar). */
export function filterByTab(rows: Invoice[], tab: InvoiceTab): Invoice[] {
  if (tab === "all") return rows;
  if (tab === "paid") return rows.filter((i) => i.status === "pagada");
  if (tab === "overdue") return rows.filter((i) => isOverdue(i));
  // pending = con saldo, no vencidas, no anuladas (vencidas tienen su propio tab)
  return rows.filter(
    (i) =>
      computeBalance(i) > 0 &&
      i.status !== "anulada" &&
      i.status !== "pagada" &&
      !isOverdue(i),
  );
}

/** Counts por tab para los tabs del header (sobre el set ya cargado). */
export function tabCounts(rows: Invoice[]): Record<InvoiceTab, number> {
  return {
    all: rows.length,
    pending: filterByTab(rows, "pending").length,
    overdue: filterByTab(rows, "overdue").length,
    paid: filterByTab(rows, "paid").length,
  };
}

export async function getInvoiceByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("invoice_code", code)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  if (!data) return null;
  return coerce(data as Record<string, unknown>);
}

export type InvoiceKpis = {
  billedYtd: number;
  outstanding: number;
  overdue: number;
};

/**
 * KPIs agregados por tenant para las 3 cards del header.
 * - billedYtd: total facturado en el año (emitidas; excluye anuladas/borrador)
 * - outstanding: saldo por cobrar (balance > 0, excluye anuladas)
 * - overdue: saldo de facturas vencidas
 *
 * Se calcula in-memory sobre las facturas vivas del tenant (RLS) porque
 * `overdue` depende de `due_date < today` y `outstanding` de `balance`.
 */
export async function invoiceKpis(
  supabase: SupabaseClient,
): Promise<InvoiceKpis> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "status, due_date, issued_at, total_amount, paid_amount, created_at",
    )
    .limit(2000);

  if (error) throw error;

  const rows = ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    status: r.status as InvoiceStatus,
    due_date: (r.due_date as string | null) ?? null,
    issued_at: (r.issued_at as string | null) ?? null,
    total_amount: Number(r.total_amount) || 0,
    paid_amount: Number(r.paid_amount) || 0,
    created_at: (r.created_at as string | null) ?? null,
  }));

  const year = new Date().getFullYear();
  let billedYtd = 0;
  let outstanding = 0;
  let overdue = 0;

  for (const r of rows) {
    if (r.status === "anulada") continue;
    const balance = r.total_amount - r.paid_amount;

    // Facturado YTD: facturas con fecha de emisión (o creación) en el año
    // actual, que no son borrador.
    const refDate = r.issued_at ?? r.created_at;
    if (
      r.status !== "borrador" &&
      refDate &&
      Number(refDate.slice(0, 4)) === year
    ) {
      billedYtd += r.total_amount;
    }

    if (balance > 0 && r.status !== "borrador") {
      outstanding += balance;
      if (isOverdue({ due_date: r.due_date, status: r.status })) {
        overdue += balance;
      }
    }
  }

  const round2 = (n: number) =>
    Math.round((n + Number.EPSILON) * 100) / 100;
  return {
    billedYtd: round2(billedYtd),
    outstanding: round2(outstanding),
    overdue: round2(overdue),
  };
}

export function parseInvoiceFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): InvoiceFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const tabRaw = single("tab");
  const tab: InvoiceTab =
    tabRaw === "pending" ||
    tabRaw === "overdue" ||
    tabRaw === "paid"
      ? tabRaw
      : "all";

  return {
    tab,
    q: single("q") || undefined,
    clientMarkbox: single("client") || undefined,
  };
}
