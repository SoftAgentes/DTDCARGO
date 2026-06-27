/**
 * Tipos + helpers PUROS del módulo Nómina · Liquidación / finiquito (SDD-0109).
 * Matchea supabase/migrations/0179_nomina_settlements.sql.
 *
 * `calcLiquidacion()` computa el finiquito de egreso LOTTT en BORRADOR / ADVISORY.
 * Lo MECÁNICO lo resuelve el motor; lo de CRITERIO (qué bonos son salariales, la
 * fórmula de prestaciones, la tasa de interés) llega como PARÁMETRO en
 * `SettlementRules` — el motor NUNCA hardcodea la ley. Cambiar la config cambia el
 * resultado; cambiar la causa cambia el resultado; el código no trae constantes
 * salariales propias.
 *
 * Regla de oro: el finiquito nace borrador/advisory. El contador valida antes de
 * pagar. Cálculo en USD (fuente de verdad del sueldo, SDD-0103); la conversión a
 * Bs para el PDF legal la hace la capa de PDF (no este motor).
 *
 * Sin React, sin server-only → importable de client y server. Validadores
 * manuales (no Zod). Los `numeric` llegan de Supabase como string → `num()`.
 */

import { num, round2, strOrNull, type NominaBadgeTone } from "./employee-types";
import type { PayrollRules, SalarialBonus } from "./payroll-rules-types";

export { num, round2, strOrNull };
export type { NominaBadgeTone };

// ╔═══════════════════════════════════════════════════════════╗
// ║ Causa de terminación LOTTT                                 ║
// ╚═══════════════════════════════════════════════════════════╝
export type TerminationCause =
  | "renuncia_76"
  | "ajena_78"
  | "despido_justificado_79"
  | "despido_injustificado_92";

export const TERMINATION_CAUSES: TerminationCause[] = [
  "renuncia_76",
  "ajena_78",
  "despido_justificado_79",
  "despido_injustificado_92",
];

export const TERMINATION_CAUSE_META: Record<
  TerminationCause,
  { label: string; short: string; note: string }
> = {
  renuncia_76: {
    label: "Renuncia (Art. 76)",
    short: "Renuncia",
    note: "Retiro voluntario: prestaciones + fracciones, sin indemnización Art. 92.",
  },
  ajena_78: {
    label: "Causas ajenas (Art. 78)",
    short: "Causas ajenas",
    note: "Terminación por causas ajenas a la voluntad: prestaciones + fracciones (Art. 92 según config).",
  },
  despido_justificado_79: {
    label: "Despido justificado (Art. 79)",
    short: "Despido justificado",
    note: "Causa imputable al trabajador: prestaciones + fracciones, sin indemnización Art. 92.",
  },
  despido_injustificado_92: {
    label: "Despido injustificado (Art. 92)",
    short: "Despido injustificado",
    note: "Prestaciones + fracciones + indemnización Art. 92 (duplica las prestaciones).",
  },
};

export const TERMINATION_CAUSE_OPTIONS: { value: TerminationCause; label: string }[] =
  TERMINATION_CAUSES.map((c) => ({ value: c, label: TERMINATION_CAUSE_META[c].label }));

export function terminationCauseLabel(v: string): string {
  return TERMINATION_CAUSE_META[v as TerminationCause]?.label ?? v;
}
export function isTerminationCause(v: unknown): v is TerminationCause {
  return typeof v === "string" && (TERMINATION_CAUSES as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado del finiquito · borrador / confirmado / anulado     ║
// ╚═══════════════════════════════════════════════════════════╝
export type SettlementStatus = "borrador" | "confirmado" | "anulado";

export const SETTLEMENT_STATUSES: SettlementStatus[] = [
  "borrador",
  "confirmado",
  "anulado",
];

export const SETTLEMENT_STATUS_META: Record<
  SettlementStatus,
  { label: string; tone: NominaBadgeTone }
> = {
  borrador: { label: "Borrador", tone: "neutral" },
  confirmado: { label: "Confirmado", tone: "success" },
  anulado: { label: "Anulado", tone: "warning" },
};

export function settlementStatusLabel(s: string): string {
  return SETTLEMENT_STATUS_META[s as SettlementStatus]?.label ?? s;
}
export function settlementStatusTone(s: string): NominaBadgeTone {
  return SETTLEMENT_STATUS_META[s as SettlementStatus]?.tone ?? "neutral";
}
export function isSettlementStatus(v: unknown): v is SettlementStatus {
  return typeof v === "string" && (SETTLEMENT_STATUSES as string[]).includes(v);
}

/**
 * Transiciones de lifecycle válidas. borrador → confirmado (genera PDF +
 * asiento); → anulado desde cualquier estado vivo (contra-asiento). Confirmado
 * NO vuelve a borrador (inmutable).
 */
export const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  borrador: ["confirmado", "anulado"],
  confirmado: ["anulado"],
  anulado: [],
};

export function canTransitionSettlement(
  from: SettlementStatus,
  to: SettlementStatus,
): boolean {
  return SETTLEMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Renglón del desglose (kind)                                ║
// ╚═══════════════════════════════════════════════════════════╝
export type SettlementLineKind =
  | "prestaciones"
  | "vacaciones_frac"
  | "bono_vacacional_frac"
  | "utilidades_frac"
  | "indemnizacion_92"
  | "intereses"
  | "deduccion_prestamo"
  | "otro";

export type SettlementLine = {
  kind: SettlementLineKind;
  label: string;
  /** Días devengados (cuando aplique). */
  days: number | null;
  /** Base de cálculo (salario normal o integral según renglón). */
  base_usd: number | null;
  /** Monto USD; negativo = deducción. */
  amount_usd: number;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Filas persistidas                                          ║
// ╚═══════════════════════════════════════════════════════════╝
export type Settlement = {
  id: string;
  tenant_id: string;
  settlement_code: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  termination_cause: TerminationCause;
  hire_date: string;
  termination_date: string;
  base_salary_usd: number;
  rules_snapshot: Partial<PayrollRules> | Record<string, unknown>;
  status: SettlementStatus;
  total_prestaciones_usd: number;
  total_fracciones_usd: number;
  total_indemnizacion_usd: number;
  total_intereses_usd: number;
  total_deductions_usd: number;
  total_net_usd: number;
  salario_integral_usd: number;
  pdf_path: string | null;
  journal_entry_id: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SettlementLineRow = {
  id: string;
  tenant_id: string;
  settlement_id: string;
  kind: SettlementLineKind;
  label: string;
  days: number | null;
  base_usd: number | null;
  amount_usd: number;
  created_at: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Método de prestaciones (config · criterio del contador)    ║
// ╚═══════════════════════════════════════════════════════════╝
export type PrestacionesMethod = "garantia" | "retroactivo" | "mejor";

export const PRESTACIONES_METHODS: PrestacionesMethod[] = [
  "garantia",
  "retroactivo",
  "mejor",
];

export function isPrestacionesMethod(v: unknown): v is PrestacionesMethod {
  return typeof v === "string" && (PRESTACIONES_METHODS as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Antigüedad (mecánico)                                      ║
// ╚═══════════════════════════════════════════════════════════╝
export type Seniority = {
  /** Total de meses completos trabajados (mecánico). */
  totalMonths: number;
  /** Años completos. */
  years: number;
  /** Meses en el año en curso incompleto (0–11). */
  monthsInCurrentYear: number;
  /** Días sueltos sobre el último mes completo. */
  extraDays: number;
};

/**
 * Antigüedad entre ingreso y egreso (fechas ISO YYYY-MM-DD). Cálculo de
 * calendario mecánico: meses completos + fracción. Egreso anterior al ingreso → 0.
 */
export function computeSeniority(hireIso: string, terminationIso: string): Seniority {
  const empty: Seniority = { totalMonths: 0, years: 0, monthsInCurrentYear: 0, extraDays: 0 };
  const h = parseIsoDate(hireIso);
  const t = parseIsoDate(terminationIso);
  if (!h || !t) return empty;
  if (
    t.y < h.y ||
    (t.y === h.y && t.m < h.m) ||
    (t.y === h.y && t.m === h.m && t.d < h.d)
  ) {
    return empty;
  }

  let months = (t.y - h.y) * 12 + (t.m - h.m);
  let extraDays = t.d - h.d;
  if (extraDays < 0) {
    months -= 1;
    // Días del mes anterior al egreso, para no quedar negativo.
    const prevMonthDays = daysInMonth(t.y, t.m - 1);
    extraDays = prevMonthDays - h.d + t.d;
  }
  if (months < 0) months = 0;

  return {
    totalMonths: months,
    years: Math.floor(months / 12),
    monthsInCurrentYear: months % 12,
    extraDays: Math.max(0, extraDays),
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Salario integral (PARAMETRIZADO · Art. 142)                ║
// ╚═══════════════════════════════════════════════════════════╝
/**
 * Subconjunto de PayrollRules que el cálculo de liquidación necesita. SOLO
 * parámetros de config — NUNCA constantes de ley en el código.
 */
export type SettlementRules = {
  /** (criterio contador) qué bonos son salariales — entran al integral. */
  salarialBonuses: SalarialBonus[];
  /** Días de bono vacacional/año (alícuota). */
  bonoVacacionalDays: number;
  /** Días de utilidades/año (alícuota). */
  utilidadesDays: number;
  /** Días de vacaciones/año (fracción). */
  vacacionesDays: number;
  /** Cómo se calculan las prestaciones (garantía / retroactivo / mejor). */
  prestacionesMethod: PrestacionesMethod;
  /** Tasa de interés sobre prestaciones (%, advisory). */
  prestacionesInterestPct: number;
  /** Si la causa Art. 78 gatilla la indemnización Art. 92. */
  ajena78Incluye92: boolean;
};

/**
 * Suma mensual (USD) de los bonos marcados salariales. La forma de cada bono es
 * laxa (`{ label?, [k] }`); se reconoce un monto mensual en `monthly_usd` |
 * `amount_usd` | `amount` (lo que el contador haya cargado). Lo que no trae monto
 * numérico aporta 0 — advisory, no inventamos.
 */
export function salarialBonusesMonthlyUsd(bonuses: SalarialBonus[]): number {
  if (!Array.isArray(bonuses)) return 0;
  let total = 0;
  for (const b of bonuses) {
    if (!b || typeof b !== "object") continue;
    const raw =
      (b as Record<string, unknown>).monthly_usd ??
      (b as Record<string, unknown>).amount_usd ??
      (b as Record<string, unknown>).amount;
    total += Math.max(0, num(raw));
  }
  return round2(total);
}

export type SalarioIntegral = {
  /** Salario normal diario = base mensual / 30. */
  normalDaily: number;
  /** Alícuota diaria de bono vacacional. */
  alicuotaBonoVacacional: number;
  /** Alícuota diaria de utilidades. */
  alicuotaUtilidades: number;
  /** Aporte diario de los bonos salariales. */
  salarialBonusesDaily: number;
  /** Salario integral DIARIO (Art. 142). */
  integralDaily: number;
  /** Salario integral mensual (integralDaily × 30, para mostrar). */
  integralMonthly: number;
};

/**
 * Salario integral (Art. 142) a partir del salario normal + alícuotas + bonos
 * salariales. CRITERIO (qué bonos, qué días) = `rules`, NUNCA constantes acá.
 *
 *   integral_diario = salario_normal_diario
 *                   + (salario_normal_diario × bono_vac_days) / 360   ← alícuota bono vac
 *                   + (salario_normal_diario × utilidades_days) / 360 ← alícuota utilidades
 *                   + Σ(bonos_salariales_mensuales) / 30
 *
 * Las alícuotas se prorratean sobre 360 (año comercial LOTTT). Advisory: el
 * contador valida días y bonos en la config.
 */
export function buildSalarioIntegral(
  baseSalaryMonthlyUsd: number,
  rules: SettlementRules,
): SalarioIntegral {
  const base = Math.max(0, num(baseSalaryMonthlyUsd));
  const normalDaily = round2(base / 30);

  const bonoVacDays = Math.max(0, num(rules.bonoVacacionalDays));
  const utilidadesDays = Math.max(0, num(rules.utilidadesDays));

  const alicuotaBonoVacacional = round2((normalDaily * bonoVacDays) / 360);
  const alicuotaUtilidades = round2((normalDaily * utilidadesDays) / 360);
  const salarialBonusesDaily = round2(salarialBonusesMonthlyUsd(rules.salarialBonuses) / 30);

  const integralDaily = round2(
    normalDaily + alicuotaBonoVacacional + alicuotaUtilidades + salarialBonusesDaily,
  );

  return {
    normalDaily,
    alicuotaBonoVacacional,
    alicuotaUtilidades,
    salarialBonusesDaily,
    integralDaily,
    integralMonthly: round2(integralDaily * 30),
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Cálculo del finiquito · calcLiquidacion() · PURO           ║
// ╚═══════════════════════════════════════════════════════════╝
export type CalcLiquidacionArgs = {
  cause: TerminationCause;
  hireDate: string;
  terminationDate: string;
  baseSalaryUsd: number;
  rules: SettlementRules;
  /** Saldo vivo de préstamos del empleado (se deduce). */
  loanBalanceUsd: number;
};

export type CalcLiquidacionTotals = {
  prestaciones_usd: number;
  fracciones_usd: number;
  indemnizacion_usd: number;
  intereses_usd: number;
  deductions_usd: number;
  net_usd: number;
  salario_integral_usd: number;
};

export type CalcLiquidacionResult = {
  lines: SettlementLine[];
  totals: CalcLiquidacionTotals;
  seniority: Seniority;
  integral: SalarioIntegral;
  /** Advisory siempre true en este slice: el contador valida la fórmula. */
  advisory: true;
};

/**
 * Prestaciones sociales (Art. 142). Calcula garantía Y retroactivo y aplica el
 * método de config (`mejor` = la mayor, decisión founder por defecto). ADVISORY:
 * la fórmula exacta (días por trimestre, 2 días/año adicionales, salario integral
 * histórico por trimestre) es criterio del contador — acá la aproximación
 * documentada sobre el ÚLTIMO integral.
 *
 *  - garantía:    15 días por trimestre completo × integral_diario.
 *  - retroactivo: 30 días por año (o fracción > 6 meses) × integral_diario.
 */
export function computePrestaciones(
  seniority: Seniority,
  integralDaily: number,
  method: PrestacionesMethod,
): { amount: number; days: number; method: PrestacionesMethod } {
  const daily = Math.max(0, num(integralDaily));

  // Garantía: 15 días por trimestre completo.
  const quarters = Math.floor(seniority.totalMonths / 3);
  const garantiaDays = 15 * quarters;
  const garantia = round2(garantiaDays * daily);

  // Retroactivo: 30 días por año; fracción > 6 meses cuenta como año completo.
  const retroactivoYears = seniority.years + (seniority.monthsInCurrentYear > 6 ? 1 : 0);
  const retroactivoDays = 30 * retroactivoYears;
  const retroactivo = round2(retroactivoDays * daily);

  if (method === "garantia") return { amount: garantia, days: garantiaDays, method };
  if (method === "retroactivo") return { amount: retroactivo, days: retroactivoDays, method };
  // 'mejor' → la que más favorece al trabajador (Art. 142 literal).
  return garantia >= retroactivo
    ? { amount: garantia, days: garantiaDays, method }
    : { amount: retroactivo, days: retroactivoDays, method };
}

/** ¿La causa gatilla la indemnización Art. 92 (duplica prestaciones)? */
export function causeTriggersArt92(
  cause: TerminationCause,
  ajena78Incluye92: boolean,
): boolean {
  if (cause === "despido_injustificado_92") return true;
  if (cause === "ajena_78") return ajena78Incluye92;
  return false; // renuncia_76, despido_justificado_79
}

/**
 * Finiquito de egreso LOTTT (BORRADOR / ADVISORY). Todo lo MECÁNICO; lo de
 * criterio llega en `rules`. El contador valida antes de pagar.
 */
export function calcLiquidacion(args: CalcLiquidacionArgs): CalcLiquidacionResult {
  const base = Math.max(0, num(args.baseSalaryUsd));
  const rules = args.rules;
  const lines: SettlementLine[] = [];

  const seniority = computeSeniority(args.hireDate, args.terminationDate);
  const integral = buildSalarioIntegral(base, rules);
  const normalDaily = integral.normalDaily;

  // 1) Prestaciones sociales (sobre el salario integral).
  const prest = computePrestaciones(seniority, integral.integralDaily, rules.prestacionesMethod);
  if (prest.amount > 0) {
    lines.push({
      kind: "prestaciones",
      label: `Prestaciones sociales (${prest.method})`,
      days: prest.days,
      base_usd: integral.integralDaily,
      amount_usd: prest.amount,
    });
  }

  // 2) Fracciones (sobre el salario NORMAL diario) — mecánico.
  const monthsFrac = seniority.monthsInCurrentYear / 12;

  const vacDays = round2(Math.max(0, num(rules.vacacionesDays)) * monthsFrac);
  const vacFrac = round2(vacDays * normalDaily);
  if (vacFrac > 0) {
    lines.push({
      kind: "vacaciones_frac",
      label: "Vacaciones fraccionadas",
      days: vacDays,
      base_usd: normalDaily,
      amount_usd: vacFrac,
    });
  }

  const bonoVacDays = round2(Math.max(0, num(rules.bonoVacacionalDays)) * monthsFrac);
  const bonoVacFrac = round2(bonoVacDays * normalDaily);
  if (bonoVacFrac > 0) {
    lines.push({
      kind: "bono_vacacional_frac",
      label: "Bono vacacional fraccionado",
      days: bonoVacDays,
      base_usd: normalDaily,
      amount_usd: bonoVacFrac,
    });
  }

  const utilDays = round2(Math.max(0, num(rules.utilidadesDays)) * monthsFrac);
  const utilFrac = round2(utilDays * normalDaily);
  if (utilFrac > 0) {
    lines.push({
      kind: "utilidades_frac",
      label: "Utilidades fraccionadas",
      days: utilDays,
      base_usd: normalDaily,
      amount_usd: utilFrac,
    });
  }

  const fracciones = round2(vacFrac + bonoVacFrac + utilFrac);

  // 3) Indemnización Art. 92 = monto de las prestaciones (solo si la causa la gatilla).
  let indemnizacion = 0;
  if (causeTriggersArt92(args.cause, rules.ajena78Incluye92)) {
    indemnizacion = prest.amount;
    if (indemnizacion > 0) {
      lines.push({
        kind: "indemnizacion_92",
        label: "Indemnización Art. 92",
        days: null,
        base_usd: integral.integralDaily,
        amount_usd: indemnizacion,
      });
    }
  }

  // 4) Intereses sobre prestaciones (advisory · tasa de config).
  const interestPct = Math.max(0, num(rules.prestacionesInterestPct));
  const intereses = round2(prest.amount * (interestPct / 100));
  if (intereses > 0) {
    lines.push({
      kind: "intereses",
      label: "Intereses sobre prestaciones",
      days: null,
      base_usd: prest.amount,
      amount_usd: intereses,
    });
  }

  // Bruto del finiquito (todo lo que suma).
  const gross = round2(prest.amount + fracciones + indemnizacion + intereses);

  // 5) Deducción de préstamos = min(saldo, bruto) — no descuenta de más.
  const loanBalance = Math.max(0, num(args.loanBalanceUsd));
  const deduction = round2(Math.min(loanBalance, gross));
  if (deduction > 0) {
    lines.push({
      kind: "deduccion_prestamo",
      label: "Deducción saldo de préstamo",
      days: null,
      base_usd: null,
      amount_usd: -deduction,
    });
  }

  const net = round2(gross - deduction);

  return {
    lines,
    totals: {
      prestaciones_usd: prest.amount,
      fracciones_usd: fracciones,
      indemnizacion_usd: indemnizacion,
      intereses_usd: intereses,
      deductions_usd: deduction,
      net_usd: net,
      salario_integral_usd: integral.integralMonthly,
    },
    seniority,
    integral,
    advisory: true,
  };
}

/** Extrae el subconjunto de criterio salarial desde un PayrollRules (o snapshot). */
export function settlementRulesFrom(
  rules: Partial<PayrollRules> | Record<string, unknown>,
): SettlementRules {
  const r = rules as Record<string, unknown>;
  const method = String(r.prestaciones_method ?? "mejor");
  return {
    salarialBonuses: Array.isArray(r.salarial_bonuses)
      ? (r.salarial_bonuses as SalarialBonus[])
      : [],
    bonoVacacionalDays: num(r.bono_vacacional_days),
    utilidadesDays: num(r.utilidades_days),
    vacacionesDays: num(r.vacaciones_days),
    prestacionesMethod: isPrestacionesMethod(method) ? method : "mejor",
    prestacionesInterestPct: num(r.prestaciones_interest_pct),
    ajena78Incluye92: r.ajena_78_incluye_92 === true,
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ KPIs del listado (PURO)                                    ║
// ╚═══════════════════════════════════════════════════════════╝
export type SettlementKpis = {
  total_count: number;
  /** Finiquitos del año en curso (no anulados). */
  draft_count: number;
  confirmed_count: number;
  /** Σ neto de los finiquitos vivos (no anulados). */
  net_usd: number;
};

export function computeSettlementKpis(
  rows: { status: SettlementStatus; total_net_usd: unknown }[],
): SettlementKpis {
  let draft = 0;
  let confirmed = 0;
  let net = 0;
  for (const s of rows) {
    if (s.status === "anulado") continue;
    if (s.status === "borrador") draft += 1;
    if (s.status === "confirmado") confirmed += 1;
    net += num(s.total_net_usd);
  }
  return {
    total_count: rows.length,
    draft_count: draft,
    confirmed_count: confirmed,
    net_usd: round2(net),
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input · generar finiquito (sin Zod)          ║
// ╚═══════════════════════════════════════════════════════════╝
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(s: string): boolean {
  return ISO_DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
}

export type GenerateSettlementInput = {
  employee_id: string;
  termination_cause: TerminationCause;
  termination_date: string;
  notes: string | null;
};

export function validateGenerateSettlementInput(
  raw: Partial<Record<string, unknown>>,
): { input: GenerateSettlementInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const employeeId = String(raw.employee_id ?? "").trim();
  if (!employeeId) errors.employee_id = "Selecciona el empleado.";

  const cause = String(raw.termination_cause ?? "").trim();
  if (!isTerminationCause(cause)) errors.termination_cause = "Causa de terminación inválida.";

  const terminationDate = String(raw.termination_date ?? "").trim();
  if (!terminationDate) errors.termination_date = "Indica la fecha de egreso.";
  else if (!isIsoDate(terminationDate)) errors.termination_date = "Fecha de egreso inválida.";

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      employee_id: employeeId,
      termination_cause: cause as TerminationCause,
      termination_date: terminationDate,
      notes: strOrNull(raw.notes),
    },
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Helpers de fecha (mecánico · sin TZ)                       ║
// ╚═══════════════════════════════════════════════════════════╝
type YMD = { y: number; m: number; d: number };

function parseIsoDate(iso: string): YMD | null {
  if (typeof iso !== "string" || !ISO_DATE_RE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** Días del mes (m es 1-based; admite m=0 → diciembre del año anterior). */
function daysInMonth(year: number, month1: number): number {
  // new Date(y, monthIndex+1, 0) da el último día; monthIndex = month1-1.
  return new Date(year, month1, 0).getDate();
}
