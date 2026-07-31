/**
 * Server actions del módulo Tesorería (SDD-0044).
 *
 * - createSupplier / updateSupplier: alta/edición de proveedor-lite (PRV-NNNN).
 * - createBill: crea la CxP + asiento de causación (delega en createBillFor).
 * - voidBill: anula una CxP sin pagos (status anulada + anula su asiento).
 * - registerPayment: registra el pago (orden OP- + saldo + asiento del pago).
 * - voidPayment: anula una orden de pago (revierte saldo + anula su asiento).
 * - getBillHistory: lee los pagos de una CxP (para el historial del drawer).
 *
 * Sin Zod: validación con `validate*Input()` propio. Las mutaciones financieras
 * se auditan atómicamente mediante los triggers de dominio D2 (SDD-0174).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  createBillFor,
  registerPaymentFor,
  voidBillFor,
  voidPaymentFor,
} from "@/lib/studio/treasury/treasury-actions";
import { isExpenseAccount } from "@/lib/studio/treasury/bill-queries";
import {
  validateSupplierInput,
  type BillInput,
  type SupplierInput,
  type SupplierPaymentInput,
} from "@/lib/studio/treasury/types";
import type { SupplierPayment } from "@/lib/studio/treasury/types";

// ── Proveedores ────────────────────────────────────────────────

/**
 * Defensa: la cuenta de gasto por defecto debe ser de costo/gasto y postable.
 * Usa el MISMO criterio `isExpenseAccount` que el dropdown del drawer y la
 * imputación de la CxP (qbo_type COGS/Expense o code 5./6. + postable), para que
 * lo que el usuario puede elegir coincida con lo que se valida. RLS ya restringe
 * `accounts` al tenant; el posteo (bill-posting) revalida en uso. Devuelve un
 * mensaje de error, o null si la cuenta es válida (o no se eligió ninguna).
 */
async function validateDefaultExpenseAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string | null,
): Promise<string | null> {
  if (!accountId) return null;
  const { data, error } = await supabase
    .from("accounts")
    .select("code, qbo_type, is_postable")
    .eq("id", accountId)
    .maybeSingle<{
      code: string;
      qbo_type: string | null;
      is_postable: boolean;
    }>();
  if (error) return "No se pudo validar la cuenta de gasto.";
  if (!data) return "La cuenta de gasto no existe o no es de tu organización.";
  if (!isExpenseAccount(data)) {
    return "La cuenta por defecto debe ser de costo o gasto (postable).";
  }
  return null;
}

export async function createSupplier(
  raw: Partial<SupplierInput>,
): Promise<{ ok?: boolean; error?: string; supplierCode?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "treasury");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateSupplierInput(raw);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos del proveedor inválidos." };
  }

  const acctErr = await validateDefaultExpenseAccount(
    supabase,
    input!.defaultExpenseAccountId,
  );
  if (acctErr) return { error: acctErr };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_supplier_code",
    { p_tenant_id: link.tenant_id },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del proveedor." };
  }
  const supplierCode = String(codeData);

  const { data: inserted, error } = await supabase
    .from("suppliers")
    .insert({
      tenant_id: link.tenant_id,
      supplier_code: supplierCode,
      name: input!.name,
      name_cn: input!.nameCn,
      type: input!.type,
      country: input!.country,
      default_currency: input!.defaultCurrency,
      payment_channel: input!.paymentChannel,
      contact_name: input!.contactName,
      contact_phone: input!.contactPhone,
      contact_email: input!.contactEmail,
      tax_id: input!.taxId,
      notes: input!.notes,
      default_expense_account_id: input!.defaultExpenseAccountId,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { error: `No se pudo crear el proveedor: ${error?.message}` };
  }

  revalidatePath("/studio/tesoreria");
  return { ok: true, supplierCode };
}

export async function updateSupplier(
  supplierId: string,
  raw: Partial<SupplierInput>,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "treasury");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateSupplierInput(raw);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos del proveedor inválidos." };
  }

  const acctErr = await validateDefaultExpenseAccount(
    supabase,
    input!.defaultExpenseAccountId,
  );
  if (acctErr) return { error: acctErr };

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: input!.name,
      name_cn: input!.nameCn,
      type: input!.type,
      country: input!.country,
      default_currency: input!.defaultCurrency,
      payment_channel: input!.paymentChannel,
      contact_name: input!.contactName,
      contact_phone: input!.contactPhone,
      contact_email: input!.contactEmail,
      tax_id: input!.taxId,
      notes: input!.notes,
      default_expense_account_id: input!.defaultExpenseAccountId,
    })
    .eq("id", supplierId);
  if (error) return { error: `No se pudo actualizar el proveedor: ${error.message}` };

  revalidatePath("/studio/tesoreria");
  return { ok: true };
}

// ── CxP ────────────────────────────────────────────────────────

export async function createBill(
  raw: Partial<BillInput>,
): Promise<{ ok?: boolean; error?: string; billCode?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "treasury");
  if (denial) return { error: denial };
  const result = await createBillFor(supabase, raw);
  if (!result.ok) {
    const firstFieldError = result.fieldErrors
      ? Object.values(result.fieldErrors)[0]
      : undefined;
    return {
      error: result.error ?? firstFieldError ?? "No se pudo crear la CxP.",
    };
  }
  revalidatePath("/studio/tesoreria");
  revalidatePath("/studio/contabilidad");
  return { ok: true, billCode: result.billCode };
}

export async function voidBill(
  billId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "treasury");
  if (denial) return { error: denial };
  const r = await voidBillFor(supabase, billId);
  if (!r.ok) return { error: r.error };
  revalidatePath("/studio/tesoreria");
  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

// ── Pagos ──────────────────────────────────────────────────────

export async function registerPayment(
  billId: string,
  payload: Partial<SupplierPaymentInput>,
): Promise<{
  ok?: boolean;
  error?: string;
  paymentCode?: string;
  fullyPaid?: boolean;
}> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "treasury");
  if (denial) return { error: denial };
  const result = await registerPaymentFor(supabase, billId, payload);
  if (!result.ok) {
    const firstFieldError = result.fieldErrors
      ? Object.values(result.fieldErrors)[0]
      : undefined;
    return {
      error: result.error ?? firstFieldError ?? "No se pudo registrar el pago.",
    };
  }
  revalidatePath("/studio/tesoreria");
  revalidatePath("/studio/contabilidad");
  return {
    ok: true,
    paymentCode: result.paymentCode,
    fullyPaid: result.fullyPaid,
  };
}

export async function voidPayment(
  paymentId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "treasury");
  if (denial) return { error: denial };
  const r = await voidPaymentFor(supabase, paymentId);
  if (!r.ok) return { error: r.error };
  revalidatePath("/studio/tesoreria");
  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

/** Lee los pagos de una CxP (para el historial del drawer). Serializable. */
export async function getBillHistory(
  billId: string,
): Promise<{ payments: SupplierPayment[] }> {
  const supabase = await createClient();
  const { listPayments } = await import("@/lib/studio/treasury/bill-queries");
  const payments = await listPayments(supabase, { billId });
  return { payments };
}
