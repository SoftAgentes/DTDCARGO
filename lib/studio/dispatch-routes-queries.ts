/**
 * Queries de rutas + catálogo de ciudades (SDD-0029 §3.7).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchRoute, DispatchCity } from "./dispatch-routes-types";
import type { VeLocalityEntry } from "./ve-catalog-types";

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

const ROUTE_COLUMNS =
  "id, tenant_id, route_code, name, route_type, hub, origin_city, destination_city, intermediate_cities, sla_hours, active, notes, created_by, updated_by, created_at, updated_at, deleted_at";

export async function listRoutes(
  supabase: SupabaseClient,
  opts: { activeOnly?: boolean } = {},
): Promise<DispatchRoute[]> {
  let query = supabase
    .from("dispatch_routes")
    .select(ROUTE_COLUMNS)
    .is("deleted_at", null)
    .order("hub", { ascending: true })
    .order("name", { ascending: true })
    .limit(200);

  if (opts.activeOnly !== false) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data as DispatchRoute[] | null) ?? [];
}

export async function getRoute(
  supabase: SupabaseClient,
  id: string,
): Promise<DispatchRoute | null> {
  const { data, error } = await supabase
    .from("dispatch_routes")
    .select(ROUTE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as DispatchRoute | null) ?? null;
}

// ─────────────────────────────────────────────────────────────
// Cities (per-tenant)
// ─────────────────────────────────────────────────────────────

const CITY_COLUMNS =
  "id, tenant_id, state_code, state_name, municipio, city, postal_code, default_radius_km, is_hq, active, usage_count, created_at, updated_at";

export async function listCities(
  supabase: SupabaseClient,
  opts: { activeOnly?: boolean; stateCode?: string } = {},
): Promise<DispatchCity[]> {
  let query = supabase
    .from("dispatch_city_catalog")
    .select(CITY_COLUMNS)
    .order("state_name", { ascending: true })
    .order("city", { ascending: true })
    .limit(500);

  if (opts.activeOnly !== false) query = query.eq("active", true);
  if (opts.stateCode) query = query.eq("state_code", opts.stateCode);

  const { data, error } = await query;
  if (error) throw error;
  return (data as DispatchCity[] | null) ?? [];
}

export async function countCities(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("dispatch_city_catalog")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────
// VE locality catalog (público, sin RLS)
// ─────────────────────────────────────────────────────────────

export async function listVeLocalityCatalog(
  supabase: SupabaseClient,
): Promise<VeLocalityEntry[]> {
  const { data, error } = await supabase
    .from("ve_locality_catalog")
    .select("*")
    .order("state_name", { ascending: true })
    .order("city", { ascending: true });
  if (error) throw error;
  return (data as VeLocalityEntry[] | null) ?? [];
}
