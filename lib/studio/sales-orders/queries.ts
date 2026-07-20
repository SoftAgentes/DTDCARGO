/**
 * Queries del módulo Órdenes de venta (SDD-0072) — la OV de DTD.
 *
 * Funciones PURAS que reciben un SupabaseClient. RLS filtra por tenant_id.
 *
 *  - listSalesOrders            · OV del tenant (vivas), recientes primero.
 *  - getSalesOrder              · una OV por id.
 *  - getSalesOrderByCode        · una OV por su code.
 *  - salesOrderStats            · conteo por status (cola del operador).
 *  - listPrealertasForSalesOrder· prealertas (cajas físicas) atadas a una OV.
 *  - getSalesOrderForPrealerta  · resolución INVERSA: dada una prealerta → su OV
 *                                 (la usará el escaneo CN en Fase 2).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SALES_ORDER_STATUSES,
  type SalesOrder,
  type SalesOrderStatus,
} from "./types";
import type { ShipmentService } from "../shipment-types";
import type { Prealerta } from "../prealertas/types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const SO_COLUMNS =
  "id, tenant_id, sales_order_code, quote_id, client_markbox, client_name, service, origin, destination, subtotal_usd, total_usd, status, notes, created_at, updated_at, deleted_at";

// Embebe el code del estimado de origen (EST-…) vía la FK quote_id → quotes.
// to-one: la fila trae `quotes: { quote_code } | null`. Respeta la RLS de quotes.
const SO_SELECT = `${SO_COLUMNS}, quotes(quote_code)`;

const PREALERTA_COLUMNS =
  "id, tenant_id, client_markbox, supplier_id, code, description, tracking_cn, boxes, est_value_usd, status, received_at, shipment_id, share_token, deleted_at, created_at, updated_at";

function coerceSalesOrder(r: Record<string, unknown>): SalesOrder {
  // Embed to-one de quotes(quote_code): supabase-js puede devolver objeto o array.
  const eq = r.quotes as
    | { quote_code?: string | null }
    | { quote_code?: string | null }[]
    | null
    | undefined;
  const embeddedQuote = Array.isArray(eq) ? eq[0] : eq;
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    sales_order_code: String(r.sales_order_code ?? ""),
    quote_id: (r.quote_id as string | null) ?? null,
    quote_code: embeddedQuote?.quote_code ?? null,
    client_markbox: (r.client_markbox as string | null) ?? null,
    client_name: String(r.client_name ?? ""),
    service: (r.service as ShipmentService) ?? "consolidado_lcl",
    origin: String(r.origin ?? ""),
    destination: String(r.destination ?? ""),
    subtotal_usd: num(r.subtotal_usd),
    total_usd: num(r.total_usd),
    status: (r.status as SalesOrderStatus) ?? "confirmada",
    notes: (r.notes as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    deleted_at: (r.deleted_at as string | null) ?? null,
  };
}

function coercePrealerta(r: Record<string, unknown>): Prealerta {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    client_markbox: String(r.client_markbox ?? ""),
    supplier_id: (r.supplier_id as string | null) ?? null,
    code: String(r.code ?? ""),
    description: String(r.description ?? ""),
    tracking_cn: (r.tracking_cn as string | null) ?? null,
    boxes: Math.round(num(r.boxes)),
    est_value_usd: r.est_value_usd == null ? null : num(r.est_value_usd),
    status: (r.status as Prealerta["status"]) ?? "anunciada",
    received_at: (r.received_at as string | null) ?? null,
    shipment_id: (r.shipment_id as string | null) ?? null,
    share_token: (r.share_token as string | null) ?? null,
    sales_order_id: (r.sales_order_id as string | null) ?? null,
    deleted_at: (r.deleted_at as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

// ── Órdenes de venta ───────────────────────────────────────────

/** Lista las OV (vivas) del tenant, recientes primero. Filtro por status opcional. */
export async function listSalesOrders(
  supabase: SupabaseClient,
  opts: { status?: string } = {},
): Promise<SalesOrder[]> {
  let query = supabase
    .from("sales_orders")
    .select(SO_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (opts.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceSalesOrder,
  );
}

/** Lee una OV por id. null si no existe (o RLS la oculta). */
export async function getSalesOrder(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesOrder | null> {
  const { data, error } = await supabase
    .from("sales_orders")
    .select(SO_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? coerceSalesOrder(data as Record<string, unknown>) : null;
}

/** Lee una OV por su code. null si no existe. */
export async function getSalesOrderByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<SalesOrder | null> {
  const { data, error } = await supabase
    .from("sales_orders")
    .select(SO_SELECT)
    .eq("sales_order_code", code)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return coerceSalesOrder(data as Record<string, unknown>);
}

// ── Prealertas atadas a la OV ──────────────────────────────────

/**
 * Lista las prealertas (cajas físicas) atadas a una OV (vivas), recientes
 * primero. RLS filtra por tenant. Defensivo: si la columna sales_order_id no
 * existe aún (0125 sin aplicar en un env), devuelve [] en vez de romper.
 */
export async function listPrealertasForSalesOrder(
  supabase: SupabaseClient,
  salesOrderId: string,
): Promise<Prealerta[]> {
  try {
    const { data, error } = await supabase
      .from("prealertas")
      .select(PREALERTA_COLUMNS)
      .eq("sales_order_id", salesOrderId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return ((data as Record<string, unknown>[] | null) ?? []).map(
      coercePrealerta,
    );
  } catch {
    return [];
  }
}

/**
 * Resolución INVERSA: dada una prealerta (caja física), devuelve la OV que
 * cumple. La usará el escaneo CN en Fase 2 (caja escaneada → OV). null si la
 * prealerta no tiene OV asociada (o no existe / RLS la oculta). Defensivo si la
 * columna aún no existe.
 *
 * // Fase 2: wiring al escaneo — la recepción móvil CN llamará a esta query para
 * // resolver la OV de la caja escaneada. NO se toca app/m/cn en Fase 1.
 */
export async function getSalesOrderForPrealerta(
  supabase: SupabaseClient,
  prealertaId: string,
): Promise<SalesOrder | null> {
  try {
    const { data: pre, error: preErr } = await supabase
      .from("prealertas")
      .select("sales_order_id")
      .eq("id", prealertaId)
      .is("deleted_at", null)
      .maybeSingle<{ sales_order_id: string | null }>();
    if (preErr || !pre?.sales_order_id) return null;
    return getSalesOrder(supabase, pre.sales_order_id);
  } catch {
    return null;
  }
}

// ── Facturas generadas por la OV (provenance · Fase 2) ─────────

/** Subset de factura para la lista de provenance en el drawer de la OV. */
export type SalesOrderInvoiceRef = {
  id: string;
  invoice_code: string;
  total_amount: number;
  status: string;
  issued_at: string | null;
  created_at: string;
};

/**
 * Facturas (0021) generadas por una OV (Fase 2), recientes primero. RLS filtra por
 * tenant. Defensivo: si la columna invoices.sales_order_id no existe aún (0127 sin
 * aplicar en un env), devuelve [] en vez de romper el drawer.
 */
export async function listInvoicesForSalesOrder(
  supabase: SupabaseClient,
  salesOrderId: string,
): Promise<SalesOrderInvoiceRef[]> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, invoice_code, total_amount, status, issued_at, created_at")
      .eq("sales_order_id", salesOrderId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: String(r.id),
      invoice_code: String(r.invoice_code ?? ""),
      total_amount: num(r.total_amount),
      status: String(r.status ?? ""),
      issued_at: (r.issued_at as string | null) ?? null,
      created_at: String(r.created_at),
    }));
  } catch {
    return [];
  }
}

// ── Stats del operador ─────────────────────────────────────────

export type SalesOrderStats = {
  /** total de OV vivas del tenant. */
  total: number;
  /** conteo por cada status del enum (0 si no hay). */
  byStatus: Record<SalesOrderStatus, number>;
  /** suma de total_usd de las OV vivas no canceladas. */
  totalUsd: number;
};

/**
 * Conteo de OV por status para la cola del operador. RLS filtra por tenant.
 * Defensivo: si la tabla aún no existe (0125 sin aplicar en un env), devuelve
 * ceros en vez de romper la pantalla.
 */
export async function salesOrderStats(
  supabase: SupabaseClient,
): Promise<SalesOrderStats> {
  const empty: SalesOrderStats = {
    total: 0,
    byStatus: SALES_ORDER_STATUSES.reduce(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<SalesOrderStatus, number>,
    ),
    totalUsd: 0,
  };

  try {
    const { data, error } = await supabase
      .from("sales_orders")
      .select("status, total_usd")
      .is("deleted_at", null)
      .limit(20000);
    if (error) throw error;

    const rows =
      (data as { status: string; total_usd: unknown }[] | null) ?? [];
    const byStatus = { ...empty.byStatus };
    let totalUsd = 0;
    for (const r of rows) {
      if (r.status in byStatus) byStatus[r.status as SalesOrderStatus] += 1;
      if (r.status !== "cancelada") totalUsd += num(r.total_usd);
    }
    return {
      total: rows.length,
      byStatus,
      totalUsd: Math.round((totalUsd + Number.EPSILON) * 100) / 100,
    };
  } catch {
    return empty;
  }
}
