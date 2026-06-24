/**
 * Tipos + helpers PUROS del módulo Nómina · Reglas de cálculo (SDD-0103 · Slice B).
 * Matchea el schema de supabase/migrations/0162_nomina_payroll_rules.sql.
 *
 * Es CONFIG, no cálculo: almacena los parámetros LOTTT (frecuencia, método de
 * días, montos base, deducciones, topes, recargos, provisiones) que el motor de
 * payroll_run consumirá en el Slice C. Acá no se computa ningún recibo.
 *
 * Sin React, sin server-only → importable desde client y server. Validadores
 * manuales (no Zod, patrón del repo). Los `numeric` llegan de Supabase como
 * string → se coercen a number con `num()`.
 */

import { num, round2, strOrNull, type NominaBadgeTone } from "./employee-types";

export { num, round2, strOrNull };
export type { NominaBadgeTone };

// ╔═══════════════════════════════════════════════════════════╗
// ║ Frecuencia de pago · mensual / quincenal / semanal         ║
// ╚═══════════════════════════════════════════════════════════╝
export type PayFrequency = "mensual" | "quincenal" | "semanal";

export const PAY_FREQUENCY: PayFrequency[] = ["mensual", "quincenal", "semanal"];

export const PAY_FREQUENCY_META: Record<PayFrequency, { label: string }> = {
  mensual: { label: "Mensual" },
  quincenal: { label: "Quincenal" },
  semanal: { label: "Semanal" },
};

export const PAY_FREQUENCY_OPTIONS: { value: PayFrequency; label: string }[] =
  PAY_FREQUENCY.map((f) => ({ value: f, label: PAY_FREQUENCY_META[f].label }));

export function payFrequencyLabel(v: string): string {
  return PAY_FREQUENCY_META[v as PayFrequency]?.label ?? v;
}
export function isPayFrequency(v: unknown): v is PayFrequency {
  return typeof v === "string" && (PAY_FREQUENCY as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Método de días · 30 fijos / días reales                    ║
// ╚═══════════════════════════════════════════════════════════╝
export type DayMethod = "30" | "real";

export const DAY_METHOD: DayMethod[] = ["30", "real"];

export const DAY_METHOD_META: Record<DayMethod, { label: string }> = {
  "30": { label: "30 días fijos" },
  real: { label: "Días reales del mes" },
};

export const DAY_METHOD_OPTIONS: { value: DayMethod; label: string }[] =
  DAY_METHOD.map((m) => ({ value: m, label: DAY_METHOD_META[m].label }));

export function dayMethodLabel(v: string): string {
  return DAY_METHOD_META[v as DayMethod]?.label ?? v;
}
export function isDayMethod(v: unknown): v is DayMethod {
  return typeof v === "string" && (DAY_METHOD as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado del ruleset · vigente / archivada                   ║
// ╚═══════════════════════════════════════════════════════════╝
export type PayrollRulesStatus = "vigente" | "archivada";

export const PAYROLL_RULES_STATUSES: PayrollRulesStatus[] = ["vigente", "archivada"];

export const PAYROLL_RULES_STATUS_META: Record<
  PayrollRulesStatus,
  { label: string; tone: NominaBadgeTone }
> = {
  vigente: { label: "Vigente", tone: "success" },
  archivada: { label: "Archivada", tone: "neutral" },
};

export function payrollRulesStatusLabel(s: string): string {
  return PAYROLL_RULES_STATUS_META[s as PayrollRulesStatus]?.label ?? s;
}
export function payrollRulesStatusTone(s: string): NominaBadgeTone {
  return PAYROLL_RULES_STATUS_META[s as PayrollRulesStatus]?.tone ?? "neutral";
}
export function isPayrollRulesStatus(v: unknown): v is PayrollRulesStatus {
  return typeof v === "string" && (PAYROLL_RULES_STATUSES as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Fila persistida                                            ║
// ╚═══════════════════════════════════════════════════════════╝
export type SalarialBonus = { label?: string; [k: string]: unknown };

export type PayrollRules = {
  id: string;
  tenant_id: string;
  version: number;
  status: PayrollRulesStatus;
  pay_frequency: PayFrequency;
  day_method: DayMethod;
  // Montos base (Bs).
  min_salary: number;
  cestaticket: number;
  bono_guerra: number;
  // Deducciones del empleado (%).
  sso_pct: number;
  rpe_pct: number;
  faov_pct: number;
  // Topes de cotización (nº de salarios mínimos).
  sso_cap_sm: number;
  rpe_cap_sm: number;
  // Recargos (%).
  overtime_pct: number;
  night_pct: number;
  holiday_pct: number;
  // Provisiones / prestaciones (días).
  utilidades_days: number;
  bono_vacacional_days: number;
  vacaciones_days: number;
  // Criterio del contador (Slice C): se almacena, no se consume aún.
  salarial_bonuses: SalarialBonus[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input (sin Zod)                              ║
// ╚═══════════════════════════════════════════════════════════╝
export type PayrollRulesInput = {
  pay_frequency: PayFrequency;
  day_method: DayMethod;
  min_salary: number;
  cestaticket: number;
  bono_guerra: number;
  sso_pct: number;
  rpe_pct: number;
  faov_pct: number;
  sso_cap_sm: number;
  rpe_cap_sm: number;
  overtime_pct: number;
  night_pct: number;
  holiday_pct: number;
  utilidades_days: number;
  bono_vacacional_days: number;
  vacaciones_days: number;
  salarial_bonuses: SalarialBonus[];
  notes: string | null;
};

/** Defaults LOTTT plausibles (espejo de los DEFAULTs de la migración 0162). */
export const PAYROLL_RULES_DEFAULTS: PayrollRulesInput = {
  pay_frequency: "mensual",
  day_method: "30",
  min_salary: 0,
  cestaticket: 0,
  bono_guerra: 0,
  sso_pct: 4,
  rpe_pct: 0.5,
  faov_pct: 1,
  sso_cap_sm: 5,
  rpe_cap_sm: 10,
  overtime_pct: 50,
  night_pct: 30,
  holiday_pct: 50,
  utilidades_days: 30,
  bono_vacacional_days: 15,
  vacaciones_days: 15,
  salarial_bonuses: [],
  notes: null,
};

/** Días de utilidades nunca por debajo del mínimo legal (LOTTT Art. 131). */
export const UTILIDADES_MIN_DAYS = 30;

// Campos % (deducciones + recargos) que deben quedar entre 0 y 100.
const PCT_FIELDS = [
  "sso_pct",
  "rpe_pct",
  "faov_pct",
  "overtime_pct",
  "night_pct",
  "holiday_pct",
] as const;
type PctField = (typeof PCT_FIELDS)[number];

const PCT_LABEL: Record<PctField, string> = {
  sso_pct: "% SSO/IVSS",
  rpe_pct: "% RPE",
  faov_pct: "% FAOV",
  overtime_pct: "% hora extra",
  night_pct: "% bono nocturno",
  holiday_pct: "% día feriado",
};

// Topes (≥ 0) expresados en nº de salarios mínimos.
const CAP_FIELDS = ["sso_cap_sm", "rpe_cap_sm"] as const;
type CapField = (typeof CAP_FIELDS)[number];
const CAP_LABEL: Record<CapField, string> = {
  sso_cap_sm: "Tope IVSS (SM)",
  rpe_cap_sm: "Tope RPE (SM)",
};

// Montos base (≥ 0, Bs).
const MONEY_FIELDS = ["min_salary", "cestaticket", "bono_guerra"] as const;
type MoneyField = (typeof MONEY_FIELDS)[number];
const MONEY_LABEL: Record<MoneyField, string> = {
  min_salary: "Salario mínimo",
  cestaticket: "Cestaticket",
  bono_guerra: "Bono de guerra",
};

// Días de provisiones (≥ 0; utilidades extra: ≥ 30).
const DAY_FIELDS = ["bono_vacacional_days", "vacaciones_days"] as const;
type DayField = (typeof DAY_FIELDS)[number];
const DAY_LABEL: Record<DayField, string> = {
  bono_vacacional_days: "Días de bono vacacional",
  vacaciones_days: "Días de vacaciones",
};

function parseSalarialBonuses(v: unknown): SalarialBonus[] | false {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v as SalarialBonus[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as SalarialBonus[]) : false;
    } catch {
      return false;
    }
  }
  return false;
}

export function validatePayrollRulesInput(
  raw: Partial<Record<string, unknown>>,
): { input: PayrollRulesInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const payFrequency = String(raw.pay_frequency ?? "mensual").trim();
  if (!isPayFrequency(payFrequency)) errors.pay_frequency = "Frecuencia inválida.";

  const dayMethod = String(raw.day_method ?? "30").trim();
  if (!isDayMethod(dayMethod)) errors.day_method = "Método de días inválido.";

  // Porcentajes 0–100.
  const pct: Record<PctField, number> = {} as Record<PctField, number>;
  for (const f of PCT_FIELDS) {
    const n = Number(raw[f] ?? PAYROLL_RULES_DEFAULTS[f]);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors[f] = `${PCT_LABEL[f]} debe estar entre 0 y 100.`;
    }
    pct[f] = round2(n);
  }

  // Topes ≥ 0.
  const cap: Record<CapField, number> = {} as Record<CapField, number>;
  for (const f of CAP_FIELDS) {
    const n = Number(raw[f] ?? PAYROLL_RULES_DEFAULTS[f]);
    if (!Number.isFinite(n) || n < 0) {
      errors[f] = `${CAP_LABEL[f]} no puede ser negativo.`;
    }
    cap[f] = round2(n);
  }

  // Montos base ≥ 0.
  const money: Record<MoneyField, number> = {} as Record<MoneyField, number>;
  for (const f of MONEY_FIELDS) {
    const n = Number(raw[f] ?? PAYROLL_RULES_DEFAULTS[f]);
    if (!Number.isFinite(n) || n < 0) {
      errors[f] = `${MONEY_LABEL[f]} no puede ser negativo.`;
    }
    money[f] = round2(n);
  }

  // Días ≥ 0.
  const days: Record<DayField, number> = {} as Record<DayField, number>;
  for (const f of DAY_FIELDS) {
    const n = Number(raw[f] ?? PAYROLL_RULES_DEFAULTS[f]);
    if (!Number.isInteger(n) || n < 0) {
      errors[f] = `${DAY_LABEL[f]} debe ser un entero ≥ 0.`;
    }
    days[f] = Math.trunc(num(n));
  }

  // Utilidades ≥ 30 (mínimo legal).
  const utilidades = Number(raw.utilidades_days ?? PAYROLL_RULES_DEFAULTS.utilidades_days);
  if (!Number.isInteger(utilidades) || utilidades < UTILIDADES_MIN_DAYS) {
    errors.utilidades_days = `Días de utilidades: mínimo legal ${UTILIDADES_MIN_DAYS}.`;
  }

  const bonuses = parseSalarialBonuses(raw.salarial_bonuses);
  if (bonuses === false) errors.salarial_bonuses = "Lista de bonos salariales inválida.";

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      pay_frequency: payFrequency as PayFrequency,
      day_method: dayMethod as DayMethod,
      min_salary: money.min_salary,
      cestaticket: money.cestaticket,
      bono_guerra: money.bono_guerra,
      sso_pct: pct.sso_pct,
      rpe_pct: pct.rpe_pct,
      faov_pct: pct.faov_pct,
      sso_cap_sm: cap.sso_cap_sm,
      rpe_cap_sm: cap.rpe_cap_sm,
      overtime_pct: pct.overtime_pct,
      night_pct: pct.night_pct,
      holiday_pct: pct.holiday_pct,
      utilidades_days: Math.trunc(utilidades),
      bono_vacacional_days: days.bono_vacacional_days,
      vacaciones_days: days.vacaciones_days,
      salarial_bonuses: bonuses === false ? [] : bonuses,
      notes: strOrNull(raw.notes),
    },
  };
}
