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
 * monedas, aportes del patrono y escalas, y la función `nomina_guardar_reglas`,
 * que guarda una versión nueva en UNA transacción. Sin la 0556 esas columnas y esa
 * función no existen: la lectura reintenta sin ellas y la escritura usa los dos
 * pasos de siempre (archivar, insertar) con restauración, y el módulo sigue como en
 * la fase A2a (`ampliada: false`). Con la 0556 aplicada se usan solas, sin otro
 * cambio de código.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMetodoPrestaciones,
  isMonedaMonto,
  num,
  resolverAjustesLiquidacion,
  type PayrollRules,
  type PayrollRulesInput,
  type SalarialBonus,
} from "./payroll-rules-types";

const COLUMNAS_BASE =
  "id, tenant_id, version, status, pay_frequency, day_method, " +
  "min_salary, cestaticket, bono_guerra, sso_pct, rpe_pct, faov_pct, " +
  "sso_cap_sm, rpe_cap_sm, overtime_pct, night_pct, holiday_pct, " +
  "utilidades_days, bono_vacacional_days, vacaciones_days, salarial_bonuses, " +
  // SDD-0658: los ajustes de la liquidación (0179, aplicada desde junio). Antes no se pedían y el
  // finiquito usaba siempre «mejor», interés 0 y Art. 92 no incluido.
  "prestaciones_method, prestaciones_interest_pct, ajena_78_incluye_92, " +
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

/** Un `numeric` opcional: undefined si la columna no vino (sin la 0556); null = «sin configurar», nunca cero. */
function numOpt(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  return v === null ? null : num(v);
}

/** Un entero opcional, con la misma regla que `numOpt`. */
function intOpt(v: unknown): number | null | undefined {
  const n = numOpt(v);
  return n === undefined || n === null ? n : Math.trunc(n);
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
  // SDD-0658 · los ajustes de la liquidación (0179), solo si la columna vino.
  if (row.prestaciones_method !== undefined) {
    rules.prestaciones_method = isMetodoPrestaciones(row.prestaciones_method) ? row.prestaciones_method : "mejor";
  }
  if (row.prestaciones_interest_pct !== undefined) {
    rules.prestaciones_interest_pct = num(row.prestaciones_interest_pct);
  }
  if (row.ajena_78_incluye_92 !== undefined) {
    rules.ajena_78_incluye_92 = row.ajena_78_incluye_92 === true;
  }
  // Lo de la 0556, solo si la columna vino: sin ella el campo queda sin definir.
  if (row.ingreso_minimo_integral_usd !== undefined) {
    rules.ingreso_minimo_integral_usd = numOpt(row.ingreso_minimo_integral_usd);
    rules.sso_patronal_pct = numOpt(row.sso_patronal_pct);
    rules.rpe_patronal_pct = numOpt(row.rpe_patronal_pct);
    rules.faov_patronal_pct = numOpt(row.faov_patronal_pct);
    rules.inces_patronal_pct = numOpt(row.inces_patronal_pct);
    rules.inces_utilidades_pct = numOpt(row.inces_utilidades_pct);
    rules.pension_contrib_pct = numOpt(row.pension_contrib_pct);
    rules.vacaciones_extra_max = intOpt(row.vacaciones_extra_max);
    rules.bono_vacacional_max_days = intOpt(row.bono_vacacional_max_days);
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

/** ¿El error es «esa función no existe» (la base todavía no tiene la 0556)? */
export function faltaFuncion(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42883" ||
    error.code === "PGRST202" ||
    /could not find the function|function .* does not exist/i.test(error.message ?? "")
  );
}

/** Lo que se le dice a quien guarda cuando la base cambia mientras tanto (B1). */
export const MSG_BASE_ACTUALIZANDO = "La base se está actualizando; recarga e inténtalo de nuevo.";
/**
 * SDD-0658: la función de la 0556 no conoce los ajustes de la liquidación; se fijan justo después, sobre
 * la versión que acaba de crear. Si ese segundo paso falla, la versión nueva quedó con los de fábrica.
 */
export const MSG_AJUSTES_LIQUIDACION_NO_GUARDADOS =
  "Las reglas se guardaron, pero no los ajustes de la liquidación (método, interés y Art. 92). Vuelve a guardar.";

/** Lo que se le dice cuando otra persona guardó una versión al mismo tiempo (B4). */
export const MSG_GUARDADO_CONCURRENTE = "Otra persona guardó al mismo tiempo; recarga.";

/** ¿El error es una violación de unicidad (23505): dos guardados simultáneos chocaron en la versión vigente? */
export function esConflictoConcurrente(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key value/i.test(error.message ?? "");
}

/**
 * Los datos que recibe `nomina_guardar_reglas`: los de siempre y los de la 0556. Lo que no llegó
 * no se manda: la moneda se hereda de la versión vigente y la fecha de vigencia es hoy en Caracas
 * (lo resuelve la función). Sin tenant ni autor: la función los toma de la sesión.
 */
export function datosParaGuardar(input: PayrollRulesInput): Record<string, unknown> {
  return {
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
    ...(input.vigente_desde ? { vigente_desde: input.vigente_desde } : {}),
    ...(input.cestaticket_moneda ? { cestaticket_moneda: input.cestaticket_moneda } : {}),
    ...(input.bono_guerra_moneda ? { bono_guerra_moneda: input.bono_guerra_moneda } : {}),
    fuente_legal: input.fuente_legal,
    ingreso_minimo_integral_usd: input.ingreso_minimo_integral_usd,
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
 * Guarda una nueva versión del ruleset: archiva el vigente y crea la versión siguiente como
 * `vigente`. El índice parcial único garantiza un solo vigente por tenant.
 *
 * Con la 0556 lo hace `nomina_guardar_reglas`, **en una sola transacción** (SECURITY INVOKER, con la
 * RLS de quien llama): si el insert falla (un CHECK, un desborde de numeric, un dato mal formado) el
 * archivado se deshace y el tenant conserva su versión vigente.
 *
 * Si la lectura dijo `ampliada` y aun así la función no existe (un desarme parcial o una caché de esquema
 * vieja), NO se degrada a los dos pasos: se devuelve un error y no se guarda nada (B1). Dos guardados
 * simultáneos (23505) dicen que otra persona guardó al mismo tiempo (B4).
 *
 * Sin la 0556 (`ampliada: false`) son los dos pasos de siempre, ahora con restauración: se archiva la
 * vigente, se inserta la nueva con las columnas de la 0162 y, si el insert falla, se vuelve a dejar
 * vigente la archivada. Si ni eso se pudo, el error lo dice con todas sus letras. Esa restauración
 * es de mejor esfuerzo: un corte del proceso entre archivar e insertar la deja sin hacer.
 */
export async function upsertPayrollRules(
  supabase: SupabaseClient,
  tenantId: string,
  input: PayrollRulesInput,
  userId: string | null,
): Promise<{ data: PayrollRules | null; error: string | null; ampliada: boolean }> {
  const { rules: current, ampliada } = await getVigentePayrollRulesConEstado(supabase);
  // SDD-0658: lo que no llegó en el formulario se conserva de la versión vigente.
  const ajustes = resolverAjustesLiquidacion(input, current);

  // 1) Con la 0556: una función, una transacción.
  if (ampliada) {
    const rpc = await supabase.rpc("nomina_guardar_reglas", { p_datos: datosParaGuardar(input) });
    // B1: la lectura vio las columnas nuevas pero la función no está (desarme parcial o caché de esquema
    // vieja). No se degrada a los dos pasos: no se guarda nada y se pide recargar.
    if (faltaFuncion(rpc.error)) {
      return { data: null, error: MSG_BASE_ACTUALIZANDO, ampliada: true };
    }
    if (rpc.error) {
      // B4: dos guardados simultáneos chocan en el índice de una sola versión vigente.
      if (esConflictoConcurrente(rpc.error)) {
        return { data: null, error: MSG_GUARDADO_CONCURRENTE, ampliada: true };
      }
      return {
        data: null,
        error: `No se pudo guardar las reglas: ${rpc.error.message}. La versión vigente no cambió.`,
        ampliada: true,
      };
    }
    // SDD-0658: la función no copia los ajustes de la liquidación; se fijan en la versión recién creada.
    const fijados = await supabase
      .from("nomina_payroll_rules")
      .update(ajustes)
      .eq("id", rpc.data as string);
    if (fijados.error) {
      return { data: null, error: MSG_AJUSTES_LIQUIDACION_NO_GUARDADOS, ampliada: true };
    }
    const leida = await supabase
      .from("nomina_payroll_rules")
      .select(COLUMNAS_AMPLIADAS)
      .eq("id", rpc.data as string)
      .single();
    if (leida.error || !leida.data) {
      return {
        data: null,
        error: "Las reglas se guardaron, pero no se pudo leer la versión nueva. Recarga la pantalla.",
        ampliada: true,
      };
    }
    return { data: rowToPayrollRules(leida.data as unknown as Record<string, unknown>), error: null, ampliada: true };
  }

  // 2) Sin la 0556: archivar, insertar y, si falla, restaurar.
  const nextVersion = current ? current.version + 1 : 1;
  if (current) {
    const { error: archiveErr } = await supabase
      .from("nomina_payroll_rules")
      .update({ status: "archivada" })
      .eq("id", current.id)
      .eq("status", "vigente");
    if (archiveErr) {
      return { data: null, error: `No se pudo archivar la versión vigente: ${archiveErr.message}`, ampliada: false };
    }
  }

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
      ...ajustes,
      notes: input.notes,
      created_by: userId,
    })
    .select(COLUMNAS_BASE)
    .single();

  if (error || !data) {
    // B4: otra persona guardó en medio. Ya hay una versión vigente (la suya): no se restaura nada.
    if (esConflictoConcurrente(error)) {
      return { data: null, error: MSG_GUARDADO_CONCURRENTE, ampliada: false };
    }
    const motivo = error?.message ?? "sin respuesta";
    if (current) {
      const restaurada = await supabase
        .from("nomina_payroll_rules")
        .update({ status: "vigente" })
        .eq("id", current.id)
        .eq("status", "archivada");
      if (restaurada.error) {
        return {
          data: null,
          error: `No se pudo guardar las reglas (${motivo}) y tampoco se pudo restaurar la versión ${current.version}: avisa a soporte antes de volver a guardar.`,
          ampliada: false,
        };
      }
      return {
        data: null,
        error: `No se pudo guardar las reglas: ${motivo}. La versión ${current.version} sigue vigente.`,
        ampliada: false,
      };
    }
    return { data: null, error: `No se pudo guardar las reglas: ${motivo}`, ampliada: false };
  }
  return { data: rowToPayrollRules(data as unknown as Record<string, unknown>), error: null, ampliada: false };
}
