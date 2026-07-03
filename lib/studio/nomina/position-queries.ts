/**
 * Queries puras del módulo Nómina · Perfiles de puesto (SDD-0140 · Fase 1).
 *
 * Funciones `(supabase: SupabaseClient) => Promise<T>` consumidas desde
 * `app/studio/(app)/nomina/page.tsx`. La RLS filtra por tenant Y rol
 * (admin/accounting) — un caller sin rol no recibe filas (no error).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Position } from "./position-types";

const POSITION_COLUMNS =
  "id, tenant_id, slug, title, area, rbac_role, triggers, responsibilities, " +
  "skills, kpi, owner_note, governance_note, sort_order, active, created_by, " +
  "created_at, updated_at, deleted_at";

/** Lista los perfiles de puesto vivos del tenant: por sort_order, luego título. */
export async function listPositions(
  supabase: SupabaseClient,
): Promise<Position[]> {
  const { data, error } = await supabase
    .from("nomina_positions")
    .select(POSITION_COLUMNS)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("[listPositions]", error.message);
    return [];
  }
  return (data ?? []) as unknown as Position[];
}

/** Un perfil de puesto por id (o null). */
export async function getPosition(
  supabase: SupabaseClient,
  id: string,
): Promise<Position | null> {
  const { data, error } = await supabase
    .from("nomina_positions")
    .select(POSITION_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getPosition]", error.message);
    return null;
  }
  return data ? (data as unknown as Position) : null;
}
