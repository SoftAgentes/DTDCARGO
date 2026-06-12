/**
 * Lógica compartida del cobro (SDD-0041 · §5.1 + SDD-0068 · capa legal SDD-C).
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
 *   1. valida (amount>0, ≤saldo, cuenta requerida, pagador — tercero exige
 *      nombre + relación + declaración de licitud, decisión #7)
 *   2. genera receipt_code (rpc next_receipt_code)
 *   3. inserta el payment_receipt (con pagador + fund_class heredada de la
 *      factura + application_status='aplicado')
 *   4. sube paid_amount de la factura + recalcula status (parcial/pagada)
 *   5. asiento del cobro (DR caja / CR 1.1.2), best-effort → guarda journal_entry_id
 *   6. audit (payment_receipt · payment_registered)
 *
 * `registerUnidentifiedPaymentFor` (SDD-0068 #2 · cláusula 7.3):
 *   pago SIN referencia → recibo sin factura (`application_status='recibido_sin_ref'`,
 *   snapshots de cliente NULL, fund_class='third_party' hasta identificar) +
 *   asiento DR caja / CR 2.1.8 "Fondos por identificar".
 *
 * `identifyPaymentFor` (SDD-0068 #3 · decisión #6):
 *   identificación RETROACTIVA de un sin-ref → setea factura + snapshots +
 *   'aplicado' + identified_at, CONSERVA received_at original, sube el saldo
 *   de la factura como un cobro normal y reclasifica (DR 2.1.8 / CR 1.1.2 con
 *   fecha = received_at). El "reverso de cargos del limbo" (bodegaje causado
 *   mientras estaba sin identificar) queda FUERA de V1: el bodegaje automático
 *   no existe aún como cargo en sistema — este es el gancho documentado.
 *
 * `voidReceiptFor`:
 *   anula el recibo (deleted_at) + baja paid_amount (si tiene factura) +
 *   recalcula status + anula TODOS sus asientos (el inicial y, si fue
 *   identificado, la reclasificación). No borra (auditable).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import {
  postReceiptJournalEntry,
  postReceiptReclassEntry,
  postUnidentifiedReceiptJournalEntry,
  voidEntriesForReceipt,
} from "@/lib/studio/accounting/receipt-posting";
import { computeBalance, type InvoiceCurrency } from "@/lib/studio/invoice-types";
import {
  validatePaymentInput,
  validateUnidentifiedPaymentInput,
  type FundClass,
  type PaymentInput,
  type PaymentMethod,
  type UnidentifiedPaymentInput,
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
  fund_class: string | null;
};

const INVOICE_PAY_COLUMNS =
  "id, tenant_id, invoice_code, client_markbox, client_name, status, currency, fx_rate, total_amount, paid_amount, fund_class";

/** Coerce defensivo de la clase de fondos (default conservador del mandato). */
function coerceFundClass(v: unknown): FundClass {
  return v === "local_revenue" ? "local_revenue" : "third_party";
}

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

  // 4. Insertar el recibo. Pagador (decisión #7) + estado de aplicación +
  // fund_class HEREDADA de la factura (decisión #5 — el sin-ref es el único
  // camino que no hereda, ver registerUnidentifiedPaymentFor).
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
      payer_kind: input!.payerKind,
      payer_name: input!.payerName,
      payer_relation: input!.payerRelation,
      licit_declared: input!.licitDeclared,
      application_status: "aplicado",
      fund_class: coerceFundClass(inv.fund_class),
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
      payer_kind: input!.payerKind,
      ...(input!.payerKind === "tercero"
        ? {
            payer_name: input!.payerName,
            payer_relation: input!.payerRelation,
            licit_declared: input!.licitDeclared,
          }
        : {}),
      fund_class: coerceFundClass(inv.fund_class),
    },
  );

  return { ok: true, receiptCode, fullyPaid };
}

// ── Pago sin referencia (SDD-0068 #2 · cláusula 7.3) ──────────

export type UnidentifiedPaymentResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof UnidentifiedPaymentInput, string>>;
  receiptCode?: string;
};

/**
 * Registra un pago que llegó SIN referencia: recibo sin factura
 * (`application_status='recibido_sin_ref'`, snapshots de cliente NULL,
 * `fund_class='third_party'` hasta identificar) + asiento DR caja / CR 2.1.8
 * "Fondos por identificar" (best-effort). NO toca ninguna factura.
 */
export async function registerUnidentifiedPaymentFor(
  supabase: SupabaseClient,
  raw: Partial<UnidentifiedPaymentInput>,
): Promise<UnidentifiedPaymentResult> {
  const { input, fieldErrors } = validateUnidentifiedPaymentInput(raw);
  if (fieldErrors) return { fieldErrors };

  // Sin factura no hay tenant implícito → se resuelve del usuario logueado.
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };
  const tenantId = link.tenant_id;

  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_receipt_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del recibo." };
  }
  const receiptCode = String(codeData);

  // Recibo sin factura: invoice_id NULL ⇔ application_status='recibido_sin_ref'
  // (CHECK payment_receipts_sinref_invoice_check, 0122). Snapshots NULL.
  const { data: insertedReceipt, error: insErr } = await supabase
    .from("payment_receipts")
    .insert({
      tenant_id: tenantId,
      receipt_code: receiptCode,
      invoice_id: null,
      client_markbox: null,
      client_name: null,
      amount: input!.amount,
      currency: input!.currency,
      fx_rate: input!.fxRate,
      method: input!.method as PaymentMethod,
      cash_account_id: input!.cashAccountId,
      reference: input!.reference,
      received_at: input!.receivedAt,
      notes: input!.notes,
      application_status: "recibido_sin_ref",
      fund_class: "third_party",
    })
    .select("id")
    .single();
  if (insErr || !insertedReceipt) {
    return { error: `No se pudo registrar el pago: ${insErr?.message}` };
  }

  // Asiento DR caja / CR cuenta puente (best-effort).
  try {
    const posting = await postUnidentifiedReceiptJournalEntry({
      tenantId,
      receiptId: insertedReceipt.id,
      receiptCode,
      cashAccountId: input!.cashAccountId,
      amount: input!.amount,
      currency: input!.currency,
      fxRate: input!.fxRate,
      entryDate: input!.receivedAt,
    });
    if (posting.ok && posting.entryId) {
      await supabase
        .from("payment_receipts")
        .update({ journal_entry_id: posting.entryId })
        .eq("id", insertedReceipt.id);
    } else if (!posting.ok) {
      console.error(
        `[contabilidad] asiento del pago sin identificar ${receiptCode} no creado:`,
        posting.skipped ?? posting.error,
      );
    }
  } catch (e) {
    console.error(
      `[contabilidad] error inesperado al asentar pago sin identificar ${receiptCode}:`,
      e,
    );
  }

  await auditReceipt(
    tenantId,
    insertedReceipt.id,
    await currentUserId(supabase),
    "unidentified_payment_registered",
    {
      receipt_code: receiptCode,
      amount: input!.amount,
      currency: input!.currency,
      method: input!.method,
      received_at: input!.receivedAt,
      reference: input!.reference,
    },
  );

  return { ok: true, receiptCode };
}

// ── Identificación retroactiva (SDD-0068 #3 · decisión #6) ────

export type IdentifyPaymentResult = {
  ok?: boolean;
  error?: string;
  receiptCode?: string;
  invoiceCode?: string;
  /** true si la identificación saldó la factura. */
  fullyPaid?: boolean;
};

/**
 * Identifica un pago sin referencia contra una factura:
 *  1. valida que el recibo esté `recibido_sin_ref` y la factura sea cobrable
 *     (emitida/parcial/vencida), de la MISMA moneda y con saldo ≥ monto.
 *  2. setea invoice_id + snapshots + application_status='aplicado' +
 *     identified_at=now() — `received_at` NO se toca (la imputación es a la
 *     fecha ORIGINAL de recepción de fondos: eso ES la retroactividad en V1) —
 *     y hereda `fund_class` de la factura.
 *  3. sube paid_amount + recalcula status de la factura (igual que un cobro).
 *  4. asiento de RECLASIFICACIÓN DR 2.1.8 / CR 1.1.2 con fecha = received_at
 *     (best-effort).
 */
export async function identifyPaymentFor(
  supabase: SupabaseClient,
  receiptId: string,
  invoiceId: string,
): Promise<IdentifyPaymentResult> {
  // 1. Leer el recibo (RLS lo acota al tenant y excluye anulados).
  const { data: receipt, error: rErr } = await supabase
    .from("payment_receipts")
    .select(
      "id, tenant_id, receipt_code, invoice_id, amount, currency, fx_rate, received_at, application_status, deleted_at",
    )
    .eq("id", receiptId)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      receipt_code: string;
      invoice_id: string | null;
      amount: number;
      currency: InvoiceCurrency;
      fx_rate: number | null;
      received_at: string;
      application_status: string;
      deleted_at: string | null;
    }>();
  if (rErr || !receipt) return { error: "Recibo no encontrado." };
  if (receipt.deleted_at) return { error: "Este recibo está anulado." };
  if (receipt.application_status !== "recibido_sin_ref") {
    return { error: "Este pago ya fue identificado y aplicado." };
  }

  // 2. Leer la factura destino.
  const { data: inv, error: iErr } = await supabase
    .from("invoices")
    .select(INVOICE_PAY_COLUMNS)
    .eq("id", invoiceId)
    .maybeSingle<InvoiceRow>();
  if (iErr || !inv) return { error: "Factura no encontrada." };
  if (
    inv.status !== "emitida" &&
    inv.status !== "parcial" &&
    inv.status !== "vencida"
  ) {
    return {
      error: "Solo se puede identificar contra facturas emitidas o parciales.",
    };
  }
  if (inv.currency !== receipt.currency) {
    return {
      error: `La moneda del pago (${receipt.currency}) no coincide con la de la factura (${inv.currency}).`,
    };
  }

  const amount = round2(Number(receipt.amount));
  const balance = computeBalance({
    total_amount: Number(inv.total_amount),
    paid_amount: Number(inv.paid_amount),
  });
  if (amount > balance + 0.01) {
    return {
      error: `El pago ($${amount.toFixed(2)}) supera el saldo de la factura ($${balance.toFixed(2)}).`,
    };
  }

  // 3. Identificar el recibo: factura + snapshots + aplicado + identified_at.
  // received_at NO se toca (retroactividad, decisión #6). fund_class hereda.
  const fundClass = coerceFundClass(inv.fund_class);
  const { error: updReceiptErr } = await supabase
    .from("payment_receipts")
    .update({
      invoice_id: inv.id,
      client_markbox: inv.client_markbox,
      client_name: inv.client_name,
      application_status: "aplicado",
      identified_at: new Date().toISOString(),
      fund_class: fundClass,
    })
    .eq("id", receipt.id);
  if (updReceiptErr) {
    return { error: `No se pudo identificar el pago: ${updReceiptErr.message}` };
  }

  // 4. Subir paid_amount + recalcular status (igual que un cobro normal).
  const newPaid = round2(Number(inv.paid_amount) + amount);
  const fullyPaid = newPaid >= Number(inv.total_amount) - 1e-6;
  const newStatus = fullyPaid ? "pagada" : "parcial";
  const { error: updInvErr } = await supabase
    .from("invoices")
    .update({
      paid_amount: newPaid,
      status: newStatus,
      last_payment_at: new Date().toISOString(),
    })
    .eq("id", inv.id);
  if (updInvErr) {
    return {
      error: `Pago identificado pero no se actualizó el saldo: ${updInvErr.message}`,
    };
  }

  // 5. Reclasificación DR puente / CR 1.1.2 con fecha = received_at ORIGINAL.
  try {
    const posting = await postReceiptReclassEntry({
      tenantId: receipt.tenant_id,
      receiptId: receipt.id,
      receiptCode: receipt.receipt_code,
      amount,
      currency: receipt.currency,
      fxRate: receipt.fx_rate,
      entryDate: receipt.received_at,
    });
    if (!posting.ok) {
      console.error(
        `[contabilidad] reclasificación de ${receipt.receipt_code} no creada:`,
        posting.skipped ?? posting.error,
      );
    }
  } catch (e) {
    console.error(
      `[contabilidad] error inesperado al reclasificar ${receipt.receipt_code}:`,
      e,
    );
  }

  await auditReceipt(
    receipt.tenant_id,
    receipt.id,
    await currentUserId(supabase),
    "payment_identified",
    {
      receipt_code: receipt.receipt_code,
      invoice_code: inv.invoice_code,
      amount,
      currency: receipt.currency,
      received_at: receipt.received_at, // fecha de imputación (retroactiva)
      paid_total: newPaid,
      new_status: newStatus,
      fund_class: fundClass,
    },
  );

  return {
    ok: true,
    receiptCode: receipt.receipt_code,
    invoiceCode: inv.invoice_code,
    fullyPaid,
  };
}

/**
 * Anula un recibo: lo marca como anulado (deleted_at), baja el paid_amount de
 * su factura (si tiene — un sin-ref no apunta a ninguna), recalcula status, y
 * anula TODOS sus asientos (el inicial + la reclasificación si fue
 * identificado, SDD-0068). No borra (auditable).
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
      invoice_id: string | null;
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

  // 2. Bajar paid_amount + recalcular status de la factura (solo si el recibo
  // apunta a una — los sin-ref no tocan ningún saldo).
  if (receipt.invoice_id) {
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
  }

  // 3. Anular TODOS los asientos del recibo (inicial + reclasificación si fue
  // identificado). Best-effort. Cubre también el caso journal_entry_id null
  // con asientos atados por journal_entries.receipt_id.
  {
    const r = await voidEntriesForReceipt(receipt.id);
    if (!r.ok) {
      console.error(
        `[contabilidad] no se pudieron anular los asientos del recibo ${receipt.receipt_code}:`,
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
