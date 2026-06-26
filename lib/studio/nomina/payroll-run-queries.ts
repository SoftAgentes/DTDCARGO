/**
 * Queries puras del módulo Nómina · Corte del período (SDD-0103 · Slice motor —
 * ESTRUCTURA). Funciones `(supabase: SupabaseClient, ...) => Promise<T>`
 * consumidas desde `page.tsx` y las server actions.
 *
 * La RLS filtra por tenant Y rol (admin/accounting): un caller sin rol no recibe
 * filas. Los `numeric` llegan como string → se coercen con `num()`.
 *
 * Incluye los LECTORES que el generador del corte necesita:
 *  - asistencia agregada por empleado en el rango [start, end] del corte.
 *  - préstamos activos con saldo vivo por empleado (reusa listLoansWithBalance).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { num } from "./employee-types";
import {
  type PayrollRun,
  type PayrollRunLine,
  type ReciboBreakdownRow,
} from "./payroll-run-types";
import { listLoansWithBalance } from "./loan-queries";
import type { LoanWithBalance } from "./loan-types";

const RUN_COLUMNS =
  "id, tenant_id, period_label, period_start, period_end, pay_frequency, " +
  "day_method, rules_snapshot, status, total_gross_usd, total_deductions_usd, " +
  "total_net_usd, notes, created_by, confirmed_at, paid_at, created_at, " +
  "updated_at, deleted_at";

const LINE_COLUMNS =
  "id, tenant_id, run_id, employee_id, employee_code, employee_name, " +
  "base_salary_usd, worked_days, overtime_hours, night_hours, overtime_pay_usd, " +
  "night_pay_usd, loan_deduction_usd, statutory_deductions_usd, gross_usd, " +
  "total_deductions_usd, net_usd, breakdown, created_at, updated_at";

function rowToRun(row: Record<string, unknown>): PayrollRun {
  return {
    ...(row as PayrollRun),
    total_gross_usd: num(row.total_gross_usd),
    total_deductions_usd: num(row.total_deductions_usd),
    total_net_usd: num(row.total_net_usd),
    rules_snapshot:
      row.rules_snapshot && typeof row.rules_snapshot === "object"
        ? (row.rules_snapshot as Record<string, unknown>)
        : {},
  };
}

function rowToLine(row: Record<string, unknown>): PayrollRunLine {
  const bd = row.breakdown;
  return {
    ...(row as PayrollRunLine),
    base_salary_usd: num(row.base_salary_usd),
    worked_days: Math.trunc(num(row.worked_days)),
    overtime_hours: num(row.overtime_hours),
    night_hours: num(row.night_hours),
    overtime_pay_usd: num(row.overtime_pay_usd),
    night_pay_usd: num(row.night_pay_usd),
    loan_deduction_usd: num(row.loan_deduction_usd),
    statutory_deductions_usd: num(row.statutory_deductions_usd),
    gross_usd: num(row.gross_usd),
    total_deductions_usd: num(row.total_deductions_usd),
    net_usd: num(row.net_usd),
    breakdown: Array.isArray(bd) ? (bd as ReciboBreakdownRow[]) : [],
  };
}

/** Cortes vivos del tenant, más recientes primero. */
export async function listPayrollRuns(
  supabase: SupabaseClient,
): Promise<PayrollRun[]> {
  const { data, error } = await supabase
    .from("nomina_payroll_runs")
    .select(RUN_COLUMNS)
    .is("deleted_at", null)
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listPayrollRuns]", error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToRun(r as unknown as Record<string, unknown>));
}

/** Un corte por id (o null). */
export async function getPayrollRun(
  supabase: SupabaseClient,
  id: string,
): Promise<PayrollRun | null> {
  const { data, error } = await supabase
    .from("nomina_payroll_runs")
    .select(RUN_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getPayrollRun]", error.message);
    return null;
  }
  return data ? rowToRun(data as unknown as Record<string, unknown>) : null;
}

/** ¿Hay ya un corte vivo (no anulado) para el período? (evita duplicar). */
export async function findLivePayrollRunForPeriod(
  supabase: SupabaseClient,
  periodLabel: string,
): Promise<PayrollRun | null> {
  const { data, error } = await supabase
    .from("nomina_payroll_runs")
    .select(RUN_COLUMNS)
    .eq("period_label", periodLabel)
    .neq("status", "anulado")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[findLivePayrollRunForPeriod]", error.message);
    return null;
  }
  return data ? rowToRun(data as unknown as Record<string, unknown>) : null;
}

/** Renglones (recibos) de un corte. */
export async function listPayrollRunLines(
  supabase: SupabaseClient,
  runId: string,
): Promise<PayrollRunLine[]> {
  const { data, error } = await supabase
    .from("nomina_payroll_run_lines")
    .select(LINE_COLUMNS)
    .eq("run_id", runId)
    .order("employee_name", { ascending: true });

  if (error) {
    console.error("[listPayrollRunLines]", error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToLine(r as unknown as Record<string, unknown>));
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Lectores que el GENERADOR necesita                         ║
// ╚═══════════════════════════════════════════════════════════╝
export type AggregatedAttendance = {
  worked_days: number;
  overtime_hours: number;
  night_hours: number;
};

/**
 * Asistencia AGREGADA por empleado en el rango [start, end] (inclusive). Suma
 * días trabajados + feriados (cuentan como base) y las horas extra/nocturnas.
 * Devuelve un Map employee_id → agregado. La RLS ya filtra por tenant+rol.
 */
export async function aggregateAttendanceByEmployee(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<Map<string, AggregatedAttendance>> {
  const { data, error } = await supabase
    .from("nomina_attendance")
    .select("employee_id, status, overtime_hours, night_hours")
    .is("deleted_at", null)
    .gte("work_date", startIso)
    .lte("work_date", endIso);

  const map = new Map<string, AggregatedAttendance>();
  if (error) {
    console.error("[aggregateAttendanceByEmployee]", error.message);
    return map;
  }
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const id = String(row.employee_id);
    const agg = map.get(id) ?? { worked_days: 0, overtime_hours: 0, night_hours: 0 };
    const status = String(row.status);
    // 'trabajado' y 'feriado' cuentan como día con derecho a pago; 'ausente' y
    // 'libre' no suman día trabajado (advisory; el contador puede afinar).
    if (status === "trabajado" || status === "feriado") agg.worked_days += 1;
    agg.overtime_hours += num(row.overtime_hours);
    agg.night_hours += num(row.night_hours);
    map.set(id, agg);
  }
  return map;
}

/**
 * Préstamo ACTIVO con saldo vivo por empleado (Map employee_id → préstamo).
 * Reusa listLoansWithBalance. Si un empleado tiene más de un préstamo activo,
 * se toma el primero (advisory; el motor descuenta una cuota por recibo).
 */
export async function activeLoanByEmployee(
  supabase: SupabaseClient,
  employees: { id: string; full_name: string; employee_code: string }[],
): Promise<Map<string, LoanWithBalance>> {
  const loans = await listLoansWithBalance(supabase, employees);
  const map = new Map<string, LoanWithBalance>();
  for (const l of loans) {
    if (l.status !== "activo" || l.balance_usd <= 0) continue;
    if (!map.has(l.employee_id)) map.set(l.employee_id, l);
  }
  return map;
}
