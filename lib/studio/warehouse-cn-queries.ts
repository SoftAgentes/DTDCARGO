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
  invoice_verified_at,
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
  opts: { redactClientNames?: boolean } = {},
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
      // Privacidad (SDD-0039 B.9): a users region=cn no se les envía el nombre
      // real del importador VE — solo el MARKBOX. Redacción server-side (no se
      // confía en hide-en-cliente).
      client_name: opts.redactClientNames ? null : r.client_name,
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

/**
 * Resuelve el nombre real del importador a partir de su Shipping Mark.
 *
 * PRIVACIDAD (auditoría 2026-07 · hallazgo H-7). El equipo CN identifica al
 * importador SOLO por Shipping Mark: su nombre nunca viaja al dispositivo en
 * Yiwu. Pero `warehouse_receipts_cn.client_name` es un snapshot denormalizado
 * que el Studio (VE) sí muestra — así que alguien tiene que llenarlo.
 *
 * Ese alguien es el SERVER, acá, desde el markbox. Nunca el cliente: si el
 * valor viniera del dispositivo, el nombre tendría que haber viajado hasta allá
 * primero, que es justo lo que se quiere evitar. Mismo principio que la
 * redacción de `listReceipts` ("no se confía en hide-en-cliente", SDD-0039 B.9),
 * aplicado al camino de escritura.
 *
 * Devuelve `null` si no hay markbox (caja huérfana) o si ningún cliente del
 * tenant lo tiene — el snapshot queda vacío antes que equivocado.
 */
export async function resolveClientNameByMarkbox(
  supabase: SupabaseClient,
  tenantId: string,
  markbox: string | null | undefined,
): Promise<string | null> {
  const mark = markbox?.trim();
  if (!mark) return null;

  const { data } = await supabase
    .from("clients")
    .select("name")
    .eq("tenant_id", tenantId)
    .eq("markbox", mark)
    .is("deleted_at", null)
    .maybeSingle<{ name: string | null }>();

  const nombre = data?.name?.trim();
  if (nombre) return nombre;

  // Camino raro pero caro si falla (SDD-0246): el bulto viene rotulado con un
  // Shipping Mark RETIRADO. Pasa cuando el cliente ya existía, se registró de
  // nuevo por la web, le dieron un código nuevo, se lo pasó a su proveedor —y
  // recién después alguien fusionó las dos fichas. La caja ya salió de Yiwu con
  // el código anulado impreso.
  //
  // La ficha retirada queda soft-deleted, así que la consulta de arriba (que
  // filtra deleted_at) no la ve y el bulto entraría como huérfano. resolve_markbox
  // sigue el redirect hasta el cliente vigente.
  //
  // Va DESPUÉS y no antes a propósito: el 99,99% de los bultos traen un código
  // vigente y no deben pagar un viaje extra a la DB.
  const { data: redirect } = await supabase.rpc("resolve_markbox", {
    p_tenant_id: tenantId,
    p_markbox: mark,
  });
  const fila = (Array.isArray(redirect) ? redirect[0] : redirect) as
    | { client_id: string; canonical_markbox: string | null; was_redirected: boolean }
    | null
    | undefined;
  if (!fila?.client_id || !fila.was_redirected) return null;

  const { data: vigente } = await supabase
    .from("clients")
    .select("name")
    .eq("id", fila.client_id)
    .maybeSingle<{ name: string | null }>();

  return vigente?.name?.trim() || null;
}
