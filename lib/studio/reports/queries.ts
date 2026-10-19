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
import { fetchAllPaged } from "@/lib/db/paginate";
import { invoiceUsdAmount } from "@/lib/studio/fidelizacion/types";
import {
  clientsWithTier,
  clientAnnualBilling,
} from "@/lib/studio/fidelizacion/queries";
import {
  getAnalyticsLeads,
  allConvertedLeads,
  KOMMO_WON_STATUS_ID,
  KOMMO_LOST_STATUS_ID,
  type AnalyticsLead,
} from "@/lib/studio/kommo-analytics";
import { listKommoUsers } from "@/lib/studio/kommo-queries";
import type { KommoUserRow } from "@/lib/studio/kommo-types";
import {
  getFiscalSettings,
  SALE_STATUSES,
  INVOICE_COLUMNS,
} from "@/lib/studio/fiscal/queries";
import {
  toSalesRow,
  salesTotals,
  toPurchaseRow,
  purchaseTotals,
  type RawInvoice,
  type RawBill,
} from "@/lib/studio/fiscal/types";
import type { InvoiceIvaMode } from "@/lib/studio/fiscal/config-types";
import { listAccounts, accountBalances } from "@/lib/studio/account-queries";
import { profitAndLoss } from "@/lib/studio/accounting/reports";
import { controlDelMayor } from "@/lib/studio/accounting/ingreso-periodo";
import { ingresoDelPeriodo } from "@/lib/studio/accounting/libro-control-queries";
import { receivablesQueue } from "@/lib/studio/payment-queries";
import { payablesQueue } from "@/lib/studio/treasury/bill-queries";
import { invoiceKpis } from "@/lib/studio/invoice-queries";
import {
  buildAgingSide,
  buildPipeline,
  buildRepurchase,
  groupByRoute,
  groupByService,
  incomeStatementRows,
  monthlyBuckets,
  monthlyCashflow,
  periodRange,
  revenueOf,
  routeLabel,
  serviceLabel,
  transitDays,
  ivaOutcome,
  type AgentRow,
  type AgingItem,
  type AgingReport,
  type CarrierRow,
  type CashflowReport,
  type PipelineQuote,
  type PipelineReport,
  type RepurchaseReport,
  type RepurchaseShipment,
  type ClientRankRow,
  type CombinedReport,
  type CommercialByAgent,
  type CommercialByClient,
  type DateRange,
  type IvaPosition,
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
import {
  currencyLabel,
  statusLabel as invoiceStatusLabel,
  type InvoiceCurrency,
  type InvoiceStatus,
} from "@/lib/studio/invoice-types";
import {
  STATUS_LABELS,
  type ShipmentService,
  type ShipmentStatus,
} from "@/lib/shared/shipment-public";
import type { QuoteStatus } from "@/lib/studio/quote-types";
import {
  REPORT_SOURCES,
  type BuilderRow,
  type ReportSourceId,
} from "./builder-types";
import {
  costingRows,
  costingTotals,
  marginByRoute,
  marginByClient,
  costPerCbmByRoute,
} from "@/lib/studio/costing/queries";

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
  "id, code, origin, destination, shipment_service, status, volume_m3, client_name, created_at, arrived_destination_at, delivered_at";

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
    client_name: (r.client_name as string | null) ?? null,
    created_at: String(r.created_at),
    arrived_destination_at: (r.arrived_destination_at as string | null) ?? null,
    delivered_at: (r.delivered_at as string | null) ?? null,
  };
}

/**
 * Lee TODAS las filas de una lectura de reporte, paginando.
 *
 * Este módulo es el que más agrega en JS de todo el ERP: cada función de acá
 * suma, promedia o agrupa lo que lee. Un `.limit(20000)` no protegía nada —
 * PostgREST devuelve 1.000 y no avisa—, así que un reporte de un período
 * grande daba un número **equivocado con cara de verdad**.
 *
 * Y no redondea cuando no puede leer completo: tira nombrando el reporte. Un
 * estado de resultados a medias es peor que una pantalla que se queja, porque
 * el que lo lee no tiene forma de saber que le falta la mitad.
 */
async function filasDelReporte<T>(
  queReporte: string,
  page: (from: number, to: number) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const { rows, complete } = await fetchAllPaged<T>(page);
  if (!complete) {
    throw new Error(
      `${queReporte}: el período supera el tope de lectura; el reporte no se puede calcular completo. Acota el rango.`,
    );
  }
  return rows;
}

/**
 * Embarques (vivos) creados en el rango. RLS filtra por tenant; deleted_at null.
 */
async function fetchShipments(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<ReportShipment[]> {
  const data = await filasDelReporte<Record<string, unknown>>(
    "Embarques del período",
    (from, to) =>
      supabase
        .from("shipments")
        .select(SHIPMENT_COLUMNS)
        .is("deleted_at", null)
        .gte("created_at", range.from)
        .lte("created_at", `${range.to}T23:59:59.999Z`)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
  );
  return data.map(coerceShipment);
}

/**
 * Mapa shipment_code → USD facturado en el rango. Una sola query de invoices
 * (vivas, con shipment_code) del período, normalizadas a USD (invoiceUsdAmount).
 * Suma cuando hay varias facturas para el mismo embarque. Solo cuenta facturas
 * BILLABLE (emitida/parcial/pagada/vencida) — excluye `borrador` (monto no
 * emitido) y `anulada`, igual que invoiceKpis (invoice-queries) y Fidelización.
 * Antes filtraba solo `.neq("anulada")`, lo que inflaba el revenue con borradores
 * y no cuadraba con Facturación/Dirección (fix del bug detectado en la
 * verificación adversarial de SDD-0052).
 */
async function fetchRevenueByCode(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<Map<string, number>> {
  const data = await filasDelReporte<Record<string, unknown>>(
    "Facturación del período",
    (from, to) =>
      supabase
        .from("invoices")
        .select("id, shipment_code, total_amount, currency, fx_rate, status")
        .is("deleted_at", null)
        .not("shipment_code", "is", null)
        .in("status", ["emitida", "parcial", "pagada", "vencida"])
        .gte("created_at", range.from)
        .lte("created_at", `${range.to}T23:59:59.999Z`)
        .order("id", { ascending: true })
        .range(from, to),
  );

  const map = new Map<string, number>();
  for (const row of data) {
    const code = (row.shipment_code as string | null) ?? null;
    if (!code) continue;
    const usd = invoiceUsdAmount({
      currency: row.currency as never,
      total_amount: num(row.total_amount),
      fx_rate: numOrNull(row.fx_rate),
    });
    map.set(code, (map.get(code) ?? 0) + usd);
  }
  // Redondear cada total por code a 2 decimales (centavo entero) para que el KPI
  // del Overview (Σ sobre embarques) y las filas por ruta/servicio (Σ por grupo)
  // cuadren EXACTO: con valores ya a centavo la suma es asociativa, sin la
  // divergencia total-vs-serie que dejan los sub-centavos de VES/fx (misma norma
  // que cashflowReport).
  for (const [code, usd] of map) {
    map.set(code, Math.round(usd * 100) / 100);
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

  // KPI revenue = revenue ATRIBUIBLE a los embarques del período (mismo cálculo
  // que las filas por ruta/servicio, que usan revenueOf sobre los shipments
  // presentes) → KPI = Σ filas por construcción. Antes sumaba TODO el mapa de
  // facturas, incluyendo huérfanas (facturas cuyo shipment_code no matchea ningún
  // embarque del rango), que inflaban el KPI sin aparecer en ninguna fila.
  // Decisión semántica: el Overview operacional mide la operación de embarques; el
  // revenue huérfano pertenece a las vistas Contables/Comerciales (que miran TODAS
  // las facturas), no a esta.
  const revenueUsd = revenueOf(shipments, revenueByCode);

  // Revenue HUÉRFANO = facturado del rango que no cae en ningún embarque del rango
  // (factura cuyo shipment_code no matchea un embarque del período). = Σ(todo el
  // mapa de facturas) − revenueUsd (revenue atribuible a embarques presentes).
  // Equivale a la suma de las entradas de revenueByCode cuyo code no está en el set
  // de codes de los embarques. Mismo criterio de redondeo (2 decimales). 0 cuando no
  // hay huérfanas. NO entra al KPI revenueUsd (a propósito): este chip lo expone al
  // lado para que ese dinero no quede oculto.
  let totalInvoiced = 0;
  for (const usd of revenueByCode.values()) totalInvoiced += usd;
  const orphanRevenueUsd =
    Math.round((totalInvoiced - revenueUsd) * 100) / 100;

  // Embarques SIN cliente asignado (caja sin dueño): client_name null o vacío.
  let unassignedCount = 0;
  let unassignedCbm = 0;
  for (const s of shipments) {
    if ((s.client_name ?? "").trim() === "") {
      unassignedCount += 1;
      unassignedCbm += Number(s.cbm) || 0;
    }
  }
  const unassigned = {
    count: unassignedCount,
    cbm: Math.round(unassignedCbm * 10) / 10,
  };

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
    orphanRevenueUsd,
    unassigned,
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
    const [bookingsRows, sailingsRows, carriersRes] = await Promise.all([
      filasDelReporte<Record<string, unknown>>("Reservas del período", (d, h) =>
        supabase
          .from("bookings")
          .select("id, carrier_id")
          .is("deleted_at", null)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("id", { ascending: true })
          .range(d, h),
      ),
      filasDelReporte<Record<string, unknown>>("Zarpes del período", (d, h) =>
        supabase
          .from("sailings")
          .select("id, carrier_id")
          .is("deleted_at", null)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("id", { ascending: true })
          .range(d, h),
      ),
      // Tope DECLARADO: `carriers` es un catálogo de navieras — decenas, no
      // miles. Mil filas nunca se alcanzan; paginarlo sería un request de más.
      supabase.from("carriers").select("id, name").limit(1000),
    ]);

    if (carriersRes.error) throw carriersRes.error;
    const bookingsRes = { data: bookingsRows };
    const sailingsRes = { data: sailingsRows };

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

// ── Comerciales · Por agente ───────────────────────────────────

const EMPTY_AGENT_TOTALS = {
  leads: 0,
  won: 0,
  lost: 0,
  clients: 0,
  revenueUsd: 0,
  convPct: 0,
};

/**
 * Desempeño por agente comercial (asesor de Kommo). REUSA el espejo Kommo
 * (SDD-0078/0087): `getAnalyticsLeads` (leads con responsible_user_id + estado),
 * `listKommoUsers` (nombre real del asesor) y `allConvertedLeads` (leadId →
 * markbox de los convertidos a cliente). El REVENUE es plata REAL del ERP
 * (`clientAnnualBilling`, USD trailing-12m) atribuida al asesor por sus leads
 * convertidos — NO el `price` de Kommo (≈$0, la ceguera de SDD-0062) ni un valor
 * fabricado (el Norte lo mockeaba). NPS/tickets del Norte se omiten (sin fuente).
 *
 * Snapshot del embudo actual (no filtra por período, igual que "Por cliente").
 * Resiliente: si el espejo Kommo no existe o está vacío → `hasKommo: false` →
 * EmptyState honesto. RLS filtra por tenant en cada lectura.
 */
export async function commercialByAgent(
  supabase: SupabaseClient,
  today?: Date,
): Promise<CommercialByAgent> {
  const now = today ?? new Date();

  let leads: AnalyticsLead[];
  try {
    // `.rows` = el espejo COMPLETO (paginado). Antes esto leía 1000 filas de
    // 3.145 y el desempeño por asesor salía del 32% de la cartera, sin avisar.
    leads = (await getAnalyticsLeads(supabase)).rows;
  } catch {
    // kommo_leads ausente (gap deploy↔migración) → sin datos, honesto.
    return { rows: [], totals: { ...EMPTY_AGENT_TOTALS }, hasKommo: false };
  }
  if (leads.length === 0) {
    return { rows: [], totals: { ...EMPTY_AGENT_TOTALS }, hasKommo: false };
  }

  const [users, converted, billing] = await Promise.all([
    listKommoUsers(supabase).catch(() => [] as KommoUserRow[]),
    allConvertedLeads(supabase).catch(() => ({}) as Record<number, string>),
    clientAnnualBilling(supabase, now).catch(() => new Map<string, number>()),
  ]);

  const nameById = new Map<number, string>();
  for (const u of users) {
    const n = (u.name ?? "").trim();
    if (n) nameById.set(u.id, n);
  }

  type Acc = {
    leads: number;
    won: number;
    lost: number;
    clients: number;
    revenueUsd: number;
  };
  const acc = new Map<number | null, Acc>();
  const bucket = (id: number | null): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = { leads: 0, won: 0, lost: 0, clients: 0, revenueUsd: 0 };
      acc.set(id, a);
    }
    return a;
  };

  for (const l of leads) {
    const a = bucket(l.responsible_user_id);
    a.leads += 1;
    if (l.status_id === KOMMO_WON_STATUS_ID) a.won += 1;
    else if (l.status_id === KOMMO_LOST_STATUS_ID) a.lost += 1;
    const markbox = converted[l.id];
    if (markbox) {
      a.clients += 1;
      a.revenueUsd += billing.get(markbox) ?? 0;
    }
  }

  const rows: AgentRow[] = [...acc.entries()]
    .map(([id, a]) => ({
      agentId: id,
      name: id == null ? "Sin asignar" : (nameById.get(id) ?? `Asesor #${id}`),
      leads: a.leads,
      won: a.won,
      lost: a.lost,
      clients: a.clients,
      revenueUsd: Math.round(a.revenueUsd * 100) / 100,
      convPct: a.leads > 0 ? Math.round((a.won / a.leads) * 1000) / 10 : 0,
    }))
    .sort((x, y) => {
      if (y.revenueUsd !== x.revenueUsd) return y.revenueUsd - x.revenueUsd;
      return y.leads - x.leads;
    });

  const totals = rows.reduce(
    (t, r) => ({
      leads: t.leads + r.leads,
      won: t.won + r.won,
      lost: t.lost + r.lost,
      clients: t.clients + r.clients,
      revenueUsd: t.revenueUsd + r.revenueUsd,
      convPct: 0,
    }),
    { ...EMPTY_AGENT_TOTALS },
  );
  totals.revenueUsd = Math.round(totals.revenueUsd * 100) / 100;
  totals.convPct =
    totals.leads > 0 ? Math.round((totals.won / totals.leads) * 1000) / 10 : 0;

  return { rows, totals, hasKommo: true };
}

// ── Contables · Estado de resultados ───────────────────────────

/**
 * Estado de resultados del período. REUSA `profitAndLoss` (Contabilidad 0040)
 * TAL CUAL sobre los saldos del rango: NO recalcula. Compone igual que Dirección
 * (0048): listAccounts + accountBalances({fromDate, upToDate}) → profitAndLoss.
 * La vista solo formatea filas con % sobre ingresos (incomeStatementRows).
 *
 * SDD-0557: suma `ingreso`, la cifra oficial del MISMO rango
 * (`ingresoDelPeriodo`), con el control contra la 4.5 calculado sobre estos
 * mismos saldos. Hoy el mayor está incompleto: el P&L puede dar 0 con facturas
 * emitidas, y la vista lo dice en vez de mostrar el estado vacío.
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
  const ingreso = await ingresoDelPeriodo(supabase, range, {
    mayor: controlDelMayor(accounts, balances),
  });
  return {
    rows: incomeStatementRows(pl),
    income: pl.income,
    netIncome: pl.netIncome,
    range,
    ingreso,
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

// ── Contables · Facturado contra cobrado (antes «Cashflow») ────

/**
 * Facturado contra cobrado del período (SDD-0052; se llamaba «Cashflow», pero
 * no es un flujo de caja: SDD-0557 le cambió el rótulo y conservó el slug
 * `cashflow` y los identificadores): serie mensual de FACTURADO vs COBRADO, ambos
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

  const [invRows, recRows, kpis] = await Promise.all([
    // Sin filtro de rango en SQL: el rango se aplica in-memory sobre
    // `issued_at ?? created_at` (el filtro SQL por una sola columna perdería las
    // filas cuyo issued_at cae en rango pero created_at no, o viceversa).
    //
    // ⚠️ Justamente por eso ésta es la lectura MÁS expuesta del módulo: no lee
    // un período, lee la tabla ENTERA de facturas vivas. Con `.limit(20000)`
    // devolvía las primeras 1.000 y el flujo de caja se calculaba sobre ellas.
    filasDelReporte<Record<string, unknown>>("Flujo de caja · facturas", (d, h) =>
      supabase
        .from("invoices")
        .select("id, total_amount, currency, fx_rate, status, issued_at, created_at")
        .is("deleted_at", null)
        .neq("status", "anulada")
        .neq("status", "borrador")
        .order("id", { ascending: true })
        .range(d, h),
    ),
    filasDelReporte<Record<string, unknown>>("Flujo de caja · cobros", (d, h) =>
      supabase
        .from("payment_receipts")
        .select("id, amount, currency, fx_rate, received_at")
        .is("deleted_at", null)
        .gte("received_at", range.from)
        .lte("received_at", range.to)
        .order("id", { ascending: true })
        .range(d, h),
    ),
    invoiceKpis(supabase),
  ]);
  const invRes = { data: invRows, error: null };
  const recRes = { data: recRows, error: null };

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

// ── Contables · Posición de IVA (débito − crédito) ─────────────

const IVA_BILL_COLUMNS =
  "bill_code, supplier_name, reference, currency, total_amount, issue_date, created_at, status";

/**
 * Posición de IVA del período. REUSA la clasificación fiscal (SDD-0073):
 *  - Débito fiscal = IVA de las ventas EMITIDAS del rango (`invoices`),
 *    clasificadas por la config del tenant vía `toSalesRow` → `salesTotals`.
 *    Con el módulo fiscal OFF (DTD hoy) las ventas caen exentas → débito 0.
 *  - Crédito fiscal = IVA de las compras (`supplier_bills`) vía `toPurchaseRow`
 *    → `purchaseTotals`. V1: `supplier_bills` no discrimina IVA (va al costo,
 *    0044) → crédito 0. NO se fabrica (regla §3.2); la UI lo advierte.
 *
 * Cuota = débito − crédito; a pagar / excedente vía `ivaOutcome` (retenciones V1
 * = 0, sin comprobantes). NO normaliza moneda (misma convención V1 que los
 * Libros fiscales, para que los números cuadren con /studio/fiscal) → devuelve
 * `currencies` para que la UI advierta si hay mezcla. Read-only, RLS por tenant.
 */
export async function ivaPosition(
  supabase: SupabaseClient,
  period: ReportPeriod,
  today?: Date,
): Promise<IvaPosition> {
  const range = periodRange(period, today);
  const settings = await getFiscalSettings(supabase);

  // ── Ventas (débito): facturas emitidas del rango, clasificadas por config.
  const invData = await filasDelReporte<Record<string, unknown>>(
    "Posición de IVA · ventas",
    (d, h) =>
      supabase
        .from("invoices")
        .select(INVOICE_COLUMNS)
        .is("deleted_at", null)
        .in("status", SALE_STATUSES as unknown as string[])
        .gte("created_at", range.from)
        .lte("created_at", `${range.to}T23:59:59.999Z`)
        .order("id", { ascending: true })
        .range(d, h),
  );

  const salesCurrencies = new Set<string>();
  const salesRows = ((invData as Record<string, unknown>[] | null) ?? []).map(
    (r) => {
      const currency = (r.currency as string | null) ?? null;
      if (currency) salesCurrencies.add(currency);
      const inv: RawInvoice = {
        invoice_code: String(r.invoice_code ?? ""),
        // El RIF/nombre no importan para los totales de IVA → null.
        client_name: (r.client_name as string | null) ?? null,
        rif: null,
        iva_mode: (r.iva_mode as InvoiceIvaMode | null) ?? null,
        base_amount: num(r.base_amount),
        iva_amount: num(r.iva_amount),
        iva_rate: num(r.iva_rate),
        total_amount: num(r.total_amount),
        issued_at: (r.issued_at as string | null) ?? null,
        created_at: String(r.created_at ?? ""),
        currency,
      };
      return toSalesRow(inv, settings);
    },
  );
  const st = salesTotals(salesRows);

  // ── Compras (crédito): supplier_bills del rango por issue_date. Defensivo:
  // si la tabla no existe en un env, crédito 0 (no rompe la vista).
  const purchaseCurrencies = new Set<string>();
  let pt = purchaseTotals([]);
  try {
    const billData = await filasDelReporte<Record<string, unknown>>(
      "Posición de IVA · compras",
      (d, h) =>
        supabase
          .from("supplier_bills")
          .select(IVA_BILL_COLUMNS)
          .is("deleted_at", null)
          .neq("status", "anulada")
          .gte("issue_date", range.from)
          .lte("issue_date", range.to)
          .order("id", { ascending: true })
          .range(d, h),
    );
    const purchaseRows = (
      (billData as Record<string, unknown>[] | null) ?? []
    ).map((r) => {
      const currency = (r.currency as string | null) ?? null;
      if (currency) purchaseCurrencies.add(currency);
      const raw: RawBill = {
        bill_code: String(r.bill_code ?? ""),
        supplier_name: (r.supplier_name as string | null) ?? null,
        reference: (r.reference as string | null) ?? null,
        tax_id: null,
        total_amount: num(r.total_amount),
        issue_date: (r.issue_date as string | null) ?? null,
        created_at: String(r.created_at ?? ""),
        currency,
      };
      return toPurchaseRow(raw, settings);
    });
    pt = purchaseTotals(purchaseRows);
  } catch {
    pt = purchaseTotals([]);
  }

  const debito = st.iva;
  const credito = pt.iva;
  const cuota = Math.round((debito - credito) * 100) / 100;
  const retenciones = 0; // V1: sin comprobantes de retención (columna preparada).
  const { aPagar, excedente } = ivaOutcome(cuota, retenciones);

  const currencies = [
    ...new Set([...salesCurrencies, ...purchaseCurrencies]),
  ].sort();

  return {
    enabled: settings.fiscal_module_enabled,
    debito,
    credito,
    cuota,
    retenciones,
    aPagar,
    excedente,
    baseGravada: st.baseGravada,
    baseNoGravada: Math.round((st.baseExenta + st.baseTasaCero) * 100) / 100,
    salesRows: st.rows,
    purchaseRows: pt.rows,
    purchaseRowsWithIva: pt.rowsWithData,
    currencies,
    range,
  };
}

// ═══════════════════════════════════════════════════════════════
// Slice C — Constructor (report builder)
// ═══════════════════════════════════════════════════════════════
//
// Trae las filas de la fuente elegida en el período, YA APLANADAS al shape
// BuilderRow (dims resueltas a labels, métricas a número, filtros a string) →
// `buildReport` (builder-types.ts) agrega/filtra sin tocar la DB. Anclado a
// campos REALES (§3.2): NO fabrica costos/márgenes/segmentos. RLS por tenant.

const EMPTY_LABEL = "Sin asignar";

/**
 * Filas del constructor para EMBARQUES: reusa `fetchShipments` +
 * `fetchRevenueByCode` (el mismo join por shipment_code que el resto de
 * Reportes; sin N+1). Cada fila enriquece su Revenue USD desde el mapa.
 *  - dims: client (client_name) · route (origen→destino) · status · service.
 *  - metrics: count (=1 por fila) · cbm (volume_m3) · revenue (USD del join).
 */
async function shipmentBuilderRows(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<BuilderRow[]> {
  const [shipments, revenueByCode] = await Promise.all([
    fetchShipments(supabase, range),
    fetchRevenueByCode(supabase, range),
  ]);

  return shipments.map((s) => {
    const statusKnown = STATUS_LABELS[s.status as ShipmentStatus];
    const clientName = (s.client_name ?? "").trim() || EMPTY_LABEL;
    return {
      dims: {
        client: clientName,
        route: routeLabel(s.origin, s.destination),
        status: statusKnown ?? s.status,
        service: serviceLabel(s.shipment_service),
      },
      metrics: {
        cbm: Number(s.cbm) || 0,
        revenue: revenueByCode.get(s.code) ?? 0,
      },
      // Los filtros usan el MISMO label que la dimensión (filtrar por lo que se ve).
      filters: {
        status: statusKnown ?? s.status,
        service: serviceLabel(s.shipment_service),
      },
    };
  });
}

const INVOICE_BUILDER_COLUMNS =
  "client_name, currency, fx_rate, total_amount, paid_amount, status, issued_at, created_at";

/**
 * Filas del constructor para FACTURAS: una query simple del período (por
 * issued_at ?? created_at, consistente con cashflow/Facturación), USD-normalizada.
 *  - dims: client (client_name) · status · currency.
 *  - metrics: count · amount (total USD) · balance (saldo = total − pagado, USD).
 * Excluye `anulada` (no representa monto vivo). El saldo USD escala el pendiente
 * en moneda por la misma tasa USD que el total (fx del documento; CNY → 0).
 */
async function invoiceBuilderRows(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<BuilderRow[]> {
  const data = await filasDelReporte<Record<string, unknown>>(
    "Constructor de reportes · facturas",
    (d, h) =>
      supabase
        .from("invoices")
        .select(INVOICE_BUILDER_COLUMNS)
        .is("deleted_at", null)
        .neq("status", "anulada")
        .order("id", { ascending: true })
        .range(d, h),
  );

  const rows: BuilderRow[] = [];
  for (const r of data) {
    const statusVal = r.status as InvoiceStatus;
    // Excluir anuladas (el .neq de la query + guard in-memory por robustez,
    // misma norma que cashflowReport).
    if (statusVal === "anulada") continue;

    const refDate =
      ((r.issued_at as string | null) ?? (r.created_at as string | null)) ??
      null;
    const refDay = refDate?.slice(0, 10) ?? null;
    if (!refDay || refDay < range.from || refDay > range.to) continue;

    const currency = r.currency as InvoiceCurrency;
    const total = num(r.total_amount);
    const fx = numOrNull(r.fx_rate);
    const amountUsd = invoiceUsdAmount({
      currency,
      total_amount: total,
      fx_rate: fx,
    });
    // Saldo en moneda = total − pagado; lo normalizamos a USD con la MISMA tasa
    // (reusar invoiceUsdAmount sobre el saldo en moneda del documento).
    const balanceMoney = Math.max(0, total - num(r.paid_amount));
    const balanceUsd = invoiceUsdAmount({
      currency,
      total_amount: balanceMoney,
      fx_rate: fx,
    });

    const clientName = (r.client_name as string | null)?.trim() || EMPTY_LABEL;
    rows.push({
      dims: {
        client: clientName,
        status: invoiceStatusLabel(statusVal),
        currency: currencyLabel(currency),
      },
      metrics: {
        amount: Math.round(amountUsd * 100) / 100,
        balance: Math.round(balanceUsd * 100) / 100,
      },
      filters: {
        status: invoiceStatusLabel(statusVal),
        currency: currencyLabel(currency),
      },
    });
  }
  return rows;
}

/**
 * Filas aplanadas de la fuente elegida en el período. Despacha a la query
 * concreta (embarques/facturas). El constructor (builder-types.ts) agrega/
 * filtra/exporta sobre estas filas SIN volver a la DB.
 */
export async function builderRows(
  supabase: SupabaseClient,
  source: ReportSourceId,
  period: ReportPeriod,
  today?: Date,
): Promise<BuilderRow[]> {
  const range = periodRange(period, today);
  if (source === "invoices") return invoiceBuilderRows(supabase, range);
  return shipmentBuilderRows(supabase, range);
}

// ═══════════════════════════════════════════════════════════════
// Slice C — Combinados (rentabilidad REAL · cruce operación × finanzas)
// ═══════════════════════════════════════════════════════════════
//
// Reusa Costing (SDD-0053) tal cual: `costingRows` cruza cada embarque con su
// REVENUE real (invoices, USD-normalizado, sin borrador) + su COSTO real
// (`shipment_costs`). El margen = revenue − costo (cero si el embarque no tiene
// costos cargados). NUNCA se fabrica costo (el Norte usa _ROUTE_COST=0.70+jitter
// → prohibido replicarlo, §3.2/§6).

/**
 * Combinados del período (rentabilidad REAL): compone `costingRows` (Costing
 * 0053) sobre el rango del período de Reportes y deriva las 3 vistas con los
 * helpers PUROS de Costing. Si ningún embarque del período tiene costos
 * cargados → `withCosts === 0` (la UI muestra un EmptyState honesto que enlaza a
 * /studio/costing, en vez de tablas de margen donde el costo es 0 por todos lados).
 *
 * Read-only, RLS por tenant (vía costingRows). Sin migración (reusa
 * `shipment_costs` de 0100, ya en prod).
 */
export async function combinedReport(
  supabase: SupabaseClient,
  period: ReportPeriod,
  today?: Date,
): Promise<CombinedReport> {
  const range = periodRange(period, today);
  const rows = await costingRows(supabase, { from: range.from, to: range.to });

  const withCosts = rows.filter((r) => r.costs != null).length;

  return {
    totals: costingTotals(rows),
    byRoute: marginByRoute(rows),
    byClient: marginByClient(rows),
    byCbm: costPerCbmByRoute(rows),
    withCosts,
    shipments: rows.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// F1-T07 — Comerciales · Recompra vencida + Pipeline de estimados
// ═══════════════════════════════════════════════════════════════
//
// Encienden el Sistema 2 (Ventas) del Motor de Crecimiento: la recompra 30/45 (la
// fuga #1) y el CBM/USD en pipeline vs 133/mes. Capa de presentación sobre tablas
// reales (shipments, quotes) — el cálculo vive en los helpers PUROS de ./types.
// RLS por tenant. Sin migración, sin fabricar nada (§3.2).

const REPURCHASE_SHIPMENT_COLUMNS =
  "client_markbox, client_name, code, status, created_at, arrived_destination_at, delivered_at";

/**
 * Recompra por cliente (decisión founder 19-jul: POR EMBARQUE). Lee TODOS los
 * embarques vivos (sin filtro de período: el último de cada cliente puede ser de
 * cuando sea) y delega la clasificación en `buildRepurchase`. RLS por tenant.
 */
export async function commercialRepurchase(
  supabase: SupabaseClient,
  today: Date = new Date(),
): Promise<RepurchaseReport> {
  const data = await filasDelReporte<Record<string, unknown>>(
    "Recompra · embarques",
    (d, h) =>
      supabase
        .from("shipments")
        .select(REPURCHASE_SHIPMENT_COLUMNS)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
  );

  const rows: RepurchaseShipment[] = data.map((r) => ({
    markbox: (r.client_markbox as string | null) ?? null,
    clientName: (r.client_name as string | null) ?? null,
    code: String(r.code ?? ""),
    status: String(r.status ?? ""),
    created_at: String(r.created_at ?? ""),
    arrived_destination_at: (r.arrived_destination_at as string | null) ?? null,
    delivered_at: (r.delivered_at as string | null) ?? null,
  }));

  return buildRepurchase(rows, today);
}

/**
 * Pipeline de estimados del período: `quotes` creadas en el rango, agrupadas por
 * estado con CBM/USD, y el abierto (draft+sent) vs la meta de 133 CBM/mes. El
 * cálculo (incluida la escala de la meta por meses del rango) vive en
 * `buildPipeline`. RLS por tenant.
 */
export async function commercialPipeline(
  supabase: SupabaseClient,
  period: ReportPeriod,
  today?: Date,
): Promise<PipelineReport> {
  const range = periodRange(period, today);
  const data = await filasDelReporte<Record<string, unknown>>(
    "Embudo comercial · cotizaciones",
    (d, h) =>
      supabase
        .from("quotes")
        .select("id, status, cbm, total_usd")
        .is("deleted_at", null)
        .gte("created_at", range.from)
        .lte("created_at", `${range.to}T23:59:59.999Z`)
        .order("id", { ascending: true })
        .range(d, h),
  );

  const quotes: PipelineQuote[] = data.map((r) => ({
    status: r.status as QuoteStatus,
    cbm: numOrNull(r.cbm),
    total_usd: num(r.total_usd),
  }));

  return buildPipeline(quotes, range);
}

// Mantiene a REPORT_SOURCES como dependencia consciente del módulo (la query y la
// UI comparten el mismo catálogo; el import explícito evita drift de keys).
export { REPORT_SOURCES };
