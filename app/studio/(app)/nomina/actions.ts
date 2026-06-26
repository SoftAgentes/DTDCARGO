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
