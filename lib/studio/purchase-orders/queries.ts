/**
 * Queries del módulo Órdenes de compra (SDD-0071) — la OC de DTD.
 *
 * Funciones PURAS que reciben un SupabaseClient. RLS filtra por tenant_id.
 *
 *  - listPurchaseOrders        · OC del tenant (vivas), recientes primero.
 *  - getPurchaseOrderByCode    · una OC por su code (+ ítems).
 *  - listPurchaseOrderItems    · ítems de una OC, en orden de posición.
 *  - listPurchaseOrderItemsByOrder · ítems de varias OC, leídos por lotes.
 *  - purchaseOrderStats        · conteo por status (cola del operador).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds, fetchAllPaged } from "@/lib/db/paginate";
import {
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderStatus,
} from "./types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const PO_COLUMNS =
  "id, tenant_id, purchase_order_code, client_markbox, supplier_id, supplier_name, sales_order_id, status, total_cost_usd, bill_id, notes, created_at, updated_at, deleted_at";

const PO_ITEM_COLUMNS =
  "id, tenant_id, purchase_order_id, description, qty, unit_cost_usd, position, created_at, updated_at";

function coercePurchaseOrder(r: Record<string, unknown>): PurchaseOrder {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    purchase_order_code: String(r.purchase_order_code ?? ""),
    client_markbox: (r.client_markbox as string | null) ?? null,
    supplier_id: (r.supplier_id as string | null) ?? null,
    supplier_name: (r.supplier_name as string | null) ?? null,
    sales_order_id: (r.sales_order_id as string | null) ?? null,
    status: (r.status as PurchaseOrderStatus) ?? "borrador",
    total_cost_usd: num(r.total_cost_usd),
    bill_id: (r.bill_id as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    deleted_at: (r.deleted_at as string | null) ?? null,
  };
}

function coercePoItem(r: Record<string, unknown>): PurchaseOrderItem {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    purchase_order_id: String(r.purchase_order_id),
    description: String(r.description ?? ""),
    qty: num(r.qty),
    unit_cost_usd: num(r.unit_cost_usd),
    position: Math.round(num(r.position)),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

// ── Órdenes de compra ──────────────────────────────────────────

/** Lista las OC (vivas) del tenant, recientes primero. Filtro por status opcional. */
export async function listPurchaseOrders(
  supabase: SupabaseClient,
  opts: { status?: string } = {},
): Promise<PurchaseOrder[]> {
  // Paginado: las órdenes de compra se acumulan con los meses.
  const pagina = (d: number, h: number) => {
    let q = supabase
      .from("purchase_orders")
      .select(PO_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (opts.status) q = q.eq("status", opts.status);
    return q.range(d, h);
  };
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(pagina);
  if (!complete) {
    throw new Error("Las órdenes de compra superan el tope de lectura; filtra por estado.");
  }
  return data.map(
    coercePurchaseOrder,
  );
}

/** Lee una OC por id. null si no existe (o RLS la oculta). */
export async function getPurchaseOrder(
  supabase: SupabaseClient,
  id: string,
): Promise<PurchaseOrder | null> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(PO_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? coercePurchaseOrder(data as Record<string, unknown>) : null;
}

/** Lee una OC por su code (+ sus ítems). null si no existe. */
export async function getPurchaseOrderByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] } | null> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(PO_COLUMNS)
    .eq("purchase_order_code", code)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  const order = coercePurchaseOrder(data as Record<string, unknown>);
  const items = await listPurchaseOrderItems(supabase, order.id);
  return { order, items };
}

/**
 * Lista los ítems de varias OC, agrupados por id de orden.
 *
 * `fetchAllByIds` parte el filtro para no desbordar la URL y pagina cada lote
 * hasta una respuesta vacía. Así la pantalla de listado no hace una consulta
 * por cada OC ni vuelve a introducir un límite silencioso de 500 ítems.
 */
export async function listPurchaseOrderItemsByOrder(
  supabase: SupabaseClient,
  purchaseOrderIds: readonly string[],
): Promise<Record<string, PurchaseOrderItem[]>> {
  const ids = [...new Set(purchaseOrderIds.filter(Boolean))];
  const byOrder = Object.fromEntries(ids.map((id) => [id, []])) as Record<
    string,
    PurchaseOrderItem[]
  >;
  if (ids.length === 0) return byOrder;

  const { rows, complete } = await fetchAllByIds<Record<string, unknown>>(
    ids,
    (batch, from, to) =>
      supabase
        .from("purchase_order_items")
        .select(PO_ITEM_COLUMNS)
        .in("purchase_order_id", batch)
        .order("purchase_order_id", { ascending: true })
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (!complete) {
    throw new Error("Los ítems de órdenes de compra superan el tope de lectura.");
  }

  for (const row of rows) {
    const item = coercePoItem(row);
    byOrder[item.purchase_order_id]?.push(item);
  }
  return byOrder;
}

/** Lista los ítems de una OC, en orden de posición. */
export async function listPurchaseOrderItems(
  supabase: SupabaseClient,
  purchaseOrderId: string,
): Promise<PurchaseOrderItem[]> {
  const byOrder = await listPurchaseOrderItemsByOrder(supabase, [purchaseOrderId]);
  return byOrder[purchaseOrderId] ?? [];
}

// ── Stats del operador ─────────────────────────────────────────

export type PurchaseOrderStats = {
  /** total de OC vivas del tenant. */
  total: number;
  /** conteo por cada status del enum (0 si no hay). */
  byStatus: Record<PurchaseOrderStatus, number>;
  /** suma de total_cost_usd de las OC vivas no canceladas. */
  totalCostUsd: number;
};

/**
 * Conteo de OC por status para la cola del operador. RLS filtra por tenant.
 * Defensivo: si la tabla aún no existe (0124 sin aplicar en un env), devuelve
 * ceros en vez de romper la pantalla.
 */
export async function purchaseOrderStats(
  supabase: SupabaseClient,
): Promise<PurchaseOrderStats> {
  const empty: PurchaseOrderStats = {
    total: 0,
    byStatus: PURCHASE_ORDER_STATUSES.reduce(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<PurchaseOrderStatus, number>,
    ),
    totalCostUsd: 0,
  };

  try {
    // Paginado: son los KPI de órdenes de compra — SUMAN montos.
    const { rows: data, complete } = await fetchAllPaged<
      Record<string, unknown>
    >((d, h) =>
      supabase
        .from("purchase_orders")
        .select("id, " + "status, total_cost_usd".replace(/^"|"$/g, "") )
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    );
    if (!complete) throw new Error("Las órdenes de compra superan el tope de lectura.");

    const rows =
      (data as { status: string; total_cost_usd: unknown }[] | null) ?? [];
    const byStatus = { ...empty.byStatus };
    let totalCostUsd = 0;
    for (const r of rows) {
      if (r.status in byStatus) byStatus[r.status as PurchaseOrderStatus] += 1;
      if (r.status !== "cancelada") totalCostUsd += num(r.total_cost_usd);
    }
    return {
      total: rows.length,
      byStatus,
      totalCostUsd: Math.round((totalCostUsd + Number.EPSILON) * 100) / 100,
    };
  } catch {
    return empty;
  }
}
