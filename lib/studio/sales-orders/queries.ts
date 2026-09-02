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
import { fetchAllByIds, fetchAllPaged } from "@/lib/db/paginate";
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
  "id, tenant_id, client_markbox, supplier_id, code, description, tracking_cn, client_note, boxes, est_value_usd, status, received_at, shipment_id, share_token, sales_order_id, deleted_at, created_at, updated_at";

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
    client_note: (r.client_note as string | null) ?? null,
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
  // Paginado: las órdenes de venta se acumulan con los meses.
  const pagina = (d: number, h: number) => {
    let q = supabase
      .from("sales_orders")
      .select(SO_SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (opts.status) q = q.eq("status", opts.status);
    return q.range(d, h);
  };
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(pagina);
  if (!complete) {
    throw new Error("Las órdenes de venta superan el tope de lectura; filtra por estado.");
  }
  return data.map(
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
  const byOrder = await listPrealertasBySalesOrder(supabase, [salesOrderId]);
  return byOrder[salesOrderId] ?? [];
}

/** Prealertas de varias OV, agrupadas con lectura paginada por lotes. */
export async function listPrealertasBySalesOrder(
  supabase: SupabaseClient,
  salesOrderIds: readonly string[],
): Promise<Record<string, Prealerta[]>> {
  const ids = [...new Set(salesOrderIds.filter(Boolean))];
  const byOrder = Object.fromEntries(ids.map((id) => [id, []])) as Record<
    string,
    Prealerta[]
  >;
  if (ids.length === 0) return byOrder;

  try {
    const { rows, complete } = await fetchAllByIds<Record<string, unknown>>(
      ids,
      (batch, from, to) =>
        supabase
          .from("prealertas")
          .select(PREALERTA_COLUMNS)
          .in("sales_order_id", batch)
          .is("deleted_at", null)
          .order("sales_order_id", { ascending: true })
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
    );
    if (!complete) {
      throw new Error("Las prealertas por orden superan el tope de lectura.");
    }
    for (const row of rows) {
      const orderId = String(row.sales_order_id ?? "");
      if (byOrder[orderId]) byOrder[orderId].push(coercePrealerta(row));
    }
    return byOrder;
  } catch {
    return byOrder;
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
};

/**
 * Referencias mínimas de facturas generadas por una OV, recientes primero.
 * La RPC valida tenant y permiso efectivo; un fallo no se presenta como vacío.
 */
export async function listInvoicesForSalesOrder(
  supabase: SupabaseClient,
  salesOrderId: string,
): Promise<SalesOrderInvoiceRef[]> {
  const byOrder = await listInvoicesBySalesOrder(supabase, [salesOrderId]);
  return byOrder[salesOrderId] ?? [];
}

/** Referencias de varias OV, agrupadas mediante RPC paginada por lotes. */
export async function listInvoicesBySalesOrder(
  supabase: SupabaseClient,
  salesOrderIds: readonly string[],
): Promise<Record<string, SalesOrderInvoiceRef[]>> {
  const ids = [...new Set(salesOrderIds.filter(Boolean))];
  const byOrder = Object.fromEntries(ids.map((id) => [id, []])) as Record<
    string,
    SalesOrderInvoiceRef[]
  >;
  if (ids.length === 0) return byOrder;

  const { rows, complete } = await fetchAllByIds<Record<string, unknown>>(
    ids,
    (batch, from, to) =>
      supabase
        .rpc("sales_order_invoice_refs", { p_sales_order_ids: batch })
        .order("sales_order_id", { ascending: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (!complete) {
    throw new Error("Las facturas por orden superan el tope de lectura.");
  }
  for (const row of rows) {
    const orderId = String(row.sales_order_id ?? "");
    if (!byOrder[orderId]) continue;
    byOrder[orderId].push({
      id: String(row.id),
      invoice_code: String(row.invoice_code ?? ""),
      total_amount: num(row.total_amount),
      status: String(row.status ?? ""),
    });
  }
  return byOrder;
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
    // Paginado: son los KPI de órdenes de venta — SUMAN montos.
    const { rows: data, complete } = await fetchAllPaged<
      Record<string, unknown>
    >((d, h) =>
      supabase
        .from("sales_orders")
        .select("id, " + "status, total_usd".replace(/^"|"$/g, "") )
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    );
    if (!complete) throw new Error("Las órdenes de venta superan el tope de lectura.");

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
