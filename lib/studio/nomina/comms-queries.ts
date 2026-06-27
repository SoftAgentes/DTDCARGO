/**
 * Queries puras del módulo Nómina · Comunicaciones al empleado (SDD-0113 Slice B).
 * Funciones `(supabase: SupabaseClient, ...) => Promise<T>`.
 *
 * Doble lado de RLS (0181): el ADMIN lista/crea/soft-delete por tenant+rol; el
 * EMPLEADO dueño lee y marca read_at/acked_at solo de los suyos. Estas funciones
 * NO deciden el lado — la RLS lo hace según la sesión. Las del empleado se usan
 * con su sesión; las del admin con la sesión Studio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeComm } from "./comms-types";

const COMM_COLUMNS =
  "id, tenant_id, employee_id, type, title, body, ref_kind, ref_id, " +
  "requires_ack, read_at, acked_at, created_by, created_at, updated_at, deleted_at";

/**
 * Comunicaciones de UN empleado (más recientes primero). Sirve para:
 *  - el ADMIN (pasa employeeId, RLS lo acota al tenant) → ver acuses.
 *  - el EMPLEADO (la RLS self-read ya lo acota a los suyos; employeeId es
 *    redundante pero defensivo).
 */
export async function listCommsForEmployee(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<EmployeeComm[]> {
  const { data, error } = await supabase
    .from("nomina_employee_comms")
    .select(COMM_COLUMNS)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listCommsForEmployee]", error.message);
    return [];
  }
  return (data ?? []) as unknown as EmployeeComm[];
}

/**
 * MIS comunicaciones (app del empleado). NO filtra por employee_id en el cliente:
 * la RLS self-read (employee_id = get_employee_id_for_user()) ya lo acota — un
 * empleado NUNCA ve las de otro aunque manipule el request.
 */
export async function listMyComms(
  supabase: SupabaseClient,
): Promise<EmployeeComm[]> {
  const { data, error } = await supabase
    .from("nomina_employee_comms")
    .select(COMM_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listMyComms]", error.message);
    return [];
  }
  return (data ?? []) as unknown as EmployeeComm[];
}

/**
 * TODAS las comunicaciones del tenant (lado ADMIN: ver acuses). La RLS admin
 * (nomina_can_access) las acota al tenant + rol. Más recientes primero.
 */
export async function listAllComms(
  supabase: SupabaseClient,
): Promise<EmployeeComm[]> {
  const { data, error } = await supabase
    .from("nomina_employee_comms")
    .select(COMM_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[listAllComms]", error.message);
    return [];
  }
  return (data ?? []) as unknown as EmployeeComm[];
}

/** Un comm por id (la RLS decide si el caller puede verlo). */
export async function getComm(
  supabase: SupabaseClient,
  commId: string,
): Promise<EmployeeComm | null> {
  const { data, error } = await supabase
    .from("nomina_employee_comms")
    .select(COMM_COLUMNS)
    .eq("id", commId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getComm]", error.message);
    return null;
  }
  return (data as unknown as EmployeeComm) ?? null;
}

/** Cuántas comunicaciones del empleado faltan por confirmar (banner/badge). */
export async function countPendingAck(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("nomina_employee_comms")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("requires_ack", true)
    .is("acked_at", null);

  if (error) {
    console.error("[countPendingAck]", error.message);
    return 0;
  }
  return count ?? 0;
}
