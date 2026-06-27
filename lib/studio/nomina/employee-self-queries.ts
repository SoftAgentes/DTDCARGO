/**
 * Lecturas acotadas al PROPIO empleado (SDD-0113 Slice C · app /m/emp).
 * Todo lo que el empleado ve de sí mismo: su ficha, su recibo del período, sus
 * comunicaciones, el estado de su cambio bancario.
 *
 * Acotamiento: NO se abre la RLS admin de las tablas de nómina. El empleado lee
 * su ficha vía la policy self-read (nomina_employees, 0181) y su recibo vía la
 * RPC get_my_payslip (0182, SECURITY DEFINER, solo SU renglón confirmado/pagado).
 * Un empleado NUNCA obtiene la ficha/recibo de otro aunque manipule el request.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Mi ficha (subconjunto seguro para mostrar; el sueldo se ve, no se edita) ──
export type MyEmployee = {
  id: string;
  employee_code: string;
  full_name: string;
  national_id: string | null;
  position_label: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  salary_usd: number;
  hire_date: string | null;
  bank_name: string | null;
  bank_account_type: string | null;
  bank_account: string | null;
  status: string;
};

const MY_EMPLOYEE_COLUMNS =
  "id, employee_code, full_name, national_id, position_label, department, " +
  "phone, email, salary_usd, hire_date, bank_name, bank_account_type, bank_account, status";

/**
 * Mi ficha. La RLS self-read (id = get_employee_id_for_user()) la acota; el
 * .single() devuelve null si el usuario no tiene ficha enlazada → la app redirige.
 */
export async function getMyEmployee(
  supabase: SupabaseClient,
): Promise<MyEmployee | null> {
  const { data, error } = await supabase
    .from("nomina_employees")
    .select(MY_EMPLOYEE_COLUMNS)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getMyEmployee]", error.message);
    return null;
  }
  return (data as unknown as MyEmployee) ?? null;
}

// ── Mi recibo del período (RPC fail-closed) ──
export type MyPayslip = {
  line_id: string;
  run_id: string;
  period_label: string;
  run_status: string;
  paid_at: string | null;
  confirmed_at: string | null;
  employee_code: string | null;
  employee_name: string | null;
  base_salary_usd: number;
  worked_days: number;
  overtime_hours: number;
  night_hours: number;
  overtime_pay_usd: number;
  night_pay_usd: number;
  loan_deduction_usd: number;
  statutory_deductions_usd: number;
  gross_usd: number;
  total_deductions_usd: number;
  net_usd: number;
  breakdown: Array<{ label: string; amount?: number; note?: string }>;
};

/**
 * Mi recibo del período (o el más reciente si period es null). Vía RPC
 * get_my_payslip (SECURITY DEFINER): SOLO mi renglón, SOLO confirmado/pagado.
 * Un borrador advisory NO se devuelve.
 */
export async function getMyPayslip(
  supabase: SupabaseClient,
  period: string | null,
): Promise<MyPayslip | null> {
  const { data, error } = await supabase.rpc("get_my_payslip", { p_period: period });
  if (error) {
    console.error("[getMyPayslip]", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as MyPayslip | undefined) ?? null;
}

export type MyPayslipPeriod = {
  period_label: string;
  run_status: string;
  period_end: string;
};

/** Mis períodos con recibo confirmado/pagado (selector). */
export async function getMyPayslipPeriods(
  supabase: SupabaseClient,
): Promise<MyPayslipPeriod[]> {
  const { data, error } = await supabase.rpc("get_my_payslip_periods");
  if (error) {
    console.error("[getMyPayslipPeriods]", error.message);
    return [];
  }
  return (data ?? []) as MyPayslipPeriod[];
}

// ── Mi cambio bancario pendiente (estado) ──
export type MyBankChange = {
  id: string;
  bank_name: string | null;
  bank_account_type: string | null;
  bank_account: string | null;
  status: string;
  requested_at: string;
  rejection_reason: string | null;
};

/** Mi solicitud de cambio bancario PENDIENTE (si existe). */
export async function getMyPendingBankChange(
  supabase: SupabaseClient,
): Promise<MyBankChange | null> {
  const { data, error } = await supabase
    .from("nomina_employee_bank_changes")
    .select("id, bank_name, bank_account_type, bank_account, status, requested_at, rejection_reason")
    .eq("status", "pendiente")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getMyPendingBankChange]", error.message);
    return null;
  }
  return (data as unknown as MyBankChange) ?? null;
}
