/**
 * Queries puras del módulo Nómina · Liquidación / finiquito (SDD-0109).
 * Funciones `(supabase: SupabaseClient, ...) => Promise<T>` consumidas desde
 * `page.tsx` y las server actions. La RLS filtra por tenant Y rol
 * (admin/accounting). Los `numeric` llegan como string → `num()`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { num } from "./employee-types";
import {
  type Settlement,
  type SettlementLineRow,
  type SettlementLineKind,
} from "./settlement-types";
import { listLoansWithBalance } from "./loan-queries";

const SETTLEMENT_COLUMNS =
  "id, tenant_id, settlement_code, employee_id, employee_code, employee_name, " +
  "termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot, " +
  "status, total_prestaciones_usd, total_fracciones_usd, total_indemnizacion_usd, " +
  "total_intereses_usd, total_deductions_usd, total_net_usd, salario_integral_usd, " +
  "pdf_path, journal_entry_id, confirmed_at, notes, created_by, created_at, " +
  "updated_at, deleted_at";

const LINE_COLUMNS =
  "id, tenant_id, settlement_id, kind, label, days, base_usd, amount_usd, created_at";

function rowToSettlement(row: Record<string, unknown>): Settlement {
  return {
    ...(row as Settlement),
    base_salary_usd: num(row.base_salary_usd),
    total_prestaciones_usd: num(row.total_prestaciones_usd),
    total_fracciones_usd: num(row.total_fracciones_usd),
    total_indemnizacion_usd: num(row.total_indemnizacion_usd),
    total_intereses_usd: num(row.total_intereses_usd),
    total_deductions_usd: num(row.total_deductions_usd),
    total_net_usd: num(row.total_net_usd),
    salario_integral_usd: num(row.salario_integral_usd),
    rules_snapshot:
      row.rules_snapshot && typeof row.rules_snapshot === "object"
        ? (row.rules_snapshot as Record<string, unknown>)
        : {},
  };
}

function rowToLine(row: Record<string, unknown>): SettlementLineRow {
  return {
    ...(row as SettlementLineRow),
    kind: row.kind as SettlementLineKind,
    days: row.days == null ? null : num(row.days),
    base_usd: row.base_usd == null ? null : num(row.base_usd),
    amount_usd: num(row.amount_usd),
  };
}

/** Finiquitos vivos del tenant, más recientes primero. */
export async function listSettlements(
  supabase: SupabaseClient,
): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from("nomina_settlements")
    .select(SETTLEMENT_COLUMNS)
    .is("deleted_at", null)
    .order("termination_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listSettlements]", error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToSettlement(r as unknown as Record<string, unknown>));
}

/** Un finiquito por id (o null). */
export async function getSettlement(
  supabase: SupabaseClient,
  id: string,
): Promise<Settlement | null> {
  const { data, error } = await supabase
    .from("nomina_settlements")
    .select(SETTLEMENT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getSettlement]", error.message);
    return null;
  }
  return data ? rowToSettlement(data as unknown as Record<string, unknown>) : null;
}

/** ¿Hay ya un finiquito vivo (no anulado) para el empleado? (evita duplicar). */
export async function findLiveSettlementForEmployee(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<Settlement | null> {
  const { data, error } = await supabase
    .from("nomina_settlements")
    .select(SETTLEMENT_COLUMNS)
    .eq("employee_id", employeeId)
    .neq("status", "anulado")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[findLiveSettlementForEmployee]", error.message);
    return null;
  }
  return data ? rowToSettlement(data as unknown as Record<string, unknown>) : null;
}

/** Renglones del desglose de un finiquito. */
export async function listSettlementLines(
  supabase: SupabaseClient,
  settlementId: string,
): Promise<SettlementLineRow[]> {
  const { data, error } = await supabase
    .from("nomina_settlement_lines")
    .select(LINE_COLUMNS)
    .eq("settlement_id", settlementId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[listSettlementLines]", error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToLine(r as unknown as Record<string, unknown>));
}

/**
 * Saldo vivo de préstamos de UN empleado (USD). Reusa listLoansWithBalance y
 * suma los préstamos activos con saldo > 0. 0 si no tiene.
 */
export async function employeeLoanBalanceUsd(
  supabase: SupabaseClient,
  employee: { id: string; full_name: string; employee_code: string },
): Promise<number> {
  const loans = await listLoansWithBalance(supabase, [employee]);
  let total = 0;
  for (const l of loans) {
    if (l.status === "activo" && l.balance_usd > 0) total += l.balance_usd;
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}
