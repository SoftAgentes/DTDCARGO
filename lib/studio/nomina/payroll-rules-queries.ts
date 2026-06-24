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
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  num,
  type PayrollRules,
  type PayrollRulesInput,
  type SalarialBonus,
} from "./payroll-rules-types";

const PAYROLL_RULES_COLUMNS =
  "id, tenant_id, version, status, pay_frequency, day_method, " +
  "min_salary, cestaticket, bono_guerra, sso_pct, rpe_pct, faov_pct, " +
  "sso_cap_sm, rpe_cap_sm, overtime_pct, night_pct, holiday_pct, " +
  "utilidades_days, bono_vacacional_days, vacaciones_days, salarial_bonuses, " +
  "notes, created_by, created_at, updated_at, deleted_at";

/** Coacciona la fila cruda (numeric→number) a PayrollRules tipado. */
function rowToPayrollRules(row: Record<string, unknown>): PayrollRules {
  const bonuses = row.salarial_bonuses;
  return {
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
}

/** El ruleset vigente del tenant (o null si todavía no tiene uno). */
export async function getVigentePayrollRules(
  supabase: SupabaseClient,
): Promise<PayrollRules | null> {
  const { data, error } = await supabase
    .from("nomina_payroll_rules")
    .select(PAYROLL_RULES_COLUMNS)
    .eq("status", "vigente")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getVigentePayrollRules]", error.message);
    return null;
  }
  return data
    ? rowToPayrollRules(data as unknown as Record<string, unknown>)
    : null;
}

/**
 * Guarda una nueva versión del ruleset: archiva el vigente y crea la versión
 * siguiente como `vigente`. El índice parcial único de la migración garantiza
 * un solo vigente por tenant; por eso se archiva ANTES de insertar.
 *
 * Transacción lógica (sin RPC): si el insert falla tras archivar, la función
 * devuelve el error y el llamador no revalida. El índice único protege la
 * carrera (2.º insert concurrente → 23505).
 */
export async function upsertPayrollRules(
  supabase: SupabaseClient,
  tenantId: string,
  input: PayrollRulesInput,
  userId: string | null,
): Promise<{ data: PayrollRules | null; error: string | null }> {
  // 1) Versión actual (si hay vigente).
  const current = await getVigentePayrollRules(supabase);
  const nextVersion = current ? current.version + 1 : 1;

  // 2) Archivar el vigente (libera el índice único parcial).
  if (current) {
    const { error: archiveErr } = await supabase
      .from("nomina_payroll_rules")
      .update({ status: "archivada" })
      .eq("id", current.id)
      .eq("status", "vigente");
    if (archiveErr) {
      return { data: null, error: `No se pudo archivar la versión vigente: ${archiveErr.message}` };
    }
  }

  // 3) Insertar la versión nueva como vigente.
  const { data, error } = await supabase
    .from("nomina_payroll_rules")
    .insert({
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
    })
    .select(PAYROLL_RULES_COLUMNS)
    .single();

  if (error) {
    return { data: null, error: `No se pudo guardar las reglas: ${error.message}` };
  }
  return {
    data: rowToPayrollRules(data as unknown as Record<string, unknown>),
    error: null,
  };
}
