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
import {
  mesEnCurso,
  type IngresoPeriodo,
} from "@/lib/studio/accounting/ingreso-periodo";
import {
  type QuoteStatus,
  statusLabel as quoteStatusLabel,
  statusBadgeTone as quoteStatusTone,
} from "@/lib/studio/quote-types";

// Re-export TYPE-ONLY de Combinados (Slice C): el client component importa estos
// tipos desde acá (server-safe, sin Supabase). Es un re-export de SOLO tipos →
// se borra en build, NO arrastra `@supabase/*` a este módulo ni al cliente.
import type {
  ClientMarginRow,
  CostingTotals,
  RouteCbmRow,
  RouteMarginRow,
} from "@/lib/studio/costing/queries";

export type {
  ClientMarginRow,
  CostingTotals,
  RouteCbmRow,
  RouteMarginRow,
};

/**
 * Payload de la categoría Combinados (Slice C): las 3 vistas de rentabilidad
 * REAL + KPIs (totales de Costing) + flags de cobertura de costos. Lo arma
 * `combinedReport` (queries.ts) reusando `costingRows`. Acá vive solo el TIPO
 * (server-safe), para que el client component lo importe sin tocar Supabase.
 */
export type CombinedReport = {
  totals: CostingTotals;
  byRoute: RouteMarginRow[];
  byClient: ClientMarginRow[];
  byCbm: RouteCbmRow[];
  /** # de embarques del período que tienen una fila de costos cargada. */
  withCosts: number;
  /** # total de embarques (vivos) del período. */
  shipments: number;
};

// ── Período ────────────────────────────────────────────────────

export type ReportPeriod = "MES" | "1M" | "3M" | "1A" | "YTD";

export const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  // SDD-0557: el mes calendario, la misma ventana de Contabilidad, Dirección y
  // el Dashboard. Las demás son ventanas móviles.
  { value: "MES", label: "Este mes" },
  { value: "1M", label: "Último mes" },
  { value: "3M", label: "Últimos 3 meses" },
  { value: "1A", label: "Último año" },
  { value: "YTD", label: "Este año (YTD)" },
];

export const DEFAULT_PERIOD: ReportPeriod = "1A";

const VALID_PERIODS: ReportPeriod[] = ["MES", "1M", "3M", "1A", "YTD"];

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
 *  - MES → 1° del mes de `today` … today (`mesEnCurso`, SDD-0557)
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
  if (period === "MES") return mesEnCurso(to);

  // trailing N meses → restamos meses sobre una copia en UTC.
  // Clampeamos el día al último día válido del mes destino: si `today` cae en
  // 29-31 y el mes destino es más corto, JS rotaría al mes siguiente
  // (ej: 31-mar − 1M → Date.UTC(2026, 1, 31) = "31 de febrero" → ~3-mar, mal).
  // `Date.UTC(y, m + 1, 0)` = día 0 del mes siguiente = último día del destino.
  const months = period === "1M" ? 1 : period === "3M" ? 3 : 12;
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() - months;
  const d = today.getUTCDate();
  const lastDayOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const from = new Date(Date.UTC(y, m, Math.min(d, lastDayOfTarget)));
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
  /** SDD-0572: facturas del grupo sin tasa, fuera del revenue. */
  facturasSinTasa?: number;
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
  /** SDD-0572: facturas del grupo sin tasa, fuera del revenue. */
  facturasSinTasa?: number;
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
  /**
   * Revenue facturado del rango que NO cae en ningún embarque del rango (factura
   * "huérfana": su `shipment_code` no matchea un embarque del período, típico de
   * una factura emitida este mes para un embarque creado el mes pasado). =
   * Σ(revenueByCode) − revenueUsd. 0 cuando no hay huérfanas. Informativo: el KPI
   * `revenueUsd` lo EXCLUYE a propósito (mide la operación de embarques); este chip
   * evita que ese dinero quede oculto.
   */
  orphanRevenueUsd: number;
  /**
   * Embarques del rango SIN cliente asignado (`client_name` null o vacío) — "cajas
   * sin dueño" que igual se despachan. Informativo, no alarma.
   */
  unassigned: { count: number; cbm: number };
  /**
   * SDD-0572: facturas de los embarques del rango que no convierten a USD (sin
   * tasa). No suman al revenue (ni 0 ni el nominal): la pantalla lo dice al lado.
   */
  facturasSinTasa?: number;
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
  client_name: string | null;
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

/**
 * Revenue USD de un grupo, sumando por shipment.code en el mapa de facturas.
 * Exportado (antes privado) para que el KPI del Overview operacional use el MISMO
 * cálculo que las filas (revenue atribuible a los embarques presentes) → KPI = Σ
 * filas por construcción. Ver `operationalOverview` en queries.ts.
 */
export function revenueOf(
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
  sinTasaByCode: Map<string, number> = new Map(),
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
      facturasSinTasa: list.reduce((n, s) => n + (sinTasaByCode.get(s.code) ?? 0), 0),
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
  sinTasaByCode: Map<string, number> = new Map(),
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
      facturasSinTasa: list.reduce((n, s) => n + (sinTasaByCode.get(s.code) ?? 0), 0),
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
  /** SDD-0557: la cifra oficial del mismo rango, con el control de la 4.5. */
  ingreso: IngresoPeriodo;
};

/**
 * Qué muestra el Estado de resultados (SDD-0557). PURA: la usan la vista y el
 * CSV, así las dos deciden igual.
 *  - "vacio": ni el mayor ni las facturas tienen nada en el período.
 *  - "solo-facturado": hay facturado pero el mayor no tiene movimiento (hoy,
 *    por B3): se muestra la cifra oficial y se dice que el mayor está vacío,
 *    en vez del estado vacío.
 *  - "completo": la cifra oficial y el P&L del mayor.
 */
export function vistaDelEstado(
  income: Pick<IncomeStatement, "income" | "netIncome" | "ingreso">,
): "vacio" | "solo-facturado" | "completo" {
  const mayorVacio = income.income === 0 && income.netIncome === 0;
  if (income.ingreso.controlI2.hayActividad || income.ingreso.controlI2.incidencias.length > 0) return "completo";
  const hayFacturado =
    income.ingreso.facturado.total !== 0 || income.ingreso.sinConvertir > 0;
  if (!mayorVacio) return "completo";
  return hayFacturado ? "solo-facturado" : "vacio";
}

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
  /** SDD-0572: documentos con saldo sin tasa, fuera de los buckets. */
  sinTasa?: number;
};

/** Payload del aging: CxC + CxP. */
export type AgingReport = {
  cxc: AgingSide;
  cxp: AgingSide;
};

// ── Contables · Facturado contra cobrado (antes «Cashflow») ────

/** Un punto de la serie mensual facturado-vs-cobrado (USD). */
export type CashflowPoint = {
  month: string; // "YYYY-MM"
  label: string; // "ENE 26"
  billed: number; // facturado en el mes (USD)
  collected: number; // cobrado en el mes (USD)
  /** Excluidas del subtotal de este mes, no contadores repetidos del período. */
  facturasSinTasa?: number;
  recibosSinTasa?: number;
};

/** Payload del cashflow: serie mensual + KPIs. */
export type CashflowReport = {
  series: CashflowPoint[];
  totalBilled: number; // facturado del período (USD)
  totalCollected: number; // cobrado del período (USD)
  outstanding: number; // por cobrar (saldo vivo, invoiceKpis)
  overdue: number; // vencido (saldo vivo, invoiceKpis)
  /** SDD-0572: facturas y recibos del período sin tasa, fuera de los totales. */
  facturasSinTasa?: number;
  recibosSinTasa?: number;
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
export type FlowItem = { dateIso: string | null; usd: number | null };

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
  const billedMissing = new Map<string, number>();
  const collectedMissing = new Map<string, number>();
  const tally = (items: FlowItem[], into: Map<string, number>, missing: Map<string, number>) => {
    for (const it of items) {
      if (!it.dateIso) continue;
      const t = new Date(it.dateIso);
      if (Number.isNaN(t.getTime())) continue;
      const key = monthKey(t);
      if (it.usd === null) {
        missing.set(key, (missing.get(key) ?? 0) + 1);
        continue;
      }
      into.set(key, (into.get(key) ?? 0) + (Number(it.usd) || 0));
    }
  };
  tally(billed, billedByMonth, billedMissing);
  tally(collected, collectedByMonth, collectedMissing);

  return months.map((key) => ({
    month: key,
    label: monthLabel(key),
    billed: Math.round((billedByMonth.get(key) ?? 0) * 100) / 100,
    collected: Math.round((collectedByMonth.get(key) ?? 0) * 100) / 100,
    facturasSinTasa: billedMissing.get(key) ?? 0,
    recibosSinTasa: collectedMissing.get(key) ?? 0,
  }));
}

// ═══════════════════════════════════════════════════════════════
// Paridad Norte — Comerciales (Por agente) + Contables (Posición IVA)
// ═══════════════════════════════════════════════════════════════
//
// Dos reportes que faltaban vs el Norte (erp/modules/reports.jsx ·
// ReportsAgents + ReportsIVA). Capa de presentación sobre datos REALES:
//  - Por agente → espejo Kommo (kommo_leads.responsible_user_id + kommo_users)
//    cruzado con la facturación real del ERP (clientAnnualBilling). El "revenue"
//    del Norte era mock; acá es plata facturada real atribuida al asesor por sus
//    leads convertidos a cliente. NPS/tickets del Norte se OMITEN (sin fuente).
//  - Posición IVA → reusa la clasificación fiscal (SDD-0073 · toSalesRow/
//    salesTotals + toPurchaseRow/purchaseTotals) sobre las facturas/compras del
//    período. Con el módulo fiscal OFF (DTD hoy) el débito es 0 (ventas exentas);
//    la vista lo dice honestamente. Sin fabricar retenciones (V1 → 0).

// ── Comerciales · Por agente ───────────────────────────────────

/** Una fila de desempeño por agente comercial (asesor de Kommo). */
export type AgentRow = {
  /** id del asesor en Kommo (responsible_user_id). null = "Sin asignar". */
  agentId: number | null;
  name: string;
  /** Leads (estimados) asignados al asesor en el embudo. */
  leads: number;
  /** Leads ganados (estado de sistema Kommo 142). */
  won: number;
  /** Leads perdidos (estado de sistema Kommo 143). */
  lost: number;
  /** Leads del asesor que se convirtieron en cliente vivo del ERP. */
  clients: number;
  /** Facturación real (USD, trailing 12m) de esos clientes convertidos. */
  revenueUsd: number;
  /** Conversión = won / leads * 100 (0 si no tiene leads). */
  convPct: number;
};

/** Payload del reporte "Por agente": filas + totales de equipo + disponibilidad. */
export type CommercialByAgent = {
  rows: AgentRow[];
  totals: {
    leads: number;
    won: number;
    lost: number;
    clients: number;
    revenueUsd: number;
    convPct: number;
  };
  /**
   * false si el espejo Kommo está vacío o no disponible (gap deploy↔migración) →
   * la UI muestra un EmptyState honesto en vez de una tabla vacía.
   */
  hasKommo: boolean;
  /**
   * true desde SDD-0614 S0 (D-6.6-1, P-9): la tabla del espejo de Kommo está
   * oculta. La vista muestra el aviso «se está pasando al CRM del Studio» y el
   * CSV no sale. R4 (S3) vuelve a llenar el reporte con las tarjetas del CRM.
   */
  oculto: boolean;
};

// ── Contables · Posición de IVA ────────────────────────────────

/**
 * Posición de IVA del período (débito − crédito). Débito = IVA en ventas real
 * (facturas clasificadas por la config fiscal); crédito = IVA en compras (V1: 0,
 * `supplier_bills` no discrimina IVA todavía → nota honesta). NO normaliza
 * moneda (misma convención V1 que los Libros fiscales) → `currencies` para
 * advertir si hay mezcla.
 */
export type IvaPosition = {
  /** ¿Módulo fiscal activo? Con OFF (DTD hoy) las ventas van exentas → débito 0. */
  enabled: boolean;
  /** Débito fiscal (IVA cobrado en ventas emitidas del período). */
  debito: number;
  /** Crédito fiscal (IVA soportado en compras). V1: 0 (sin desglose en compras). */
  credito: number;
  /** Cuota tributaria = débito − crédito. */
  cuota: number;
  /** Retenciones de IVA soportadas. V1 sin comprobantes → 0. */
  retenciones: number;
  /** A pagar si (cuota − retenciones) > 0. */
  aPagar: number;
  /** Excedente / crédito a favor si (cuota − retenciones) < 0. */
  excedente: number;
  /** Σ base imponible gravada de ventas. */
  baseGravada: number;
  /** Σ base exenta + tasa cero de ventas. */
  baseNoGravada: number;
  /** # de facturas de venta consideradas en el período. */
  salesRows: number;
  /** # de compras consideradas en el período. */
  purchaseRows: number;
  /** # de compras con IVA discriminado (crédito real, hoy 0). */
  purchaseRowsWithIva: number;
  /** Monedas presentes (V1 no normaliza; >1 → la UI advierte mezcla). */
  currencies: string[];
  range: DateRange;
};

/**
 * Deriva "a pagar" / "excedente a favor" de la cuota tributaria tras descontar
 * retenciones soportadas. PURA — testeable sin DB.
 */
export function ivaOutcome(
  cuota: number,
  retenciones: number,
): { aPagar: number; excedente: number } {
  const neto = Math.round((cuota - retenciones) * 100) / 100;
  return {
    aPagar: neto > 0 ? neto : 0,
    excedente: neto < 0 ? -neto : 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// F1-T07 — Comerciales · Recompra vencida + Pipeline de estimados
// ═══════════════════════════════════════════════════════════════
//
// Dos reportes que hacen MEDIBLE al Sistema 2 (Ventas) del Motor de Crecimiento:
//  - Recompra: clientes cuyo último embarque quedó atrás sin uno nuevo (la fuga
//    #1). Fuente: shipments, POR EMBARQUE (decisión founder 19-jul). Solo fechas
//    reales, cero costo fabricado (regla §3.2).
//  - Pipeline: CBM/USD de estimados vivos (draft+sent) del período vs la meta de
//    133 CBM/mes (2 contenedores). Fuente: quotes.

/** Meta comercial norte: 2 contenedores/mes ≈ 133 CBM. */
export const MONTHLY_TARGET_CBM = 133;

/** Umbrales de recompra (días desde el último embarque cerrado). */
export const REPURCHASE_WINDOW_DAYS = 30; // ventana: hay que contactar
export const REPURCHASE_OVERDUE_DAYS = 45; // vencida: la fuga

// ── Recompra ───────────────────────────────────────────────────

/**
 * Estados de shipment que cuentan como "en curso" (el cliente ya está comprando
 * de nuevo → no es fuga). Todo lo demás se trata como cerrado (delivered) o
 * cancelado. Alineado con ACTIVE_STATUSES de queries.ts + draft (recién creado).
 */
const REPURCHASE_ACTIVE_STATUSES = new Set<string>([
  "draft",
  "in_warehouse",
  "consolidating",
  "shipped",
  "in_transit",
  "in_customs",
  "arrived_destination",
  "out_for_delivery",
  "last_mile",
]);

/** Forma mínima de un embarque para el cálculo de recompra (puro/testeable). */
export type RepurchaseShipment = {
  markbox: string | null;
  clientName: string | null;
  code: string;
  status: string;
  created_at: string;
  arrived_destination_at: string | null;
  delivered_at: string | null;
};

/** Una fila de recompra: un cliente cuyo último embarque quedó atrás. */
export type RepurchaseRow = {
  markbox: string | null;
  name: string;
  lastCode: string;
  lastActivityIso: string;
  daysSince: number;
  bucket: "window" | "overdue";
};

/** Payload del reporte de recompra. */
export type RepurchaseReport = {
  rows: RepurchaseRow[]; // window + overdue, orden daysSince desc
  totalWithHistory: number; // clientes con ≥1 embarque
  activeCount: number; // con embarque en curso (no cuentan como fuga)
  recentCount: number; // cerrado hace < windowDays (aún no toca)
  windowCount: number; // [windowDays, overdueDays)
  overdueCount: number; // ≥ overdueDays
  windowDays: number;
  overdueDays: number;
};

/** Días enteros entre una fecha ISO y `today` (≥0; null si no parsea). */
export function daysSinceIso(iso: string | null, today: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = Math.floor((today.getTime() - t) / MS_PER_DAY);
  return d >= 0 ? d : 0;
}

/**
 * Agrupa embarques por cliente (markbox ?? nombre) y clasifica la recompra:
 *  - Si el cliente tiene algún embarque EN CURSO → activo (no es fuga).
 *  - Si todos cerraron → días desde el último cierre (delivered ?? arrived ??
 *    created). < window = reciente · [window, overdue) = ventana · ≥ overdue =
 *    vencida. Solo devuelve las filas de ventana + vencidas (las accionables),
 *    ordenadas por días desc. PURA — testeable sin DB.
 */
export function buildRepurchase(
  shipments: RepurchaseShipment[],
  today: Date = new Date(),
  windowDays: number = REPURCHASE_WINDOW_DAYS,
  overdueDays: number = REPURCHASE_OVERDUE_DAYS,
): RepurchaseReport {
  type Acc = {
    markbox: string | null;
    name: string;
    hasActive: boolean;
    lastMs: number;
    lastIso: string;
    lastCode: string;
  };
  const groups = new Map<string, Acc>();

  for (const s of shipments) {
    const mk = (s.markbox ?? "").trim();
    const nm = (s.clientName ?? "").trim();
    const key = mk || nm;
    if (!key) continue; // caja sin dueño → no es un cliente
    if (s.status === "cancelled") continue; // cancelado no es ni cierre ni actividad

    const refIso = s.delivered_at ?? s.arrived_destination_at ?? s.created_at;
    const refMs = Date.parse(refIso);
    const active = REPURCHASE_ACTIVE_STATUSES.has(s.status);

    let g = groups.get(key);
    if (!g) {
      g = {
        markbox: mk || null,
        name: nm || mk || "Sin nombre",
        hasActive: false,
        lastMs: -Infinity,
        lastIso: refIso,
        lastCode: s.code,
      };
      groups.set(key, g);
    }
    if (active) g.hasActive = true;
    // El embarque más reciente define la fecha de referencia y el nombre visible.
    if (Number.isFinite(refMs) && refMs > g.lastMs) {
      g.lastMs = refMs;
      g.lastIso = refIso;
      g.lastCode = s.code;
      if (nm) g.name = nm;
    }
  }

  const rows: RepurchaseRow[] = [];
  let activeCount = 0;
  let recentCount = 0;
  let windowCount = 0;
  let overdueCount = 0;

  for (const g of groups.values()) {
    if (g.hasActive) {
      activeCount += 1;
      continue;
    }
    const days = daysSinceIso(g.lastIso, today) ?? 0;
    if (days >= overdueDays) {
      overdueCount += 1;
      rows.push({
        markbox: g.markbox,
        name: g.name,
        lastCode: g.lastCode,
        lastActivityIso: g.lastIso,
        daysSince: days,
        bucket: "overdue",
      });
    } else if (days >= windowDays) {
      windowCount += 1;
      rows.push({
        markbox: g.markbox,
        name: g.name,
        lastCode: g.lastCode,
        lastActivityIso: g.lastIso,
        daysSince: days,
        bucket: "window",
      });
    } else {
      recentCount += 1;
    }
  }

  rows.sort((a, b) => b.daysSince - a.daysSince);

  return {
    rows,
    totalWithHistory: groups.size,
    activeCount,
    recentCount,
    windowCount,
    overdueCount,
    windowDays,
    overdueDays,
  };
}

// ── Pipeline de estimados ──────────────────────────────────────

/** Forma mínima de un estimado para el cálculo de pipeline (puro/testeable). */
export type PipelineQuote = {
  status: QuoteStatus;
  cbm: number | null;
  total_usd: number;
};

/** Una fila del desglose por estado del pipeline. */
export type PipelineStatusRow = {
  status: QuoteStatus;
  label: string;
  tone: string; // BadgeTone (lo resuelve la UI)
  count: number;
  cbm: number;
  usd: number;
  open: boolean; // draft|sent = oportunidad viva
};

/** Payload del reporte de pipeline. */
export type PipelineReport = {
  byStatus: PipelineStatusRow[];
  openCount: number;
  openCbm: number;
  openUsd: number;
  wonCount: number; // accepted
  wonUsd: number;
  monthlyTargetCbm: number; // 133
  months: number; // meses del rango
  avgMonthlyOpenCbm: number; // openCbm / months
  pctOfTarget: number; // avgMonthlyOpenCbm / target * 100
  range: DateRange;
};

/** Estados "abiertos" del pipeline (ni ganado ni perdido). */
const OPEN_QUOTE_STATUSES = new Set<QuoteStatus>(["draft", "sent"]);

/** Orden de presentación del desglose por estado. */
const QUOTE_STATUS_ORDER: QuoteStatus[] = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
];

/** # de meses calendario (≥1) que abarca un rango — para escalar la meta. */
export function monthsInRange(range: DateRange): number {
  const from = new Date(`${range.from}T00:00:00Z`);
  const to = new Date(`${range.to}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 1;
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) +
    1;
  return months >= 1 ? months : 1;
}

/**
 * Agrega estimados por estado y calcula el pipeline abierto (draft+sent) en
 * CBM/USD, comparado con la meta mensual (133 CBM × meses del rango). El CBM solo
 * suma donde existe (los FCL flat lo dejan null). PURA — testeable sin DB.
 */
export function buildPipeline(
  quotes: PipelineQuote[],
  range: DateRange,
  monthlyTargetCbm: number = MONTHLY_TARGET_CBM,
): PipelineReport {
  const acc = new Map<QuoteStatus, { count: number; cbm: number; usd: number }>();
  for (const st of QUOTE_STATUS_ORDER) acc.set(st, { count: 0, cbm: 0, usd: 0 });

  for (const q of quotes) {
    const b = acc.get(q.status);
    if (!b) continue; // status fuera del enum → defensivo
    b.count += 1;
    b.cbm += Number(q.cbm) || 0;
    b.usd += Number(q.total_usd) || 0;
  }

  const byStatus: PipelineStatusRow[] = QUOTE_STATUS_ORDER.map((st) => {
    const b = acc.get(st)!;
    return {
      status: st,
      label: quoteStatusLabel(st),
      tone: quoteStatusTone(st),
      count: b.count,
      cbm: Math.round(b.cbm * 10) / 10,
      usd: Math.round(b.usd * 100) / 100,
      open: OPEN_QUOTE_STATUSES.has(st),
    };
  });

  let openCount = 0;
  let openCbm = 0;
  let openUsd = 0;
  for (const st of OPEN_QUOTE_STATUSES) {
    const b = acc.get(st)!;
    openCount += b.count;
    openCbm += b.cbm;
    openUsd += b.usd;
  }
  const won = acc.get("accepted")!;

  const months = monthsInRange(range);
  const avgMonthlyOpenCbm = Math.round((openCbm / months) * 10) / 10;
  const pctOfTarget =
    monthlyTargetCbm > 0
      ? Math.round((avgMonthlyOpenCbm / monthlyTargetCbm) * 1000) / 10
      : 0;

  return {
    byStatus,
    openCount,
    openCbm: Math.round(openCbm * 10) / 10,
    openUsd: Math.round(openUsd * 100) / 100,
    wonCount: won.count,
    wonUsd: Math.round(won.usd * 100) / 100,
    monthlyTargetCbm,
    months,
    avgMonthlyOpenCbm,
    pctOfTarget,
    range,
  };
}
