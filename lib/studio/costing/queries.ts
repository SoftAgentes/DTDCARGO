/**
 * Queries del módulo Costing & Margen (SDD-0053 · Slice A).
 *
 * Funciones puras que reciben un SupabaseClient y confían en RLS por tenant.
 * Read-only: el costo vive en `shipment_costs` / `route_cost_templates`
 * (migración 0099); el revenue se deriva de `invoices` reales (Facturación
 * 0021), EXCLUYENDO `borrador` (lección de la verificación de SDD-0052: hay
 * que usar la whitelist BILLABLE_STATUSES, nunca solo `.neq('anulada')`).
 *
 * Supabase devuelve `numeric` como string → se coerce a number en cada lectura.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import {
  invoiceUsdAmount,
  marginTone,
  matchTemplate,
  shipmentEconomics,
  totalCost,
  type CostCategoryKey,
  type MarginTone,
  type RouteCostTemplate,
  type ShipmentCosts,
  type ShipmentEconomics,
} from "./types";
import {
  allocateLinkedBills,
  effectiveCosts,
  isCostBill,
  marginByContainer,
  type ConsolidationItemRow,
  type ConsolidationRow,
  type ContainerMarginRow,
  type LinkedBillRow,
  type ShipmentCxp,
} from "./cxp-ligadas";
import type { ShipmentService } from "@/lib/studio/shipment-types";
import type { InvoiceCurrency, InvoiceStatus } from "@/lib/studio/invoice-types";
import type { Shipment } from "@/lib/studio/shipment-types";
import type { Quote, QuoteStatus } from "@/lib/studio/quote-types";

const COST_KEYS: CostCategoryKey[] = [
  "freight",
  "customs",
  "transport",
  "handling",
  "insurance",
  "commission",
  "other",
];

/**
 * Estados de factura que cuentan como revenue (excluye `borrador` y `anulada`).
 * MISMA whitelist que Facturación/Dirección/Fidelización — NO usar
 * `.neq('anulada')` solo (dejaría entrar borradores; bug que tuvo 0052).
 */
const BILLABLE_STATUSES: InvoiceStatus[] = [
  "emitida",
  "parcial",
  "pagada",
  "vencida",
];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Coacciona una fila cruda de shipment_costs a ShipmentCosts (numeric→number). */
function coerceCosts(row: Record<string, unknown>): ShipmentCosts {
  return {
    ...(row as unknown as ShipmentCosts),
    freight: num(row.freight),
    customs: num(row.customs),
    transport: num(row.transport),
    handling: num(row.handling),
    insurance: num(row.insurance),
    commission: num(row.commission),
    other: num(row.other),
  };
}

const COST_COLUMNS =
  "id, tenant_id, shipment_id, freight, customs, transport, handling, insurance, commission, other, notes, created_at, updated_at, deleted_at";

/**
 * Costos por embarque → `Map<shipment_id, ShipmentCosts>`. RLS por tenant.
 */
export async function listShipmentCosts(
  supabase: SupabaseClient,
): Promise<Map<string, ShipmentCosts>> {
  // Paginado: es el MAPA de costos por embarque. Un embarque que no entra al
  // mapa se costea en cero — margen inflado, no margen faltante.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("shipment_costs")
        .select(COST_COLUMNS)
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) {
    throw new Error("Los costos superan el tope de lectura; el margen quedaría inflado.");
  }

  const out = new Map<string, ShipmentCosts>();
  for (const raw of data) {
    const c = coerceCosts(raw);
    if (c.shipment_id) out.set(c.shipment_id, c);
  }
  return out;
}

// ── Revenue derivado de invoices ──────────────────────────────
export type Period = { from?: string; to?: string };

export type RevenueMaps = {
  /** revenue USD por shipment_id (cuando la factura tiene el FK). */
  byId: Map<string, number>;
  /** revenue USD por shipment_code (fallback cuando shipment_id es null). */
  byCode: Map<string, number>;
  /** SDD-0572: facturas sin tasa (no suman), por shipment_id y por shipment_code. */
  sinTasaById?: Map<string, number>;
  sinTasaByCode?: Map<string, number>;
  /** Solo facturas legadas SIN FK: se unen al FK propio sin duplicar ni reasignar. */
  sinTasaOnlyCode?: Map<string, number>;
};

type RevenueRow = {
  shipment_id: string | null;
  shipment_code: string | null;
  currency: InvoiceCurrency;
  total_amount: number;
  fx_rate: number | null;
  status: InvoiceStatus;
  issued_at: string | null;
  created_at: string | null;
};

/** ¿La fecha de referencia cae dentro del período (inclusive)? */
function inPeriod(refDate: string | null, period?: Period): boolean {
  if (!period || (!period.from && !period.to)) return true;
  if (!refDate) return false;
  const d = refDate.slice(0, 10);
  if (period.from && d < period.from) return false;
  if (period.to && d > period.to) return false;
  return true;
}

/**
 * Revenue real por embarque desde `invoices`, USD-normalizado.
 *
 * - EXCLUYE `borrador` y `anulada` vía whitelist BILLABLE_STATUSES (lección
 *   0052: nunca `.neq('anulada')` solo).
 * - EXCLUYE las borradas (`deleted_at`, SDD-0465): la RLS no las oculta (0230)
 *   y una factura eliminada no es ingreso del embarque.
 * - Normaliza cada factura a USD vía `invoiceUsdAmount` (SDD-0572: VES y CNY por
 *   su tasa; sin tasa no suma y se cuenta en `sinTasaById`/`sinTasaByCode`).
 * - Acumula en dos mapas: por `shipment_id` (preferido) y por `shipment_code`
 *   (fallback cuando el FK es null). Una sola query (sin N+1).
 */
export async function revenueByShipment(
  supabase: SupabaseClient,
  period?: Period,
): Promise<RevenueMaps> {
  // Paginado: el ingreso por embarque. Si falta una factura, ese embarque
  // aparece con menos ingreso del real y su margen sale negativo sin serlo.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("invoices")
        .select(
          "id, shipment_id, shipment_code, currency, total_amount, fx_rate, status, issued_at, created_at",
        )
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) {
    throw new Error("Las facturas superan el tope de lectura; el ingreso por embarque quedaría corto.");
  }

  const byId = new Map<string, number>();
  const byCode = new Map<string, number>();
  const sinTasaById = new Map<string, number>();
  const sinTasaByCode = new Map<string, number>();
  const sinTasaOnlyCode = new Map<string, number>();

  const rows = data.map(
    (r): RevenueRow => ({
      shipment_id: (r.shipment_id as string | null) ?? null,
      shipment_code: (r.shipment_code as string | null) ?? null,
      currency: r.currency as InvoiceCurrency,
      total_amount: num(r.total_amount),
      fx_rate:
        r.fx_rate == null
          ? null
          : Number.isFinite(Number(r.fx_rate))
            ? Number(r.fx_rate)
            : null,
      status: r.status as InvoiceStatus,
      issued_at: (r.issued_at as string | null) ?? null,
      created_at: (r.created_at as string | null) ?? null,
    }),
  );

  for (const r of rows) {
    if (!BILLABLE_STATUSES.includes(r.status)) continue;
    const refDate = r.issued_at ?? r.created_at;
    if (!inPeriod(refDate, period)) continue;

    const usd = invoiceUsdAmount(r);
    // SDD-0572: sin tasa no suma (antes un CNY daba 0 y el embarque salía en pérdida).
    if (usd === null) {
      if (r.shipment_id) sinTasaById.set(r.shipment_id, (sinTasaById.get(r.shipment_id) ?? 0) + 1);
      if (r.shipment_code) sinTasaByCode.set(r.shipment_code, (sinTasaByCode.get(r.shipment_code) ?? 0) + 1);
      if (!r.shipment_id && r.shipment_code) sinTasaOnlyCode.set(r.shipment_code, (sinTasaOnlyCode.get(r.shipment_code) ?? 0) + 1);
      continue;
    }
    if (usd <= 0) continue;

    if (r.shipment_id) {
      byId.set(r.shipment_id, (byId.get(r.shipment_id) ?? 0) + usd);
    }
    if (r.shipment_code) {
      byCode.set(r.shipment_code, (byCode.get(r.shipment_code) ?? 0) + usd);
    }
  }

  return { byId, byCode, sinTasaById, sinTasaByCode, sinTasaOnlyCode };
}

/** SDD-0572: FK propio más facturas solo-code. Un FK ajeno nunca se reasigna. */
function resolveSinTasa(shipment: Pick<Shipment, "id" | "code">, rev: RevenueMaps): number {
  const porId = rev.sinTasaById?.get(shipment.id) ?? 0;
  return porId + (shipment.code ? (rev.sinTasaOnlyCode?.get(shipment.code) ?? 0) : 0);
}

/** Resuelve el revenue de un embarque: por id, fallback por code. */
function resolveRevenue(
  shipment: Pick<Shipment, "id" | "code">,
  rev: RevenueMaps,
): number {
  if (rev.byId.has(shipment.id)) return rev.byId.get(shipment.id) ?? 0;
  if (shipment.code && rev.byCode.has(shipment.code)) {
    return rev.byCode.get(shipment.code) ?? 0;
  }
  return 0;
}

const SHIPMENT_COLUMNS =
  "id, tenant_id, code, client_name, client_markbox, origin, destination, shipment_service, status, weight_kg, volume_m3, vehicle_category, vehicle_model, arrived_destination_at, cancellation_reason, notes, deleted_at, created_at, updated_at";

export type CostingRow = {
  shipment: Shipment;
  costs: ShipmentCosts | null;
  eco: ShipmentEconomics;
  /**
   * SDD-0572: facturas del embarque sin tasa, fuera del revenue. Con alguna, el
   * margen está incompleto: el embarque se marca «sin tasa», no «en pérdida».
   */
  facturasSinTasa?: number;
  /**
   * SDD-0631: lo que aportan las CxP ligadas (directas o por su contenedor). En
   * las categorías que cubren, reemplazan a `costs`; `eco` ya lo refleja.
   */
  cxp?: ShipmentCxp;
};

/** SDD-0631: ¿el margen de la fila está incompleto por facturas o CxP sin tasa? */
export function rowSinTasa(row: Pick<CostingRow, "facturasSinTasa" | "cxp">): boolean {
  return (row.facturasSinTasa ?? 0) > 0 || (row.cxp?.sinTasa ?? 0) > 0;
}

// ── SDD-0631 · CxP ligadas y contenedores ─────────────────────
const LINKED_BILL_COLUMNS =
  "id, shipment_id, consolidation_id, cost_category, currency, total_amount, fx_rate, status, deleted_at";

/** La base todavía no tiene la 0536: la columna no existe. */
function isMissingLinkColumn(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /(consolidation_id|cost_category)/.test(msg) && /does not exist|no existe|schema cache/i.test(msg);
}

export type CostLinks = {
  bills: LinkedBillRow[];
  items: ConsolidationItemRow[];
  consolidations: ConsolidationRow[];
  /** false si la base no tiene la 0536 (sin CxP ligadas, sin romper). */
  linksAvailable: boolean;
};

/**
 * CxP vivas (filtra el vínculo y el estado en JS: son pocas), piezas de
 * contenedor y consolidaciones. Paginado: una CxP que no entra es un costo que
 * falta y un margen inflado.
 */
export async function listCostLinks(supabase: SupabaseClient): Promise<CostLinks> {
  const billsP = fetchAllPaged<Record<string, unknown>>((d, h) =>
    supabase
      .from("supplier_bills")
      .select(LINKED_BILL_COLUMNS)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(d, h),
  ).then(
    (r) => ({ ...r, available: true }),
    (e: unknown) => {
      if (isMissingLinkColumn(e)) return { rows: [], complete: true, available: false };
      throw e;
    },
  );
  const [billsRes, itemsRes, consRes] = await Promise.all([
    billsP,
    fetchAllPaged<Record<string, unknown>>((d, h) =>
      supabase
        .from("consolidation_items")
        .select("id, consolidation_id, shipment_id, cbm")
        .order("id", { ascending: true })
        .range(d, h),
    ),
    fetchAllPaged<Record<string, unknown>>((d, h) =>
      supabase
        .from("consolidations")
        .select("id, ref, status, container_type, deleted_at")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    ),
  ]);
  if (!billsRes.complete || !itemsRes.complete || !consRes.complete) {
    throw new Error("Las CxP o los contenedores superan el tope de lectura; el margen quedaría inflado.");
  }
  return {
    bills: (billsRes.rows as unknown as LinkedBillRow[]).filter(isCostBill),
    items: itemsRes.rows as unknown as ConsolidationItemRow[],
    consolidations: consRes.rows as unknown as ConsolidationRow[],
    linksAvailable: billsRes.available,
  };
}

/** Filas de costeo + lo necesario para el margen por contenedor. */
export type CostingData = {
  rows: CostingRow[];
  containers: ContainerMarginRow[];
  linksAvailable: boolean;
};

/**
 * Filas de costeo: cada embarque vivo del tenant + sus costos + su economía.
 * Cruza `shipments` (no borrados) + costos (Map) + revenue (id → fallback code)
 * + CxP ligadas (SDD-0631: reemplazan a `shipment_costs` en su categoría).
 */
export async function costingRows(
  supabase: SupabaseClient,
  period?: Period,
): Promise<CostingRow[]> {
  return (await costingData(supabase, period)).rows;
}

export async function costingData(
  supabase: SupabaseClient,
  period?: Period,
): Promise<CostingData> {
  const [costsMap, rev, shipmentsRes, links] = await Promise.all([
    listShipmentCosts(supabase),
    revenueByShipment(supabase, period),
    fetchAllPaged<Record<string, unknown>>((d, h) =>
      supabase
        .from("shipments")
        .select(SHIPMENT_COLUMNS)
        .order("id", { ascending: true })
        .range(d, h),
    ),
    listCostLinks(supabase),
  ]);

  if (!shipmentsRes.complete) {
    throw new Error("Los embarques superan el tope de lectura; el costeo quedaría incompleto.");
  }

  const shipments = shipmentsRes.rows as unknown as Shipment[];
  const allocation = allocateLinkedBills(links.bills, links.items);

  const rows = shipments
    .filter((s) => s.deleted_at == null)
    .map((shipment): CostingRow => {
      const costs = costsMap.get(shipment.id) ?? null;
      const cxp = allocation.byShipment.get(shipment.id);
      const revenueUsd = resolveRevenue(shipment, rev);
      const eco = shipmentEconomics({ revenueUsd, costs: effectiveCosts(costs, cxp) });
      const row: CostingRow = { shipment, costs, eco, facturasSinTasa: resolveSinTasa(shipment, rev) };
      if (cxp) row.cxp = cxp;
      return row;
    });

  const containers = marginByContainer(
    rows.map((r) => ({
      shipmentId: r.shipment.id,
      revenue: r.eco.revenue,
      totalCost: r.eco.totalCost,
      sinTasa: rowSinTasa(r) ? 1 : 0,
    })),
    links.consolidations,
    links.items,
    allocation,
  );

  return { rows, containers, linksAvailable: links.linksAvailable };
}

// ── Agregados puros (sobre las filas ya cargadas) ─────────────
export type CostingTotals = {
  /** Suma conocida; con sinTasa > 0 es subtotal y margin/avgMarginPct no se certifican. */
  revenue: number;
  cost: number;
  margin: number;
  avgMarginPct: number;
  profitable: number;
  losing: number;
  /** SDD-0572: embarques con alguna factura sin tasa (no cuentan como rentables ni en pérdida). */
  sinTasa: number;
  catTotals: Record<CostCategoryKey, number>;
};

/**
 * Totales del set de costeo (PURA): revenue/cost/margin, margen % promedio
 * (sobre el total), conteo de rentables/en-pérdida y total por categoría.
 */
export function costingTotals(rows: CostingRow[]): CostingTotals {
  const catTotals: Record<CostCategoryKey, number> = {
    freight: 0,
    customs: 0,
    transport: 0,
    handling: 0,
    insurance: 0,
    commission: 0,
    other: 0,
  };
  let revenue = 0;
  let cost = 0;
  let profitable = 0;
  let losing = 0;
  let sinTasa = 0;

  for (const row of rows) {
    const { eco } = row;
    revenue += eco.revenue;
    cost += eco.totalCost;
    if (rowSinTasa(row)) sinTasa += 1;
    else if (eco.margin > 0) profitable += 1;
    else if (eco.margin < 0) losing += 1;
    for (const k of COST_KEYS) catTotals[k] += eco[k];
  }

  const margin = revenue - cost;
  const avgMarginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

  return { revenue, cost, margin, avgMarginPct, profitable, losing, sinTasa, catTotals };
}

export type RouteMarginRow = {
  origin: string;
  destination: string;
  count: number;
  revenue: number;
  cost: number;
  /** Embarques con conversión incompleta: revenue es subtotal y el margen no se evalúa. */
  sinTasa: number;
  margin: number;
  marginPct: number;
  tone: MarginTone;
};

/**
 * Margen por ruta (PURA): agrupa por `origin→destination`, suma revenue/cost,
 * deriva margen + %. Las rutas completas van por marginPct; las incompletas
 * quedan al final, en orden estable, con sinTasa y subtotal conocido. Espejo de
 * RoutesMarginSection en costing.jsx.
 */
export function marginByRoute(rows: CostingRow[]): RouteMarginRow[] {
  const byRoute = new Map<
    string,
    { origin: string; destination: string; count: number; revenue: number; cost: number; sinTasa: number }
  >();

  for (const row of rows) {
    const { shipment, eco } = row;
    const origin = shipment.origin ?? "";
    const destination = shipment.destination ?? "";
    const key = `${origin}→${destination}`;
    const cur =
      byRoute.get(key) ?? { origin, destination, count: 0, revenue: 0, cost: 0, sinTasa: 0 };
    cur.count += 1;
    cur.revenue += eco.revenue;
    cur.cost += eco.totalCost;
    if (rowSinTasa(row)) cur.sinTasa += 1;
    byRoute.set(key, cur);
  }

  return [...byRoute.values()]
    .map((r) => {
      const margin = r.revenue - r.cost;
      const marginPct = r.revenue > 0 ? (margin / r.revenue) * 100 : 0;
      return { ...r, margin, marginPct, tone: marginTone(marginPct) };
    })
    .sort((a, b) => {
      if (a.sinTasa > 0 || b.sinTasa > 0) return Number(a.sinTasa > 0) - Number(b.sinTasa > 0);
      return b.marginPct - a.marginPct;
    });
}

// ── Margen por cliente (Reportes · Combinados) ────────────────
/** Etiqueta para los embarques sin cliente asignado. */
export const NO_CLIENT_LABEL = "Sin cliente asignado";

export type ClientMarginRow = {
  client: string;
  count: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  tone: MarginTone;
  /** Embarques con ingreso incompleto; revenue conserva el subtotal conocido. */
  sinTasa: number;
};

/**
 * Margen por cliente (PURA): espejo de `marginByRoute` pero agrupando por
 * `shipment.client_name` (los sin cliente → "Sin cliente asignado"). Suma
 * revenue/cost de costos REALES (`shipment_costs`), deriva margen + %. Sin NaN
 * (marginPct 0 si revenue 0). Orden descendente por margen absoluto.
 *
 * Espejo de `ReportsMargenCliente` del Norte, pero con costo REAL (no el
 * `_ROUTE_COST=0.70`+jitter fabricado del mock).
 */
export function marginByClient(rows: CostingRow[]): ClientMarginRow[] {
  const byClient = new Map<
    string,
    { client: string; count: number; revenue: number; cost: number; sinTasa: number }
  >();

  for (const row of rows) {
    const { shipment, eco } = row;
    const name = (shipment.client_name ?? "").trim();
    const client = name || NO_CLIENT_LABEL;
    const cur = byClient.get(client) ?? { client, count: 0, revenue: 0, cost: 0, sinTasa: 0 };
    cur.count += 1;
    cur.revenue += eco.revenue;
    cur.cost += eco.totalCost;
    if (rowSinTasa(row)) cur.sinTasa += 1;
    byClient.set(client, cur);
  }

  return [...byClient.values()]
    .map((r) => {
      const margin = r.revenue - r.cost;
      const marginPct = r.revenue > 0 ? (margin / r.revenue) * 100 : 0;
      return { ...r, margin, marginPct, tone: marginTone(marginPct) };
    })
    .sort((a, b) => {
      if (a.sinTasa > 0 || b.sinTasa > 0) return Number(a.sinTasa > 0) - Number(b.sinTasa > 0);
      return b.margin - a.margin;
    });
}

// ── Costo por CBM (Reportes · Combinados) ─────────────────────
export type RouteCbmRow = {
  origin: string;
  destination: string;
  count: number;
  cbm: number;
  revenue: number;
  cost: number;
  /** Costo unitario por CBM (cost / cbm; 0 si cbm ≤ 0). */
  costPerCbm: number;
  /** Revenue unitario por CBM (revenue / cbm; 0 si cbm ≤ 0). */
  revenuePerCbm: number;
  /** Margen unitario por CBM (revenuePerCbm − costPerCbm). */
  marginPerCbm: number;
  /** Embarques con ingreso incompleto; costo/CBM permanece conocido. */
  sinTasa: number;
};

/** CBM de un embarque (vive en `volume_m3`); 0 si nulo/no finito. */
function shipmentCbm(shipment: { volume_m3: number | null }): number {
  const v = Number(shipment.volume_m3);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Costo (y revenue) unitario por CBM agrupado por ruta `origin→destination`
 * (PURA), desde los costos REALES. costPerCbm/revenuePerCbm = total / CBM, 0 si
 * CBM ≤ 0 (sin Infinity/NaN). Orden descendente por revenuePerCbm.
 *
 * Espejo de `ReportsCostoCBM` del Norte, con costo REAL (sin fabricarlo).
 */
export function costPerCbmByRoute(rows: CostingRow[]): RouteCbmRow[] {
  const byRoute = new Map<
    string,
    {
      origin: string;
      destination: string;
      count: number;
      cbm: number;
      revenue: number;
      cost: number;
      sinTasa: number;
    }
  >();

  for (const row of rows) {
    const { shipment, eco } = row;
    const origin = shipment.origin ?? "";
    const destination = shipment.destination ?? "";
    const key = `${origin}→${destination}`;
    const cur =
      byRoute.get(key) ??
      { origin, destination, count: 0, cbm: 0, revenue: 0, cost: 0, sinTasa: 0 };
    cur.count += 1;
    cur.cbm += shipmentCbm(shipment);
    cur.revenue += eco.revenue;
    cur.cost += eco.totalCost;
    if (rowSinTasa(row)) cur.sinTasa += 1;
    byRoute.set(key, cur);
  }

  return [...byRoute.values()]
    .map((r) => {
      const costPerCbm = r.cbm > 0 ? r.cost / r.cbm : 0;
      const revenuePerCbm = r.cbm > 0 ? r.revenue / r.cbm : 0;
      return {
        ...r,
        cbm: Math.round(r.cbm * 10) / 10,
        costPerCbm,
        revenuePerCbm,
        marginPerCbm: revenuePerCbm - costPerCbm,
      };
    })
    .sort((a, b) => {
      if (a.sinTasa > 0 || b.sinTasa > 0) return Number(a.sinTasa > 0) - Number(b.sinTasa > 0);
      return b.revenuePerCbm - a.revenuePerCbm;
    });
}

// ── Templates por ruta ────────────────────────────────────────
const TEMPLATE_COLUMNS =
  "id, tenant_id, name, origin, destination, shipment_service, freight, customs, transport, handling, insurance, commission, other, active, notes, created_at, updated_at, deleted_at";

/** Coacciona una fila cruda de route_cost_templates (numeric→number). */
function coerceTemplate(row: Record<string, unknown>): RouteCostTemplate {
  return {
    ...(row as unknown as RouteCostTemplate),
    freight: num(row.freight),
    customs: num(row.customs),
    transport: num(row.transport),
    handling: num(row.handling),
    insurance: num(row.insurance),
    commission: num(row.commission),
    other: num(row.other),
    active: Boolean(row.active),
  };
}

/** Lista templates de costo por ruta del tenant (RLS). */
export async function listRouteCostTemplates(
  supabase: SupabaseClient,
): Promise<RouteCostTemplate[]> {
  const { data, error } = await supabase
    .from("route_cost_templates")
    .select(TEMPLATE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceTemplate);
}


// ── Forecast del pipeline (Slice C) ───────────────────────────
/**
 * Estados de estimado que entran al forecast: `accepted` (pendiente de
 * embarcar) y `sent` (esperando respuesta). El bucketing fino (y descartar los
 * aceptados ya convertidos) lo hace `buildForecast` en ui.ts; acá solo se
 * acota la query para no traer borradores/rechazados/vencidos.
 */
const FORECAST_QUOTE_STATUSES: QuoteStatus[] = ["accepted", "sent"];

const FORECAST_QUOTE_COLUMNS =
  "id, tenant_id, quote_code, client_markbox, client_name, service, origin, destination, cbm, weight_kg, boxes, packaging, rate_per_cbm, flat_rate, rate_used_id, subtotal_usd, packaging_cost, total_usd, status, valid_until, sent_at, accepted_at, converted_to_shipment_id, notes, created_at, updated_at, deleted_at";

/**
 * Estimados del pipeline para el forecast (aceptados + enviados), no
 * borrados. RLS por tenant. El cruce con templates y el cálculo del margen
 * proyectado son puros (`buildForecast` en ui.ts).
 */
export async function forecastQuotes(
  supabase: SupabaseClient,
): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select(FORECAST_QUOTE_COLUMNS)
    .in("status", FORECAST_QUOTE_STATUSES)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data as Quote[] | null) ?? [];
}

// ── Auto-prefill de costos al crear un embarque (Slice C) ─────
export type PrefillShipment = {
  id: string;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService | null;
};

export type PrefillResult =
  | { prefilled: true; templateId: string }
  | { prefilled: false; reason: "no-template" | "exists" | "error" };

/**
 * Auto-prefill BEST-EFFORT del costeo de un embarque recién creado: si hay un
 * template de costo por ruta que matchea su `origin + destination + service`,
 * crea su fila `shipment_costs` con los 7 defaults del template.
 *
 * Garantías (la creación del embarque NO debe romperse por esto):
 *  - Si NO hay template match → no inserta, devuelve `no-template`.
 *  - Respeta el unique `(tenant_id, shipment_id)`: usa `onConflict` con
 *    `ignoreDuplicates` → NO pisa una fila de costos ya existente.
 *  - NUNCA lanza: cualquier error de lectura/escritura se traga y devuelve
 *    `error` (el caller lo ignora). El defensor real cross-tenant es el trigger
 *    de 0100.
 *
 * Recibe un cliente con privilegios suficientes para escribir `shipment_costs`
 * del tenant (admin client desde la action) + el `tenantId` explícito.
 */
export async function prefillShipmentCostsFromTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  shipment: PrefillShipment,
): Promise<PrefillResult> {
  try {
    const templates = await listRouteCostTemplates(supabase);
    const tpl = matchTemplate(templates, {
      origin: shipment.origin,
      destination: shipment.destination,
      shipment_service: shipment.shipment_service,
    });
    if (!tpl) return { prefilled: false, reason: "no-template" };

    const { error } = await supabase.from("shipment_costs").upsert(
      {
        tenant_id: tenantId,
        shipment_id: shipment.id,
        freight: tpl.freight,
        customs: tpl.customs,
        transport: tpl.transport,
        handling: tpl.handling,
        insurance: tpl.insurance,
        commission: tpl.commission,
        other: tpl.other,
        notes: `Prellenado desde template "${tpl.name}".`,
        deleted_at: null,
      },
      { onConflict: "tenant_id,shipment_id", ignoreDuplicates: true },
    );

    if (error) return { prefilled: false, reason: "error" };
    return { prefilled: true, templateId: tpl.id };
  } catch {
    // Best-effort: jamás propaga (no romper la creación del embarque).
    return { prefilled: false, reason: "error" };
  }
}

// Re-export del helper de suma para la UI (Slice B).
export { totalCost };
