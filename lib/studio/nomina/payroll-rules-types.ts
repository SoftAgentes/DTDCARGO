/**
 * Tipos + helpers PUROS del módulo Nómina · Reglas de cálculo (SDD-0103 · Slice B).
 * Matchea el schema de supabase/migrations/0162_nomina_payroll_rules.sql.
 *
 * Es CONFIG, no cálculo: almacena los parámetros LOTTT (frecuencia, método de
 * días, montos base, deducciones, topes, recargos, provisiones) que el motor de
 * payroll_run consumirá en el Slice C. Acá no se computa ningún recibo.
 *
 * SDD-0653 fase A2b (migración 0556, EN ESPERA): la fila gana vigencia, fuente legal, monedas
 * explícitas, aportes patronales y escalas por antigüedad. Esos campos son OPCIONALES en
 * `PayrollRules`: sin la 0556 la base no los trae y todo sigue como en la fase A2a.
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

/** Moneda de un monto de las reglas (D4): el salario mínimo va en Bs; los bonos, en USD o Bs. */
export type MonedaMonto = "VES" | "USD";
export const MONEDAS_MONTO: MonedaMonto[] = ["VES", "USD"];
export function isMonedaMonto(v: unknown): v is MonedaMonto {
  return typeof v === "string" && (MONEDAS_MONTO as string[]).includes(v);
}

/** Tope legal de la contribución especial para las pensiones (Ley de Protección de las Pensiones, Art. 7). */
export const PENSION_CONTRIB_MAX_PCT = 15;

// ╔═══════════════════════════════════════════════════════════╗
// ║ Ajustes de la liquidación (SDD-0109 · migración 0179)      ║
// ╚═══════════════════════════════════════════════════════════╝
// SDD-0658: hasta esta spec no se leían ni se conservaban al guardar una versión nueva.

/** Cómo se calculan las prestaciones del finiquito. Espejo de `PrestacionesMethod` (settlement-types). */
export type MetodoPrestaciones = "garantia" | "retroactivo" | "mejor";

export const METODO_PRESTACIONES_OPTIONS: { value: MetodoPrestaciones; label: string }[] = [
  { value: "mejor", label: "El mayor de los dos (garantía o retroactivo)" },
  { value: "garantia", label: "Garantía (Art. 142, a y b)" },
  { value: "retroactivo", label: "Retroactivo (Art. 142, c)" },
];

export function isMetodoPrestaciones(v: unknown): v is MetodoPrestaciones {
  return v === "garantia" || v === "retroactivo" || v === "mejor";
}

/** Los ajustes de la liquidación que guarda cada versión de las reglas. */
export type AjustesLiquidacion = {
  prestaciones_method: MetodoPrestaciones;
  prestaciones_interest_pct: number;
  ajena_78_incluye_92: boolean;
};

/** Los valores con que nacen las columnas en la base (DEFAULT de la 0179). No son una recomendación legal. */
export const AJUSTES_LIQUIDACION_BASE: AjustesLiquidacion = {
  prestaciones_method: "mejor",
  prestaciones_interest_pct: 0,
  ajena_78_incluye_92: false,
};

/**
 * Lo que la versión nueva guarda: lo que llegó en el formulario; si no llegó (null), lo de la versión
 * vigente; y si la vigente tampoco lo trae, el valor con que nace la columna. Así guardar otra cosa
 * nunca devuelve estos ajustes a su valor de fábrica.
 */
export function resolverAjustesLiquidacion(
  input: Pick<PayrollRulesInput, "prestaciones_method" | "prestaciones_interest_pct" | "ajena_78_incluye_92">,
  vigente: Pick<PayrollRules, "prestaciones_method" | "prestaciones_interest_pct" | "ajena_78_incluye_92"> | null,
): AjustesLiquidacion {
  const metodoVigente = vigente?.prestaciones_method;
  const interesVigente = vigente?.prestaciones_interest_pct;
  const ajenaVigente = vigente?.ajena_78_incluye_92;
  return {
    prestaciones_method:
      input.prestaciones_method ??
      (isMetodoPrestaciones(metodoVigente) ? metodoVigente : AJUSTES_LIQUIDACION_BASE.prestaciones_method),
    prestaciones_interest_pct:
      input.prestaciones_interest_pct ??
      (typeof interesVigente === "number" && Number.isFinite(interesVigente)
        ? interesVigente
        : AJUSTES_LIQUIDACION_BASE.prestaciones_interest_pct),
    ajena_78_incluye_92:
      input.ajena_78_incluye_92 ??
      (typeof ajenaVigente === "boolean" ? ajenaVigente : AJUSTES_LIQUIDACION_BASE.ajena_78_incluye_92),
  };
}
/** LOTTT Art. 131: mínimo y máximo de días de utilidades. */
export const UTILIDADES_MAX_DAYS = 120;

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
  // Config de liquidación (SDD-0109 · additiva, migr 0179). Opcionales: filas
  // viejas y snapshots previos a 0179 no las traen → el motor usa defaults.
  prestaciones_method?: MetodoPrestaciones;
  prestaciones_interest_pct?: number;
  ajena_78_incluye_92?: boolean;
  // SDD-0653 A2b · migración 0556 (opcionales: sin la 0556 la base no los trae).
  /** Desde cuándo rige esta versión (AAAA-MM-DD). null = versión anterior a la 0556, sin fecha registrada. */
  vigente_desde?: string | null;
  /** La norma que respalda esta versión, texto corto. */
  fuente_legal?: string | null;
  // Lo que se configura: undefined = la base no tiene la 0556; null = la versión existe pero NO LO CONFIGURÓ
  // («sin configurar»; no cuenta como cumplido y nunca se lee como cero).
  /** Ingreso mínimo integral, en USD (D4). */
  ingreso_minimo_integral_usd?: number | null;
  cestaticket_moneda?: MonedaMonto;
  bono_guerra_moneda?: MonedaMonto;
  // Aportes del patrono (%), solo para el costo de la nómina (D5): no se descuentan al trabajador.
  sso_patronal_pct?: number | null;
  rpe_patronal_pct?: number | null;
  faov_patronal_pct?: number | null;
  inces_patronal_pct?: number | null;
  /** Retención al TRABAJADOR (no es un aporte del patrono): 0,5 % de las utilidades para el INCES. */
  inces_utilidades_pct?: number | null;
  pension_contrib_pct?: number | null;
  // Escalas por antigüedad (D10).
  vacaciones_extra_max?: number | null;
  bono_vacacional_max_days?: number | null;
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
  // SDD-0658 · ajustes de la liquidación (columnas de la 0179). null = no llegó: la versión nueva
  // conserva el de la vigente (resolverAjustesLiquidacion).
  prestaciones_method: MetodoPrestaciones | null;
  /** Interés sobre prestaciones, % de 0 a 100. */
  prestaciones_interest_pct: number | null;
  /** Si el despido por causa ajena (Art. 78) suma también la indemnización del Art. 92. */
  ajena_78_incluye_92: boolean | null;
  // SDD-0653 A2b: solo se persisten si la base tiene la 0556 (payroll-rules-queries.ts).
  /** AAAA-MM-DD, no posterior a hoy en Caracas; null = que la base ponga hoy en Caracas. */
  vigente_desde: string | null;
  fuente_legal: string | null;
  /** null = sin configurar. */
  ingreso_minimo_integral_usd: number | null;
  /** null = no llegó: la versión nueva hereda la de la vigente (nunca se impone USD). */
  cestaticket_moneda: MonedaMonto | null;
  bono_guerra_moneda: MonedaMonto | null;
  // null = sin configurar.
  sso_patronal_pct: number | null;
  rpe_patronal_pct: number | null;
  faov_patronal_pct: number | null;
  inces_patronal_pct: number | null;
  /** Retención al trabajador sobre sus utilidades. */
  inces_utilidades_pct: number | null;
  pension_contrib_pct: number | null;
  vacaciones_extra_max: number | null;
  bono_vacacional_max_days: number | null;
  notes: string | null;
};

/**
 * Defaults LOTTT plausibles (espejo de los DEFAULTs de la migración 0162) y, para lo que agregó la
 * 0556, las PROPUESTAS de la norma que el formulario muestra al crear una versión nueva, marcadas
 * «por confirmar». La base no tiene default para esos campos: una versión que no los trae queda
 * «sin configurar», y el validador no los rellena.
 */
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
  // SDD-0658: sin propuesta. El formulario muestra lo de la versión vigente; el validador no inventa nada.
  prestaciones_method: null,
  prestaciones_interest_pct: null,
  ajena_78_incluye_92: null,
  // Todo en dólares (D4): el formulario propone USD para los bonos cuando no hay versión de la cual heredar.
  // El validador NO usa esto: una moneda que no llega se hereda de la vigente.
  vigente_desde: null,
  fuente_legal: null,
  // Los aportes, el INCES de utilidades, las pensiones y las escalas de abajo son PROPUESTAS de la norma conocida,
  // por confirmar con el contador: el formulario las muestra como placeholder y solo se guardan si quien edita
  // pulsa «Usar la propuesta». Nada de esto es un default del validador ni de la base.
  // El ingreso mínimo integral es un anuncio sin Gaceta: no se propone ningún valor.
  ingreso_minimo_integral_usd: null,
  cestaticket_moneda: "USD",
  bono_guerra_moneda: "USD",
  sso_patronal_pct: 9,
  rpe_patronal_pct: 2,
  faov_patronal_pct: 2,
  inces_patronal_pct: 2,
  inces_utilidades_pct: 0.5,
  pension_contrib_pct: 9,
  vacaciones_extra_max: 15,
  bono_vacacional_max_days: 30,
  notes: null,
};

/** Días de utilidades nunca por debajo del mínimo legal (LOTTT Art. 131). */
export const UTILIDADES_MIN_DAYS = 30;

// Campos % (deducciones, recargos y aportes del patrono) que deben quedar entre 0 y 100.
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

// Porcentajes que agregó la 0556 (0–100): opcionales, vacío = «sin configurar» (null).
const PCT_OPCIONALES = [
  "sso_patronal_pct",
  "rpe_patronal_pct",
  "faov_patronal_pct",
  "inces_patronal_pct",
  "inces_utilidades_pct",
] as const;
type PctOpcional = (typeof PCT_OPCIONALES)[number];
const PCT_OPCIONAL_LABEL: Record<PctOpcional, string> = {
  sso_patronal_pct: "% IVSS del patrono",
  rpe_patronal_pct: "% RPE del patrono",
  faov_patronal_pct: "% FAOV del patrono",
  inces_patronal_pct: "% INCES del patrono",
  inces_utilidades_pct: "% INCES sobre utilidades (retención al trabajador)",
};

/** Un campo opcional sin valor (vacío, ausente o null) = «sin configurar». */
function sinValor(v: unknown): boolean {
  return v === undefined || v === null || String(v).trim() === "";
}

// Topes (≥ 0) expresados en nº de salarios mínimos.
const CAP_FIELDS = ["sso_cap_sm", "rpe_cap_sm"] as const;
type CapField = (typeof CAP_FIELDS)[number];
const CAP_LABEL: Record<CapField, string> = {
  sso_cap_sm: "Tope IVSS (SM)",
  rpe_cap_sm: "Tope RPE (SM)",
};

// Montos base (≥ 0). El salario mínimo va en Bs; cestaticket y bono, en la moneda que diga su campo
// *_moneda; el ingreso mínimo integral, en USD (D4, opcional). Tope: numeric(14,2) = 12 enteros y 2 decimales;
// pasarlo desbordaría la columna y la base rechazaría el guardado entero.
const MONEY_FIELDS = ["min_salary", "cestaticket", "bono_guerra"] as const;
type MoneyField = (typeof MONEY_FIELDS)[number];
const MONEY_LABEL: Record<MoneyField, string> = {
  min_salary: "Salario mínimo",
  cestaticket: "Cestaticket",
  bono_guerra: "Bono de guerra",
};
export const MONTO_MAX = 999_999_999_999.99;

// Días de provisiones (enteros ≥ 0; utilidades: 30 a 120).
const DAY_FIELDS = ["bono_vacacional_days", "vacaciones_days"] as const;
type DayField = (typeof DAY_FIELDS)[number];
const DAY_LABEL: Record<DayField, string> = {
  bono_vacacional_days: "Días de bono vacacional",
  vacaciones_days: "Días de vacaciones",
};

// Escalas por antigüedad que agregó la 0556 (enteros 0–365): opcionales, vacío = «sin configurar» (null).
const ESCALAS = ["vacaciones_extra_max", "bono_vacacional_max_days"] as const;
type Escala = (typeof ESCALAS)[number];
const ESCALA_LABEL: Record<Escala, string> = {
  vacaciones_extra_max: "Máximo de días adicionales de vacaciones",
  bono_vacacional_max_days: "Máximo de días de bono vacacional",
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Piso de «Rige desde»: la misma regla que la función `nomina_guardar_reglas` de la 0556 (2000-01-01). */
export const VIGENTE_DESDE_MIN = "2000-01-01";
/** ¿Es una fecha real AAAA-MM-DD (no 2026-02-31)? */
export function isFechaIso(v: unknown): v is string {
  if (typeof v !== "string" || !FECHA_ISO.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
export const FUENTE_LEGAL_MAX = 200;
/** Tope de las escalas por antigüedad (el CHECK de la 0556: 365). */
export const DIAS_ESCALA_MAX = 365;

/** Hoy en Caracas (AAAA-MM-DD): el día contra el que se compara la vigencia. No depende de la zona del equipo. */
export function hoyCaracas(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

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
  /** Hoy en Caracas (AAAA-MM-DD); por omisión, el reloj. Solo para probar. */
  hoy: string = hoyCaracas(),
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
    } else if (n > MONTO_MAX) {
      errors[f] = `${MONEY_LABEL[f]} no puede pasar de ${MONTO_MAX.toLocaleString("es-VE")}.`;
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

  // Utilidades entre 30 y 120 (LOTTT Art. 131).
  const utilidades = Number(raw.utilidades_days ?? PAYROLL_RULES_DEFAULTS.utilidades_days);
  if (!Number.isInteger(utilidades) || utilidades < UTILIDADES_MIN_DAYS) {
    errors.utilidades_days = `Días de utilidades: mínimo legal ${UTILIDADES_MIN_DAYS}.`;
  } else if (utilidades > UTILIDADES_MAX_DAYS) {
    errors.utilidades_days = `Días de utilidades: máximo legal ${UTILIDADES_MAX_DAYS}.`;
  }

  // Lo que agregó la 0556: todo opcional; vacío = «sin configurar» (null), nunca un valor inventado.
  const opcional: Record<PctOpcional, number | null> = {} as Record<PctOpcional, number | null>;
  for (const f of PCT_OPCIONALES) {
    if (sinValor(raw[f])) {
      opcional[f] = null;
      continue;
    }
    const n = Number(raw[f]);
    if (!Number.isFinite(n) || n < 0 || n > 100) errors[f] = `${PCT_OPCIONAL_LABEL[f]} debe estar entre 0 y 100.`;
    opcional[f] = round2(n);
  }

  // Contribución para las pensiones: 0 a 15 % (tope legal, Art. 7).
  let pension: number | null = null;
  if (!sinValor(raw.pension_contrib_pct)) {
    const n = Number(raw.pension_contrib_pct);
    if (!Number.isFinite(n) || n < 0 || n > PENSION_CONTRIB_MAX_PCT) {
      errors.pension_contrib_pct = `Contribución para las pensiones: entre 0 y ${PENSION_CONTRIB_MAX_PCT} % (tope legal).`;
    }
    pension = round2(n);
  }

  // Ingreso mínimo integral (USD): opcional, ≥ 0 y dentro de numeric(14,2).
  let ingresoMinimo: number | null = null;
  if (!sinValor(raw.ingreso_minimo_integral_usd)) {
    const n = Number(raw.ingreso_minimo_integral_usd);
    if (!Number.isFinite(n) || n < 0) errors.ingreso_minimo_integral_usd = "Ingreso mínimo integral no puede ser negativo.";
    else if (n > MONTO_MAX) {
      errors.ingreso_minimo_integral_usd = `Ingreso mínimo integral no puede pasar de ${MONTO_MAX.toLocaleString("es-VE")}.`;
    }
    ingresoMinimo = round2(n);
  }

  // Escalas por antigüedad: enteros de 0 a 365, opcionales.
  const escala: Record<Escala, number | null> = {} as Record<Escala, number | null>;
  for (const f of ESCALAS) {
    if (sinValor(raw[f])) {
      escala[f] = null;
      continue;
    }
    const n = Number(raw[f]);
    if (!Number.isInteger(n) || n < 0) errors[f] = `${ESCALA_LABEL[f]} debe ser un entero ≥ 0.`;
    else if (n > DIAS_ESCALA_MAX) errors[f] = `${ESCALA_LABEL[f]} no puede pasar de ${DIAS_ESCALA_MAX}.`;
    escala[f] = Math.trunc(num(n));
  }

  // Monedas de los bonos (D4): si no llegan, la versión nueva hereda la de la vigente (null aquí).
  let cestaticketMoneda: MonedaMonto | null = null;
  if (!sinValor(raw.cestaticket_moneda)) {
    const m = String(raw.cestaticket_moneda).trim();
    if (isMonedaMonto(m)) cestaticketMoneda = m;
    else errors.cestaticket_moneda = "Moneda del cestaticket inválida (Bs o USD).";
  }
  let bonoMoneda: MonedaMonto | null = null;
  if (!sinValor(raw.bono_guerra_moneda)) {
    const m = String(raw.bono_guerra_moneda).trim();
    if (isMonedaMonto(m)) bonoMoneda = m;
    else errors.bono_guerra_moneda = "Moneda del bono de guerra inválida (Bs o USD).";
  }

  // Vigencia (informativa) y fuente legal (D2): opcionales; la vigencia no puede ser posterior a hoy en Caracas.
  const vigenteRaw = strOrNull(raw.vigente_desde);
  if (vigenteRaw !== null) {
    if (!isFechaIso(vigenteRaw)) errors.vigente_desde = "Fecha de vigencia inválida (AAAA-MM-DD).";
    else if (vigenteRaw < VIGENTE_DESDE_MIN) errors.vigente_desde = `La fecha de vigencia no puede ser anterior a ${VIGENTE_DESDE_MIN}.`;
    else if (vigenteRaw > hoy) errors.vigente_desde = "La fecha de vigencia no puede ser posterior a hoy.";
  }
  const fuenteRaw = strOrNull(raw.fuente_legal);
  if (fuenteRaw !== null && fuenteRaw.length > FUENTE_LEGAL_MAX) {
    errors.fuente_legal = `La fuente legal admite hasta ${FUENTE_LEGAL_MAX} caracteres.`;
  }

  // Ajustes de la liquidación (SDD-0658): opcionales; vacío = conservar el de la versión vigente.
  let metodoPrestaciones: MetodoPrestaciones | null = null;
  if (!sinValor(raw.prestaciones_method)) {
    const m = String(raw.prestaciones_method).trim();
    if (isMetodoPrestaciones(m)) metodoPrestaciones = m;
    else errors.prestaciones_method = "Método de prestaciones inválido.";
  }
  let interesPrestaciones: number | null = null;
  if (!sinValor(raw.prestaciones_interest_pct)) {
    const n = Number(raw.prestaciones_interest_pct);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.prestaciones_interest_pct = "Interés sobre prestaciones debe estar entre 0 y 100.";
    }
    interesPrestaciones = round2(n);
  }
  let ajenaIncluye92: boolean | null = null;
  if (!sinValor(raw.ajena_78_incluye_92)) {
    const v = String(raw.ajena_78_incluye_92).trim().toLowerCase();
    if (v === "true" || v === "si" || v === "sí") ajenaIncluye92 = true;
    else if (v === "false" || v === "no") ajenaIncluye92 = false;
    else errors.ajena_78_incluye_92 = "Respuesta inválida (sí o no).";
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
      prestaciones_method: metodoPrestaciones,
      prestaciones_interest_pct: interesPrestaciones,
      ajena_78_incluye_92: ajenaIncluye92,
      vigente_desde: vigenteRaw,
      fuente_legal: fuenteRaw,
      ingreso_minimo_integral_usd: ingresoMinimo,
      cestaticket_moneda: cestaticketMoneda,
      bono_guerra_moneda: bonoMoneda,
      sso_patronal_pct: opcional.sso_patronal_pct,
      rpe_patronal_pct: opcional.rpe_patronal_pct,
      faov_patronal_pct: opcional.faov_patronal_pct,
      inces_patronal_pct: opcional.inces_patronal_pct,
      inces_utilidades_pct: opcional.inces_utilidades_pct,
      pension_contrib_pct: pension,
      vacaciones_extra_max: escala.vacaciones_extra_max,
      bono_vacacional_max_days: escala.bono_vacacional_max_days,
      notes: strOrNull(raw.notes),
    },
  };
}
