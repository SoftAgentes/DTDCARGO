/**
 * Queries del módulo Almacén CN (SDD-0016).
 *
 * RLS filtra por tenant_id automáticamente. warehouses_cn es catálogo
 * global (todos los autenticados ven los activos).
 */

import { roundCbm } from "@/lib/shared/cbm";
import { fetchAllPaged } from "@/lib/db/paginate";
import { situacionDeRecepcion } from "./almacen-cn-contenedores";
import { leerContenedorVigentePorEnvio } from "./almacen-cn-contenedores-queries";
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
  /**
   * SDD-0682: `en_almacen` (por defecto) = lo que está físicamente en la bodega
   * (pendiente de consolidar + incidencia). `all` trae también lo consolidado,
   * que ya salió hacia un contenedor.
   */
  status?: WarehouseReceiptStatus | "all" | "en_almacen";
};

/**
 * SDD-0682: estados que se piden a la base para «En almacén». Lo consolidado
 * entra también, y después `leerSalidasDeAlmacen` saca lo que ya zarpó o llegó
 * (Sam, 2026-11-20: hasta que el contenedor zarpe, «quedan en almacén»).
 */
export const ESTADOS_EN_ALMACEN: readonly WarehouseReceiptStatus[] = [
  "pendiente_consolidacion",
  "incidencia",
  "consolidado",
];

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
 * Lista de recepciones VIVAS con filtros. Joins con warehouses_cn y trae
 * items_count agregado. Hasta 100 más recientes.
 *
 * SDD-0522: la RLS NO excluye las eliminadas —la 0230 sacó `deleted_at is
 * null` de la policy FOR ALL porque bloqueaba el propio soft delete—, así que
 * el `.is("deleted_at", null)` de abajo es lo único que las deja fuera.
 */
export async function listReceipts(
  supabase: SupabaseClient,
  filters: ReceiptFilters = {},
  opts: { redactClientNames?: boolean; salidas?: SalidasDeAlmacen } = {},
): Promise<WarehouseReceiptRow[]> {
  const bodegas = await bodegasDelFiltro(supabase, filters);
  if (bodegas === "ninguna") return [];
  const busqueda = busquedaDelFiltro(filters);

  // Cada página arma su consulta desde cero: un builder de supabase-js no se reusa.
  const armar = () => {
    let query = supabase
      .from("warehouse_receipts_cn")
      .select(RECEIPT_LIST_SELECT)
      .is("deleted_at", null)
      .order("received_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (filters.status === "en_almacen") {
      query = query.in("status", [...ESTADOS_EN_ALMACEN]);
    } else if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (bodegas) query = query.in("warehouse_id", bodegas);
    if (busqueda) query = query.or(busqueda);
    return query;
  };

  let data: unknown[];
  let salidas: SalidasDeAlmacen | null = null;
  if (filters.status === "en_almacen") {
    // SDD-0682: se pide por páginas y se salta lo que ya salió de la bodega, para
    // que las recepciones de un contenedor zarpado no tapen a las que siguen aquí.
    salidas = opts.salidas ?? (await leerSalidasDeAlmacen(supabase, filters));
    const quedan: unknown[] = [];
    for (let pagina = 0; pagina < PAGINAS_EN_ALMACEN && quedan.length < TOPE_LISTA; pagina++) {
      const desde = pagina * TAMANO_PAGINA;
      const { data: filas, error } = await armar().range(desde, desde + TAMANO_PAGINA - 1);
      if (error) throw error;
      const lista = (filas ?? []) as unknown as { id: string }[];
      for (const f of lista) {
        if (!salidas.fuera.has(f.id)) quedan.push(f);
      }
      if (lista.length < TAMANO_PAGINA) break;
    }
    data = quedan.slice(0, TOPE_LISTA);
  } else {
    const { data: filas, error } = await armar().limit(TOPE_LISTA);
    if (error) throw error;
    data = filas ?? [];
  }

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
      // SDD-0682: consolidada en un contenedor que aún no zarpa.
      contenedor_sin_zarpar: salidas?.sinZarpar.get(r.id) ?? null,
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
 * RLS filtra por tenant automáticamente; las eliminadas las saca cada select
 * (SDD-0522: la RLS no lo hace desde la 0230).
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
      .is("deleted_at", null)
      .gte("received_at", firstOfMonth),
    supabase
      .from("warehouse_receipts_cn")
      .select("total_cbm", { count: "exact" })
      .is("deleted_at", null)
      .eq("status", "pendiente_consolidacion")
      .limit(500),
    supabase
      .from("warehouse_receipts_cn")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
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
    cbmInWarehouse: roundCbm(cbmInWarehouse),
    incidentsCount,
  };
}

/**
 * Bodegas que deja pasar el filtro de hub o de código. `null` = sin filtro de
 * bodega; `"ninguna"` = el filtro no coincide con ninguna bodega (cero filas).
 */
async function bodegasDelFiltro(
  supabase: SupabaseClient,
  filters: ReceiptFilters,
): Promise<string[] | null | "ninguna"> {
  // Filtro exacto por warehouse_code → resolver a id primero
  if (filters.warehouseCode && filters.warehouseCode.trim()) {
    const { data: wh } = await supabase
      .from("warehouses_cn")
      .select("id")
      .eq("code", filters.warehouseCode.trim())
      .maybeSingle<{ id: string }>();
    return wh?.id ? [wh.id] : "ninguna";
  }
  if (filters.hub && VALID_HUB_PREFIXES.includes(filters.hub)) {
    // Filtro por prefix de hub → resolver a array de ids
    const { data: hubs } = await supabase
      .from("warehouses_cn")
      .select("id")
      .eq("hub_code", filters.hub)
      .eq("active", true);
    const ids = (hubs ?? []).map((h: { id: string }) => h.id);
    return ids.length === 0 ? "ninguna" : ids;
  }
  return null;
}

/** Expresión `or` de PostgREST para la búsqueda de texto; `null` sin búsqueda. */
function busquedaDelFiltro(filters: ReceiptFilters): string | null {
  if (!filters.q || !filters.q.trim()) return null;
  const q = filters.q
    .trim()
    .replace(/[,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [
    `receipt_code.ilike.%${q}%`,
    `client_name.ilike.%${q}%`,
    `client_markbox.ilike.%${q}%`,
    `supplier_name.ilike.%${q}%`,
    `supplier_name_translated.ilike.%${q}%`,
  ].join(",");
}

const TOPE_LISTA = 100;
const TAMANO_PAGINA = 200;
/** Hasta 5.000 filas recorridas para llenar las 100 de «En almacén». */
const PAGINAS_EN_ALMACEN = 25;

/**
 * SDD-0682: qué recepciones consolidadas ya no están en la bodega.
 *  - `fuera`: ids que no van en «En almacén» (su contenedor zarpó o llegó).
 *  - `enCamino`: cuántas van en un contenedor zarpado: las que se ven en «En
 *    camino». Es el número del aviso, así su enlace dice la verdad.
 *  - `sinZarpar`: las que siguen en la bodega dentro de un contenedor que aún no
 *    zarpa, con su nombre para la etiqueta.
 */
export type SalidasDeAlmacen = {
  fuera: Set<string>;
  enCamino: number;
  sinZarpar: Map<string, { numeroDtd: number | null; ref: string | null }>;
};

/**
 * Lee las recepciones consolidadas (con los mismos filtros de bodega y búsqueda
 * que la tabla; RLS acota al tenant), el contenedor vigente de cada envío
 * (`leerContenedorVigentePorEnvio`: la línea más reciente en un contenedor vivo,
 * la misma que usa «En camino») y decide con `situacionDeRecepcion`. Solo lee.
 */
export async function leerSalidasDeAlmacen(
  supabase: SupabaseClient,
  filters: ReceiptFilters = {},
): Promise<SalidasDeAlmacen> {
  const out: SalidasDeAlmacen = { fuera: new Set(), enCamino: 0, sinZarpar: new Map() };
  const bodegas = await bodegasDelFiltro(supabase, filters);
  if (bodegas === "ninguna") return out;
  const busqueda = busquedaDelFiltro(filters);

  const consolidadas = await fetchAllPaged<{ id: string; shipment_id: string | null }>((d, h) => {
    let q = supabase
      .from("warehouse_receipts_cn")
      .select("id, shipment_id")
      .is("deleted_at", null)
      .eq("status", "consolidado");
    if (bodegas) q = q.in("warehouse_id", bodegas);
    if (busqueda) q = q.or(busqueda);
    return q.order("id", { ascending: true }).range(d, h);
  });
  if (!consolidadas.complete) throw new Error("Las recepciones consolidadas superan el tope de lectura.");
  const envios = consolidadas.rows.map((r) => r.shipment_id).filter((x): x is string => !!x);
  if (envios.length === 0) return out;
  const vigente = await leerContenedorVigentePorEnvio(supabase, envios);

  for (const r of consolidadas.rows) {
    const c = r.shipment_id ? (vigente.get(r.shipment_id) ?? null) : null;
    const situacion = situacionDeRecepcion("consolidado", c);
    if (situacion === "camino") {
      out.fuera.add(r.id);
      out.enCamino++;
    } else if (situacion === "llego") {
      out.fuera.add(r.id);
    } else if (c) {
      out.sinZarpar.set(r.id, { numeroDtd: c.numeroDtd, ref: c.ref });
    }
  }
  return out;
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
  // SDD-0682: sin `?status=` (o con un valor que no existe) la pantalla abre en
  // «En almacén». `?status=all` es la forma explícita de ver todo.
  const status: ReceiptFilters["status"] =
    statusRaw === "all"
      ? "all"
      : statusRaw && VALID_STATUSES.includes(statusRaw as WarehouseReceiptStatus)
        ? (statusRaw as WarehouseReceiptStatus)
        : "en_almacen";

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
