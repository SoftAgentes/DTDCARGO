/**
 * Tipos + helpers PUROS del módulo Nómina · Préstamos (SDD-0103 · Slice C).
 * Matchea supabase/migrations/0164_nomina_loans.sql.
 *
 * Préstamo a un empleado con una CUOTA por período. El descuento real en el
 * recibo lo hará el motor (payroll_run, Slice posterior, con contador) — acá
 * solo se registra el préstamo, sus cuotas pagadas y el SALDO derivado
 * (principal − Σ cuotas). Sin React, sin server-only → importable de client y
 * server. Validadores manuales (no Zod). `numeric` llega como string → num().
 *
 * Reusa los helpers base (num/round2/strOrNull) y los tonos de `employee-types`.
 */

import {
  num,
  round2,
  strOrNull,
  type NominaBadgeTone,
} from "./employee-types";

export { num, round2, strOrNull };
export type { NominaBadgeTone };

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado del préstamo · activo / pagado / cancelado          ║
// ╚═══════════════════════════════════════════════════════════╝
export type LoanStatus = "activo" | "pagado" | "cancelado";

export const LOAN_STATUS: LoanStatus[] = ["activo", "pagado", "cancelado"];

export const LOAN_STATUS_META: Record<
  LoanStatus,
  { label: string; tone: NominaBadgeTone }
> = {
  activo: { label: "Activo", tone: "success" },
  pagado: { label: "Pagado", tone: "neutral" },
  cancelado: { label: "Cancelado", tone: "warning" },
};

export function loanStatusLabel(s: string): string {
  return LOAN_STATUS_META[s as LoanStatus]?.label ?? s;
}
export function loanStatusTone(s: string): NominaBadgeTone {
  return LOAN_STATUS_META[s as LoanStatus]?.tone ?? "neutral";
}
export function isLoanStatus(v: unknown): v is LoanStatus {
  return typeof v === "string" && (LOAN_STATUS as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Filas persistidas                                          ║
// ╚═══════════════════════════════════════════════════════════╝
export type Loan = {
  id: string;
  tenant_id: string;
  employee_id: string;
  principal_usd: number;
  installment_usd: number;
  installments_total: number;
  granted_on: string;
  status: LoanStatus;
  concept: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LoanInstallment = {
  id: string;
  tenant_id: string;
  loan_id: string;
  paid_on: string;
  amount_usd: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Saldo derivado (principal − Σ cuotas) · PURO               ║
// ╚═══════════════════════════════════════════════════════════╝
/**
 * Σ de las cuotas/abonos de un préstamo (USD). Acepta filas crudas (numeric→
 * string) o ya coercidas; usa num() en ambos casos.
 */
export function sumInstallments(
  installments: { amount_usd: unknown }[],
): number {
  let total = 0;
  for (const i of installments) total += num(i.amount_usd);
  return round2(total);
}

/**
 * Saldo vivo del préstamo = principal − Σ cuotas, nunca negativo.
 * El motor descuenta min(cuota, saldo) en cada recibo; cuando el saldo llega a
 * 0 el préstamo se considera pagado.
 */
export function loanBalance(
  principalUsd: unknown,
  installments: { amount_usd: unknown }[],
): number {
  const bal = num(principalUsd) - sumInstallments(installments);
  return round2(Math.max(0, bal));
}

/** El préstamo quedó saldado (saldo 0) por las cuotas registradas. */
export function loanIsSettled(
  principalUsd: unknown,
  installments: { amount_usd: unknown }[],
): boolean {
  return loanBalance(principalUsd, installments) <= 0;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Préstamo enriquecido (con saldo) + KPIs                    ║
// ╚═══════════════════════════════════════════════════════════╝
export type LoanWithBalance = Loan & {
  paid_usd: number;
  balance_usd: number;
  employee_name: string;
  employee_code: string;
};

export type LoanKpis = {
  active_count: number;
  total_count: number;
  /** Σ de saldos de los préstamos ACTIVOS (USD) = exposición viva. */
  outstanding_usd: number;
};

/** KPIs de la pestaña Préstamos (PURO — testeable sin DB). */
export function computeLoanKpis(
  loans: { status: LoanStatus; balance_usd: number }[],
): LoanKpis {
  let active = 0;
  let outstanding = 0;
  for (const l of loans) {
    if (l.status === "activo") {
      active += 1;
      outstanding += num(l.balance_usd);
    }
  }
  return {
    active_count: active,
    total_count: loans.length,
    outstanding_usd: round2(outstanding),
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input (sin Zod)                              ║
// ╚═══════════════════════════════════════════════════════════╝
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type LoanInput = {
  employee_id: string;
  principal_usd: number;
  installment_usd: number;
  installments_total: number;
  granted_on: string;
  concept: string | null;
  notes: string | null;
};

export function validateLoanInput(
  raw: Partial<Record<string, unknown>>,
): { input: LoanInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const employeeId = String(raw.employee_id ?? "").trim();
  if (!employeeId) errors.employee_id = "Indica el empleado.";

  const principal = Number(raw.principal_usd ?? 0);
  if (!Number.isFinite(principal) || principal <= 0) {
    errors.principal_usd = "El monto debe ser mayor a 0.";
  }

  const installment = Number(raw.installment_usd ?? 0);
  if (!Number.isFinite(installment) || installment < 0) {
    errors.installment_usd = "La cuota no puede ser negativa.";
  } else if (
    Number.isFinite(principal) &&
    principal > 0 &&
    installment > principal
  ) {
    errors.installment_usd = "La cuota no puede superar el monto del préstamo.";
  }

  const totalRaw = raw.installments_total ?? 1;
  const total = Number(totalRaw);
  if (!Number.isInteger(total) || total < 1) {
    errors.installments_total = "El número de cuotas debe ser un entero ≥ 1.";
  }

  const grantedRaw = strOrNull(raw.granted_on);
  let grantedOn = grantedRaw;
  if (
    grantedRaw !== null &&
    (!ISO_DATE_RE.test(grantedRaw) || Number.isNaN(Date.parse(grantedRaw)))
  ) {
    errors.granted_on = "Fecha inválida.";
    grantedOn = null;
  }

  const concept = strOrNull(raw.concept);
  if (concept !== null && concept.length > 200) {
    errors.concept = "Concepto demasiado largo (máx 200).";
  }

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      employee_id: employeeId,
      principal_usd: round2(principal),
      installment_usd: round2(installment),
      installments_total: Math.trunc(total),
      granted_on: grantedOn ?? new Date().toISOString().slice(0, 10),
      concept,
      notes: strOrNull(raw.notes),
    },
  };
}

export type LoanInstallmentInput = {
  loan_id: string;
  paid_on: string;
  amount_usd: number;
};

export function validateLoanInstallmentInput(
  raw: Partial<Record<string, unknown>>,
): { input: LoanInstallmentInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const loanId = String(raw.loan_id ?? "").trim();
  if (!loanId) errors.loan_id = "Indica el préstamo.";

  const amount = Number(raw.amount_usd ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount_usd = "El monto de la cuota debe ser mayor a 0.";
  }

  const paidOnRaw = strOrNull(raw.paid_on);
  let paidOn = paidOnRaw;
  if (
    paidOnRaw !== null &&
    (!ISO_DATE_RE.test(paidOnRaw) || Number.isNaN(Date.parse(paidOnRaw)))
  ) {
    errors.paid_on = "Fecha inválida.";
    paidOn = null;
  }

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      loan_id: loanId,
      paid_on: paidOn ?? new Date().toISOString().slice(0, 10),
      amount_usd: round2(amount),
    },
  };
}
