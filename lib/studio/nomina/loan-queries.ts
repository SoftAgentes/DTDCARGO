/**
 * Queries puras del módulo Nómina · Préstamos (SDD-0103 · Slice C).
 *
 * Funciones `(supabase: SupabaseClient) => Promise<T>` consumidas desde
 * `page.tsx` y las server actions. La RLS filtra por tenant Y rol
 * (admin/accounting): un caller sin rol no recibe filas. Los `numeric` llegan
 * como string → se coercen con `num()`.
 *
 * El SALDO no es columna: se deriva (principal − Σ cuotas) acá, combinando los
 * préstamos con sus cuotas vivas. `listLoansWithBalance` arma ese join en
 * memoria para que la UI no tenga que recalcular.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { num } from "./employee-types";
import {
  loanBalance,
  sumInstallments,
  type Loan,
  type LoanInstallment,
  type LoanWithBalance,
} from "./loan-types";

const LOAN_COLUMNS =
  "id, tenant_id, employee_id, principal_usd, installment_usd, " +
  "installments_total, granted_on, status, concept, notes, created_by, " +
  "created_at, updated_at, deleted_at";

const INSTALLMENT_COLUMNS =
  "id, tenant_id, loan_id, paid_on, amount_usd, created_by, created_at, " +
  "updated_at, deleted_at";

function rowToLoan(row: Record<string, unknown>): Loan {
  return {
    ...(row as Loan),
    principal_usd: num(row.principal_usd),
    installment_usd: num(row.installment_usd),
    installments_total: Math.trunc(num(row.installments_total)),
  };
}

function rowToInstallment(row: Record<string, unknown>): LoanInstallment {
  return {
    ...(row as LoanInstallment),
    amount_usd: num(row.amount_usd),
  };
}

/** Préstamos vivos del tenant: activos primero, luego por fecha desc. */
export async function listLoans(
  supabase: SupabaseClient,
): Promise<Loan[]> {
  const { data, error } = await supabase
    .from("nomina_loans")
    .select(LOAN_COLUMNS)
    .is("deleted_at", null)
    .order("status", { ascending: true })
    .order("granted_on", { ascending: false });

  if (error) {
    console.error("[listLoans]", error.message);
    return [];
  }
  return (data ?? []).map((r) =>
    rowToLoan(r as unknown as Record<string, unknown>),
  );
}

/** Cuotas/abonos vivos del tenant, más recientes primero. */
export async function listLoanInstallments(
  supabase: SupabaseClient,
  limit = 500,
): Promise<LoanInstallment[]> {
  const { data, error } = await supabase
    .from("nomina_loan_installments")
    .select(INSTALLMENT_COLUMNS)
    .is("deleted_at", null)
    .order("paid_on", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[listLoanInstallments]", error.message);
    return [];
  }
  return (data ?? []).map((r) =>
    rowToInstallment(r as unknown as Record<string, unknown>),
  );
}

/**
 * Préstamos enriquecidos con saldo derivado + nombre/código del empleado.
 * Combina préstamos, cuotas y empleados en memoria (RLS ya filtró por tenant+rol).
 * El saldo (principal − Σ cuotas) se calcula acá, no en la DB.
 */
export async function listLoansWithBalance(
  supabase: SupabaseClient,
  employees: { id: string; full_name: string; employee_code: string }[],
): Promise<LoanWithBalance[]> {
  const [loans, installments] = await Promise.all([
    listLoans(supabase),
    listLoanInstallments(supabase),
  ]);

  const byLoan = new Map<string, LoanInstallment[]>();
  for (const i of installments) {
    const arr = byLoan.get(i.loan_id) ?? [];
    arr.push(i);
    byLoan.set(i.loan_id, arr);
  }

  const empById = new Map(
    employees.map((e) => [e.id, { name: e.full_name, code: e.employee_code }]),
  );

  return loans.map((l) => {
    const ins = byLoan.get(l.id) ?? [];
    const paid = sumInstallments(ins);
    const balance = loanBalance(l.principal_usd, ins);
    const emp = empById.get(l.employee_id);
    return {
      ...l,
      paid_usd: paid,
      balance_usd: balance,
      employee_name: emp?.name ?? "Empleado",
      employee_code: emp?.code ?? "—",
    };
  });
}

/** Un préstamo por id (o null). */
export async function getLoan(
  supabase: SupabaseClient,
  id: string,
): Promise<Loan | null> {
  const { data, error } = await supabase
    .from("nomina_loans")
    .select(LOAN_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getLoan]", error.message);
    return null;
  }
  return data ? rowToLoan(data as unknown as Record<string, unknown>) : null;
}

/**
 * Saldo vivo de un préstamo leyendo sus cuotas de la DB (para que la action
 * decida si la cuota nueva lo deja saldado → status 'pagado'). RLS aplica.
 */
export async function getLoanBalance(
  supabase: SupabaseClient,
  loanId: string,
  principalUsd: number,
): Promise<number> {
  const { data, error } = await supabase
    .from("nomina_loan_installments")
    .select("amount_usd")
    .eq("loan_id", loanId)
    .is("deleted_at", null);

  if (error) {
    console.error("[getLoanBalance]", error.message);
    return principalUsd;
  }
  return loanBalance(
    principalUsd,
    (data ?? []) as { amount_usd: unknown }[],
  );
}
