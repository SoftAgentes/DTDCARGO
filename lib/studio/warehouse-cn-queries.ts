/**
 * Queries del módulo Almacén CN (SDD-0016).
 *
 * RLS filtra por tenant_id automáticamente. warehouses_cn es catálogo
 * global (todos los autenticados ven los activos).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WarehouseCN,
  WarehouseReceipt,
  WarehouseReceiptEvent,
  WarehouseReceiptItem,
  WarehouseReceiptItemSummary,
  WarehouseReceiptRow,
  WarehouseReceiptStatus,
} from "./warehouse-cn-types";

// ─────────────────────────────────────────────────────────────
// Filtros del listado
// ─────────────────────────────────────────────────────────────

export type ReceiptFilters = {
  q?: string;
  /** Prefix del hub: 'YIW' | 'CAN' | 'SZX' | 'SHA' (filtra warehouses por hub_code) */
  hub?: string;
  /** Code exacto de un warehouse: 'YIW-A1', etc. (más específico que hub) */
  warehouseCode?: string;
  status?: WarehouseReceiptStatus | "all";
};

const VALID_STATUSES: WarehouseReceiptStatus[] = [
  "pendiente_consolidacion",
  "consolidado",
  "incidencia",
];
const VALID_HUB_PREFIXES = ["YIW", "CAN", "SZX", "SHA"];

// ─────────────────────────────────────────────────────────────
// SELECT columns
// ─────────────────────────────────────────────────────────────

const WAREHOUSE_COLUMNS =
  "id, code, hub_code, hub_name_es, hub_name_cn, warehouse_name, city, address, active, display_order, created_at";

const RECEIPT_LIST_SELECT = `
  id, tenant_id, receipt_code, warehouse_id,
  client_markbox, client_name, is_orphan, orphan_marks, orphan_brought_by, orphan_suspected_client,
  supplier_name, supplier_name_translated,
  boxes, total_cbm, total_weight_kg, status, shipment_id,
  received_at, notes, destination_city, payment_status,
  deleted_at, created_at, updated_at,
  warehouse:warehouses_cn!warehouse_id ( code, hub_code, hub_name_es, hub_name_cn ),
  items:warehouse_receipt_items ( description, description_translated, quantity, position, hs_code ),
  items_count:warehouse_receipt_items(count)
`;

const RECEIPT_DETAIL_SELECT = `
  id, tenant_id, receipt_code, warehouse_id,
  client_markbox, client_name, is_orphan, orphan_marks, orphan_brought_by, orphan_suspected_client,
  supplier_name, supplier_name_translated,
  boxes, total_cbm, total_weight_kg, status, shipment_id,
  received_at, notes, deleted_at, created_at, updated_at
`;

const ITEM_COLUMNS =
  "id, tenant_id, receipt_id, description, description_translated, hs_code, quantity, unit_value_usd, notes, position, created_at, updated_at";

const EVENT_COLUMNS =
  "id, tenant_id, receipt_id, event_type, description, occurred_at, created_by, created_at";

// ─────────────────────────────────────────────────────────────
// Catálogo
// ─────────────────────────────────────────────────────────────

export async function listWarehouses(
  supabase: SupabaseClient,
): Promise<WarehouseCN[]> {
  const { data, error } = await supabase
    .from("warehouses_cn")
    .select(WAREHOUSE_COLUMNS)
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data as WarehouseCN[] | null) ?? [];
}

// ─────────────────────────────────────────────────────────────
// Receipts
// ─────────────────────────────────────────────────────────────

/**
 * Lista de recepciones con filtros. Joins con warehouses_cn y trae
 * items_count agregado. Hasta 100 más recientes.
 */
export async function listReceipts(
  supabase: SupabaseClient,
  filters: ReceiptFilters = {},
): Promise<WarehouseReceiptRow[]> {
  let query = supabase
    .from("warehouse_receipts_cn")
    .select(RECEIPT_LIST_SELECT)
    .order("received_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  // Filtro exacto por warehouse_code → resolver a id primero
  if (filters.warehouseCode && filters.warehouseCode.trim()) {
    const { data: wh } = await supabase
      .from("warehouses_cn")
      .select("id")
      .eq("code", filters.warehouseCode.trim())
      .maybeSingle<{ id: string }>();
    if (wh?.id) {
      query = query.eq("warehouse_id", wh.id);
    } else {
      // warehouse_code inválido → no rows
      return [];
    }
  } else if (filters.hub && VALID_HUB_PREFIXES.includes(filters.hub)) {
    // Filtro por prefix de hub → resolver a array de ids
    const { data: hubs } = await supabase
      .from("warehouses_cn")
      .select("id")
      .eq("hub_code", filters.hub)
      .eq("active", true);
    const ids = (hubs ?? []).map((h: { id: string }) => h.id);
    if (ids.length === 0) return [];
    query = query.in("warehouse_id", ids);
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q
      .trim()
      .replace(/[,()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    query = query.or(
      [
        `receipt_code.ilike.%${q}%`,
        `client_name.ilike.%${q}%`,
        `client_markbox.ilike.%${q}%`,
        `supplier_name.ilike.%${q}%`,
        `supplier_name_translated.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  // Supabase devuelve las relaciones como arrays incluso en FK 1:1
  // (`warehouse` viene `[{...}]`, `items_count` viene `[{count: N}]`).
  // `items` viene como array desordenado — ordenamos por position acá.
  type RawRow = Omit<
    WarehouseReceiptRow,
    "warehouse" | "items_count" | "items"
  > & {
    warehouse:
      | Pick<WarehouseCN, "code" | "hub_code" | "hub_name_es" | "hub_name_cn">
      | Pick<WarehouseCN, "code" | "hub_code" | "hub_name_es" | "hub_name_cn">[]
      | null;
    items_count: { count: number }[] | number;
    items: WarehouseReceiptItemSummary[] | null;
  };

  const rows = (data ?? []) as unknown as RawRow[];

  return rows.map((r) => {
    const wh = Array.isArray(r.warehouse) ? r.warehouse[0] : r.warehouse;
    const items = (r.items ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return {
      ...r,
      warehouse: wh ?? {
        code: "—",
        hub_code: "—",
        hub_name_es: "—",
        hub_name_cn: "—",
      },
      items,
      items_count: Array.isArray(r.items_count)
        ? (r.items_count[0]?.count ?? 0)
        : (r.items_count ?? 0),
    } satisfies WarehouseReceiptRow;
  });
}

/** Detalle individual de recepción por id (sin items, sin events). */
export async function getReceiptById(
  supabase: SupabaseClient,
  id: string,
): Promise<WarehouseReceipt | null> {
  const { data, error } = await supabase
    .from("warehouse_receipts_cn")
    .select(RECEIPT_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as WarehouseReceipt | null) ?? null;
}

/** Items de una recepción, ordenados por position. */
export async function listItemsForReceipt(
  supabase: SupabaseClient,
  receiptId: string,
): Promise<WarehouseReceiptItem[]> {
  const { data, error } = await supabase
    .from("warehouse_receipt_items")
    .select(ITEM_COLUMNS)
    .eq("receipt_id", receiptId)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data as WarehouseReceiptItem[] | null) ?? [];
}

/** Eventos timeline de una recepción, más reciente primero. */
export async function listEventsForReceipt(
  supabase: SupabaseClient,
  receiptId: string,
): Promise<WarehouseReceiptEvent[]> {
  const { data, error } = await supabase
    .from("warehouse_receipt_events")
    .select(EVENT_COLUMNS)
    .eq("receipt_id", receiptId)
    .order("occurred_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data as WarehouseReceiptEvent[] | null) ?? [];
}

// ─────────────────────────────────────────────────────────────
// KPIs del módulo
// ─────────────────────────────────────────────────────────────

export type WarehouseKpis = {
  receiptsThisMonth: number;
  pendingCount: number;
  cbmInWarehouse: number;
  incidentsCount: number;
};

/**
 * Calcula los 4 KPIs operativos del módulo Almacén CN.
 * - receiptsThisMonth: receipts con `received_at` en el mes corriente
 * - pendingCount: receipts en `pendiente_consolidacion`
 * - cbmInWarehouse: suma de `total_cbm` de pendientes (los que esperan zarpe)
 * - incidentsCount: receipts en `incidencia`
 *
 * Sin agregados Postgres complejos (group by) — usa 3 selects livianos.
 * RLS filtra por tenant automáticamente.
 */
export async function computeWarehouseKpis(
  supabase: SupabaseClient,
): Promise<WarehouseKpis> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [thisMonthResult, pendingResult, incidentResult] = await Promise.all([
    supabase
      .from("warehouse_receipts_cn")
      .select("id", { count: "exact", head: true })
      .gte("received_at", firstOfMonth),
    supabase
      .from("warehouse_receipts_cn")
      .select("total_cbm", { count: "exact" })
      .eq("status", "pendiente_consolidacion")
      .limit(500),
    supabase
      .from("warehouse_receipts_cn")
      .select("id", { count: "exact", head: true })
      .eq("status", "incidencia"),
  ]);

  const receiptsThisMonth = thisMonthResult.count ?? 0;
  const pendingCount = pendingResult.count ?? 0;
  const incidentsCount = incidentResult.count ?? 0;

  const cbmInWarehouse = ((pendingResult.data as { total_cbm: number | null }[] | null) ?? [])
    .reduce((sum, r) => sum + (r.total_cbm ? Number(r.total_cbm) : 0), 0);

  return {
    receiptsThisMonth,
    pendingCount,
    cbmInWarehouse: Math.round(cbmInWarehouse * 1000) / 1000,
    incidentsCount,
  };
}

// ─────────────────────────────────────────────────────────────
// parseFiltersFromSearchParams
// ─────────────────────────────────────────────────────────────

const WAREHOUSE_CODE_RE = /^(YIW|CAN|SZX|SHA)-[A-Z0-9]+$/;

export function parseReceiptFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ReceiptFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const statusRaw = single("status");
  const status: ReceiptFilters["status"] =
    statusRaw && VALID_STATUSES.includes(statusRaw as WarehouseReceiptStatus)
      ? (statusRaw as WarehouseReceiptStatus)
      : "all";

  const hubRaw = single("hub");
  const hub =
    hubRaw && VALID_HUB_PREFIXES.includes(hubRaw) ? hubRaw : undefined;

  const warehouseCodeRaw = single("wh");
  const warehouseCode =
    warehouseCodeRaw && WAREHOUSE_CODE_RE.test(warehouseCodeRaw)
      ? warehouseCodeRaw
      : undefined;

  return {
    q: single("q") || undefined,
    hub,
    warehouseCode,
    status,
  };
}
