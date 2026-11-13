/**
 * Server actions del módulo Tesorería (SDD-0044).
 *
 * - createSupplier / updateSupplier: alta/edición de proveedor-lite (PRV-NNNN).
 * - createBill: crea la CxP + asiento de causación (delega en createBillFor).
 * - voidBill: anula una CxP sin pagos (status anulada + anula su asiento).
 * - registerPayment: registra el pago (orden OP- + saldo + asiento del pago).
 * - voidPayment: anula una orden de pago (revierte saldo + anula su asiento).
 * - getBillHistory: lee los pagos de una CxP (para el historial del drawer).
 * - getPayableForBill: abre una CxP en consulta desde el tab «Pagos» (0494).
 *
 * Sin Zod: validación con `validate*Input()` propio. Las mutaciones financieras
 * se auditan atómicamente mediante los triggers de dominio D2 (SDD-0174).
 */

"use server";

import { revalidatePath } from "next/cache";
import { fechaCaracas } from "@/lib/shared/fechas-caracas";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial, moduleViewDenial } from "@/lib/studio/rbac-guard";
import {
  createBillFor,
  registerPaymentFor,
  voidBillFor,
  voidPaymentFor,
} from "@/lib/studio/treasury/treasury-actions";
import { isExpenseAccount } from "@/lib/studio/treasury/bill-queries";
import type { Payable } from "@/lib/studio/treasury/bill-queries";
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
  const issueDate = raw?.issueDate === undefined ? fechaCaracas() : raw.issueDate;
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "treasury");
  if (denial) return { error: denial };
  const result = await createBillFor(supabase, { ...raw, issueDate });
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
  reason: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "treasury");
  if (denial) return { error: denial };
  const r = await voidBillFor(supabase, billId, reason);
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
  const paidAt = payload?.paidAt === undefined ? fechaCaracas() : payload.paidAt;
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "treasury");
  if (denial) return { error: denial };
  const result = await registerPaymentFor(supabase, billId, { ...payload, paidAt });
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
  reason: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "treasury");
  if (denial) return { error: denial };
  const r = await voidPaymentFor(supabase, paymentId, reason);
  if (!r.ok) return { error: r.error };
  revalidatePath("/studio/tesoreria");
  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

/**
 * Lee los pagos de una CxP (para el historial del drawer). Serializable.
 *
 * Gate de VISTA (SDD-0494): el layout de Tesorería exige `requireModuleView`,
 * pero eso protege la PÁGINA, no esta action — que es un endpoint invocable
 * directo, igual que las mutaciones (SDD-0085 §Seguridad). Y la RLS no ayuda
 * acá: `supplier_payments_team_select` (0470) es tenant-wide, así que sin este
 * candado un rol `operations` o `commercial` leía órdenes de pago con sus
 * montos, contra lo que el propio layout declara («NUNCA operations/commercial»).
 * Hueco preexistente; se cierra junto con el de `getPayableForBill`.
 */
export async function getBillHistory(
  billId: string,
): Promise<{ payments: SupplierPayment[]; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "treasury");
  if (denial) return { payments: [], error: denial };
  const { listPayments } = await import("@/lib/studio/treasury/bill-queries");
  const payments = await listPayments(supabase, { billId });
  return { payments };
}

/**
 * Lee UNA CxP como `Payable` para abrir su drawer desde el tab «Pagos»
 * (SDD-0494), incluso si quedó saldada y por eso salió de la cola.
 *
 * Lleva el gate de VISTA, no el de edición: no muta nada, pero expone datos de
 * dinero (proveedor, total, pagado, saldo) que el módulo reserva a `accounting`
 * y `admin`. El mismo razonamiento que `getBillHistory`, arriba.
 */
export async function getPayableForBill(
  billId: string,
): Promise<{ payable: Payable | null; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "treasury");
  if (denial) return { payable: null, error: denial };
  const { payableForBill } = await import("@/lib/studio/treasury/bill-queries");
  return { payable: await payableForBill(supabase, billId) };
}
