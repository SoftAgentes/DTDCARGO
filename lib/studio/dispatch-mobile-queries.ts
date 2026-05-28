/**
 * Queries server-side de las apps móviles del Despacho (SDD-0030).
 * Llamadas con admin client (service_role) desde server components
 * porque el operario no tiene auth.uid().
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DispatchOrderRow,
  DispatchOrderStatus,
} from "./dispatch-types";

const OD_WITH_JOINS_SELECT = `
  id, tenant_id, order_code, status, hub,
  route_id, truck_id, driver_id,
  capacity_kg_snapshot, capacity_cbm_snapshot,
  total_kg, total_cbm, package_count, cities_ordered,
  created_at, updated_at, departed_at, completed_at, closed_at,
  cancelled_at, reassigned_at,
  progress_pct, current_city,
  cancel_reason, parent_od_id,
  created_by, updated_by, cancelled_by,
  route:dispatch_routes!route_id ( id, route_code, name ),
  truck:tms_trucks!truck_id ( id, plate, brand ),
  driver:tms_drivers!driver_id ( id, name, rating ),
  packages:dispatch_order_packages ( * )
`;

// ─────────────────────────────────────────────────────────────
// Bodeguero · OD del hub donde opera
// ─────────────────────────────────────────────────────────────

/**
 * Lista ODs activas del tenant en estados creada/cargando/lista.
 * El admin asigna las ODs a un hub específico (dispatch_orders.hub);
 * el bodeguero ve todas las del tenant porque no hay FK explícito
 * operario→hub VE todavía.
 *
 * V2: agregar campo `default_hub` a `operario_pins` y filtrar por eso.
 */
export async function listOdsForBodeguero(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<DispatchOrderRow[]> {
  const { data, error } = await supabase
    .from("dispatch_orders")
    .select(OD_WITH_JOINS_SELECT)
    .eq("tenant_id", tenantId)
    .in("status", ["creada", "cargando", "lista"])
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw error;
  return normalizeOdRows(data);
}

// ─────────────────────────────────────────────────────────────
// Camionero · OD asignadas al chofer (Sprint 0 fix: link explícito)
// ─────────────────────────────────────────────────────────────

/**
 * Devuelve ODs `lista` o `en_ruta` asignadas al driver linkeado al
 * operario via `operario_pins.tms_driver_id` (migración 0060).
 *
 * Sprint 0 fix: reemplaza el match por nombre (`.ilike("name", ...)`)
 * que era anti-pattern de seguridad — homónimos veían ODs cruzadas.
 * Ahora es FK explícito: cada operario camionero tiene su driver TMS
 * linkeado al crearse en el Studio admin.
 *
 * Si `tmsDriverId` es null (operario sin link todavía), devuelve []
 * — UI muestra empty state con mensaje claro.
 */
export async function listOdsForCamionero(
  supabase: SupabaseClient,
  tenantId: string,
  tmsDriverId: string | null,
): Promise<DispatchOrderRow[]> {
  if (!tmsDriverId) return [];

  const { data, error } = await supabase
    .from("dispatch_orders")
    .select(OD_WITH_JOINS_SELECT)
    .eq("tenant_id", tenantId)
    .in("status", ["lista", "en_ruta"])
    .eq("driver_id", tmsDriverId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return normalizeOdRows(data);
}

// ─────────────────────────────────────────────────────────────
// Counts para badges del home
// ─────────────────────────────────────────────────────────────

export async function countOdsForBodegueroByStatus(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<Record<DispatchOrderStatus, number>> {
  const { data, error } = await supabase
    .from("dispatch_orders")
    .select("status")
    .eq("tenant_id", tenantId)
    .in("status", ["creada", "cargando", "lista"]);
  if (error) throw error;

  const map: Record<DispatchOrderStatus, number> = {
    creada: 0, cargando: 0, lista: 0,
    en_ruta: 0, entregada: 0, cerrada: 0, cancelada: 0,
  };
  for (const r of (data as { status: DispatchOrderStatus }[] | null) ?? []) {
    map[r.status] += 1;
  }
  return map;
}

// ─────────────────────────────────────────────────────────────
// Normalizer (Supabase array-vs-object en joins)
// ─────────────────────────────────────────────────────────────

function normalizeOdRows(raw: unknown): DispatchOrderRow[] {
  const arr = (raw as unknown[]) ?? [];
  return arr.map((r) => {
    const row = r as DispatchOrderRow & {
      route: unknown;
      truck: unknown;
      driver: unknown;
      packages: unknown;
    };
    return {
      ...row,
      route: Array.isArray(row.route) ? row.route[0] ?? null : (row.route as DispatchOrderRow["route"]),
      truck: Array.isArray(row.truck) ? row.truck[0] ?? null : (row.truck as DispatchOrderRow["truck"]),
      driver: Array.isArray(row.driver) ? row.driver[0] ?? null : (row.driver as DispatchOrderRow["driver"]),
      packages: Array.isArray(row.packages) ? (row.packages as DispatchOrderRow["packages"]) : [],
    };
  });
}
