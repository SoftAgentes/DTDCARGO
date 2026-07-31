/**
 * Lógica compartida de Tesorería (SDD-0044 · §5.1) — el espejo de
 * `collections-actions.ts`.
 *
 * NO es un módulo `"use server"`: son helpers puros-de-IO que reciben el
 * SupabaseClient autenticado del caller (RLS). La auditoría D2 vive en
 * PostgreSQL y comparte transacción con cada mutación financiera.
 *
 * `createBillFor`:
 *   1. valida (total>0, proveedor + cuenta de gasto + vencimiento)
 *   2. genera bill_code (rpc next_bill_code)
 *   3. inserta la supplier_bill (snapshot supplier_name)
 *   4. asiento de causación (DR gasto / CR 2.1.1), best-effort → journal_entry_id
 *   5. audit (supplier_bill · bill_created)
 *
 * `registerPaymentFor`:
 *   1. valida (amount>0, ≤saldo, cuenta de caja)
 *   2. genera payment_code (rpc next_payment_order_code)
 *   3. inserta la supplier_payment
 *   4. sube paid_amount de la CxP + recalcula status (parcial/pagada)
 *   5. asiento del pago (DR 2.1.1 / CR caja), best-effort → journal_entry_id
 *   6. audit (supplier_payment · payment_registered)
 *
 * `voidPaymentFor`: anula la orden (deleted_at) + baja paid_amount + recalcula
 *   status + anula su asiento. No borra (auditable).
 *
 * `voidBillFor`: anula la CxP sin pagos (status='anulada' + anula su asiento).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateAuditReason } from "@/lib/studio/audit/reason";
import {
  postBillJournalEntry,
  voidBillJournalEntry,
} from "@/lib/studio/accounting/bill-posting";
import {
  postSupplierPaymentJournalEntry,
  voidSupplierPaymentJournalEntry,
} from "@/lib/studio/accounting/supplier-payment-posting";
import {
  billBalance,
  validateBillInput,
  validatePaymentInput,
  type BillInput,
  type PaymentMethod,
  type SupplierPaymentInput,
} from "./types";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function resolveTenantId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

// ── Crear CxP ──────────────────────────────────────────────────

export type CreateBillResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof BillInput, string>>;
  billCode?: string;
};

/**
 * Crea una CxP. El SupabaseClient debe estar autenticado (RLS resuelve el
 * tenant). Devuelve `{ ok, billCode }` o `{ error | fieldErrors }`. NO throwea
 * por la contabilidad (best-effort).
 */
export async function createBillFor(
  supabase: SupabaseClient,
  raw: Partial<BillInput>,
): Promise<CreateBillResult> {
  const { input, fieldErrors } = validateBillInput(raw);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Snapshot del proveedor (nombre) + validar que existe en el tenant.
  const { data: supplier, error: supErr } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("id", input!.supplierId)
    .maybeSingle<{ id: string; name: string }>();
  if (supErr || !supplier) return { error: "Proveedor no encontrado." };

  // Generar bill_code atómico.
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_bill_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de la CxP." };
  }
  const billCode = String(codeData);

  const { data: insertedBill, error: insErr } = await supabase
    .from("supplier_bills")
    .insert({
      tenant_id: tenantId,
      bill_code: billCode,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      concept: input!.concept,
      expense_account_id: input!.expenseAccountId,
      currency: input!.currency,
      fx_rate: input!.fxRate,
      total_amount: input!.totalAmount,
      status: "pendiente",
      issue_date: input!.issueDate,
      due_date: input!.dueDate,
      reference: input!.reference,
      shipment_id: input!.shipmentId,
      notes: input!.notes,
    })
    .select("id")
    .single();
  if (insErr || !insertedBill) {
    return { error: `No se pudo crear la CxP: ${insErr?.message}` };
  }

  // Asiento de causación (best-effort) — DR gasto / CR 2.1.1.
  try {
    const posting = await postBillJournalEntry({
      tenantId,
      billId: insertedBill.id,
      billCode,
      expenseAccountId: input!.expenseAccountId,
      amount: input!.totalAmount,
      currency: input!.currency,
      fxRate: input!.fxRate,
      entryDate: input!.issueDate,
    });
    if (posting.ok && posting.entryId) {
      await supabase
        .from("supplier_bills")
        .update({ journal_entry_id: posting.entryId })
        .eq("id", insertedBill.id);
    } else if (!posting.ok) {
      console.error(
        `[contabilidad] asiento de causación ${billCode} no creado:`,
        posting.skipped ?? posting.error,
      );
    }
  } catch (e) {
    console.error(
      `[contabilidad] error inesperado al causar CxP ${billCode}:`,
      e,
    );
  }

  return { ok: true, billCode };
}

// ── Anular CxP (solo sin pagos) ────────────────────────────────

export async function voidBillFor(
  supabase: SupabaseClient,
  billId: string,
  reasonRaw: string,
): Promise<{ ok?: boolean; error?: string }> {
  const reasonResult = validateAuditReason(reasonRaw);
  if (!reasonResult.ok) return { error: reasonResult.error };

  const { data: bill, error: readErr } = await supabase
    .from("supplier_bills")
    .select(
      "id, tenant_id, bill_code, paid_amount, status, journal_entry_id, deleted_at",
    )
    .eq("id", billId)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      bill_code: string;
      paid_amount: number;
      status: string;
      journal_entry_id: string | null;
      deleted_at: string | null;
    }>();
  if (readErr || !bill) return { error: "CxP no encontrada." };
  if (bill.status === "anulada") return { error: "Esta CxP ya está anulada." };
  if (Number(bill.paid_amount) > 0) {
    return {
      error: "No se puede anular una CxP con pagos. Anula primero las órdenes de pago.",
    };
  }

  const { data: changed, error: voidErr } = await supabase.rpc(
    "void_supplier_bill_with_audit_reason",
    {
      p_id: bill.id,
      p_reason: reasonResult.reason,
    },
  );
  if (voidErr) return { error: voidErr.message };
  if (!changed) return { error: "La CxP ya no admite anulación." };

  // Anular el asiento de causación (si lo tiene). Best-effort.
  if (bill.journal_entry_id) {
    const r = await voidBillJournalEntry(bill.journal_entry_id);
    if (!r.ok) {
      console.error(
        `[contabilidad] no se pudo anular el asiento de la CxP ${bill.bill_code}:`,
        r.error,
      );
    }
  }

  return { ok: true };
}

// ── Registrar pago ─────────────────────────────────────────────

type BillRow = {
  id: string;
  tenant_id: string;
  bill_code: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  total_amount: number;
  paid_amount: number;
};

const BILL_PAY_COLUMNS =
  "id, tenant_id, bill_code, supplier_id, supplier_name, status, total_amount, paid_amount";

export type RegisterPaymentResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof SupplierPaymentInput, string>>;
  paymentCode?: string;
  /** true si el pago saldó la CxP. */
  fullyPaid?: boolean;
};

/**
 * Registra un pago (orden de pago) sobre una CxP. El SupabaseClient debe estar
 * autenticado (RLS resuelve el tenant). NO throwea por la contabilidad.
 */
export async function registerPaymentFor(
  supabase: SupabaseClient,
  billId: string,
  raw: Partial<SupplierPaymentInput>,
): Promise<RegisterPaymentResult> {
  const { data: bill, error: readErr } = await supabase
    .from("supplier_bills")
    .select(BILL_PAY_COLUMNS)
    .eq("id", billId)
    .maybeSingle<BillRow>();
  if (readErr || !bill) return { error: "CxP no encontrada." };

  if (bill.status === "anulada" || bill.status === "pagada") {
    return {
      error: "Solo se pueden registrar pagos en CxP pendientes o parciales.",
    };
  }

  const balance = billBalance({
    total_amount: Number(bill.total_amount),
    paid_amount: Number(bill.paid_amount),
  });

  const { input, fieldErrors } = validatePaymentInput(raw, balance);
  if (fieldErrors) return { fieldErrors };

  // El pago hereda la moneda de la CxP (una orden por CxP en el MVP). El
  // fx_rate del pago se deriva de la CxP cuando aplique (se guarda en la orden
  // para el asiento en USD funcional).
  const { data: billCur } = await supabase
    .from("supplier_bills")
    .select("currency, fx_rate")
    .eq("id", bill.id)
    .maybeSingle<{ currency: string; fx_rate: number | null }>();
  const currency = billCur?.currency ?? "USD";
  const fxRate = billCur?.fx_rate ?? null;

  // Generar payment_code atómico.
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_payment_order_code",
    { p_tenant_id: bill.tenant_id },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de la orden de pago." };
  }
  const paymentCode = String(codeData);

  const { data: insertedPayment, error: insErr } = await supabase
    .from("supplier_payments")
    .insert({
      tenant_id: bill.tenant_id,
      payment_code: paymentCode,
      bill_id: bill.id,
      supplier_id: bill.supplier_id,
      supplier_name: bill.supplier_name,
      amount: input!.amount,
      currency,
      fx_rate: fxRate,
      method: input!.method as PaymentMethod,
      cash_account_id: input!.cashAccountId,
      reference: input!.reference,
      paid_at: input!.paidAt,
      notes: input!.notes,
    })
    .select("id")
    .single();
  if (insErr || !insertedPayment) {
    return { error: `No se pudo registrar el pago: ${insErr?.message}` };
  }

  // Subir paid_amount + recalcular status.
  const newPaid = round2(Number(bill.paid_amount) + input!.amount);
  const fullyPaid = newPaid >= Number(bill.total_amount) - 1e-6;
  const newStatus = fullyPaid ? "pagada" : "parcial";

  const { error: updErr } = await supabase
    .from("supplier_bills")
    .update({ paid_amount: newPaid, status: newStatus })
    .eq("id", bill.id);
  if (updErr) {
    return {
      error: `Pago registrado pero no se actualizó el saldo: ${updErr.message}`,
    };
  }

  // Asiento del pago (best-effort) — DR 2.1.1 / CR caja. Guarda el id.
  try {
    const posting = await postSupplierPaymentJournalEntry({
      tenantId: bill.tenant_id,
      paymentId: insertedPayment.id,
      paymentCode,
      cashAccountId: input!.cashAccountId,
      amount: input!.amount,
      currency,
      fxRate,
      entryDate: input!.paidAt,
    });
    if (posting.ok && posting.entryId) {
      await supabase
        .from("supplier_payments")
        .update({ journal_entry_id: posting.entryId })
        .eq("id", insertedPayment.id);
    } else if (!posting.ok) {
      console.error(
        `[contabilidad] asiento del pago ${paymentCode} no creado:`,
        posting.skipped ?? posting.error,
      );
    }
  } catch (e) {
    console.error(
      `[contabilidad] error inesperado al asentar pago ${paymentCode}:`,
      e,
    );
  }

  return { ok: true, paymentCode, fullyPaid };
}

// ── Anular orden de pago ───────────────────────────────────────

export async function voidPaymentFor(
  supabase: SupabaseClient,
  paymentId: string,
  reasonRaw: string,
): Promise<{ ok?: boolean; error?: string }> {
  const reasonResult = validateAuditReason(reasonRaw);
  if (!reasonResult.ok) return { error: reasonResult.error };

  const { data: payment, error: readErr } = await supabase
    .from("supplier_payments")
    .select("id, tenant_id, payment_code, bill_id, amount, journal_entry_id, deleted_at")
    .eq("id", paymentId)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      payment_code: string;
      bill_id: string;
      amount: number;
      journal_entry_id: string | null;
      deleted_at: string | null;
    }>();
  if (readErr || !payment) return { error: "Orden de pago no encontrada." };
  if (payment.deleted_at) return { error: "Esta orden ya está anulada." };

  // 1. Marcar la orden como anulada.
  const { data: changed, error: voidErr } = await supabase.rpc(
    "void_supplier_payment_with_audit_reason",
    {
      p_id: payment.id,
      p_reason: reasonResult.reason,
    },
  );
  if (voidErr) return { error: voidErr.message };
  if (!changed) return { error: "La orden de pago ya no admite anulación." };

  // 2. Bajar paid_amount + recalcular status de la CxP.
  const { data: bill } = await supabase
    .from("supplier_bills")
    .select("id, total_amount, paid_amount, status")
    .eq("id", payment.bill_id)
    .maybeSingle<{
      id: string;
      total_amount: number;
      paid_amount: number;
      status: string;
    }>();
  if (bill && bill.status !== "anulada") {
    const newPaid = Math.max(
      0,
      round2(Number(bill.paid_amount) - Number(payment.amount)),
    );
    const newStatus = newPaid <= 0 ? "pendiente" : "parcial";
    await supabase
      .from("supplier_bills")
      .update({ paid_amount: newPaid, status: newStatus })
      .eq("id", bill.id);
  }

  // 3. Anular el asiento del pago (si lo tiene). Best-effort.
  if (payment.journal_entry_id) {
    const r = await voidSupplierPaymentJournalEntry(payment.journal_entry_id);
    if (!r.ok) {
      console.error(
        `[contabilidad] no se pudo anular el asiento del pago ${payment.payment_code}:`,
        r.error,
      );
    }
  }

  return { ok: true };
}
