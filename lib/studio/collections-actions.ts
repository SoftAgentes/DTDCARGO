/**
 * Lógica compartida del cobro (SDD-0041 · §5.1).
 *
 * El cobro vive UNA sola vez acá y se dispara desde 2 lugares: el detalle de
 * factura (SDD-0021, `facturacion/actions.ts`) y el módulo Cobranzas
 * (`cobranzas/actions.ts`). Misma operación, un solo camino server-side.
 *
 * NO es un módulo `"use server"`: son helpers puros-de-IO que reciben el
 * SupabaseClient autenticado del caller (RLS) + usan el admin client solo para
 * el asiento y el audit (igual que el resto del Studio).
 *
 * `registerCollectionFor`:
 *   1. valida (amount>0, ≤saldo, cuenta requerida)
 *   2. genera receipt_code (rpc next_receipt_code)
 *   3. inserta el payment_receipt
 *   4. sube paid_amount de la factura + recalcula status (parcial/pagada)
 *   5. asiento del cobro (DR caja / CR 1.1.2), best-effort → guarda journal_entry_id
 *   6. audit (payment_receipt · payment_registered)
 *
 * `voidReceiptFor`:
 *   anula el recibo (deleted_at) + baja paid_amount + recalcula status +
 *   anula su asiento. No borra (auditable).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import {
  postReceiptJournalEntry,
  voidReceiptJournalEntry,
} from "@/lib/studio/accounting/receipt-posting";
import { computeBalance, type InvoiceCurrency } from "@/lib/studio/invoice-types";
import {
  validatePaymentInput,
  type PaymentInput,
  type PaymentMethod,
} from "@/lib/studio/payment-types";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type InvoiceRow = {
  id: string;
  tenant_id: string;
  invoice_code: string;
  client_markbox: string;
  client_name: string;
  status: string;
  currency: InvoiceCurrency;
  fx_rate: number | null;
  total_amount: number;
  paid_amount: number;
};

const INVOICE_PAY_COLUMNS =
  "id, tenant_id, invoice_code, client_markbox, client_name, status, currency, fx_rate, total_amount, paid_amount";

/** Best-effort audit con actor_type='user'. No bloquea la mutación. */
async function auditReceipt(
  tenantId: string,
  receiptId: string,
  actorId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("entity_audit_log").insert({
      tenant_id: tenantId,
      entity_type: "payment_receipt",
      entity_id: receiptId,
      actor_type: "user",
      actor_id: actorId,
      event_type: eventType,
      payload,
    });
  } catch (e) {
    console.error("[auditReceipt] no se pudo registrar audit:", e);
  }
}

async function currentUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export type RegisterCollectionResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof PaymentInput, string>>;
  receiptCode?: string;
  /** true si el cobro saldó la factura. */
  fullyPaid?: boolean;
};

/**
 * Registra un cobro sobre una factura. El SupabaseClient debe estar autenticado
 * (RLS resuelve el tenant). Devuelve `{ ok, receiptCode, fullyPaid }` o
 * `{ error | fieldErrors }`. NO throwea por la contabilidad (best-effort).
 */
export async function registerCollectionFor(
  supabase: SupabaseClient,
  invoiceId: string,
  raw: Partial<PaymentInput>,
): Promise<RegisterCollectionResult> {
  // 1. Leer la factura (RLS la acota al tenant).
  const { data: inv, error: readErr } = await supabase
    .from("invoices")
    .select(INVOICE_PAY_COLUMNS)
    .eq("id", invoiceId)
    .maybeSingle<InvoiceRow>();
  if (readErr || !inv) return { error: "Factura no encontrada." };

  if (
    inv.status !== "emitida" &&
    inv.status !== "parcial" &&
    inv.status !== "vencida"
  ) {
    return {
      error: "Solo se pueden registrar cobros en facturas emitidas o parciales.",
    };
  }

  const balance = computeBalance({
    total_amount: Number(inv.total_amount),
    paid_amount: Number(inv.paid_amount),
  });

  // 2. Validar el input (amount>0, ≤saldo, cuenta requerida).
  const { input, fieldErrors } = validatePaymentInput(raw, balance);
  if (fieldErrors) return { fieldErrors };

  // 3. Generar receipt_code atómico.
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_receipt_code",
    { p_tenant_id: inv.tenant_id },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del recibo." };
  }
  const receiptCode = String(codeData);

  // 4. Insertar el recibo.
  const { data: insertedReceipt, error: insErr } = await supabase
    .from("payment_receipts")
    .insert({
      tenant_id: inv.tenant_id,
      receipt_code: receiptCode,
      invoice_id: inv.id,
      client_markbox: inv.client_markbox,
      client_name: inv.client_name,
      amount: input!.amount,
      currency: inv.currency,
      fx_rate: inv.fx_rate,
      method: input!.method as PaymentMethod,
      cash_account_id: input!.cashAccountId,
      reference: input!.reference,
      received_at: input!.receivedAt,
      notes: input!.notes,
    })
    .select("id")
    .single();
  if (insErr || !insertedReceipt) {
    return { error: `No se pudo registrar el cobro: ${insErr?.message}` };
  }

  // 5. Subir paid_amount + recalcular status.
  const newPaid = round2(Number(inv.paid_amount) + input!.amount);
  const fullyPaid = newPaid >= Number(inv.total_amount) - 1e-6;
  const newStatus = fullyPaid ? "pagada" : "parcial";

  const { error: updErr } = await supabase
    .from("invoices")
    .update({
      paid_amount: newPaid,
      status: newStatus,
      last_payment_at: new Date().toISOString(),
    })
    .eq("id", inv.id);
  if (updErr) {
    // El recibo ya se creó; el caller verá el error pero el cobro quedó
    // registrado. Mejor reportar que dejar la factura sin actualizar a ciegas.
    return { error: `Cobro registrado pero no se actualizó el saldo: ${updErr.message}` };
  }

  // 6. Asiento del cobro (best-effort) — DR caja / CR 1.1.2. Guarda el id.
  try {
    const posting = await postReceiptJournalEntry({
      tenantId: inv.tenant_id,
      receiptId: insertedReceipt.id,
      receiptCode,
      cashAccountId: input!.cashAccountId,
      amount: input!.amount,
      currency: inv.currency,
      fxRate: inv.fx_rate,
      entryDate: input!.receivedAt,
    });
    if (posting.ok && posting.entryId) {
      await supabase
        .from("payment_receipts")
        .update({ journal_entry_id: posting.entryId })
        .eq("id", insertedReceipt.id);
    } else if (!posting.ok) {
      console.error(
        `[contabilidad] asiento del cobro ${receiptCode} no creado:`,
        posting.skipped ?? posting.error,
      );
    }
  } catch (e) {
    console.error(
      `[contabilidad] error inesperado al asentar cobro ${receiptCode}:`,
      e,
    );
  }

  await auditReceipt(
    inv.tenant_id,
    insertedReceipt.id,
    await currentUserId(supabase),
    "payment_registered",
    {
      receipt_code: receiptCode,
      invoice_code: inv.invoice_code,
      amount: input!.amount,
      currency: inv.currency,
      method: input!.method,
      paid_total: newPaid,
      new_status: newStatus,
    },
  );

  return { ok: true, receiptCode, fullyPaid };
}

/**
 * Anula un recibo: lo marca como anulado (deleted_at), baja el paid_amount de
 * su factura, recalcula status, y anula su asiento. No borra (auditable).
 */
export async function voidReceiptFor(
  supabase: SupabaseClient,
  receiptId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const { data: receipt, error: readErr } = await supabase
    .from("payment_receipts")
    .select(
      "id, tenant_id, receipt_code, invoice_id, amount, journal_entry_id, deleted_at",
    )
    .eq("id", receiptId)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      receipt_code: string;
      invoice_id: string;
      amount: number;
      journal_entry_id: string | null;
      deleted_at: string | null;
    }>();
  if (readErr || !receipt) return { error: "Recibo no encontrado." };
  if (receipt.deleted_at) return { error: "Este recibo ya está anulado." };

  // 1. Marcar el recibo como anulado.
  const { error: voidErr } = await supabase
    .from("payment_receipts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", receipt.id);
  if (voidErr) return { error: voidErr.message };

  // 2. Bajar paid_amount + recalcular status de la factura.
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, total_amount, paid_amount, status")
    .eq("id", receipt.invoice_id)
    .maybeSingle<{
      id: string;
      total_amount: number;
      paid_amount: number;
      status: string;
    }>();
  if (inv) {
    const newPaid = Math.max(0, round2(Number(inv.paid_amount) - Number(receipt.amount)));
    const newStatus = newPaid <= 0 ? "emitida" : "parcial";
    await supabase
      .from("invoices")
      .update({ paid_amount: newPaid, status: newStatus })
      .eq("id", inv.id);
  }

  // 3. Anular el asiento del cobro (si lo tiene). Best-effort.
  if (receipt.journal_entry_id) {
    const r = await voidReceiptJournalEntry(receipt.journal_entry_id);
    if (!r.ok) {
      console.error(
        `[contabilidad] no se pudo anular el asiento del recibo ${receipt.receipt_code}:`,
        r.error,
      );
    }
  }

  await auditReceipt(
    receipt.tenant_id,
    receipt.id,
    await currentUserId(supabase),
    "voided",
    { receipt_code: receipt.receipt_code, amount: receipt.amount },
  );

  return { ok: true };
}
