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
import {
  invoiceUsdAmount,
  marginTone,
  shipmentEconomics,
  totalCost,
  type CostCategoryKey,
  type MarginTone,
  type RouteCostTemplate,
  type ShipmentCosts,
  type ShipmentEconomics,
} from "./types";
import type { InvoiceCurrency, InvoiceStatus } from "@/lib/studio/invoice-types";
import type { Shipment } from "@/lib/studio/shipment-types";

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
  const { data, error } = await supabase
    .from("shipment_costs")
    .select(COST_COLUMNS)
    .limit(5000);

  if (error) throw error;

  const out = new Map<string, ShipmentCosts>();
  for (const raw of (data as Record<string, unknown>[] | null) ?? []) {
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
 * - Normaliza cada factura a USD vía `invoiceUsdAmount` (VES/fx_rate; CNY → 0).
 * - Acumula en dos mapas: por `shipment_id` (preferido) y por `shipment_code`
 *   (fallback cuando el FK es null). Una sola query (sin N+1).
 */
export async function revenueByShipment(
  supabase: SupabaseClient,
  period?: Period,
): Promise<RevenueMaps> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "shipment_id, shipment_code, currency, total_amount, fx_rate, status, issued_at, created_at",
    )
    .limit(5000);

  if (error) throw error;

  const byId = new Map<string, number>();
  const byCode = new Map<string, number>();

  const rows = ((data as Record<string, unknown>[] | null) ?? []).map(
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
    if (usd <= 0) continue;

    if (r.shipment_id) {
      byId.set(r.shipment_id, (byId.get(r.shipment_id) ?? 0) + usd);
    }
    if (r.shipment_code) {
      byCode.set(r.shipment_code, (byCode.get(r.shipment_code) ?? 0) + usd);
    }
  }

  return { byId, byCode };
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
};

/**
 * Filas de costeo: cada embarque vivo del tenant + sus costos + su economía.
 * Cruza `shipments` (no borrados) + costos (Map) + revenue (id → fallback code).
 */
export async function costingRows(
  supabase: SupabaseClient,
  period?: Period,
): Promise<CostingRow[]> {
  const [costsMap, rev, shipmentsRes] = await Promise.all([
    listShipmentCosts(supabase),
    revenueByShipment(supabase, period),
    supabase.from("shipments").select(SHIPMENT_COLUMNS).limit(5000),
  ]);

  if (shipmentsRes.error) throw shipmentsRes.error;

  const shipments = ((shipmentsRes.data as Record<string, unknown>[] | null) ??
    []) as unknown as Shipment[];

  return shipments
    .filter((s) => s.deleted_at == null)
    .map((shipment) => {
      const costs = costsMap.get(shipment.id) ?? null;
      const revenueUsd = resolveRevenue(shipment, rev);
      const eco = shipmentEconomics({ revenueUsd, costs });
      return { shipment, costs, eco };
    });
}

// ── Agregados puros (sobre las filas ya cargadas) ─────────────
export type CostingTotals = {
  revenue: number;
  cost: number;
  margin: number;
  avgMarginPct: number;
  profitable: number;
  losing: number;
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

  for (const { eco } of rows) {
    revenue += eco.revenue;
    cost += eco.totalCost;
    if (eco.margin > 0) profitable += 1;
    else if (eco.margin < 0) losing += 1;
    for (const k of COST_KEYS) catTotals[k] += eco[k];
  }

  const margin = revenue - cost;
  const avgMarginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

  return { revenue, cost, margin, avgMarginPct, profitable, losing, catTotals };
}

export type RouteMarginRow = {
  origin: string;
  destination: string;
  count: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  tone: MarginTone;
};

/**
 * Margen por ruta (PURA): agrupa por `origin→destination`, suma revenue/cost,
 * deriva margen + %. Orden descendente por marginPct. Espejo de
 * RoutesMarginSection en costing.jsx.
 */
export function marginByRoute(rows: CostingRow[]): RouteMarginRow[] {
  const byRoute = new Map<
    string,
    { origin: string; destination: string; count: number; revenue: number; cost: number }
  >();

  for (const { shipment, eco } of rows) {
    const origin = shipment.origin ?? "";
    const destination = shipment.destination ?? "";
    const key = `${origin}→${destination}`;
    const cur =
      byRoute.get(key) ?? { origin, destination, count: 0, revenue: 0, cost: 0 };
    cur.count += 1;
    cur.revenue += eco.revenue;
    cur.cost += eco.totalCost;
    byRoute.set(key, cur);
  }

  return [...byRoute.values()]
    .map((r) => {
      const margin = r.revenue - r.cost;
      const marginPct = r.revenue > 0 ? (margin / r.revenue) * 100 : 0;
      return { ...r, margin, marginPct, tone: marginTone(marginPct) };
    })
    .sort((a, b) => b.marginPct - a.marginPct);
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

// Re-export del helper de suma para la UI (Slice B).
export { totalCost };
