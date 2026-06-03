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
import {
  groupByRoute,
  groupByService,
  monthlyBuckets,
  periodRange,
  transitDays,
  type CarrierRow,
  type DateRange,
  type OperationalOverview,
  type PortSplitRow,
  type ReportPeriod,
  type ReportShipment,
  type RouteRow,
  type ServiceRow,
  type TransitByPortRow,
} from "./types";
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
