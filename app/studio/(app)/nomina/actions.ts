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
