/**
 * Tipos + helpers PUROS del módulo Reportes & Analytics (SDD-0052 · Slice A).
 *
 * Capa de presentación sobre agregados existentes (patrón Dirección 0048): NO
 * recalcula finanzas, NO tiene tablas propias. Este archivo es server-safe (sin
 * `"use client"`, sin Supabase, sin Zod) → lo importan tanto el `page.tsx`
 * (server) como `ReportesClient.tsx` (client) sin cruzar la frontera RSC.
 *
 * Decisiones ancladas (spec §3):
 *  - on-time se OMITE en V1 (no hay campo ETA/SLA en shipments).
 *  - Revenue por ruta/servicio = cruce con `invoices` (no es un campo de shipments).
 *  - Período resuelto server-side a `{from, to}` (YYYY-MM-DD).
 *
 * Reusa `SERVICE_LABELS` de `@/lib/shared/shipment-public` (puente permitido).
 */

import {
  SERVICE_LABELS,
  type ShipmentService,
} from "@/lib/shared/shipment-public";

// ── Período ────────────────────────────────────────────────────

export type ReportPeriod = "1M" | "3M" | "1A" | "YTD";

export const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "1M", label: "Último mes" },
  { value: "3M", label: "Últimos 3 meses" },
  { value: "1A", label: "Último año" },
  { value: "YTD", label: "Este año (YTD)" },
];

export const DEFAULT_PERIOD: ReportPeriod = "1A";

const VALID_PERIODS: ReportPeriod[] = ["1M", "3M", "1A", "YTD"];

/** Normaliza un valor crudo del URL a un ReportPeriod válido (default 1A). */
export function asPeriod(raw: unknown): ReportPeriod {
  return typeof raw === "string" && VALID_PERIODS.includes(raw as ReportPeriod)
    ? (raw as ReportPeriod)
    : DEFAULT_PERIOD;
}

export type DateRange = { from: string; to: string };

function iso(d: Date): string {
  // YYYY-MM-DD en UTC — estable e independiente del huso del server.
  return d.toISOString().slice(0, 10);
}

/**
 * Rango {from, to} (YYYY-MM-DD, inclusivo) para un período, relativo a `today`.
 *  - 1M  → trailing 1 mes  (today − 1 mes … today)
 *  - 3M  → trailing 3 meses
 *  - 1A  → trailing 12 meses
 *  - YTD → 1° de enero del año de `today` … today
 *
 * Pensado para filtrar `created_at`/`issued_at` con `.gte(from).lte(to)`.
 * `today` default = ahora (UTC). Determinístico para tests.
 */
export function periodRange(
  period: ReportPeriod,
  today: Date = new Date(),
): DateRange {
  const to = iso(today);

  if (period === "YTD") {
    const year = today.getUTCFullYear();
    return { from: `${year}-01-01`, to };
  }

  // trailing N meses → restamos meses sobre una copia en UTC.
  const months = period === "1M" ? 1 : period === "3M" ? 3 : 12;
  const from = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth() - months,
      today.getUTCDate(),
    ),
  );
  return { from: iso(from), to };
}

// ── Tipos de salida (filas/series) ─────────────────────────────

/** Una fila agregada por ruta (origen → destino). */
export type RouteRow = {
  key: string; // "origin||destination"
  origin: string;
  destination: string;
  label: string; // "Yiwu → Pto Cabello"
  count: number; // embarques
  cbm: number; // CBM total movido
  avgTransit: number | null; // días promedio (null si ninguno medible)
  revenue: number; // USD facturado cruzado por shipment_code
  rate: number; // USD por CBM (revenue / cbm, 0 si cbm≤0)
};

/** Una fila agregada por servicio (shipment_service). */
export type ServiceRow = {
  service: ShipmentService;
  label: string;
  count: number;
  cbm: number;
  avgTransit: number | null;
  revenue: number;
  rate: number;
};

/** Una fila por naviera (desde bookings/sailings de la migración 0096). */
export type CarrierRow = {
  carrierId: string | null;
  name: string;
  bookings: number;
  sailings: number;
};

/** Un punto de la serie mensual (volumen de embarques + CBM por mes). */
export type MonthlyVolumePoint = {
  month: string; // "YYYY-MM"
  label: string; // "ENE 26"
  count: number;
  cbm: number;
};

/** Split por puerto/destino (participación porcentual). */
export type PortSplitRow = {
  port: string;
  count: number;
  cbm: number;
  pct: number; // % sobre el total de embarques del período
};

/** Tránsito promedio por puerto de destino (días). */
export type TransitByPortRow = {
  port: string;
  avgTransit: number | null;
  count: number; // embarques con tránsito medible
};

/** Agregado del Overview operacional. */
export type OperationalOverview = {
  shipments: number;
  cbm: number;
  revenueUsd: number;
  active: number;
  monthly: MonthlyVolumePoint[];
  portSplit: PortSplitRow[];
  transitByPort: TransitByPortRow[];
};

// ── Forma mínima de un shipment para los helpers ───────────────
/**
 * Subconjunto de `shipments` que los reportes necesitan. Las queries lo proveen
 * coercionado; los helpers son puros sobre esta forma.
 * Nota: el CBM vive en la columna `volume_m3` (no `cbm`), pero acá lo
 * normalizamos a `cbm` para los reportes.
 */
export type ReportShipment = {
  id: string;
  code: string;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: string;
  cbm: number | null;
  created_at: string; // ISO
  arrived_destination_at: string | null;
  delivered_at: string | null;
};

// ── Helpers puros (testeables) ─────────────────────────────────

const MS_PER_DAY = 86_400_000;

/**
 * Días de tránsito de un embarque: (delivered_at ?? arrived_destination_at) −
 * created_at, en días enteros (redondeado). null si falta el hito de cierre o
 * la fecha de creación, o si el resultado es negativo (datos inconsistentes).
 */
export function transitDays(
  shipment: Pick<
    ReportShipment,
    "created_at" | "arrived_destination_at" | "delivered_at"
  >,
): number | null {
  const end = shipment.delivered_at ?? shipment.arrived_destination_at;
  if (!end || !shipment.created_at) return null;
  const start = Date.parse(shipment.created_at);
  const finish = Date.parse(end);
  if (!Number.isFinite(start) || !Number.isFinite(finish)) return null;
  const days = Math.round((finish - start) / MS_PER_DAY);
  return days >= 0 ? days : null;
}

/** USD por CBM. 0 si cbm ≤ 0 (evita división por cero / negativos). */
export function ratePerCbm(revenueUsd: number, cbm: number): number {
  const c = Number(cbm);
  if (!Number.isFinite(c) || c <= 0) return 0;
  const r = Number(revenueUsd);
  return Number.isFinite(r) ? r / c : 0;
}

/** Clave estable de una ruta a partir de origen + destino (normalizados). */
export function routeKey(origin: string | null, destination: string | null): string {
  return `${(origin ?? "").trim()}||${(destination ?? "").trim()}`;
}

/** Label legible de una ruta ("Origen → Destino"; "—" para extremos vacíos). */
export function routeLabel(
  origin: string | null,
  destination: string | null,
): string {
  const o = (origin ?? "").trim() || "—";
  const d = (destination ?? "").trim() || "—";
  return `${o} → ${d}`;
}

/** Label de servicio (reusa SERVICE_LABELS del puente público). */
export function serviceLabel(service: ShipmentService): string {
  return SERVICE_LABELS[service]?.primary ?? service;
}

const MONTH_ABBR = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const idx = Number(m) - 1;
  const abbr = MONTH_ABBR[idx] ?? m;
  return `${abbr} ${y.slice(2)}`;
}

/**
 * Distribuye embarques en buckets mensuales (uno por mes calendario presente en
 * `range`, de from a to inclusive). Cuenta embarques + CBM por mes según
 * `created_at`. Meses sin datos aparecen con count/cbm = 0 (serie continua).
 */
export function monthlyBuckets(
  rows: Pick<ReportShipment, "created_at" | "cbm">[],
  range: DateRange,
): MonthlyVolumePoint[] {
  // 1. Construir la lista continua de meses del rango.
  const start = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  // Guard: si el rango está invertido devolvemos vacío.
  if (cursor.getTime() > lastMonth.getTime()) return [];
  // Cap defensivo: máximo 36 meses para no loopear sobre datos corruptos.
  let guard = 0;
  while (cursor.getTime() <= lastMonth.getTime() && guard < 36) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    guard++;
  }

  const acc = new Map<string, { count: number; cbm: number }>();
  for (const key of months) acc.set(key, { count: 0, cbm: 0 });

  for (const r of rows) {
    const t = r.created_at ? new Date(r.created_at) : null;
    if (!t || Number.isNaN(t.getTime())) continue;
    const key = monthKey(t);
    const bucket = acc.get(key);
    if (!bucket) continue; // fuera del rango de meses
    bucket.count += 1;
    bucket.cbm += Number(r.cbm) || 0;
  }

  return months.map((key) => {
    const b = acc.get(key) ?? { count: 0, cbm: 0 };
    return {
      month: key,
      label: monthLabel(key),
      count: b.count,
      cbm: Math.round(b.cbm * 10) / 10,
    };
  });
}

// ── Agrupadores (group by) + revenue join ──────────────────────

/**
 * Promedia los tránsitos medibles de un conjunto de embarques. null si ninguno
 * es medible.
 */
function avgTransitOf(rows: ReportShipment[]): number | null {
  const ds = rows.map(transitDays).filter((d): d is number => d != null);
  if (ds.length === 0) return null;
  const sum = ds.reduce((s, d) => s + d, 0);
  return Math.round((sum / ds.length) * 10) / 10;
}

/** Revenue USD de un grupo, sumando por shipment.code en el mapa de facturas. */
function revenueOf(
  rows: ReportShipment[],
  revenueByCode: Map<string, number>,
): number {
  let total = 0;
  for (const r of rows) {
    total += revenueByCode.get(r.code) ?? 0;
  }
  return Math.round(total * 100) / 100;
}

function cbmOf(rows: ReportShipment[]): number {
  const sum = rows.reduce((s, r) => s + (Number(r.cbm) || 0), 0);
  return Math.round(sum * 10) / 10;
}

/**
 * Agrupa embarques por ruta (origen → destino), cruza revenue por shipment_code
 * y devuelve filas ordenadas desc por revenue (count como desempate).
 */
export function groupByRoute(
  shipments: ReportShipment[],
  revenueByCode: Map<string, number>,
): RouteRow[] {
  const groups = new Map<string, ReportShipment[]>();
  for (const s of shipments) {
    const key = routeKey(s.origin, s.destination);
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  const rows: RouteRow[] = [];
  for (const [key, list] of groups) {
    const first = list[0];
    const cbm = cbmOf(list);
    const revenue = revenueOf(list, revenueByCode);
    rows.push({
      key,
      origin: (first.origin ?? "").trim(),
      destination: (first.destination ?? "").trim(),
      label: routeLabel(first.origin, first.destination),
      count: list.length,
      cbm,
      avgTransit: avgTransitOf(list),
      revenue,
      rate: Math.round(ratePerCbm(revenue, cbm)),
    });
  }

  return sortByRevenueThenCount(rows);
}

/**
 * Agrupa embarques por servicio, cruza revenue por shipment_code y devuelve
 * filas ordenadas desc por revenue (count como desempate).
 */
export function groupByService(
  shipments: ReportShipment[],
  revenueByCode: Map<string, number>,
): ServiceRow[] {
  const groups = new Map<ShipmentService, ReportShipment[]>();
  for (const s of shipments) {
    const list = groups.get(s.shipment_service) ?? [];
    list.push(s);
    groups.set(s.shipment_service, list);
  }

  const rows: ServiceRow[] = [];
  for (const [service, list] of groups) {
    const cbm = cbmOf(list);
    const revenue = revenueOf(list, revenueByCode);
    rows.push({
      service,
      label: serviceLabel(service),
      count: list.length,
      cbm,
      avgTransit: avgTransitOf(list),
      revenue,
      rate: Math.round(ratePerCbm(revenue, cbm)),
    });
  }

  return sortByRevenueThenCount(rows);
}

function sortByRevenueThenCount<T extends { revenue: number; count: number }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    return b.count - a.count;
  });
}

// ═══════════════════════════════════════════════════════════════
// Slice B — Comerciales (Por cliente) + Contables/financieros
// ═══════════════════════════════════════════════════════════════
//
// Capa de presentación pura: tipos de salida + helpers testeables. Las queries
// (queries.ts) reusan los agregados ya construidos (clientsWithTier 0051,
// profitAndLoss 0040, collectionKpis/receivablesQueue 0041, treasuryKpis/
// payablesQueue 0044, invoiceKpis 0021) — acá NO se recalcula finanza.

// ── Comerciales · Por cliente ──────────────────────────────────

/** Una fila del ranking comercial por cliente (facturación trailing-12m USD). */
export type ClientRankRow = {
  markbox: string;
  name: string;
  billedUsd: number;
  tierId: string;
  tierLabel: string;
  tierTone: string; // BadgeTone (string libre, lo resuelve la UI)
};

/** Distribución de clientes por nivel (tier). */
export type TierDistRow = {
  tierId: string;
  label: string;
  tone: string;
  count: number;
  pct: number; // % sobre el total de clientes
};

/** Payload de "Por cliente": ranking + distribución por tier. */
export type CommercialByClient = {
  ranking: ClientRankRow[];
  tierDist: TierDistRow[];
  totalClients: number;
  totalBilledUsd: number;
};

// ── Contables · Estado de resultados ───────────────────────────

/** Una fila del estado de resultados (label + monto + % opcional sobre ingresos). */
export type IncomeRow = {
  label: string;
  amount: number;
  /** % sobre ingresos (null para la fila de ingresos misma o si no aplica). */
  pct: number | null;
  /** Resalta los subtotales (utilidad bruta/operativa/neta). */
  emphasis: boolean;
};

/** Payload del estado de resultados: filas formateadas + período. */
export type IncomeStatement = {
  rows: IncomeRow[];
  income: number;
  netIncome: number;
  range: DateRange;
};

// ── Contables · Aging CxC/CxP ──────────────────────────────────

/** Un bucket de aging (corriente / 1-30 / 31-60 / 60+). */
export type AgingBucket = {
  id: "current" | "b1_30" | "b31_60" | "b60_plus";
  label: string;
  amount: number;
  count: number;
  pct: number; // % sobre el total del lado (CxC o CxP)
};

/** Una cara del reporte de aging (CxC o CxP). */
export type AgingSide = {
  total: number;
  overdue: number;
  buckets: AgingBucket[];
};

/** Payload del aging: CxC + CxP. */
export type AgingReport = {
  cxc: AgingSide;
  cxp: AgingSide;
};

// ── Contables · Cashflow facturado vs cobrado ──────────────────

/** Un punto de la serie mensual facturado-vs-cobrado (USD). */
export type CashflowPoint = {
  month: string; // "YYYY-MM"
  label: string; // "ENE 26"
  billed: number; // facturado en el mes (USD)
  collected: number; // cobrado en el mes (USD)
};

/** Payload del cashflow: serie mensual + KPIs. */
export type CashflowReport = {
  series: CashflowPoint[];
  totalBilled: number; // facturado del período (USD)
  totalCollected: number; // cobrado del período (USD)
  outstanding: number; // por cobrar (saldo vivo, invoiceKpis)
  overdue: number; // vencido (saldo vivo, invoiceKpis)
};

// ── Helpers puros (testeables) ─────────────────────────────────

/** IDs y labels de los buckets de aging (orden de presentación). */
export const AGING_BUCKETS: { id: AgingBucket["id"]; label: string }[] = [
  { id: "current", label: "Corriente" },
  { id: "b1_30", label: "1–30 días" },
  { id: "b31_60", label: "31–60 días" },
  { id: "b60_plus", label: "60+ días" },
];

/**
 * Clasifica un saldo en su bucket de aging según los días vencido.
 *  - daysOverdue ≤ 0 (o null = sin vencimiento) → corriente (al día).
 *  - 1–30  → b1_30
 *  - 31–60 → b31_60
 *  - 60+   → b60_plus
 * PURA — testeable sin DB.
 */
export function classifyAging(daysOverdue: number | null): AgingBucket["id"] {
  const d = daysOverdue ?? 0;
  if (d <= 0) return "current";
  if (d <= 30) return "b1_30";
  if (d <= 60) return "b31_60";
  return "b60_plus";
}

/** Mínimo que el aging necesita de un saldo (CxC o CxP). */
export type AgingItem = { balance: number; daysOverdue: number | null };

/**
 * Construye una cara del aging (CxC o CxP) a partir de los saldos vivos.
 * Suma cada saldo a su bucket; `overdue` = todo lo que no es corriente.
 * PURA — testeable sin DB.
 */
export function buildAgingSide(items: AgingItem[]): AgingSide {
  const acc = new Map<AgingBucket["id"], { amount: number; count: number }>();
  for (const b of AGING_BUCKETS) acc.set(b.id, { amount: 0, count: 0 });

  let total = 0;
  let overdue = 0;
  for (const it of items) {
    const bal = Number(it.balance) || 0;
    if (bal <= 0) continue;
    const id = classifyAging(it.daysOverdue);
    const bucket = acc.get(id)!;
    bucket.amount += bal;
    bucket.count += 1;
    total += bal;
    if (id !== "current") overdue += bal;
  }

  total = Math.round(total * 100) / 100;
  overdue = Math.round(overdue * 100) / 100;

  const buckets: AgingBucket[] = AGING_BUCKETS.map((b) => {
    const v = acc.get(b.id)!;
    const amount = Math.round(v.amount * 100) / 100;
    return {
      id: b.id,
      label: b.label,
      amount,
      count: v.count,
      pct: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
    };
  });

  return { total, overdue, buckets };
}

/**
 * Filas formateadas de un estado de resultados a partir del P&L crudo
 * (profitAndLoss de Contabilidad 0040). NO recalcula: solo arma las filas con %
 * sobre ingresos. PURA — testeable sin DB.
 */
export function incomeStatementRows(pl: {
  income: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netIncome: number;
}): IncomeRow[] {
  const base = pl.income;
  const pct = (n: number): number | null =>
    base > 0 ? Math.round((n / base) * 1000) / 10 : null;

  return [
    { label: "Ingresos", amount: pl.income, pct: base > 0 ? 100 : null, emphasis: false },
    { label: "Costo de ventas", amount: pl.cogs, pct: pct(pl.cogs), emphasis: false },
    { label: "Utilidad bruta", amount: pl.grossProfit, pct: pct(pl.grossProfit), emphasis: true },
    { label: "Gastos operativos", amount: pl.expenses, pct: pct(pl.expenses), emphasis: false },
    { label: "Utilidad neta", amount: pl.netIncome, pct: pct(pl.netIncome), emphasis: true },
  ];
}

/** Mínimo que el cashflow necesita de un movimiento (factura o cobro). */
export type FlowItem = { dateIso: string | null; usd: number };

/**
 * Serie mensual facturado-vs-cobrado (USD) sobre el rango, alineada a los meses
 * del período (serie continua, igual criterio que monthlyBuckets). Cada item ya
 * viene USD-normalizado (lo hace la query con invoiceUsdAmount). PURA.
 */
export function monthlyCashflow(
  billed: FlowItem[],
  collected: FlowItem[],
  range: DateRange,
): CashflowPoint[] {
  // Reusa la lista continua de meses construida por monthlyBuckets (sobre filas
  // con created_at), pero acá sumamos USD. Construimos los meses del rango:
  const start = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  if (cursor.getTime() > lastMonth.getTime()) return [];
  let guard = 0;
  while (cursor.getTime() <= lastMonth.getTime() && guard < 36) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    guard++;
  }

  const billedByMonth = new Map<string, number>();
  const collectedByMonth = new Map<string, number>();
  const tally = (items: FlowItem[], into: Map<string, number>) => {
    for (const it of items) {
      if (!it.dateIso) continue;
      const t = new Date(it.dateIso);
      if (Number.isNaN(t.getTime())) continue;
      const key = monthKey(t);
      into.set(key, (into.get(key) ?? 0) + (Number(it.usd) || 0));
    }
  };
  tally(billed, billedByMonth);
  tally(collected, collectedByMonth);

  return months.map((key) => ({
    month: key,
    label: monthLabel(key),
    billed: Math.round((billedByMonth.get(key) ?? 0) * 100) / 100,
    collected: Math.round((collectedByMonth.get(key) ?? 0) * 100) / 100,
  }));
}
