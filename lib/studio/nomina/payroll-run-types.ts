/**
 * Tipos + helpers PUROS del módulo Nómina · Corte del período (SDD-0103 · Slice
 * motor — ESTRUCTURA). Matchea supabase/migrations/0175_nomina_payroll_run.sql.
 *
 * Es la ESTRUCTURA del motor, NO la ley fiscal. `calcReciboDraft()` computa un
 * recibo en BORRADOR / ADVISORY con SOLO lo MECÁNICO que el HANDOFF-NOMINA §3
 * marca como ya resuelto:
 *   1. Prorrateo por frecuencia de pago + método de días.
 *   2. Monetización de horas extra / nocturnas (con los %s de payroll_rules).
 *   3. Deducciones SSO/RPE/FAOV sobre el SUELDO BASE, con sus topes en SM.
 *   4. Descuento de cuota de préstamo = min(installment, saldo).
 *
 * Lo que NO hace (frontera del slice):
 *   ❌ NO consume rules.salarial_bonuses (criterio del contador: qué bonos son
 *      salariales y entran a la base de cotización). Se ignora a propósito.
 *   ❌ NO calcula liquidación (Art. 142 / salario integral).
 *   ❌ NO genera asiento contable (eso integra SDD-0079, otro slice).
 * Cada recibo se marca borrador/advisory: el contador valida antes de pagar.
 *
 * Sin React, sin server-only → importable de client y server. Validadores
 * manuales (no Zod). Los `numeric` llegan como string → se coercen con `num()`.
 */

import { num, round2, strOrNull, type NominaBadgeTone } from "./employee-types";

export { num, round2, strOrNull };
export type { NominaBadgeTone };

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado del corte · borrador / confirmado / pagado / anulado ║
// ╚═══════════════════════════════════════════════════════════╝
export type PayrollRunStatus = "borrador" | "confirmado" | "pagado" | "anulado";

export const PAYROLL_RUN_STATUS: PayrollRunStatus[] = [
  "borrador",
  "confirmado",
  "pagado",
  "anulado",
];

export const PAYROLL_RUN_STATUS_META: Record<
  PayrollRunStatus,
  { label: string; tone: NominaBadgeTone }
> = {
  borrador: { label: "Borrador", tone: "neutral" },
  confirmado: { label: "Confirmado", tone: "info" },
  pagado: { label: "Pagado", tone: "success" },
  anulado: { label: "Anulado", tone: "danger" },
};

export function payrollRunStatusLabel(s: string): string {
  return PAYROLL_RUN_STATUS_META[s as PayrollRunStatus]?.label ?? s;
}
export function payrollRunStatusTone(s: string): NominaBadgeTone {
  return PAYROLL_RUN_STATUS_META[s as PayrollRunStatus]?.tone ?? "neutral";
}
export function isPayrollRunStatus(v: unknown): v is PayrollRunStatus {
  return typeof v === "string" && (PAYROLL_RUN_STATUS as string[]).includes(v);
}

/**
 * Transiciones de lifecycle VÁLIDAS. borrador → confirmado → pagado en cadena;
 * → anulado desde cualquier estado vivo. Cualquier otro salto se rechaza.
 * (Sin asiento contable en este slice — el confirmar no postea nada todavía.)
 */
export const PAYROLL_RUN_TRANSITIONS: Record<PayrollRunStatus, PayrollRunStatus[]> = {
  borrador: ["confirmado", "anulado"],
  confirmado: ["pagado", "anulado"],
  pagado: ["anulado"],
  anulado: [],
};

export function canTransitionPayrollRun(
  from: PayrollRunStatus,
  to: PayrollRunStatus,
): boolean {
  return PAYROLL_RUN_TRANSITIONS[from]?.includes(to) ?? false;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Frecuencia / método de días (snapshot del corte)           ║
// ╚═══════════════════════════════════════════════════════════╝
// Reexportados de payroll-rules-types para no duplicar los enums; el corte
// guarda un snapshot de estos valores (rules congeladas).
import {
  type PayFrequency,
  type DayMethod,
  payFrequencyLabel,
  dayMethodLabel,
} from "./payroll-rules-types";
import type { PayrollRules } from "./payroll-rules-types";
export { payFrequencyLabel, dayMethodLabel };
export type { PayFrequency, DayMethod };

// ╔═══════════════════════════════════════════════════════════╗
// ║ Filas persistidas                                          ║
// ╚═══════════════════════════════════════════════════════════╝
/** Renglón transparente del recibo (label + monto). Advisory. */
export type ReciboBreakdownRow = {
  label: string;
  /** USD; positivo = suma al bruto, negativo = deducción. */
  amount_usd: number;
  /** Pista de la fórmula mecánica usada (auditable). */
  note?: string;
};

export type PayrollRun = {
  id: string;
  tenant_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  pay_frequency: PayFrequency;
  day_method: DayMethod;
  rules_snapshot: Partial<PayrollRules> | Record<string, unknown>;
  status: PayrollRunStatus;
  total_gross_usd: number;
  total_deductions_usd: number;
  total_net_usd: number;
  notes: string | null;
  created_by: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PayrollRunLine = {
  id: string;
  tenant_id: string;
  run_id: string;
  employee_id: string;
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
  breakdown: ReciboBreakdownRow[];
  created_at: string;
  updated_at: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ KPIs del listado de cortes (PURO)                          ║
// ╚═══════════════════════════════════════════════════════════╝
export type PayrollRunKpis = {
  total_count: number;
  /** Cortes no-anulados (borrador + confirmado + pagado). */
  live_count: number;
  draft_count: number;
  /** Σ neto de los cortes vivos (no anulados) = exposición de pago. */
  net_usd: number;
};

export function computePayrollRunKpis(
  runs: { status: PayrollRunStatus; total_net_usd: unknown }[],
): PayrollRunKpis {
  let live = 0;
  let draft = 0;
  let net = 0;
  for (const r of runs) {
    if (r.status === "anulado") continue;
    live += 1;
    if (r.status === "borrador") draft += 1;
    net += num(r.total_net_usd);
  }
  return {
    total_count: runs.length,
    live_count: live,
    draft_count: draft,
    net_usd: round2(net),
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Cálculo del recibo · BORRADOR / ADVISORY · PURO            ║
// ╚═══════════════════════════════════════════════════════════╝
/**
 * Insumo de reglas que `calcReciboDraft` consume. Es el subconjunto MECÁNICO
 * de payroll_rules (HANDOFF §3 «✅ ya resueltos»). Nota: `salarial_bonuses` NO
 * aparece acá a propósito → el motor de esta estructura NO lo consume (criterio
 * del contador, Slice posterior).
 */
export type CalcRules = {
  pay_frequency: PayFrequency;
  day_method: DayMethod;
  min_salary: number; // SML de referencia para los topes (en nº de SM)
  sso_pct: number;
  rpe_pct: number;
  faov_pct: number;
  sso_cap_sm: number;
  rpe_cap_sm: number;
  overtime_pct: number;
  night_pct: number;
};

export type CalcReciboArgs = {
  /** Sueldo mensual base del empleado (USD). */
  base_salary_usd: number;
  /** Reglas (snapshot) — solo el subconjunto mecánico. */
  rules: CalcRules;
  /** Días reales del período (para day_method='real'). */
  period_days: number;
  /** Asistencia agregada del empleado en el período. */
  attendance: {
    worked_days: number;
    overtime_hours: number;
    night_hours: number;
  };
  /** Préstamo activo del empleado (o null): cuota + saldo vivo. */
  loan: { installment_usd: number; balance_usd: number } | null;
};

export type CalcReciboResult = {
  worked_days: number;
  overtime_pay_usd: number;
  night_pay_usd: number;
  statutory_deductions_usd: number;
  loan_deduction_usd: number;
  gross_usd: number;
  total_deductions_usd: number;
  net_usd: number;
  breakdown: ReciboBreakdownRow[];
};

/** Días del período del corte según la frecuencia de pago (base 30/mes). */
export function periodDaysForFrequency(
  freq: PayFrequency,
  dayMethod: DayMethod,
  realPeriodDays: number,
): number {
  // day_method = '30' → 30 días fijos/mes; 'real' → días reales del rango.
  const monthDays = dayMethod === "real" ? realPeriodDays : 30;
  switch (freq) {
    case "semanal":
      return round2(monthDays / 4); // ~1 semana del mes
    case "quincenal":
      return round2(monthDays / 2);
    case "mensual":
    default:
      return monthDays;
  }
}

/**
 * Recibo BORRADOR / ADVISORY de un empleado. SOLO cálculo MECÁNICO (HANDOFF §3
 * «✅ ya resueltos»). El contador valida antes de pagar.
 *
 * Fórmulas (todas advisory/mecánicas):
 *  - sueldo del período: prorrateo del base mensual por días del período según
 *    frecuencia + método de días → `daily = base/30`; el período cubre
 *    `periodDays` días; se reconoce `min(worked_days, periodDays)` trabajados.
 *  - valor hora: `base / 30 / 8` (jornada de 8 h, divisor LOTTT mecánico).
 *  - hora extra diurna: `horas × valor_hora × (1 + overtime_pct/100)` (recargo).
 *  - bono nocturno: `horas × valor_hora × (night_pct/100)` (recargo sobre normal).
 *  - deducciones SSO/RPE/FAOV: sobre el SUELDO BASE prorrateado, con tope =
 *    `cap_sm × min_salary` (en SM). FAOV sin tope. (HANDOFF §3: «las deducciones
 *    se calculan SOLO sobre el sueldo base» — NO se suman bonos salariales.)
 *  - cuota de préstamo: `min(installment, saldo)` (no descuenta de más).
 *
 * IMPORTANTE — frontera: este motor NO consume `rules.salarial_bonuses`; esa
 * lista es criterio del contador (qué bonos entran a la base de cotización) y se
 * resuelve en un Slice posterior. Acá la base de cotización = sueldo base puro.
 */
export function calcReciboDraft(args: CalcReciboArgs): CalcReciboResult {
  const base = round2(Math.max(0, num(args.base_salary_usd)));
  const r = args.rules;
  const breakdown: ReciboBreakdownRow[] = [];

  // 1) Prorrateo por frecuencia + método de días.
  const periodDays = Math.max(
    0,
    periodDaysForFrequency(r.pay_frequency, r.day_method, num(args.period_days)),
  );
  const dailyRate = base / 30; // base mensual sobre 30 días fijos
  const workedDays = Math.max(
    0,
    Math.min(num(args.attendance.worked_days), periodDays),
  );
  // Si no hay asistencia cargada (worked_days = 0) se reconoce el período
  // completo prorrateado por frecuencia (caso típico sin calendario diario).
  const effectiveDays = workedDays > 0 ? workedDays : periodDays;
  const salaryPeriod = round2(dailyRate * effectiveDays);
  breakdown.push({
    label: "Sueldo del período",
    amount_usd: salaryPeriod,
    note: `${effectiveDays} día(s) × ${round2(dailyRate)} USD/día (${payFrequencyLabel(r.pay_frequency)})`,
  });

  // 2) Horas extra / nocturnas monetizadas (recargos LOTTT).
  const hourlyRate = base / 30 / 8; // valor hora (jornada 8 h)
  const overtimeHours = Math.max(0, num(args.attendance.overtime_hours));
  const nightHours = Math.max(0, num(args.attendance.night_hours));

  const overtimePay = round2(
    overtimeHours * hourlyRate * (1 + num(r.overtime_pct) / 100),
  );
  if (overtimePay > 0) {
    breakdown.push({
      label: "Horas extra",
      amount_usd: overtimePay,
      note: `${overtimeHours} h × ${round2(hourlyRate)} × (1 + ${r.overtime_pct}%)`,
    });
  }
  const nightPay = round2(nightHours * hourlyRate * (num(r.night_pct) / 100));
  if (nightPay > 0) {
    breakdown.push({
      label: "Bono nocturno",
      amount_usd: nightPay,
      note: `${nightHours} h × ${round2(hourlyRate)} × ${r.night_pct}%`,
    });
  }

  const gross = round2(salaryPeriod + overtimePay + nightPay);

  // 3) Deducciones SSO/RPE/FAOV sobre el sueldo base prorrateado, con topes en SM.
  //    NO se suman bonos salariales (criterio del contador → no se consume aquí).
  const minSalary = Math.max(0, num(r.min_salary));
  const ssoCap = num(r.sso_cap_sm) > 0 && minSalary > 0
    ? round2(num(r.sso_cap_sm) * minSalary)
    : Infinity;
  const rpeCap = num(r.rpe_cap_sm) > 0 && minSalary > 0
    ? round2(num(r.rpe_cap_sm) * minSalary)
    : Infinity;

  const ssoBase = Math.min(salaryPeriod, ssoCap);
  const rpeBase = Math.min(salaryPeriod, rpeCap);
  const faovBase = salaryPeriod; // FAOV sin tope

  const ssoDed = round2(ssoBase * (num(r.sso_pct) / 100));
  const rpeDed = round2(rpeBase * (num(r.rpe_pct) / 100));
  const faovDed = round2(faovBase * (num(r.faov_pct) / 100));
  const statutory = round2(ssoDed + rpeDed + faovDed);

  if (ssoDed > 0) {
    breakdown.push({ label: "SSO / IVSS", amount_usd: -ssoDed, note: `${r.sso_pct}% (tope ${r.sso_cap_sm} SM)` });
  }
  if (rpeDed > 0) {
    breakdown.push({ label: "RPE", amount_usd: -rpeDed, note: `${r.rpe_pct}% (tope ${r.rpe_cap_sm} SM)` });
  }
  if (faovDed > 0) {
    breakdown.push({ label: "FAOV", amount_usd: -faovDed, note: `${r.faov_pct}% (sin tope)` });
  }

  // 4) Cuota de préstamo = min(cuota, saldo vivo).
  let loanDeduction = 0;
  if (args.loan) {
    const installment = Math.max(0, num(args.loan.installment_usd));
    const balance = Math.max(0, num(args.loan.balance_usd));
    loanDeduction = round2(Math.min(installment, balance));
    if (loanDeduction > 0) {
      breakdown.push({
        label: "Cuota de préstamo",
        amount_usd: -loanDeduction,
        note: `min(cuota ${installment}, saldo ${balance})`,
      });
    }
  }

  const totalDeductions = round2(statutory + loanDeduction);
  const net = round2(gross - totalDeductions);

  return {
    worked_days: effectiveDays,
    overtime_pay_usd: overtimePay,
    night_pay_usd: nightPay,
    statutory_deductions_usd: statutory,
    loan_deduction_usd: loanDeduction,
    gross_usd: gross,
    total_deductions_usd: totalDeductions,
    net_usd: net,
    breakdown,
  };
}

/** Extrae el subconjunto mecánico de reglas que calcReciboDraft consume. */
export function calcRulesFrom(
  rules: Pick<
    PayrollRules,
    | "pay_frequency"
    | "day_method"
    | "min_salary"
    | "sso_pct"
    | "rpe_pct"
    | "faov_pct"
    | "sso_cap_sm"
    | "rpe_cap_sm"
    | "overtime_pct"
    | "night_pct"
  >,
): CalcRules {
  return {
    pay_frequency: rules.pay_frequency,
    day_method: rules.day_method,
    min_salary: num(rules.min_salary),
    sso_pct: num(rules.sso_pct),
    rpe_pct: num(rules.rpe_pct),
    faov_pct: num(rules.faov_pct),
    sso_cap_sm: num(rules.sso_cap_sm),
    rpe_cap_sm: num(rules.rpe_cap_sm),
    overtime_pct: num(rules.overtime_pct),
    night_pct: num(rules.night_pct),
  };
}

/** Días reales (inclusive) entre dos fechas ISO YYYY-MM-DD. */
export function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = Date.parse(startIso + "T00:00:00Z");
  const end = Date.parse(endIso + "T00:00:00Z");
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input · generar corte (sin Zod)              ║
// ╚═══════════════════════════════════════════════════════════╝
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_LABEL_RE = /^.{1,40}$/;

function isIsoDate(s: string): boolean {
  return ISO_DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
}

export type GeneratePayrollRunInput = {
  period_label: string;
  period_start: string;
  period_end: string;
  notes: string | null;
};

export function validateGeneratePayrollRunInput(
  raw: Partial<Record<string, unknown>>,
): { input: GeneratePayrollRunInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const periodLabel = String(raw.period_label ?? "").trim();
  if (!periodLabel) errors.period_label = "Indica el período (ej. 2026-06).";
  else if (!PERIOD_LABEL_RE.test(periodLabel)) {
    errors.period_label = "Período demasiado largo (máx 40).";
  }

  const periodStart = String(raw.period_start ?? "").trim();
  if (!periodStart) errors.period_start = "Indica la fecha de inicio.";
  else if (!isIsoDate(periodStart)) errors.period_start = "Fecha de inicio inválida.";

  const periodEnd = String(raw.period_end ?? "").trim();
  if (!periodEnd) errors.period_end = "Indica la fecha de fin.";
  else if (!isIsoDate(periodEnd)) errors.period_end = "Fecha de fin inválida.";

  if (
    !errors.period_start &&
    !errors.period_end &&
    Date.parse(periodEnd) < Date.parse(periodStart)
  ) {
    errors.period_end = "El fin no puede ser anterior al inicio.";
  }

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      period_label: periodLabel,
      period_start: periodStart,
      period_end: periodEnd,
      notes: strOrNull(raw.notes),
    },
  };
}
