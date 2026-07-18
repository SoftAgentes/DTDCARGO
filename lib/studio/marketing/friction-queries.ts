/**
 * Queries server-side de "Reportar fricción" (SDD-0119 Slice 1 · módulo
 * Marketing). Función pura: recibe un SupabaseClient (server-side, con
 * cookies del user logueado) y devuelve data tipada. RLS filtra por tenant +
 * acceso al módulo (ver 0234_marketing_friction_reports.sql); el `.eq`
 * explícito es defensa en profundidad + aprovecha el índice
 * (tenant_id, status, created_at desc).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingDbObject } from "@/lib/studio/db-errors";
import type { FrictionReport } from "./friction-types";

const FRICTION_COLUMNS =
  "id, tenant_id, reporter_user_id, title, description, status, " +
  "resolved_at, resolved_by, created_at, updated_at";

/**
 * Lista los reportes de fricción del tenant (bandeja del módulo Marketing).
 * Orden: abiertos/en revisión primero (más recientes arriba), resueltos al
 * final — así la bandeja prioriza lo pendiente sin esconder el historial.
 */
export async function listFrictionReports(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<FrictionReport[]> {
  const { data, error } = await supabase
    .from("marketing_friction_reports")
    .select(FRICTION_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  // La migr 0234 se aplica a mano → si todavía no está, la bandeja degrada a
  // vacía en vez de tumbar /studio/marketing con un 500 (el módulo entero vive
  // en esa ruta). Cualquier otro error sí se propaga: es un bug real.
  if (error) {
    if (isMissingDbObject(error)) {
      console.error(
        "[listFrictionReports] marketing_friction_reports no existe (¿migr 0234 sin aplicar?) — degradando a vacío:",
        error.message,
      );
      return [];
    }
    throw error;
  }
  const rows = (data as unknown as FrictionReport[] | null) ?? [];

  return [...rows].sort((a, b) => {
    const rank = (s: FrictionReport["status"]) => (s === "resolved" ? 1 : 0);
    const rankDiff = rank(a.status) - rank(b.status);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
