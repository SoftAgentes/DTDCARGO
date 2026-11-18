/**
 * Queries puras del módulo Nómina · Reglas de cálculo (SDD-0103 · Slice B).
 *
 * Funciones `(supabase: SupabaseClient, ...) => Promise<T>` consumidas desde
 * `page.tsx` y las server actions. La RLS filtra por tenant Y rol
 * (admin/accounting): un caller sin rol no recibe filas. Los `numeric` llegan
 * como string → se coercen con `num()`.
 *
 * Versionado: editar el ruleset **archiva** el vigente (status='archivada') e
 * **inserta** una versión nueva (version = prev.version + 1, o 1 si no había),
 * para que cada corte futuro (payroll_run, Slice C) pueda congelar el snapshot
 * de reglas que usó.
 *
 * SDD-0653 A2b · migración 0556 (EN ESPERA): la tabla gana vigencia, fuente legal,
 * monedas, aportes del patrono y escalas. Sin la 0556 esas columnas no existen:
 * la lectura reintenta sin ellas y la escritura las omite, y el módulo sigue
 * como en la fase A2a (`ampliada: false`). Con la 0556 aplicada se leen y se
 * guardan solas, sin otro cambio de código.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMonedaMonto,
  num,
  type PayrollRules,
  type PayrollRulesInput,
  type SalarialBonus,
} from "./payroll-rules-types";

const COLUMNAS_BASE =
  "id, tenant_id, version, status, pay_frequency, day_method, " +
  "min_salary, cestaticket, bono_guerra, sso_pct, rpe_pct, faov_pct, " +
  "sso_cap_sm, rpe_cap_sm, overtime_pct, night_pct, holiday_pct, " +
  "utilidades_days, bono_vacacional_days, vacaciones_days, salarial_bonuses, " +
  "notes, created_by, created_at, updated_at, deleted_at";

/**
 * Las columnas que agrega la 0556. La prueba de la migración comprueba que son
 * exactamente las del SQL (gemela): agregar una aquí sin la migración, o al revés, la pone en rojo.
 */
export const COLUMNAS_0556 = [
  "vigente_desde",
  "fuente_legal",
  "ingreso_minimo_integral_usd",
  "cestaticket_moneda",
  "bono_guerra_moneda",
  "sso_patronal_pct",
  "rpe_patronal_pct",
  "faov_patronal_pct",
  "inces_patronal_pct",
  "inces_utilidades_pct",
  "pension_contrib_pct",
  "vacaciones_extra_max",
  "bono_vacacional_max_days",
] as const;

const COLUMNAS_AMPLIADAS = `${COLUMNAS_BASE}, ${COLUMNAS_0556.join(", ")}`;

/** ¿El error es «esa columna no existe» (la base todavía no tiene la 0556)? */
export function faltaColumna(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(error.message ?? "")
  );
}

/** Un `numeric` opcional: undefined si la columna no vino (sin la 0556). */
function numOpt(v: unknown): number | undefined {
  return v === undefined ? undefined : num(v);
}

/** Coacciona la fila cruda (numeric→number) a PayrollRules tipado. */
function rowToPayrollRules(row: Record<string, unknown>): PayrollRules {
  const bonuses = row.salarial_bonuses;
  const rules: PayrollRules = {
    ...(row as PayrollRules),
    version: Math.trunc(num(row.version)),
    min_salary: num(row.min_salary),
    cestaticket: num(row.cestaticket),
    bono_guerra: num(row.bono_guerra),
    sso_pct: num(row.sso_pct),
    rpe_pct: num(row.rpe_pct),
    faov_pct: num(row.faov_pct),
    sso_cap_sm: num(row.sso_cap_sm),
    rpe_cap_sm: num(row.rpe_cap_sm),
    overtime_pct: num(row.overtime_pct),
    night_pct: num(row.night_pct),
    holiday_pct: num(row.holiday_pct),
    utilidades_days: Math.trunc(num(row.utilidades_days)),
    bono_vacacional_days: Math.trunc(num(row.bono_vacacional_days)),
    vacaciones_days: Math.trunc(num(row.vacaciones_days)),
    salarial_bonuses: Array.isArray(bonuses) ? (bonuses as SalarialBonus[]) : [],
  };
  // Lo de la 0556, solo si la columna vino: sin ella el campo queda sin definir.
  if (row.ingreso_minimo_integral_usd !== undefined) {
    rules.ingreso_minimo_integral_usd = numOpt(row.ingreso_minimo_integral_usd);
    rules.sso_patronal_pct = numOpt(row.sso_patronal_pct);
    rules.rpe_patronal_pct = numOpt(row.rpe_patronal_pct);
    rules.faov_patronal_pct = numOpt(row.faov_patronal_pct);
    rules.inces_patronal_pct = numOpt(row.inces_patronal_pct);
    rules.inces_utilidades_pct = numOpt(row.inces_utilidades_pct);
    rules.pension_contrib_pct = numOpt(row.pension_contrib_pct);
    rules.vacaciones_extra_max = row.vacaciones_extra_max === undefined ? undefined : Math.trunc(num(row.vacaciones_extra_max));
    rules.bono_vacacional_max_days =
      row.bono_vacacional_max_days === undefined ? undefined : Math.trunc(num(row.bono_vacacional_max_days));
    const monedaCestaticket = row.cestaticket_moneda;
    const monedaBono = row.bono_guerra_moneda;
    rules.cestaticket_moneda = isMonedaMonto(monedaCestaticket) ? monedaCestaticket : "VES";
    rules.bono_guerra_moneda = isMonedaMonto(monedaBono) ? monedaBono : "VES";
    rules.vigente_desde = typeof row.vigente_desde === "string" ? row.vigente_desde.slice(0, 10) : null;
    rules.fuente_legal = typeof row.fuente_legal === "string" ? row.fuente_legal : null;
  }
  return rules;
}

/**
 * El ruleset vigente del tenant y si la base tiene la 0556 (`ampliada`). Se intenta con
 * las columnas nuevas; si la base responde «columna inexistente» (no hay 0556), se
 * reintenta sin ellas. `ampliada` no depende de que haya filas: Postgres planifica la
 * consulta y rechaza la columna aunque la tabla esté vacía.
 */
export async function getVigentePayrollRulesConEstado(
  supabase: SupabaseClient,
): Promise<{ rules: PayrollRules | null; ampliada: boolean }> {
  let ampliada = true;
  let res = await supabase
    .from("nomina_payroll_rules")
    .select(COLUMNAS_AMPLIADAS)
    .eq("status", "vigente")
    .is("deleted_at", null)
    .maybeSingle();

  if (faltaColumna(res.error)) {
    ampliada = false;
    res = await supabase
      .from("nomina_payroll_rules")
      .select(COLUMNAS_BASE)
      .eq("status", "vigente")
      .is("deleted_at", null)
      .maybeSingle();
  }

  if (res.error) {
    console.error("[getVigentePayrollRules]", res.error.code ?? "", res.error.message);
    return { rules: null, ampliada };
  }
  return {
    rules: res.data ? rowToPayrollRules(res.data as unknown as Record<string, unknown>) : null,
    ampliada,
  };
}

/** El ruleset vigente del tenant (o null si todavía no tiene uno). */
export async function getVigentePayrollRules(
  supabase: SupabaseClient,
): Promise<PayrollRules | null> {
  return (await getVigentePayrollRulesConEstado(supabase)).rules;
}

/** Los campos de la 0556 para el insert; vigente_desde solo si vino (si no, manda el default de la base). */
function camposDeLa0556(input: PayrollRulesInput): Record<string, unknown> {
  return {
    ...(input.vigente_desde ? { vigente_desde: input.vigente_desde } : {}),
    fuente_legal: input.fuente_legal,
    ingreso_minimo_integral_usd: input.ingreso_minimo_integral_usd,
    cestaticket_moneda: input.cestaticket_moneda,
    bono_guerra_moneda: input.bono_guerra_moneda,
    sso_patronal_pct: input.sso_patronal_pct,
    rpe_patronal_pct: input.rpe_patronal_pct,
    faov_patronal_pct: input.faov_patronal_pct,
    inces_patronal_pct: input.inces_patronal_pct,
    inces_utilidades_pct: input.inces_utilidades_pct,
    pension_contrib_pct: input.pension_contrib_pct,
    vacaciones_extra_max: input.vacaciones_extra_max,
    bono_vacacional_max_days: input.bono_vacacional_max_days,
  };
}

/**
 * Guarda una nueva versión del ruleset: archiva el vigente y crea la versión
 * siguiente como `vigente`. El índice parcial único de la migración garantiza
 * un solo vigente por tenant; por eso se archiva ANTES de insertar.
 *
 * Transacción lógica (sin RPC): si el insert falla tras archivar, la función
 * devuelve el error y el llamador no revalida. El índice único protege la
 * carrera (2.º insert concurrente → 23505).
 *
 * Sin la 0556 (`ampliada: false`) el insert omite las columnas nuevas; si la base
 * las perdiera entre la lectura y el insert (un desarme), se reintenta sin ellas.
 */
export async function upsertPayrollRules(
  supabase: SupabaseClient,
  tenantId: string,
  input: PayrollRulesInput,
  userId: string | null,
): Promise<{ data: PayrollRules | null; error: string | null; ampliada: boolean }> {
  // 1) Versión actual (si hay vigente) y si la base tiene la 0556.
  const { rules: current, ampliada } = await getVigentePayrollRulesConEstado(supabase);
  const nextVersion = current ? current.version + 1 : 1;

  // 2) Archivar el vigente (libera el índice único parcial).
  if (current) {
    const { error: archiveErr } = await supabase
      .from("nomina_payroll_rules")
      .update({ status: "archivada" })
      .eq("id", current.id)
      .eq("status", "vigente");
    if (archiveErr) {
      return { data: null, error: `No se pudo archivar la versión vigente: ${archiveErr.message}`, ampliada };
    }
  }

  // 3) Insertar la versión nueva como vigente.
  const base = {
    tenant_id: tenantId,
    version: nextVersion,
    status: "vigente",
    pay_frequency: input.pay_frequency,
    day_method: input.day_method,
    min_salary: input.min_salary,
    cestaticket: input.cestaticket,
    bono_guerra: input.bono_guerra,
    sso_pct: input.sso_pct,
    rpe_pct: input.rpe_pct,
    faov_pct: input.faov_pct,
    sso_cap_sm: input.sso_cap_sm,
    rpe_cap_sm: input.rpe_cap_sm,
    overtime_pct: input.overtime_pct,
    night_pct: input.night_pct,
    holiday_pct: input.holiday_pct,
    utilidades_days: input.utilidades_days,
    bono_vacacional_days: input.bono_vacacional_days,
    vacaciones_days: input.vacaciones_days,
    salarial_bonuses: input.salarial_bonuses,
    notes: input.notes,
    created_by: userId,
  };

  let usadas = ampliada;
  let res = await supabase
    .from("nomina_payroll_rules")
    .insert(ampliada ? { ...base, ...camposDeLa0556(input) } : base)
    .select(ampliada ? COLUMNAS_AMPLIADAS : COLUMNAS_BASE)
    .single();
  if (ampliada && faltaColumna(res.error)) {
    usadas = false;
    res = await supabase.from("nomina_payroll_rules").insert(base).select(COLUMNAS_BASE).single();
  }

  if (res.error) {
    return { data: null, error: `No se pudo guardar las reglas: ${res.error.message}`, ampliada: usadas };
  }
  return {
    data: rowToPayrollRules(res.data as unknown as Record<string, unknown>),
    error: null,
    ampliada: usadas,
  };
}
