/**
 * Queries puras del módulo Nómina · Empleados (SDD-0103 · Slice A).
 *
 * Funciones `(supabase: SupabaseClient) => Promise<T>` consumidas desde
 * `app/studio/(app)/nomina/page.tsx`. La RLS filtra por tenant Y rol
 * (admin/accounting) — un caller sin rol no recibe filas (no error). El sueldo
 * `numeric` llega como string → se coerce a number con `num()`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { num, type Employee } from "./employee-types";

const EMPLOYEE_COLUMNS =
  "id, tenant_id, employee_code, full_name, national_id, position_label, " +
  "department, position_id, phone, email, salary_usd, hire_date, birth_date, bank_name, " +
  "bank_account_type, bank_account, status, notes, created_by, created_at, " +
  "updated_at, deleted_at, auth_user_id";

/** Coacciona la fila cruda (numeric→number) a Employee tipado. */
function rowToEmployee(row: Record<string, unknown>): Employee {
  return {
    ...(row as Employee),
    salary_usd: num(row.salary_usd),
    auth_user_id: (row.auth_user_id as string | null | undefined) ?? null,
  };
}

/** Lista los empleados vivos del tenant: activos primero, luego por nombre. */
export async function listEmployees(
  supabase: SupabaseClient,
): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("nomina_employees")
    .select(EMPLOYEE_COLUMNS)
    .is("deleted_at", null)
    .order("status", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[listEmployees]", error.message);
    return [];
  }
  return (data ?? []).map((r) =>
    rowToEmployee(r as unknown as Record<string, unknown>),
  );
}

/** Un empleado por id (o null). */
export async function getEmployee(
  supabase: SupabaseClient,
  id: string,
): Promise<Employee | null> {
  const { data, error } = await supabase
    .from("nomina_employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getEmployee]", error.message);
    return null;
  }
  return data ? rowToEmployee(data as unknown as Record<string, unknown>) : null;
}

/** Resultado de buscar una ficha: un error de lectura no es «no existe» (SDD-0652). */
export type EmployeeLookup =
  | { kind: "found"; employee: Employee }
  | { kind: "not_found" }
  | { kind: "error" };

/** `EMP-` y de 1 a 9 dígitos (`next_employee_code` rellena a 4). Se prueba en `employee-queries.test.ts`. */
const EMPLOYEE_CODE_RE = /^EMP-[0-9]{1,9}$/;

/**
 * Una ficha por código `EMP-NNNN` **en el tenant dado** (SDD-0652 F1).
 *
 * El tenant lo pone quien llama, después de comprobar el rol en el servidor
 * (`getFichaEmpleadoAccess`): no se confía solo en la RLS, porque la lectura
 * propia de 0181 deja a cualquier usuario enlazado leer su propia ficha.
 */
export async function getEmployeeByCode(
  supabase: SupabaseClient,
  tenantId: string,
  code: string,
): Promise<EmployeeLookup> {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (!EMPLOYEE_CODE_RE.test(normalized)) return { kind: "not_found" };

  const { data, error } = await supabase
    .from("nomina_employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("employee_code", normalized)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getEmployeeByCode]", error.message);
    return { kind: "error" };
  }
  if (!data) return { kind: "not_found" };
  return { kind: "found", employee: rowToEmployee(data as unknown as Record<string, unknown>) };
}
