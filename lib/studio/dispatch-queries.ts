/**
 * Queries del módulo Despacho (SDD-0029).
 * RLS por tenant en las 5 tablas privadas.
 * Catálogo VE público sin RLS.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DispatchHub,
  DispatchOrder,
  DispatchOrderRow,
  DispatchOrderStatus,
  DispatchPackageKind,
  DispatchPaymentStatus,
  EligiblePackage,
  DispatchFilters,
} from "./dispatch-types";

// ─────────────────────────────────────────────────────────────
// Select strings reusables
// ─────────────────────────────────────────────────────────────

const OD_COLUMNS = `
  id, tenant_id, order_code, status, hub,
  route_id, truck_id, driver_id,
  capacity_kg_snapshot, capacity_cbm_snapshot,
  total_kg, total_cbm, package_count, cities_ordered,
  created_at, updated_at, departed_at, completed_at, closed_at,
  cancelled_at, reassigned_at,
  progress_pct, current_city,
  cancel_reason, parent_od_id,
  created_by, updated_by, cancelled_by
`;

const OD_WITH_JOINS_SELECT = `
  ${OD_COLUMNS},
  route:dispatch_routes!route_id ( id, route_code, name ),
  truck:tms_trucks!truck_id ( id, plate, brand ),
  driver:tms_drivers!driver_id ( id, name, rating ),
  packages:dispatch_order_packages ( * )
`;

// ─────────────────────────────────────────────────────────────
// listDispatchOrders + filters
// ─────────────────────────────────────────────────────────────

export async function listDispatchOrders(
  supabase: SupabaseClient,
  filters: DispatchFilters = {},
): Promise<DispatchOrderRow[]> {
  let query = supabase
    .from("dispatch_orders")
    .select(OD_WITH_JOINS_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.hub && filters.hub !== "all") query = query.eq("hub", filters.hub);

  if (filters.status === "active") {
    query = query.not("status", "in", "(cerrada,cancelada)");
  } else if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return normalizeOdRows(data);
}

export async function listActiveDispatchOrders(
  supabase: SupabaseClient,
): Promise<DispatchOrderRow[]> {
  return listDispatchOrders(supabase, { status: "active" });
}

export async function listDispatchOrdersForHub(
  supabase: SupabaseClient,
  hub: DispatchHub,
): Promise<DispatchOrderRow[]> {
  return listDispatchOrders(supabase, { hub, status: "active" });
}

export async function getDispatchOrder(
  supabase: SupabaseClient,
  id: string,
): Promise<DispatchOrderRow | null> {
  const { data, error } = await supabase
    .from("dispatch_orders")
    .select(OD_WITH_JOINS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizeOdRow(data);
}

export async function getDispatchOrderByCode(
  supabase: SupabaseClient,
  orderCode: string,
): Promise<DispatchOrderRow | null> {
  const { data, error } = await supabase
    .from("dispatch_orders")
    .select(OD_WITH_JOINS_SELECT)
    .eq("order_code", orderCode)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizeOdRow(data);
}

// ─────────────────────────────────────────────────────────────
// listEligiblePackages — proyección de warehouse_receipts_cn
// ─────────────────────────────────────────────────────────────

/**
 * Devuelve los paquetes que se pueden incluir en una OD nueva.
 * Source: warehouse_receipts_cn con status='received' y NOT in dispatch_order_packages.
 *
 * NOTA Fase 1: source solo warehouse_receipts_cn. En SDD-0030 se extiende
 * a warehouse_receipts_ve cuando esté portado.
 *
 * SCHEMA DRIFT (2026-05-27): el SDD-0029 spec original asumía columnas
 * `markbox`, `weight_kg`, `cbm`, `destination_city`, `payment_status`,
 * `hs_code`, `aes_code` en warehouse_receipts_cn. SDD-0027/0028 (PWA
 * operario CN · Wang Hua) rediseñó la tabla y nadie sincronizó este query.
 *
 * Schema actual:
 *   - markbox          → client_markbox (rename)
 *   - weight_kg        → total_weight_kg (rename)
 *   - cbm              → total_cbm (rename)
 *   - destination_city → no existe en NINGUNA tabla (operario CN no captura)
 *   - payment_status   → no existe (pertenece a cobranza, no al receipt)
 *   - hs_code/aes_code → no existen en este schema
 *
 * Fix mínimo viable: defaults razonables ("—" y "pendiente") para los
 * campos que no podemos resolver. TODO enriquecer cuando founder decida
 * approach (a · agregar columnas o b · resolver via JOINs futuras).
 */
export async function listEligiblePackages(
  supabase: SupabaseClient,
  _opts: { hub?: DispatchHub; city?: string } = {},
): Promise<EligiblePackage[]> {
  // 1. Traer receipts CN status='received', no orphan, no deleted
  // opts.city es no-op por ahora (city no existe en schema)
  void _opts;
  const query = supabase
    .from("warehouse_receipts_cn")
    .select(
      "id, client_markbox, client_name, description, boxes, total_weight_kg, total_cbm, received_at",
    )
    // SCHEMA DRIFT (2026-05-27): el enum warehouse_receipt_status real es
    // {pendiente_consolidacion, consolidado, incidencia} · NO existe 'received'
    // que el SDD-0029 asumía. 'consolidado' significa paquete listo para
    // despacho (ya empacado/preparado).
    .eq("status", "consolidado")
    .eq("is_orphan", false)
    .is("deleted_at", null)
    .order("received_at", { ascending: true })
    .limit(500);

  const { data: receipts, error } = await query;
  if (error) throw error;

  type Receipt = {
    id: string;
    client_markbox: string;
    client_name: string | null;
    description: string | null;
    boxes: number | null;
    total_weight_kg: number | null;
    total_cbm: number | null;
    received_at: string;
  };

  const rows = (receipts as Receipt[] | null) ?? [];
  if (rows.length === 0) return [];

  // 2. Excluir los que ya están en alguna OD activa
  const { data: assigned } = await supabase
    .from("dispatch_order_packages")
    .select("package_id, od_id, od:dispatch_orders!od_id(status)")
    .in("package_id", rows.map((r) => r.id))
    .eq("package_kind", "warehouse_receipt_cn");

  type Assigned = {
    package_id: string;
    od_id: string;
    od: { status: DispatchOrderStatus } | { status: DispatchOrderStatus }[] | null;
  };

  const assignedSet = new Set<string>();
  for (const a of (assigned as Assigned[] | null) ?? []) {
    const odStatus = Array.isArray(a.od) ? a.od[0]?.status : a.od?.status;
    if (odStatus && odStatus !== "cancelada" && odStatus !== "cerrada") {
      assignedSet.add(a.package_id);
    }
  }

  // 3. Proyección runtime con defaults para columnas no resueltas
  const now = Date.now();
  const projected: EligiblePackage[] = rows
    .filter((r) => !assignedSet.has(r.id))
    .map((r) => {
      const received = new Date(r.received_at).getTime();
      const days = Math.max(0, Math.floor((now - received) / (1000 * 60 * 60 * 24)));
      return {
        id: r.id,
        package_kind: "warehouse_receipt_cn" as DispatchPackageKind,
        markbox: r.client_markbox,
        client_name: r.client_name ?? "—",
        city: "—", // TODO: resolver via parseo de clients.address o nueva columna
        pay: "pendiente" as DispatchPaymentStatus, // TODO: resolver via cobranza/invoices
        description: r.description,
        boxes_total: r.boxes ?? 1,
        weight_kg: Number(r.total_weight_kg ?? 0),
        cbm: Number(r.total_cbm ?? 0),
        hs_code: null, // TODO: resolver via paquetes detallados
        aes_code: null, // TODO: resolver via paquetes detallados
        received_at: r.received_at,
        route_proximity: null,
        tier: null,
        days_in_warehouse: days,
        score: 0, // se calcula con dispatch-scoring.ts en el page
      };
    });

  return projected;
}

// ─────────────────────────────────────────────────────────────
// KPIs del Despacho
// ─────────────────────────────────────────────────────────────

export type DispatchKpis = {
  packagesInQueue: number;
  activeOds: number;
  todayCreated: number;
  todayCompleted: number;
  avgCapacityUsagePct: number;
  cancelledThisWeek: number;
};

export async function computeDispatchKpis(
  supabase: SupabaseClient,
): Promise<DispatchKpis> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    queueResult,
    activeOdsResult,
    todayCreatedResult,
    todayCompletedResult,
    cancelledWeekResult,
    activeOdsForCapacity,
  ] = await Promise.all([
    supabase
      .from("warehouse_receipts_cn")
      .select("id", { count: "exact", head: true })
      .eq("status", "received"),
    supabase
      .from("dispatch_orders")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(cerrada,cancelada)"),
    supabase
      .from("dispatch_orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${todayIso}T00:00:00`),
    supabase
      .from("dispatch_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "entregada")
      .gte("completed_at", `${todayIso}T00:00:00`),
    supabase
      .from("dispatch_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelada")
      .gte("cancelled_at", weekAgoIso),
    supabase
      .from("dispatch_orders")
      .select("total_kg, total_cbm, capacity_kg_snapshot, capacity_cbm_snapshot")
      .not("status", "in", "(cerrada,cancelada)")
      .not("capacity_kg_snapshot", "is", null)
      .limit(200),
  ]);

  let avgCapacityUsagePct = 0;
  const capRows =
    (activeOdsForCapacity.data as Array<{
      total_kg: number | null;
      total_cbm: number | null;
      capacity_kg_snapshot: number | null;
      capacity_cbm_snapshot: number | null;
    }> | null) ?? [];
  if (capRows.length > 0) {
    let sum = 0;
    let count = 0;
    for (const r of capRows) {
      const kgPct = r.capacity_kg_snapshot
        ? (Number(r.total_kg ?? 0) / Number(r.capacity_kg_snapshot)) * 100
        : 0;
      const cbmPct = r.capacity_cbm_snapshot
        ? (Number(r.total_cbm ?? 0) / Number(r.capacity_cbm_snapshot)) * 100
        : 0;
      const usage = Math.max(kgPct, cbmPct);
      if (usage > 0) {
        sum += usage;
        count++;
      }
    }
    avgCapacityUsagePct = count > 0 ? Math.round(sum / count) : 0;
  }

  return {
    packagesInQueue: queueResult.count ?? 0,
    activeOds: activeOdsResult.count ?? 0,
    todayCreated: todayCreatedResult.count ?? 0,
    todayCompleted: todayCompletedResult.count ?? 0,
    avgCapacityUsagePct,
    cancelledThisWeek: cancelledWeekResult.count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Dashboard reports queries
// ─────────────────────────────────────────────────────────────

export type DispatchDashboardPeriod = "7d" | "30d" | "90d";

export type DispatchDashboardStats = {
  totalOds: number;
  completed: number;
  ontime: number;
  late: number;
  cancelled: number;
  ontimePct: number;
  avgRouteHours: number | null;
};

export async function computeDispatchDashboardStats(
  supabase: SupabaseClient,
  period: DispatchDashboardPeriod,
): Promise<DispatchDashboardStats> {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("dispatch_orders")
    .select(
      "status, created_at, completed_at, departed_at, route:dispatch_routes!route_id(sla_hours)",
    )
    .gte("created_at", since)
    .limit(2000);

  if (error) throw error;

  type Row = {
    status: DispatchOrderStatus;
    created_at: string;
    completed_at: string | null;
    departed_at: string | null;
    route: { sla_hours: number | null } | { sla_hours: number | null }[] | null;
  };

  const rows = (data as Row[] | null) ?? [];
  let completed = 0;
  let ontime = 0;
  let late = 0;
  let cancelled = 0;
  let sumRouteHours = 0;
  let countRouteHours = 0;

  for (const r of rows) {
    if (r.status === "cancelada") cancelled++;
    if (r.status === "entregada" || r.status === "cerrada") {
      completed++;
      const sla = Array.isArray(r.route) ? r.route[0]?.sla_hours : r.route?.sla_hours;
      if (r.completed_at && r.departed_at) {
        const dep = new Date(r.departed_at).getTime();
        const comp = new Date(r.completed_at).getTime();
        const hours = (comp - dep) / (1000 * 60 * 60);
        sumRouteHours += hours;
        countRouteHours++;
        if (sla != null && hours <= sla) ontime++;
        else if (sla != null) late++;
      }
    }
  }

  return {
    totalOds: rows.length,
    completed,
    ontime,
    late,
    cancelled,
    ontimePct: completed > 0 ? Math.round((ontime / completed) * 100) : 0,
    avgRouteHours: countRouteHours > 0 ? sumRouteHours / countRouteHours : null,
  };
}

export type DispatchRouteRanking = {
  route_id: string;
  route_code: string;
  route_name: string;
  ods: number;
  ontime: number;
  ontime_pct: number;
};

export async function listDispatchRouteRanking(
  supabase: SupabaseClient,
  period: DispatchDashboardPeriod,
): Promise<DispatchRouteRanking[]> {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("dispatch_orders")
    .select(
      "status, departed_at, completed_at, route:dispatch_routes!route_id(id, route_code, name, sla_hours)",
    )
    .gte("created_at", since)
    .not("route_id", "is", null)
    .limit(2000);

  if (error) throw error;

  type Row = {
    status: DispatchOrderStatus;
    departed_at: string | null;
    completed_at: string | null;
    route:
      | { id: string; route_code: string; name: string; sla_hours: number | null }
      | { id: string; route_code: string; name: string; sla_hours: number | null }[]
      | null;
  };

  const map = new Map<string, DispatchRouteRanking & { _sla: number | null }>();
  for (const r of (data as Row[] | null) ?? []) {
    const route = Array.isArray(r.route) ? r.route[0] : r.route;
    if (!route) continue;
    const existing = map.get(route.id) ?? {
      route_id: route.id,
      route_code: route.route_code,
      route_name: route.name,
      ods: 0,
      ontime: 0,
      ontime_pct: 0,
      _sla: route.sla_hours,
    };
    existing.ods += 1;
    if (
      (r.status === "entregada" || r.status === "cerrada") &&
      r.completed_at &&
      r.departed_at &&
      route.sla_hours != null
    ) {
      const hours =
        (new Date(r.completed_at).getTime() - new Date(r.departed_at).getTime()) /
        (1000 * 60 * 60);
      if (hours <= route.sla_hours) existing.ontime += 1;
    }
    map.set(route.id, existing);
  }

  const result: DispatchRouteRanking[] = Array.from(map.values()).map((r) => ({
    route_id: r.route_id,
    route_code: r.route_code,
    route_name: r.route_name,
    ods: r.ods,
    ontime: r.ontime,
    ontime_pct: r.ods > 0 ? Math.round((r.ontime / r.ods) * 100) : 0,
  }));

  result.sort((a, b) => b.ods - a.ods);
  return result.slice(0, 10);
}

export type DispatchTopCity = {
  city: string;
  ods: number;
  kg: number;
  /** Cantidad de paquetes en ODs entregadas que excedieron SLA de la ruta. */
  late: number;
};

export async function listDispatchTopCities(
  supabase: SupabaseClient,
  period: DispatchDashboardPeriod,
): Promise<DispatchTopCity[]> {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("dispatch_order_packages")
    .select(
      "city, weight_kg, boxes_shipped, boxes_total, od:dispatch_orders!od_id(created_at, tenant_id, status, departed_at, completed_at, route:dispatch_routes!route_id(sla_hours))",
    )
    .gte("od.created_at", since)
    .limit(5000);

  if (error) throw error;

  type Row = {
    city: string;
    weight_kg: number;
    boxes_shipped: number;
    boxes_total: number;
    od:
      | {
          created_at: string;
          status: DispatchOrderStatus;
          departed_at: string | null;
          completed_at: string | null;
          route: { sla_hours: number | null } | { sla_hours: number | null }[] | null;
        }
      | {
          created_at: string;
          status: DispatchOrderStatus;
          departed_at: string | null;
          completed_at: string | null;
          route: { sla_hours: number | null } | { sla_hours: number | null }[] | null;
        }[]
      | null;
  };

  const map = new Map<string, DispatchTopCity>();
  for (const r of (data as Row[] | null) ?? []) {
    const existing = map.get(r.city) ?? { city: r.city, ods: 0, kg: 0, late: 0 };
    existing.ods += 1;
    const ratio = r.boxes_shipped / r.boxes_total;
    existing.kg += Number(r.weight_kg ?? 0) * ratio;

    // Calcular si este paquete cayó en una OD entregada tarde
    const od = Array.isArray(r.od) ? r.od[0] : r.od;
    if (
      od &&
      (od.status === "entregada" || od.status === "cerrada") &&
      od.departed_at &&
      od.completed_at
    ) {
      const route = Array.isArray(od.route) ? od.route[0] : od.route;
      const sla = route?.sla_hours;
      if (sla != null) {
        const hours =
          (new Date(od.completed_at).getTime() -
            new Date(od.departed_at).getTime()) /
          (1000 * 60 * 60);
        if (hours > sla) existing.late += 1;
      }
    }

    map.set(r.city, existing);
  }

  const result = Array.from(map.values()).sort((a, b) => b.ods - a.ods).slice(0, 5);
  return result.map((r) => ({ ...r, kg: Math.round(r.kg) }));
}

// ─────────────────────────────────────────────────────────────
// Capacity for a given truck (for the create OD drawer)
// ─────────────────────────────────────────────────────────────

export async function getTruckCapacity(
  supabase: SupabaseClient,
  truckId: string,
): Promise<{ capacity_kg: number; capacity_cbm: number } | null> {
  const { data, error } = await supabase
    .from("tms_trucks")
    .select("capacity_kg, capacity_cbm")
    .eq("id", truckId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    capacity_kg: Number(data.capacity_kg ?? 0),
    capacity_cbm: Number(data.capacity_cbm ?? 0),
  };
}

// ─────────────────────────────────────────────────────────────
// Normalizers (Supabase devuelve relaciones como array si !inner no se usa)
// ─────────────────────────────────────────────────────────────

function normalizeOdRow(raw: unknown): DispatchOrderRow {
  const r = raw as DispatchOrder & {
    route:
      | { id: string; route_code: string; name: string }
      | { id: string; route_code: string; name: string }[]
      | null;
    truck:
      | { id: string; plate: string; brand: string | null }
      | { id: string; plate: string; brand: string | null }[]
      | null;
    driver:
      | { id: string; name: string; rating: number | null }
      | { id: string; name: string; rating: number | null }[]
      | null;
    packages: DispatchOrderRow["packages"];
  };
  return {
    ...r,
    route: Array.isArray(r.route) ? r.route[0] ?? null : r.route,
    truck: Array.isArray(r.truck) ? r.truck[0] ?? null : r.truck,
    driver: Array.isArray(r.driver) ? r.driver[0] ?? null : r.driver,
    packages: r.packages ?? [],
  };
}

function normalizeOdRows(raw: unknown): DispatchOrderRow[] {
  const arr = (raw as unknown[]) ?? [];
  return arr.map(normalizeOdRow);
}
