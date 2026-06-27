/**
 * Server actions del módulo Nómina (SDD-0103 · Slice A).
 *
 * Empleados:
 *  - createEmployeeAction       · genera EMP-NNNN (next_employee_code) + insert.
 *  - updateEmployeeAction       · edita la ficha (no toca code).
 *  - setEmployeeStatusAction    · activo / inactivo / egresado.
 *  - softDeleteEmployeeAction   · deleted_at = now().
 * Prestadores:
 *  - createContractorAction / updateContractorAction / setContractorStatusAction
 *    / softDeleteContractorAction.
 *  - createContractorPaymentAction · registra un pago por sesión.
 *  - softDeleteContractorPaymentAction.
 * Asistencia + Feriados (Slice C):
 *  - createAttendanceAction / updateAttendanceAction / softDeleteAttendanceAction.
 *  - createHolidayAction / softDeleteHolidayAction.
 * Préstamos (Slice C):
 *  - createLoanAction / registerLoanInstallmentAction / cancelLoanAction
 *    / softDeleteLoanAction.
 * Amonestaciones (Slice C · Art. 79 LOTTT):
 *  - emitirAmonestacionAction (genera AM-NNNN) / anularAmonestacionAction.
 *
 * Es NÓMINA = dinero + PII. TODA mutación pasa el gate de edición por módulo
 * (moduleEditDenial, SDD-0085) ANTES de tocar nada: las server actions son
 * invocables directo como un endpoint → validan su propio rol (accounting/admin).
 * La RLS (tenant + rol) es el backstop final en la DB.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateEmployeeInput,
  isEmployeeStatus,
  type NominaActionState,
  type EmployeeStatus,
} from "@/lib/studio/nomina/employee-types";
import {
  validateContractorInput,
  validateContractorPaymentInput,
  isContractorStatus,
  type ContractorStatus,
} from "@/lib/studio/nomina/contractor-types";
import { validatePayrollRulesInput } from "@/lib/studio/nomina/payroll-rules-types";
import { upsertPayrollRules } from "@/lib/studio/nomina/payroll-rules-queries";
import {
  validateAttendanceInput,
  validateHolidayInput,
} from "@/lib/studio/nomina/attendance-types";
import {
  validateLoanInput,
  validateLoanInstallmentInput,
} from "@/lib/studio/nomina/loan-types";
import { getLoan, getLoanBalance } from "@/lib/studio/nomina/loan-queries";
import { validateWarningInput } from "@/lib/studio/nomina/warning-types";
import {
  validateGeneratePayrollRunInput,
  calcReciboDraft,
  calcRulesFrom,
  canTransitionPayrollRun,
  daysBetweenInclusive,
  isPayrollRunStatus,
  type PayrollRunStatus,
} from "@/lib/studio/nomina/payroll-run-types";
import { getVigentePayrollRules } from "@/lib/studio/nomina/payroll-rules-queries";
import { listEmployees } from "@/lib/studio/nomina/employee-queries";
import {
  getPayrollRun,
  findLivePayrollRunForPeriod,
  aggregateAttendanceByEmployee,
  activeLoanByEmployee,
  listPayrollRunLines,
} from "@/lib/studio/nomina/payroll-run-queries";
import type { PayrollRunLine } from "@/lib/studio/nomina/payroll-run-types";
import {
  validateGenerateSettlementInput,
  calcLiquidacion,
  settlementRulesFrom,
  canTransitionSettlement,
  type SettlementLine,
} from "@/lib/studio/nomina/settlement-types";
import {
  getSettlement,
  findLiveSettlementForEmployee,
  listSettlementLines,
  employeeLoanBalanceUsd,
} from "@/lib/studio/nomina/settlement-queries";
import type { SettlementLineRow } from "@/lib/studio/nomina/settlement-types";
import {
  postSettlementJournalEntry,
  voidSettlementJournalEntry,
} from "@/lib/studio/accounting/settlement-posting";
import {
  getAccountingSettings,
  isPeriodClosed,
} from "@/lib/studio/accounting/period-queries";
import { validateInviteInput } from "@/lib/studio/nomina/invite-types";
import { validateApproveRegistrationInput } from "@/lib/studio/nomina/registration-types";
import { getRegistration } from "@/lib/studio/nomina/registration-queries";

const MODULE_ID = "nomina";
const PATH = "/studio/nomina";

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Empleados                                                  ║
// ╚═══════════════════════════════════════════════════════════╝
function employeeRawFromForm(formData: FormData): Record<string, unknown> {
  return {
    full_name: strOrNull(formData.get("full_name")),
    national_id: strOrNull(formData.get("national_id")),
    position_label: strOrNull(formData.get("position_label")),
    department: strOrNull(formData.get("department")),
    phone: strOrNull(formData.get("phone")),
    email: strOrNull(formData.get("email")),
    salary_usd: strOrNull(formData.get("salary_usd")) ?? 0,
    hire_date: strOrNull(formData.get("hire_date")),
    birth_date: strOrNull(formData.get("birth_date")),
    bank_name: strOrNull(formData.get("bank_name")),
    bank_account_type: strOrNull(formData.get("bank_account_type")),
    bank_account: strOrNull(formData.get("bank_account")),
    status: strOrNull(formData.get("status")) ?? "activo",
    notes: strOrNull(formData.get("notes")),
  };
}

export async function createEmployeeAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateEmployeeInput(employeeRawFromForm(formData));
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: codeData, error: codeErr } = await supabase.rpc("next_employee_code", {
    p_tenant_id: tenantId,
  });
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del empleado." };
  }
  const employeeCode = String(codeData);

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase.from("nomina_employees").insert({
    tenant_id: tenantId,
    employee_code: employeeCode,
    ...input!,
    created_by: userResp.user?.id ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      // unique national_id por tenant, o carrera del code.
      if (/national_id/.test(error.message)) {
        return { fieldErrors: { national_id: "Ya existe un empleado con esa cédula." } };
      }
      return { error: "Carrera al generar el código. Intenta de nuevo." };
    }
    return { error: `No se pudo crear el empleado: ${error.message}` };
  }

  revalidatePath(PATH);
  return { ok: true, createdCode: employeeCode };
}

export async function updateEmployeeAction(
  employeeId: string,
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateEmployeeInput(employeeRawFromForm(formData));
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("nomina_employees")
    .update({ ...input! })
    .eq("id", employeeId);

  if (error) {
    if (error.code === "23505" && /national_id/.test(error.message)) {
      return { fieldErrors: { national_id: "Ya existe un empleado con esa cédula." } };
    }
    return { error: `No se pudo guardar el empleado: ${error.message}` };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function setEmployeeStatusAction(
  employeeId: string,
  status: EmployeeStatus,
): Promise<{ ok?: boolean; error?: string }> {
  if (!isEmployeeStatus(status)) return { error: "Estado inválido." };

  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_employees")
    .update({ status })
    .eq("id", employeeId);

  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

export async function softDeleteEmployeeAction(
  employeeId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_employees")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", employeeId);

  if (error) return { error: `No se pudo eliminar el empleado: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Prestadores                                                ║
// ╚═══════════════════════════════════════════════════════════╝
function contractorRawFromForm(formData: FormData): Record<string, unknown> {
  return {
    full_name: strOrNull(formData.get("full_name")),
    service: strOrNull(formData.get("service")),
    phone: strOrNull(formData.get("phone")),
    national_id: strOrNull(formData.get("national_id")),
    default_rate_usd: strOrNull(formData.get("default_rate_usd")) ?? 0,
    status: strOrNull(formData.get("status")) ?? "activo",
    notes: strOrNull(formData.get("notes")),
  };
}

export async function createContractorAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateContractorInput(contractorRawFromForm(formData));
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase.from("nomina_contractors").insert({
    tenant_id: tenantId,
    ...input!,
    created_by: userResp.user?.id ?? null,
  });

  if (error) return { error: `No se pudo crear el prestador: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateContractorAction(
  contractorId: string,
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateContractorInput(contractorRawFromForm(formData));
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("nomina_contractors")
    .update({ ...input! })
    .eq("id", contractorId);

  if (error) return { error: `No se pudo guardar el prestador: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

export async function setContractorStatusAction(
  contractorId: string,
  status: ContractorStatus,
): Promise<{ ok?: boolean; error?: string }> {
  if (!isContractorStatus(status)) return { error: "Estado inválido." };

  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_contractors")
    .update({ status })
    .eq("id", contractorId);

  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

export async function softDeleteContractorAction(
  contractorId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_contractors")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", contractorId);

  if (error) return { error: `No se pudo eliminar el prestador: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

export async function createContractorPaymentAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const raw = {
    contractor_id: strOrNull(formData.get("contractor_id")),
    paid_on: strOrNull(formData.get("paid_on")),
    concept: strOrNull(formData.get("concept")),
    amount_usd: strOrNull(formData.get("amount_usd")) ?? 0,
  };
  const { input, fieldErrors } = validateContractorPaymentInput(raw);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase.from("nomina_contractor_payments").insert({
    tenant_id: tenantId,
    contractor_id: input!.contractor_id,
    paid_on: input!.paid_on,
    concept: input!.concept,
    amount_usd: input!.amount_usd,
    created_by: userResp.user?.id ?? null,
  });

  if (error) {
    // El trigger nomina_contractor_payment_check rechaza un prestador de otro tenant.
    if (error.code === "check_violation" || /no pertenece al tenant/i.test(error.message)) {
      return { fieldErrors: { contractor_id: "El prestador no es de tu tenant." } };
    }
    return { error: `No se pudo registrar el pago: ${error.message}` };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function softDeleteContractorPaymentAction(
  paymentId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_contractor_payments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", paymentId);

  if (error) return { error: `No se pudo eliminar el pago: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Reglas de cálculo (payroll_rules · Slice B)                ║
// ╚═══════════════════════════════════════════════════════════╝
function payrollRulesRawFromForm(formData: FormData): Record<string, unknown> {
  return {
    pay_frequency: strOrNull(formData.get("pay_frequency")) ?? "mensual",
    day_method: strOrNull(formData.get("day_method")) ?? "30",
    min_salary: strOrNull(formData.get("min_salary")) ?? 0,
    cestaticket: strOrNull(formData.get("cestaticket")) ?? 0,
    bono_guerra: strOrNull(formData.get("bono_guerra")) ?? 0,
    sso_pct: strOrNull(formData.get("sso_pct")) ?? 0,
    rpe_pct: strOrNull(formData.get("rpe_pct")) ?? 0,
    faov_pct: strOrNull(formData.get("faov_pct")) ?? 0,
    sso_cap_sm: strOrNull(formData.get("sso_cap_sm")) ?? 0,
    rpe_cap_sm: strOrNull(formData.get("rpe_cap_sm")) ?? 0,
    overtime_pct: strOrNull(formData.get("overtime_pct")) ?? 0,
    night_pct: strOrNull(formData.get("night_pct")) ?? 0,
    holiday_pct: strOrNull(formData.get("holiday_pct")) ?? 0,
    utilidades_days: strOrNull(formData.get("utilidades_days")) ?? 30,
    bono_vacacional_days: strOrNull(formData.get("bono_vacacional_days")) ?? 0,
    vacaciones_days: strOrNull(formData.get("vacaciones_days")) ?? 0,
    salarial_bonuses: strOrNull(formData.get("salarial_bonuses")),
    notes: strOrNull(formData.get("notes")),
  };
}

/**
 * Guarda una nueva versión del ruleset LOTTT (archiva el vigente + sube version).
 * Es config, no cálculo: solo persiste params. Gate de rol (moduleEditDenial)
 * como PRIMER paso; la RLS por tenant+rol es el backstop en la DB.
 */
export async function savePayrollRulesAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validatePayrollRulesInput(
    payrollRulesRawFromForm(formData),
  );
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await upsertPayrollRules(
    supabase,
    tenantId,
    input!,
    userResp.user?.id ?? null,
  );
  if (error) return { error };

  revalidatePath(PATH);
  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Asistencia + Feriados (Slice C · insumo del motor)         ║
// ╚═══════════════════════════════════════════════════════════╝
function attendanceRawFromForm(formData: FormData): Record<string, unknown> {
  return {
    employee_id: strOrNull(formData.get("employee_id")),
    work_date: strOrNull(formData.get("work_date")),
    status: strOrNull(formData.get("status")) ?? "trabajado",
    overtime_hours: strOrNull(formData.get("overtime_hours")) ?? 0,
    night_hours: strOrNull(formData.get("night_hours")) ?? 0,
    notes: strOrNull(formData.get("notes")),
  };
}

export async function createAttendanceAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateAttendanceInput(attendanceRawFromForm(formData));
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase.from("nomina_attendance").insert({
    tenant_id: tenantId,
    employee_id: input!.employee_id,
    work_date: input!.work_date,
    status: input!.status,
    overtime_hours: input!.overtime_hours,
    night_hours: input!.night_hours,
    notes: input!.notes,
    created_by: userResp.user?.id ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { work_date: "Ya hay un registro de ese empleado para esa fecha." } };
    }
    // El trigger nomina_attendance_check rechaza un empleado de otro tenant.
    if (error.code === "check_violation" || /no pertenece al tenant/i.test(error.message)) {
      return { fieldErrors: { employee_id: "El empleado no es de tu tenant." } };
    }
    return { error: `No se pudo registrar la asistencia: ${error.message}` };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateAttendanceAction(
  attendanceId: string,
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateAttendanceInput(attendanceRawFromForm(formData));
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("nomina_attendance")
    .update({
      status: input!.status,
      overtime_hours: input!.overtime_hours,
      night_hours: input!.night_hours,
      notes: input!.notes,
    })
    .eq("id", attendanceId);

  if (error) return { error: `No se pudo guardar la asistencia: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

export async function softDeleteAttendanceAction(
  attendanceId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_attendance")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", attendanceId);

  if (error) return { error: `No se pudo eliminar el registro: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

export async function createHolidayAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateHolidayInput({
    holiday_date: strOrNull(formData.get("holiday_date")),
    label: strOrNull(formData.get("label")),
    scope: strOrNull(formData.get("scope")) ?? "nacional",
  });
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase.from("nomina_holidays").insert({
    tenant_id: tenantId,
    holiday_date: input!.holiday_date,
    label: input!.label,
    scope: input!.scope,
    created_by: userResp.user?.id ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { holiday_date: "Ya hay un feriado en esa fecha." } };
    }
    return { error: `No se pudo agregar el feriado: ${error.message}` };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function softDeleteHolidayAction(
  holidayId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_holidays")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", holidayId);

  if (error) return { error: `No se pudo eliminar el feriado: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Préstamos (loans · Slice C)                                ║
// ╚═══════════════════════════════════════════════════════════╝
function loanRawFromForm(formData: FormData): Record<string, unknown> {
  return {
    employee_id: strOrNull(formData.get("employee_id")),
    principal_usd: strOrNull(formData.get("principal_usd")) ?? 0,
    installment_usd: strOrNull(formData.get("installment_usd")) ?? 0,
    installments_total: strOrNull(formData.get("installments_total")) ?? 1,
    granted_on: strOrNull(formData.get("granted_on")),
    concept: strOrNull(formData.get("concept")),
    notes: strOrNull(formData.get("notes")),
  };
}

/**
 * Crea un préstamo a un empleado. El descuento real en el recibo lo hará el
 * motor (payroll_run, Slice posterior); acá solo se registra. Gate de rol
 * (moduleEditDenial) PRIMERO; la RLS por tenant+rol es el backstop en la DB.
 */
export async function createLoanAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateLoanInput(loanRawFromForm(formData));
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase.from("nomina_loans").insert({
    tenant_id: tenantId,
    employee_id: input!.employee_id,
    principal_usd: input!.principal_usd,
    installment_usd: input!.installment_usd,
    installments_total: input!.installments_total,
    granted_on: input!.granted_on,
    concept: input!.concept,
    notes: input!.notes,
    created_by: userResp.user?.id ?? null,
  });

  if (error) {
    // FK del empleado → 23503 si el empleado no es del tenant (RLS lo oculta).
    if (error.code === "23503" || /employee_id/.test(error.message)) {
      return { fieldErrors: { employee_id: "El empleado no es de tu tenant." } };
    }
    return { error: `No se pudo registrar el préstamo: ${error.message}` };
  }

  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Registra una cuota/abono contra un préstamo. Si la cuota lleva el saldo
 * (principal − Σ cuotas) a 0, marca el préstamo como 'pagado'. El saldo es
 * derivado: se relee de la DB antes de decidir el estado.
 */
export async function registerLoanInstallmentAction(
  loanId: string,
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const raw = {
    loan_id: loanId,
    paid_on: strOrNull(formData.get("paid_on")),
    amount_usd: strOrNull(formData.get("amount_usd")) ?? 0,
  };
  const { input, fieldErrors } = validateLoanInstallmentInput(raw);
  if (fieldErrors) return { fieldErrors };

  const loan = await getLoan(supabase, loanId);
  if (!loan) return { error: "El préstamo no existe o no es de tu tenant." };
  if (loan.status !== "activo") {
    return { error: "El préstamo no está activo." };
  }

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase.from("nomina_loan_installments").insert({
    tenant_id: tenantId,
    loan_id: input!.loan_id,
    paid_on: input!.paid_on,
    amount_usd: input!.amount_usd,
    created_by: userResp.user?.id ?? null,
  });

  if (error) {
    // El trigger nomina_loan_installment_check rechaza un préstamo de otro tenant.
    if (error.code === "check_violation" || /no pertenece al tenant/i.test(error.message)) {
      return { error: "El préstamo no es de tu tenant." };
    }
    return { error: `No se pudo registrar la cuota: ${error.message}` };
  }

  // Si el saldo llegó a 0, el préstamo queda saldado.
  const balance = await getLoanBalance(supabase, loanId, loan.principal_usd);
  if (balance <= 0) {
    await supabase
      .from("nomina_loans")
      .update({ status: "pagado" })
      .eq("id", loanId)
      .eq("status", "activo");
  }

  revalidatePath(PATH);
  return { ok: true };
}

/** Cancela un préstamo (status='cancelado'); el motor deja de descontar. */
export async function cancelLoanAction(
  loanId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_loans")
    .update({ status: "cancelado" })
    .eq("id", loanId)
    .eq("status", "activo");

  if (error) return { error: `No se pudo cancelar el préstamo: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

/** Soft delete de un préstamo (deleted_at = now()). */
export async function softDeleteLoanAction(
  loanId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_loans")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", loanId);

  if (error) return { error: `No se pudo eliminar el préstamo: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Amonestaciones (warnings · Slice C)                        ║
// ╚═══════════════════════════════════════════════════════════╝
function warningRawFromForm(formData: FormData): Record<string, unknown> {
  return {
    employee_id: strOrNull(formData.get("employee_id")),
    issued_on: strOrNull(formData.get("issued_on")),
    cause: strOrNull(formData.get("cause")),
    narrative: strOrNull(formData.get("narrative")),
    witnesses: strOrNull(formData.get("witnesses")),
    severity: strOrNull(formData.get("severity")) ?? "leve",
    notes: strOrNull(formData.get("notes")),
  };
}

/**
 * Emite una amonestación (acta disciplinaria, Art. 79 LOTTT): genera AM-NNNN
 * (next_warning_code) + insert. Gate de rol (moduleEditDenial) como PRIMER paso;
 * el trigger de coherencia (employee_id del mismo tenant) y la RLS por tenant+rol
 * son el backstop en la DB.
 */
export async function emitirAmonestacionAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateWarningInput(warningRawFromForm(formData));
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: codeData, error: codeErr } = await supabase.rpc("next_warning_code", {
    p_tenant_id: tenantId,
  });
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de la amonestación." };
  }
  const warningCode = String(codeData);

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase.from("nomina_warnings").insert({
    tenant_id: tenantId,
    warning_code: warningCode,
    employee_id: input!.employee_id,
    issued_on: input!.issued_on,
    cause: input!.cause,
    narrative: input!.narrative,
    witnesses: input!.witnesses,
    severity: input!.severity,
    notes: input!.notes,
    created_by: userResp.user?.id ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Carrera al generar el código. Intenta de nuevo." };
    }
    // El trigger nomina_warning_check rechaza un empleado de otro tenant.
    if (error.code === "check_violation" || /no pertenece al tenant/i.test(error.message)) {
      return { fieldErrors: { employee_id: "El empleado no es de tu tenant." } };
    }
    return { error: `No se pudo emitir la amonestación: ${error.message}` };
  }

  revalidatePath(PATH);
  return { ok: true, createdCode: warningCode };
}

/** Anula una amonestación (status='anulada'). No la borra: queda el rastro. */
export async function anularAmonestacionAction(
  warningId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_warnings")
    .update({ status: "anulada" })
    .eq("id", warningId);

  if (error) return { error: `No se pudo anular la amonestación: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Corte del período (payroll_run · Slice motor — ESTRUCTURA) ║
// ╚═══════════════════════════════════════════════════════════╝
//
// Genera el corte de nómina del período + sus renglones (recibos) en
// BORRADOR / ADVISORY (solo cálculo MECÁNICO; calcReciboDraft). Congela las
// reglas vigentes (rules_snapshot). NO genera asiento contable, NO consume
// salarial_bonuses, NO calcula liquidación (frontera del slice).
//
// TODO: asiento al confirmar (slice motor + contador) — integra SDD-0079.

/** Recalcula y persiste los renglones de un corte en borrador (helper interno). */
async function buildRunLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  run: { id: string; tenant_id: string; period_start: string; period_end: string; rules_snapshot: Record<string, unknown> },
): Promise<{ error: string | null; totals: { gross: number; deductions: number; net: number } }> {
  // Reglas mecánicas del snapshot congelado del corte (NO se relee payroll_rules,
  // así un corte viejo no cambia si editan las reglas después).
  const snap = run.rules_snapshot as Record<string, unknown>;
  const calcRules = calcRulesFrom({
    pay_frequency: (snap.pay_frequency as "mensual" | "quincenal" | "semanal") ?? "mensual",
    day_method: (snap.day_method as "30" | "real") ?? "30",
    min_salary: Number(snap.min_salary ?? 0),
    sso_pct: Number(snap.sso_pct ?? 0),
    rpe_pct: Number(snap.rpe_pct ?? 0),
    faov_pct: Number(snap.faov_pct ?? 0),
    sso_cap_sm: Number(snap.sso_cap_sm ?? 0),
    rpe_cap_sm: Number(snap.rpe_cap_sm ?? 0),
    overtime_pct: Number(snap.overtime_pct ?? 0),
    night_pct: Number(snap.night_pct ?? 0),
  });

  const employees = await listEmployees(supabase);
  const activeEmployees = employees.filter((e) => e.status === "activo");

  const periodDays = daysBetweenInclusive(run.period_start, run.period_end);
  const attendanceByEmp = await aggregateAttendanceByEmployee(
    supabase,
    run.period_start,
    run.period_end,
  );
  const loanByEmp = await activeLoanByEmployee(supabase, employees);

  // Limpia los renglones previos (regeneración mientras borrador).
  const { error: delErr } = await supabase
    .from("nomina_payroll_run_lines")
    .delete()
    .eq("run_id", run.id);
  if (delErr) {
    return { error: `No se pudieron limpiar los renglones: ${delErr.message}`, totals: { gross: 0, deductions: 0, net: 0 } };
  }

  let gross = 0;
  let deductions = 0;
  let net = 0;

  const rows = activeEmployees.map((e) => {
    const attendance = attendanceByEmp.get(e.id) ?? {
      worked_days: 0,
      overtime_hours: 0,
      night_hours: 0,
    };
    const loan = loanByEmp.get(e.id);
    const recibo = calcReciboDraft({
      base_salary_usd: e.salary_usd,
      rules: calcRules,
      period_days: periodDays,
      attendance,
      loan: loan ? { installment_usd: loan.installment_usd, balance_usd: loan.balance_usd } : null,
    });
    gross += recibo.gross_usd;
    deductions += recibo.total_deductions_usd;
    net += recibo.net_usd;
    return {
      tenant_id: run.tenant_id,
      run_id: run.id,
      employee_id: e.id,
      employee_code: e.employee_code,
      employee_name: e.full_name,
      base_salary_usd: e.salary_usd,
      worked_days: recibo.worked_days,
      overtime_hours: attendance.overtime_hours,
      night_hours: attendance.night_hours,
      overtime_pay_usd: recibo.overtime_pay_usd,
      night_pay_usd: recibo.night_pay_usd,
      loan_deduction_usd: recibo.loan_deduction_usd,
      statutory_deductions_usd: recibo.statutory_deductions_usd,
      gross_usd: recibo.gross_usd,
      total_deductions_usd: recibo.total_deductions_usd,
      net_usd: recibo.net_usd,
      breakdown: recibo.breakdown,
    };
  });

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("nomina_payroll_run_lines").insert(rows);
    if (insErr) {
      return { error: `No se pudieron generar los recibos: ${insErr.message}`, totals: { gross: 0, deductions: 0, net: 0 } };
    }
  }

  return {
    error: null,
    totals: {
      gross: Math.round((gross + Number.EPSILON) * 100) / 100,
      deductions: Math.round((deductions + Number.EPSILON) * 100) / 100,
      net: Math.round((net + Number.EPSILON) * 100) / 100,
    },
  };
}

/**
 * Genera un corte de nómina del período: snapshot de las reglas vigentes → crea
 * el run en borrador → computa los renglones (recibos BORRADOR/ADVISORY de los
 * empleados activos) → rollup de totales. Si ya hay un corte vivo del período,
 * devuelve error claro. Gate de rol (moduleEditDenial) PRIMERO; RLS = backstop.
 */
export async function generatePayrollRunAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateGeneratePayrollRunInput({
    period_label: strOrNull(formData.get("period_label")),
    period_start: strOrNull(formData.get("period_start")),
    period_end: strOrNull(formData.get("period_end")),
    notes: strOrNull(formData.get("notes")),
  });
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  // ¿Ya hay un corte vivo (no anulado) para este período?
  const existing = await findLivePayrollRunForPeriod(supabase, input!.period_label);
  if (existing) {
    return {
      fieldErrors: {
        period_label: `Ya existe un corte ${input!.period_label} (${existing.status}). Anúlalo para regenerar.`,
      },
    };
  }

  // Reglas vigentes a congelar en el corte.
  const rules = await getVigentePayrollRules(supabase);
  if (!rules) {
    return { error: "Define primero las reglas de cálculo (pestaña Reglas)." };
  }

  const { data: userResp } = await supabase.auth.getUser();

  // 1) Crea el corte en borrador con el snapshot congelado de las reglas.
  const { data: runData, error: runErr } = await supabase
    .from("nomina_payroll_runs")
    .insert({
      tenant_id: tenantId,
      period_label: input!.period_label,
      period_start: input!.period_start,
      period_end: input!.period_end,
      pay_frequency: rules.pay_frequency,
      day_method: rules.day_method,
      rules_snapshot: rules,
      status: "borrador",
      notes: input!.notes,
      created_by: userResp.user?.id ?? null,
    })
    .select("id, tenant_id, period_start, period_end, rules_snapshot")
    .single();

  if (runErr || !runData) {
    if (runErr?.code === "23505") {
      return { fieldErrors: { period_label: "Ya hay un corte vivo para ese período." } };
    }
    return { error: `No se pudo crear el corte: ${runErr?.message ?? "desconocido"}` };
  }

  // 2) Computa y persiste los renglones (recibos).
  const built = await buildRunLines(supabase, {
    id: String(runData.id),
    tenant_id: String(runData.tenant_id),
    period_start: String(runData.period_start),
    period_end: String(runData.period_end),
    rules_snapshot: (runData.rules_snapshot ?? {}) as Record<string, unknown>,
  });
  if (built.error) return { error: built.error };

  // 3) Rollup de totales en el corte.
  await supabase
    .from("nomina_payroll_runs")
    .update({
      total_gross_usd: built.totals.gross,
      total_deductions_usd: built.totals.deductions,
      total_net_usd: built.totals.net,
    })
    .eq("id", runData.id);

  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Regenera los renglones de un corte (solo si está en borrador): borra y
 * recomputa con el snapshot de reglas congelado del propio corte.
 */
export async function regeneratePayrollRunLinesAction(
  runId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const run = await getPayrollRun(supabase, runId);
  if (!run) return { error: "El corte no existe o no es de tu tenant." };
  if (run.status !== "borrador") {
    return { error: "Solo se pueden regenerar cortes en borrador." };
  }

  const built = await buildRunLines(supabase, {
    id: run.id,
    tenant_id: run.tenant_id,
    period_start: run.period_start,
    period_end: run.period_end,
    rules_snapshot: (run.rules_snapshot ?? {}) as Record<string, unknown>,
  });
  if (built.error) return { error: built.error };

  await supabase
    .from("nomina_payroll_runs")
    .update({
      total_gross_usd: built.totals.gross,
      total_deductions_usd: built.totals.deductions,
      total_net_usd: built.totals.net,
    })
    .eq("id", runId)
    .eq("status", "borrador");

  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Cambia el estado del corte (borrador→confirmado→pagado · →anulado). Rechaza
 * saltos inválidos. Marca confirmed_at / paid_at. SIN asiento contable en este
 * slice (TODO: asiento al confirmar — slice motor + contador).
 */
export async function setPayrollRunStatusAction(
  runId: string,
  status: PayrollRunStatus,
): Promise<{ ok?: boolean; error?: string }> {
  if (!isPayrollRunStatus(status)) return { error: "Estado inválido." };

  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const run = await getPayrollRun(supabase, runId);
  if (!run) return { error: "El corte no existe o no es de tu tenant." };

  if (!canTransitionPayrollRun(run.status, status)) {
    return { error: `No se puede pasar de ${run.status} a ${status}.` };
  }

  const patch: Record<string, unknown> = { status };
  if (status === "confirmado") patch.confirmed_at = new Date().toISOString();
  if (status === "pagado") patch.paid_at = new Date().toISOString();

  const { error } = await supabase
    .from("nomina_payroll_runs")
    .update(patch)
    .eq("id", runId)
    .eq("status", run.status); // optimista: solo si no cambió mientras tanto

  if (error) return { error: `No se pudo cambiar el estado del corte: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

/** Lee los renglones (recibos) de un corte. Read-only (gate de view por la page). */
export async function listPayrollRunLinesAction(
  runId: string,
): Promise<{ lines?: PayrollRunLine[]; error?: string }> {
  const supabase = await createClient();
  // Lectura: la RLS por tenant+rol ya restringe; no muta nada.
  const run = await getPayrollRun(supabase, runId);
  if (!run) return { error: "El corte no existe o no es de tu tenant." };
  const lines = await listPayrollRunLines(supabase, runId);
  return { lines };
}

/** Soft delete de un corte (deleted_at = now()). */
export async function softDeletePayrollRunAction(
  runId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_payroll_runs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", runId);

  if (error) return { error: `No se pudo eliminar el corte: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Liquidación / finiquito (settlements · SDD-0109)           ║
// ╚═══════════════════════════════════════════════════════════╝
//
// Genera el finiquito de egreso (LOTTT) en BORRADOR / ADVISORY: calcula
// prestaciones + fracciones + indemnización Art. 92 + intereses − deducciones,
// con el criterio salarial como PARÁMETRO (calcLiquidacion). Congela el ruleset
// (rules_snapshot). Al CONFIRMAR genera el asiento de provisión (SDD-0079);
// el pago real sale luego por Tesorería. El contador valida antes de pagar.

/** Persiste los renglones del desglose de un finiquito en borrador (helper). */
async function writeSettlementLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  settlementId: string,
  lines: SettlementLine[],
): Promise<string | null> {
  const { error: delErr } = await supabase
    .from("nomina_settlement_lines")
    .delete()
    .eq("settlement_id", settlementId);
  if (delErr) return `No se pudieron limpiar los renglones: ${delErr.message}`;

  if (lines.length === 0) return null;

  const rows = lines.map((l) => ({
    tenant_id: tenantId,
    settlement_id: settlementId,
    kind: l.kind,
    label: l.label,
    days: l.days,
    base_usd: l.base_usd,
    amount_usd: l.amount_usd,
  }));
  const { error: insErr } = await supabase.from("nomina_settlement_lines").insert(rows);
  if (insErr) return `No se pudieron generar los renglones: ${insErr.message}`;
  return null;
}

/**
 * Genera un finiquito para un empleado por causa de terminación. Congela las
 * reglas vigentes, computa el desglose (advisory) y crea el finiquito en
 * borrador. Si ya hay uno vivo del empleado, error claro. Gate de rol PRIMERO.
 */
export async function generarFiniquitoAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateGenerateSettlementInput({
    employee_id: strOrNull(formData.get("employee_id")),
    termination_cause: strOrNull(formData.get("termination_cause")),
    termination_date: strOrNull(formData.get("termination_date")),
    notes: strOrNull(formData.get("notes")),
  });
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  // ¿Ya hay finiquito vivo del empleado?
  const existing = await findLiveSettlementForEmployee(supabase, input!.employee_id);
  if (existing) {
    return {
      fieldErrors: {
        employee_id: `El empleado ya tiene un finiquito ${existing.settlement_code} (${existing.status}). Anúlalo para regenerar.`,
      },
    };
  }

  // Datos del empleado (sueldo + ingreso) — de la ficha.
  const employees = await listEmployees(supabase);
  const employee = employees.find((e) => e.id === input!.employee_id);
  if (!employee) return { fieldErrors: { employee_id: "El empleado no es de tu tenant." } };
  if (!employee.hire_date) {
    return { fieldErrors: { employee_id: "El empleado no tiene fecha de ingreso en la ficha." } };
  }
  if (input!.termination_date < employee.hire_date) {
    return { fieldErrors: { termination_date: "El egreso no puede ser anterior al ingreso." } };
  }

  // Reglas vigentes (criterio salarial) a congelar.
  const rules = await getVigentePayrollRules(supabase);
  if (!rules) {
    return { error: "Define primero las reglas de cálculo (pestaña Reglas)." };
  }

  const loanBalanceUsd = await employeeLoanBalanceUsd(supabase, {
    id: employee.id,
    full_name: employee.full_name,
    employee_code: employee.employee_code,
  });

  const calc = calcLiquidacion({
    cause: input!.termination_cause,
    hireDate: employee.hire_date,
    terminationDate: input!.termination_date,
    baseSalaryUsd: employee.salary_usd,
    rules: settlementRulesFrom(rules),
    loanBalanceUsd,
  });

  // next_settlement_code (correlativo LIQ-NNNN).
  const { data: codeData, error: codeErr } = await supabase.rpc("next_settlement_code", {
    p_tenant_id: tenantId,
  });
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del finiquito." };
  }
  const settlementCode = String(codeData);

  const { data: userResp } = await supabase.auth.getUser();

  const { data: ins, error: insErr } = await supabase
    .from("nomina_settlements")
    .insert({
      tenant_id: tenantId,
      settlement_code: settlementCode,
      employee_id: employee.id,
      employee_code: employee.employee_code,
      employee_name: employee.full_name,
      termination_cause: input!.termination_cause,
      hire_date: employee.hire_date,
      termination_date: input!.termination_date,
      base_salary_usd: employee.salary_usd,
      rules_snapshot: rules,
      status: "borrador",
      total_prestaciones_usd: calc.totals.prestaciones_usd,
      total_fracciones_usd: calc.totals.fracciones_usd,
      total_indemnizacion_usd: calc.totals.indemnizacion_usd,
      total_intereses_usd: calc.totals.intereses_usd,
      total_deductions_usd: calc.totals.deductions_usd,
      total_net_usd: calc.totals.net_usd,
      salario_integral_usd: calc.totals.salario_integral_usd,
      notes: input!.notes,
      created_by: userResp.user?.id ?? null,
    })
    .select("id")
    .single();

  if (insErr || !ins) {
    if (insErr?.code === "23505") {
      return { error: "Carrera al generar el código. Intenta de nuevo." };
    }
    if (insErr?.code === "check_violation" || /no pertenece al tenant/i.test(insErr?.message ?? "")) {
      return { fieldErrors: { employee_id: "El empleado no es de tu tenant." } };
    }
    return { error: `No se pudo crear el finiquito: ${insErr?.message ?? "desconocido"}` };
  }

  const lineErr = await writeSettlementLines(supabase, tenantId, String(ins.id), calc.lines);
  if (lineErr) return { error: lineErr };

  revalidatePath(PATH);
  return { ok: true, createdCode: settlementCode };
}

/**
 * Regenera el desglose de un finiquito en borrador: recomputa con el snapshot de
 * reglas congelado del propio finiquito + el saldo de préstamo actual.
 */
export async function regenerarFiniquitoAction(
  settlementId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const s = await getSettlement(supabase, settlementId);
  if (!s) return { error: "El finiquito no existe o no es de tu tenant." };
  if (s.status !== "borrador") {
    return { error: "Solo se pueden regenerar finiquitos en borrador." };
  }

  const loanBalanceUsd = await employeeLoanBalanceUsd(supabase, {
    id: s.employee_id,
    full_name: s.employee_name,
    employee_code: s.employee_code,
  });

  const calc = calcLiquidacion({
    cause: s.termination_cause,
    hireDate: s.hire_date,
    terminationDate: s.termination_date,
    baseSalaryUsd: s.base_salary_usd,
    rules: settlementRulesFrom(s.rules_snapshot),
    loanBalanceUsd,
  });

  const lineErr = await writeSettlementLines(supabase, s.tenant_id, s.id, calc.lines);
  if (lineErr) return { error: lineErr };

  await supabase
    .from("nomina_settlements")
    .update({
      total_prestaciones_usd: calc.totals.prestaciones_usd,
      total_fracciones_usd: calc.totals.fracciones_usd,
      total_indemnizacion_usd: calc.totals.indemnizacion_usd,
      total_intereses_usd: calc.totals.intereses_usd,
      total_deductions_usd: calc.totals.deductions_usd,
      total_net_usd: calc.totals.net_usd,
      salario_integral_usd: calc.totals.salario_integral_usd,
    })
    .eq("id", s.id)
    .eq("status", "borrador");

  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Confirma el finiquito (borrador → confirmado): valida período abierto, genera
 * el asiento de PROVISIÓN (DR gasto / CR sueldos por pagar, SDD-0079), guarda el
 * journal_entry_id y sella confirmed_at. (PDF a Storage = Slice posterior; el
 * detalle es imprimible desde el navegador.) Es un asiento contable → idempotente
 * por el journal_entry_id del propio finiquito.
 */
export async function confirmarFiniquitoAction(
  settlementId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const s = await getSettlement(supabase, settlementId);
  if (!s) return { error: "El finiquito no existe o no es de tu tenant." };
  if (!canTransitionSettlement(s.status, "confirmado")) {
    return { error: `No se puede confirmar un finiquito ${s.status}.` };
  }
  if (s.journal_entry_id) {
    return { error: "El finiquito ya tiene un asiento contable." };
  }

  // Período fiscal cerrado → no se postea (SDD-0080).
  const settings = await getAccountingSettings(supabase);
  if (isPeriodClosed(settings.closing_date, s.termination_date)) {
    return {
      error: `El período del egreso (${s.termination_date}) está cerrado contablemente. No se puede asentar.`,
    };
  }

  // RECLAMAR PRIMERO (UPDATE optimista) y SOLO el ganador postea → cierra el
  // TOCTOU del doble-confirm: dos clicks concurrentes no crean dos asientos.
  // El guard `status='borrador' AND journal_entry_id IS NULL` + el .select()
  // nos dice cuántas filas matchearon (0 = otra acción ya lo tomó).
  const { data: claimed, error: claimErr } = await supabase
    .from("nomina_settlements")
    .update({ status: "confirmado", confirmed_at: new Date().toISOString() })
    .eq("id", s.id)
    .eq("status", "borrador")
    .is("journal_entry_id", null)
    .select("id");
  if (claimErr) return { error: `No se pudo confirmar el finiquito: ${claimErr.message}` };
  if (!claimed || claimed.length === 0) {
    return { error: "El finiquito ya no está en borrador (otra acción lo cambió)." };
  }

  // Ganamos el reclamo → generamos el asiento de provisión (best-effort: si falta
  // una cuenta del CoA, no rompe; queda confirmado sin asiento y se reintenta).
  const posting = await postSettlementJournalEntry({
    tenantId: s.tenant_id,
    settlementId: s.id,
    settlementCode: s.settlement_code,
    employeeName: s.employee_name,
    netUsd: s.total_net_usd,
    entryDate: s.termination_date,
  });
  if (!posting.ok && !posting.skipped) {
    // El asiento falló de verdad → revertimos el reclamo (vuelve a borrador).
    await supabase
      .from("nomina_settlements")
      .update({ status: "borrador", confirmed_at: null })
      .eq("id", s.id)
      .eq("status", "confirmado");
    return { error: `No se pudo generar el asiento: ${posting.error ?? "desconocido"}` };
  }

  // Guardar el back-pointer al asiento. Si esto fallara, el finiquito queda
  // confirmado y el asiento vivo: anulamos el asiento para no dejarlo huérfano.
  if (posting.entryId) {
    const { error: linkErr } = await supabase
      .from("nomina_settlements")
      .update({ journal_entry_id: posting.entryId })
      .eq("id", s.id);
    if (linkErr) {
      await voidSettlementJournalEntry(posting.entryId);
      await supabase
        .from("nomina_settlements")
        .update({ status: "borrador", confirmed_at: null })
        .eq("id", s.id)
        .eq("status", "confirmado");
      return { error: `No se pudo ligar el asiento: ${linkErr.message}` };
    }
  }

  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Anula un finiquito (borrador|confirmado → anulado). Si tenía asiento, lo anula
 * (contra-asiento lógico: status='anulado', los saldos lo ignoran). Conserva la
 * fila (rastro). Libera el índice único parcial para re-generar. Solo admin/accounting.
 */
export async function anularFiniquitoAction(
  settlementId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const s = await getSettlement(supabase, settlementId);
  if (!s) return { error: "El finiquito no existe o no es de tu tenant." };
  if (!canTransitionSettlement(s.status, "anulado")) {
    return { error: `No se puede anular un finiquito ${s.status}.` };
  }

  if (s.journal_entry_id) {
    const voided = await voidSettlementJournalEntry(s.journal_entry_id);
    if (!voided.ok) {
      return { error: `No se pudo anular el asiento: ${voided.error ?? "desconocido"}` };
    }
  }

  const { error } = await supabase
    .from("nomina_settlements")
    .update({ status: "anulado", journal_entry_id: null })
    .eq("id", s.id)
    .eq("status", s.status);

  if (error) return { error: `No se pudo anular el finiquito: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

/** Lee los renglones del desglose de un finiquito. Read-only (gate de view). */
export async function listSettlementLinesAction(
  settlementId: string,
): Promise<{ lines?: SettlementLineRow[]; error?: string }> {
  const supabase = await createClient();
  const s = await getSettlement(supabase, settlementId);
  if (!s) return { error: "El finiquito no existe o no es de tu tenant." };
  const lines = await listSettlementLines(supabase, settlementId);
  return { lines };
}

/** Soft delete de un finiquito (deleted_at = now()). */
export async function softDeleteFiniquitoAction(
  settlementId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_settlements")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", settlementId);

  if (error) return { error: `No se pudo eliminar el finiquito: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Onboarding del empleado · Invitaciones (SDD-0113 Slice A)  ║
// ╚═══════════════════════════════════════════════════════════╝
//
// El admin genera una INVITACIÓN (link con token) que comparte por WhatsApp; el
// candidato se auto-registra (SOLICITUD en staging, app/m/emp); el admin la
// aprueba → materializa la ficha nomina_employees (con el sueldo que define la
// EMPRESA) o la rechaza. Gate de rol (moduleEditDenial) PRIMERO; RLS = backstop.

/**
 * Genera una invitación: el token lo pone la DB (default gen_random_bytes).
 * Devuelve el token en `createdToken` para que la UI arme el link a copiar.
 */
export async function createInviteAction(
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateInviteInput({
    cargo: strOrNull(formData.get("cargo")),
    department: strOrNull(formData.get("department")),
  });
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: userResp } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("nomina_employee_invites")
    .insert({
      tenant_id: tenantId,
      cargo: input!.cargo,
      department: input!.department,
      created_by: userResp.user?.id ?? null,
    })
    .select("token")
    .single();

  if (error || !data) {
    return { error: `No se pudo generar la invitación: ${error?.message ?? "desconocido"}` };
  }

  revalidatePath(PATH);
  return { ok: true, createdToken: String(data.token) };
}

/** Revoca una invitación (status='revocada'); el link deja de servir. */
export async function revokeInviteAction(
  inviteId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("nomina_employee_invites")
    .update({ status: "revocada" })
    .eq("id", inviteId)
    .eq("status", "activa");

  if (error) return { error: `No se pudo revocar la invitación: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Onboarding · Aprobar / rechazar solicitudes (SDD-0113 A)   ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Aprueba una solicitud: MATERIALIZA la ficha nomina_employees con los datos del
 * candidato + el **sueldo que define la empresa** (NO el que pidió el candidato),
 * genera EMP-NNNN, y enlaza la solicitud (status='aprobada', employee_id). El
 * alta/enlace del login del empleado (auth.users, patrón Portal Cliente) es Slice
 * C — acá solo se crea la ficha. Gate de rol PRIMERO; RLS = backstop.
 */
export async function approveRegistrationAction(
  registrationId: string,
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateApproveRegistrationInput({
    salary_usd: strOrNull(formData.get("salary_usd")) ?? 0,
    hire_date: strOrNull(formData.get("hire_date")),
  });
  if (fieldErrors) return { fieldErrors };

  const reg = await getRegistration(supabase, registrationId);
  if (!reg) return { error: "La solicitud no existe o no es de tu tenant." };
  if (reg.status !== "pendiente") {
    return { error: "La solicitud ya fue revisada." };
  }

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  const { data: codeData, error: codeErr } = await supabase.rpc("next_employee_code", {
    p_tenant_id: tenantId,
  });
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del empleado." };
  }
  const employeeCode = String(codeData);

  const { data: userResp } = await supabase.auth.getUser();

  // 1) Materializa la ficha con el sueldo de la empresa.
  const { data: empData, error: empErr } = await supabase
    .from("nomina_employees")
    .insert({
      tenant_id: tenantId,
      employee_code: employeeCode,
      full_name: reg.full_name,
      national_id: reg.national_id,
      position_label: reg.cargo,
      phone: reg.phone,
      email: reg.email,
      salary_usd: input!.salary_usd,
      hire_date: input!.hire_date ?? reg.start_date,
      birth_date: reg.birth_date,
      bank_name: reg.bank_name,
      bank_account_type: reg.bank_account_type,
      bank_account: reg.bank_account,
      status: "activo",
      created_by: userResp.user?.id ?? null,
    })
    .select("id")
    .single();

  if (empErr || !empData) {
    if (empErr?.code === "23505" && /national_id/.test(empErr.message)) {
      return { error: "Ya existe un empleado con esa cédula. Revisa antes de aprobar." };
    }
    return { error: `No se pudo crear la ficha: ${empErr?.message ?? "desconocido"}` };
  }

  // 2) Enlaza la solicitud → aprobada (optimista: solo si sigue pendiente).
  const { error: regErr } = await supabase
    .from("nomina_employee_registrations")
    .update({
      status: "aprobada",
      employee_id: empData.id,
      reviewed_by: userResp.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", registrationId)
    .eq("status", "pendiente");

  if (regErr) {
    // La ficha quedó creada; reportamos el desfase para que el admin lo revise.
    return { error: `Ficha creada (${employeeCode}) pero no se pudo cerrar la solicitud: ${regErr.message}` };
  }

  revalidatePath(PATH);
  return { ok: true, createdCode: employeeCode };
}

/** Rechaza una solicitud con motivo. No crea ficha; queda el rastro. */
export async function rejectRegistrationAction(
  registrationId: string,
  _prev: NominaActionState,
  formData: FormData,
): Promise<NominaActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const reason = strOrNull(formData.get("rejection_reason"));
  if (!reason) return { fieldErrors: { rejection_reason: "Indica el motivo del rechazo." } };

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("nomina_employee_registrations")
    .update({
      status: "rechazada",
      rejection_reason: reason,
      reviewed_by: userResp.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", registrationId)
    .eq("status", "pendiente");

  if (error) return { error: `No se pudo rechazar la solicitud: ${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}