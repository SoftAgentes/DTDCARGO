/**
 * Queries puras del módulo Nómina · Amonestaciones (SDD-0103 · Slice C).
 *
 * Funciones `(supabase: SupabaseClient) => Promise<T>` consumidas desde
 * `app/studio/(app)/nomina/page.tsx`. La RLS filtra por tenant Y rol
 * (admin/accounting): un caller sin rol no recibe filas (no error).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Warning } from "./warning-types";

const WARNING_COLUMNS =
  "id, tenant_id, employee_id, warning_code, issued_on, cause, narrative, " +
  "witnesses, severity, status, notes, created_by, created_at, updated_at, deleted_at";

/** Lista las amonestaciones vivas del tenant, más recientes primero. */
export async function listWarnings(
  supabase: SupabaseClient,
  limit = 200,
): Promise<Warning[]> {
  const { data, error } = await supabase
    .from("nomina_warnings")
    .select(WARNING_COLUMNS)
    .is("deleted_at", null)
    .order("issued_on", { ascending: false })
    .order("warning_code", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[listWarnings]", error.message);
    return [];
  }
  return (data ?? []) as unknown as Warning[];
}

/** Una amonestación por id (o null). */
export async function getWarning(
  supabase: SupabaseClient,
  id: string,
): Promise<Warning | null> {
  const { data, error } = await supabase
    .from("nomina_warnings")
    .select(WARNING_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getWarning]", error.message);
    return null;
  }
  return data ? (data as unknown as Warning) : null;
}
