/**
 * Queries del módulo Reportes & Analytics (SDD-0052 · Slice A).
 *
 * Funciones PURAS que reciben un SupabaseClient. RLS filtra por tenant_id; no
 * recalculan finanzas (patrón Dirección 0048) — leen tablas existentes y delegan
 * en los helpers puros de `./types`.
 *
 * Revenue join (decisión §4): UNA sola query de `invoices` del período →
 * `Map<shipment_code, usd>` → se pasa a los `groupBy*` puros (sin N+1).
 *
 * Schema confirmado:
 *  - shipments (0002+0009): origin, destination, shipment_service, status,
 *    volume_m3 (= CBM), created_at, arrived_destination_at, delivered_at.
 *  - invoices (0077): shipment_code (snapshot), total_amount, currency, fx_rate,
 *    created_at, status.
 *  - bookings/sailings (0096): carrier_id → carriers.name.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { invoiceUsdAmount } from "@/lib/studio/fidelizacion/types";
import { clientsWithTier } from "@/lib/studio/fidelizacion/queries";
import { listAccounts, accountBalances } from "@/lib/studio/account-queries";
import { profitAndLoss } from "@/lib/studio/accounting/reports";
import { receivablesQueue } from "@/lib/studio/payment-queries";
import { payablesQueue } from "@/lib/studio/treasury/bill-queries";
import { invoiceKpis } from "@/lib/studio/invoice-queries";
import {
  buildAgingSide,
  groupByRoute,
  groupByService,
  incomeStatementRows,
  monthlyBuckets,
  monthlyCashflow,
  periodRange,
  transitDays,
  type AgingItem,
  type AgingReport,
  type CarrierRow,
  type CashflowReport,
  type ClientRankRow,
  type CommercialByClient,
  type DateRange,
  type FlowItem,
  type IncomeStatement,
  type OperationalOverview,
  type PortSplitRow,
  type ReportPeriod,
  type ReportShipment,
  type RouteRow,
  type ServiceRow,
  type TierDistRow,
  type TransitByPortRow,
} from "./types";
import type { InvoiceCurrency } from "@/lib/studio/invoice-types";
import type { ShipmentService } from "@/lib/shared/shipment-public";

// ── Estados "activos" (en curso) para el KPI de Overview ───────
// Embarque que aún se está moviendo (no draft, no terminal).
const ACTIVE_STATUSES = [
  "in_warehouse",
  "consolidating",
  "shipped",
  "in_transit",
  "in_customs",
  "arrived_destination",
  "out_for_delivery",
  "last_mile",
];

const SHIPMENT_COLUMNS =
  "id, code, origin, destination, shipment_service, status, volume_m3, created_at, arrived_destination_at, delivered_at";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function coerceShipment(r: Record<string, unknown>): ReportShipment {
  return {
    id: String(r.id),
    code: String(r.code ?? ""),
    origin: (r.origin as string | null) ?? null,
    destination: (r.destination as string | null) ?? null,
    shipment_service: r.shipment_service as ShipmentService,
    status: String(r.status ?? ""),
    cbm: numOrNull(r.volume_m3),
    created_at: String(r.created_at),
    arrived_destination_at: (r.arrived_destination_at as string | null) ?? null,
    delivered_at: (r.delivered_at as string | null) ?? null,
  };
}

/**
 * Embarques (vivos) creados en el rango. RLS filtra por tenant; deleted_at null.
 */
async function fetchShipments(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<ReportShipment[]> {
  const { data, error } = await supabase
    .from("shipments")
    .select(SHIPMENT_COLUMNS)
    .is("deleted_at", null)
    .gte("created_at", range.from)
    .lte("created_at", `${range.to}T23:59:59.999Z`)
    .order("created_at", { ascending: true })
    .limit(20000);
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceShipment);
}

/**
 * Mapa shipment_code → USD facturado en el rango. Una sola query de invoices
 * (vivas, con shipment_code) del período, normalizadas a USD (invoiceUsdAmount).
 * Suma cuando hay varias facturas para el mismo embarque. Excluye anuladas.
 */
async function fetchRevenueByCode(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("invoices")
    .select("shipment_code, total_amount, currency, fx_rate, status")
    .is("deleted_at", null)
    .not("shipment_code", "is", null)
    .neq("status", "anulada")
    .gte("created_at", range.from)
    .lte("created_at", `${range.to}T23:59:59.999Z`)
    .limit(20000);
  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of (data as Record<string, unknown>[] | null) ?? []) {
    const code = (row.shipment_code as string | null) ?? null;
    if (!code) continue;
    const usd = invoiceUsdAmount({
      currency: row.currency as never,
      total_amount: num(row.total_amount),
      fx_rate: numOrNull(row.fx_rate),
    });
    map.set(code, (map.get(code) ?? 0) + usd);
  }
  return map;
}

// ── Overview ───────────────────────────────────────────────────

/**
 * Agregado operacional del período: totales (embarques/CBM/revenue/activos) +
 * serie mensual + split por destino + tránsito promedio por destino. on-time se
 * OMITE (sin fuente, §3.2).
 */
export async function operationalOverview(
  supabase: SupabaseClient,
  period: ReportPeriod,
  today?: Date,
): Promise<OperationalOverview> {
  const range = periodRange(period, today);
  const [shipments, revenueByCode] = await Promise.all([
    fetchShipments(supabase, range),
    fetchRevenueByCode(supabase, range),
  ]);

  const cbm =
    Math.round(shipments.reduce((s, x) => s + (Number(x.cbm) || 0), 0) * 10) /
    10;

  let revenueUsd = 0;
  for (const v of revenueByCode.values()) revenueUsd += v;
  revenueUsd = Math.round(revenueUsd * 100) / 100;

  const active = shipments.filter((s) =>
    ACTIVE_STATUSES.includes(s.status),
  ).length;

  const monthly = monthlyBuckets(shipments, range);
  const portSplit = portSplitOf(shipments);
  const transitByPort = transitByPortOf(shipments);

  return {
    shipments: shipments.length,
    cbm,
    revenueUsd,
    active,
    monthly,
    portSplit,
    transitByPort,
  };
}

/** Split por puerto/destino, ordenado desc por embarques, con %. */
function portSplitOf(shipments: ReportShipment[]): PortSplitRow[] {
  const total = shipments.length;
  const byPort = new Map<string, { count: number; cbm: number }>();
  for (const s of shipments) {
    const port = (s.destination ?? "").trim() || "Sin destino";
    const b = byPort.get(port) ?? { count: 0, cbm: 0 };
    b.count += 1;
    b.cbm += Number(s.cbm) || 0;
    byPort.set(port, b);
  }
  return [...byPort.entries()]
    .map(([port, b]) => ({
      port,
      count: b.count,
      cbm: Math.round(b.cbm * 10) / 10,
      pct: total > 0 ? Math.round((b.count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Tránsito promedio por puerto de destino (días), desc por volumen. */
function transitByPortOf(shipments: ReportShipment[]): TransitByPortRow[] {
  const byPort = new Map<string, number[]>();
  for (const s of shipments) {
    const d = transitDays(s);
    if (d == null) continue;
    const port = (s.destination ?? "").trim() || "Sin destino";
    const list = byPort.get(port) ?? [];
    list.push(d);
    byPort.set(port, list);
  }
  return [...byPort.entries()]
    .map(([port, ds]) => ({
      port,
      count: ds.length,
      avgTransit:
        ds.length > 0
          ? Math.round((ds.reduce((s, x) => s + x, 0) / ds.length) * 10) / 10
          : null,
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Por ruta / por servicio ────────────────────────────────────

export async function reportByRoute(
  supabase: SupabaseClient,
  period: ReportPeriod,
  today?: Date,
): Promise<RouteRow[]> {
  const range = periodRange(period, today);
  const [shipments, revenueByCode] = await Promise.all([
    fetchShipments(supabase, range),
    fetchRevenueByCode(supabase, range),
  ]);
  return groupByRoute(shipments, revenueByCode);
}

export async function reportByService(
  supabase: SupabaseClient,
  period: ReportPeriod,
  today?: Date,
): Promise<ServiceRow[]> {
  const range = periodRange(period, today);
  const [shipments, revenueByCode] = await Promise.all([
    fetchShipments(supabase, range),
    fetchRevenueByCode(supabase, range),
  ]);
  return groupByService(shipments, revenueByCode);
}

// ── Por naviera (bookings/sailings, 0096) ──────────────────────

/**
 * Filas por naviera desde `bookings` (count) + `sailings` (count) del período,
 * agrupadas por carrier. Resuelve el nombre vía `carriers`. EmptyState honesto:
 * devuelve [] si no hay bookings ni sailings (la UI muestra el vacío).
 *
 * Defensivo: si la migración 0096 no está aplicada en un env, devuelve [] en vez
 * de romper.
 */
export async function reportByCarrier(
  supabase: SupabaseClient,
  period: ReportPeriod,
  today?: Date,
): Promise<CarrierRow[]> {
  const range = periodRange(period, today);
  const from = range.from;
  const to = `${range.to}T23:59:59.999Z`;

  try {
    const [bookingsRes, sailingsRes, carriersRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("carrier_id")
        .is("deleted_at", null)
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(20000),
      supabase
        .from("sailings")
        .select("carrier_id")
        .is("deleted_at", null)
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(20000),
      supabase.from("carriers").select("id, name").limit(2000),
    ]);

    if (bookingsRes.error) throw bookingsRes.error;
    if (sailingsRes.error) throw sailingsRes.error;
    if (carriersRes.error) throw carriersRes.error;

    const nameById = new Map<string, string>();
    for (const c of (carriersRes.data as Record<string, unknown>[] | null) ??
      []) {
      nameById.set(String(c.id), String(c.name ?? "Sin nombre"));
    }

    const acc = new Map<string, { bookings: number; sailings: number }>();
    const bump = (carrierId: string | null, key: "bookings" | "sailings") => {
      const id = carrierId ?? "__none__";
      const row = acc.get(id) ?? { bookings: 0, sailings: 0 };
      row[key] += 1;
      acc.set(id, row);
    };

    for (const b of (bookingsRes.data as Record<string, unknown>[] | null) ??
      []) {
      bump((b.carrier_id as string | null) ?? null, "bookings");
    }
    for (const s of (sailingsRes.data as Record<string, unknown>[] | null) ??
      []) {
      bump((s.carrier_id as string | null) ?? null, "sailings");
    }

    const rows: CarrierRow[] = [...acc.entries()].map(([id, counts]) => ({
      carrierId: id === "__none__" ? null : id,
      name:
        id === "__none__"
          ? "Sin naviera asignada"
          : (nameById.get(id) ?? "Naviera"),
      bookings: counts.bookings,
      sailings: counts.sailings,
    }));

    return rows.sort((a, b) => {
      if (b.bookings !== a.bookings) return b.bookings - a.bookings;
      return b.sailings - a.sailings;
    });
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// Slice B — Comerciales (Por cliente) + Contables/financieros
// ═══════════════════════════════════════════════════════════════
//
// Capa de presentación pura: REUSA los agregados ya construidos y testeados.
// NO recalcula finanzas ni fabrica costos (regla §3.2 / §6). Solo se muestran
// reportes con fuente real. RLS filtra por tenant en cada agregado reusado.

// ── Comerciales · Por cliente ──────────────────────────────────

/**
 * Ranking comercial por cliente + distribución por tier. REUSA
 * `clientsWithTier` (0051): facturación trailing-12m USD-normalizada + tier
 * derivado, ya ordenada desc por facturación. NO "por segmento" (la tabla
 * `clients` no tiene columna segment) ni "por agente" (sin campo de agente).
 *
 * `today` = ahora; determinístico para tests.
 */
export async function commercialByClient(
  supabase: SupabaseClient,
  today?: Date,
): Promise<CommercialByClient> {
  const clients = await clientsWithTier(supabase, today ?? new Date());

  const ranking: ClientRankRow[] = clients.map((c) => ({
    markbox: c.markbox,
    name: c.name,
    billedUsd: Math.round(c.billedUsd * 100) / 100,
    tierId: c.tier.id,
    tierLabel: c.tier.label,
    tierTone: c.tier.tone,
  }));

  const totalClients = clients.length;
  const totalBilledUsd =
    Math.round(clients.reduce((s, c) => s + c.billedUsd, 0) * 100) / 100;

  // Distribución por tier (en orden de aparición de los tiers en el ranking,
  // estable: bronze < silver < gold < platinum según billedUsd derivado).
  const order: string[] = [];
  const counts = new Map<string, { label: string; tone: string; count: number }>();
  for (const c of clients) {
    const id = c.tier.id;
    if (!counts.has(id)) {
      counts.set(id, { label: c.tier.label, tone: c.tier.tone, count: 0 });
      order.push(id);
    }
    counts.get(id)!.count += 1;
  }
  const tierDist: TierDistRow[] = order.map((id) => {
    const v = counts.get(id)!;
    return {
      tierId: id,
      label: v.label,
      tone: v.tone,
      count: v.count,
      pct:
        totalClients > 0
          ? Math.round((v.count / totalClients) * 1000) / 10
          : 0,
    };
  });

  return { ranking, tierDist, totalClients, totalBilledUsd };
}

// ── Contables · Estado de resultados ───────────────────────────

/**
 * Estado de resultados del período. REUSA `profitAndLoss` (Contabilidad 0040)
 * TAL CUAL sobre los saldos del rango: NO recalcula. Compone igual que Dirección
 * (0048): listAccounts + accountBalances({fromDate, upToDate}) → profitAndLoss.
 * La vista solo formatea filas con % sobre ingresos (incomeStatementRows).
 */
export async function incomeStatement(
  supabase: SupabaseClient,
  period: ReportPeriod,
  today?: Date,
): Promise<IncomeStatement> {
  const range = periodRange(period, today);
  const [accounts, balances] = await Promise.all([
    listAccounts(supabase),
    accountBalances(supabase, { fromDate: range.from, upToDate: range.to }),
  ]);
  const pl = profitAndLoss(accounts, balances);
  return {
    rows: incomeStatementRows(pl),
    income: pl.income,
    netIncome: pl.netIncome,
    range,
  };
}

// ── Contables · Aging CxC/CxP ──────────────────────────────────

/**
 * Reporte de aging CxC/CxP en USD real. REUSA `receivablesQueue` (Cobranzas
 * 0041) para CxC y `payablesQueue` (Tesorería 0044) para CxP. Los buckets
 * (corriente / 1-30 / 31-60 / 60+) se COMPUTAN del `daysOverdue` que cada cola
 * provee (buildAgingSide, puro), sumando el saldo NORMALIZADO a USD
 * (`balanceUsd`, decisión SDD-0052 r2) — el `balance` nativo es multi-moneda y
 * NO se puede sumar como si fuera USD. CNY → 0 (consistente con cashflow).
 * EmptyState honesto: si vacío, buckets en 0.
 *
 * `today` (YYYY-MM-DD) determinístico para tests.
 */
export async function agingReport(
  supabase: SupabaseClient,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<AgingReport> {
  const [cxcQueue, cxpQueue] = await Promise.all([
    receivablesQueue(supabase, today),
    payablesQueue(supabase, today),
  ]);

  // Bucketiza por el SALDO EN USD (no el balance multi-moneda).
  const cxcItems: AgingItem[] = cxcQueue.map((r) => ({
    balance: r.balanceUsd,
    daysOverdue: r.daysOverdue,
  }));
  const cxpItems: AgingItem[] = cxpQueue.map((p) => ({
    balance: p.balanceUsd,
    daysOverdue: p.daysOverdue,
  }));

  return {
    cxc: buildAgingSide(cxcItems),
    cxp: buildAgingSide(cxpItems),
  };
}

// ── Contables · Cashflow facturado vs cobrado ──────────────────

/**
 * Cashflow del período: serie mensual de FACTURADO vs COBRADO, ambos
 * USD-normalizados vía invoiceUsdAmount (VES/fx; CNY → 0). KPIs por-cobrar/vencido
 * REUSAN `invoiceKpis` (Facturación 0021, saldos vivos · no del rango). NO
 * recalcula montos: solo agrega y normaliza. EmptyState honesto si la serie es plana.
 *
 * FACTURADO usa la MISMA fecha de referencia para el filtro de rango y el bucket
 * (`issued_at ?? created_at`, consistente con `invoiceKpis`/`clientAnnualBilling`)
 * — antes filtraba por `created_at` pero bucketizaba por `issued_at`, lo que
 * descuadraba el total (KPI) con las barras (serie). El filtro de rango y el
 * agrupado mensual se hacen IN-MEMORY sobre ese mismo `refDate` → total = Σ serie.
 */
export async function cashflowReport(
  supabase: SupabaseClient,
  period: ReportPeriod,
  today?: Date,
): Promise<CashflowReport> {
  const range = periodRange(period, today);

  const [invRes, recRes, kpis] = await Promise.all([
    // Sin filtro de rango en SQL: el rango se aplica in-memory sobre
    // `issued_at ?? created_at` (el filtro SQL por una sola columna perdería las
    // filas cuyo issued_at cae en rango pero created_at no, o viceversa).
    supabase
      .from("invoices")
      .select("total_amount, currency, fx_rate, status, issued_at, created_at")
      .is("deleted_at", null)
      .neq("status", "anulada")
      .neq("status", "borrador")
      .limit(20000),
    supabase
      .from("payment_receipts")
      .select("amount, currency, fx_rate, received_at")
      .is("deleted_at", null)
      .gte("received_at", range.from)
      .lte("received_at", range.to)
      .limit(20000),
    invoiceKpis(supabase),
  ]);

  if (invRes.error) throw invRes.error;
  if (recRes.error) throw recRes.error;

  // Facturado: una fila por factura, fecha de referencia = issued_at (o
  // created_at). El filtro de estado va en la query (.neq) y se repite en memoria
  // por robustez. El rango se filtra por la MISMA fecha que bucketiza la serie
  // (refDate ∈ [from, to]), de modo que el total cuadra con la suma de las barras.
  const billed: FlowItem[] = [];
  let totalBilled = 0;
  for (const row of (invRes.data as Record<string, unknown>[] | null) ?? []) {
    const status = String(row.status ?? "");
    if (status === "anulada" || status === "borrador") continue;
    const refDate =
      ((row.issued_at as string | null) ?? (row.created_at as string | null)) ??
      null;
    const refDay = refDate?.slice(0, 10) ?? null;
    // Filtro de rango in-memory sobre la fecha de referencia (inclusive).
    if (!refDay || refDay < range.from || refDay > range.to) continue;
    const usd = invoiceUsdAmount({
      currency: row.currency as InvoiceCurrency,
      total_amount: num(row.total_amount),
      fx_rate: numOrNull(row.fx_rate),
    });
    if (usd <= 0) continue;
    billed.push({ dateIso: refDate, usd });
    totalBilled += usd;
  }

  // Cobrado: una fila por recibo, fecha = received_at, USD-norm (misma lógica).
  const collected: FlowItem[] = [];
  let totalCollected = 0;
  for (const row of (recRes.data as Record<string, unknown>[] | null) ?? []) {
    const usd = invoiceUsdAmount({
      currency: row.currency as InvoiceCurrency,
      total_amount: num(row.amount),
      fx_rate: numOrNull(row.fx_rate),
    });
    if (usd <= 0) continue;
    collected.push({ dateIso: (row.received_at as string | null) ?? null, usd });
    totalCollected += usd;
  }

  return {
    series: monthlyCashflow(billed, collected, range),
    totalBilled: Math.round(totalBilled * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    outstanding: kpis.outstanding,
    overdue: kpis.overdue,
  };
}
