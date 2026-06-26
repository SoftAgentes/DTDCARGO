/**
 * Queries puras del módulo Nómina · Asistencia + Feriados (SDD-0103 · Slice C).
 *
 * Funciones `(supabase: SupabaseClient, ...) => Promise<T>` consumidas desde
 * `app/studio/(app)/nomina/page.tsx`. La RLS filtra por tenant Y rol
 * (admin/accounting): un caller sin rol no recibe filas (no error). Las horas
 * `numeric` llegan como string → se coercen con `num()`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { num } from "./employee-types";
import type { Attendance, Holiday } from "./attendance-types";

const ATTENDANCE_COLUMNS =
  "id, tenant_id, employee_id, work_date, status, overtime_hours, night_hours, " +
  "notes, created_by, created_at, updated_at, deleted_at";

const HOLIDAY_COLUMNS =
  "id, tenant_id, holiday_date, label, scope, created_by, created_at, " +
  "updated_at, deleted_at";

/** Coacciona la fila cruda (numeric→number) a Attendance tipado. */
function rowToAttendance(row: Record<string, unknown>): Attendance {
  return {
    ...(row as Attendance),
    overtime_hours: num(row.overtime_hours),
    night_hours: num(row.night_hours),
  };
}

/**
 * Lista la asistencia viva del tenant, más reciente primero. Por defecto trae
 * el último tramo (limit) — suficiente para el calendario del mes en la UI.
 */
export async function listAttendance(
  supabase: SupabaseClient,
  limit = 400,
): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from("nomina_attendance")
    .select(ATTENDANCE_COLUMNS)
    .is("deleted_at", null)
    .order("work_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[listAttendance]", error.message);
    return [];
  }
  return (data ?? []).map((r) =>
    rowToAttendance(r as unknown as Record<string, unknown>),
  );
}

/** Un registro de asistencia por id (o null). */
export async function getAttendance(
  supabase: SupabaseClient,
  id: string,
): Promise<Attendance | null> {
  const { data, error } = await supabase
    .from("nomina_attendance")
    .select(ATTENDANCE_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getAttendance]", error.message);
    return null;
  }
  return data ? rowToAttendance(data as unknown as Record<string, unknown>) : null;
}

/** Lista los feriados vivos del tenant, por fecha ascendente. */
export async function listHolidays(
  supabase: SupabaseClient,
  limit = 400,
): Promise<Holiday[]> {
  const { data, error } = await supabase
    .from("nomina_holidays")
    .select(HOLIDAY_COLUMNS)
    .is("deleted_at", null)
    .order("holiday_date", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[listHolidays]", error.message);
    return [];
  }
  return (data ?? []) as unknown as Holiday[];
}
