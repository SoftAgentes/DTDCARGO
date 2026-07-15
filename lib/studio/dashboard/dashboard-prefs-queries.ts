/**
 * Queries de persistencia del dashboard configurable (SDD-0114 · Slice A).
 *
 * Funciones puras `(supabase, …) => Promise<T>`. La RLS de `user_dashboard_prefs`
 * ya restringe a la fila del propio usuario dentro de su tenant, así que acá NO
 * hace falta re-filtrar por user_id/tenant (defensa en profundidad la da la DB).
 *
 * `getDashboardConfig` devuelve el jsonb CRUDO (o null si el usuario no tiene fila
 * todavía). La normalización + filtro RBAC vive en la Server Action / page vía
 * `validateDashboardConfigInput` — así el catálogo puede evolucionar sin migrar
 * datos: ids viejos en el jsonb se descartan al leer, no rompen nada.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Config cruda del usuario (jsonb) o null si no tiene fila. NUNCA lanza:
 * ante error de DB devuelve null → el caller cae al default filtrado.
 */
export async function getDashboardConfig(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("user_dashboard_prefs")
    .select("config")
    .eq("user_id", userId)
    .maybeSingle<{ config: Record<string, unknown> | null }>();

  if (error) {
    console.error("[getDashboardConfig]", error.message);
    return null;
  }
  return data?.config ?? null;
}
