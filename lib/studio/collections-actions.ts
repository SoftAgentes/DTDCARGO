/**
 * Lógica compartida del cobro (SDD-0041 · §5.1 + SDD-0068 · capa legal SDD-C).
 *
 * El cobro vive UNA sola vez acá y se dispara desde 2 lugares: el detalle de
 * factura (SDD-0021, `facturacion/actions.ts`) y el módulo Cobranzas
 * (`cobranzas/actions.ts`). Misma operación, un solo camino server-side.
 *
 * NO es un módulo `"use server"`: son helpers puros-de-IO que reciben el
 * SupabaseClient autenticado del caller (RLS). La auditoría D2 vive en
 * PostgreSQL y comparte transacción con cada mutación financiera.
 *
 * SDD-0488: el recibo y el saldo de la factura se escriben en UNA transacción,
 * con la factura tomada FOR UPDATE, por las RPC de la migración 0467
 * (`register_collection_receipt`, `identify_collection_receipt`,
 * `void_collection_receipt`). Antes se leía la factura sin lock y se escribía
 * `paid_amount` absoluto en otro request: dos cobros simultáneos, o un cobro y
 * una confirmación de reporte de pago, perdían una suma. Las lecturas previas
 * que quedan acá sólo dan el mensaje al usuario; la RPC vuelve a validar todo.
 * Regla de saldo estricta (decisión de Sam, igual que la 0464): nada por encima
 * de total − pagado.
 *
 * `registerCollectionFor`:
 *   1. valida (amount>0, ≤saldo, cuenta requerida, pagador — tercero exige
 *      nombre + relación + declaración de licitud, decisión #7)
 *   2. rpc register_collection_receipt: genera el receipt_code, inserta el
 *      payment_receipt (pagador + fund_class heredada + 'aplicado'), sube
 *      paid_amount y recalcula status (parcial/pagada), todo junto
 *   3. asiento del cobro (DR caja / CR 1.1.2), best-effort → guarda journal_entry_id
 *   4. audit (payment_receipt · payment_registered), en el trigger D2
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
 *   recalcula status en una transacción (una factura anulada no revive) +
 *   anula TODOS sus asientos (el inicial y, si fue identificado, la
 *   reclasificación). No borra (auditable).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaCaracas } from "@/lib/shared/fechas-caracas";
import { validateAuditReason } from "@/lib/studio/audit/reason";
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

/** Lo que devuelven las RPC de cobro de 0467 (jsonb). */
type CollectionRpcResult = {
  receipt_id: string;
  receipt_code: string;
  tenant_id: string;
  invoice_id: string | null;
  invoice_code?: string;
  amount?: number;
  currency?: InvoiceCurrency;
  fx_rate?: number | null;
  received_at?: string;
  paid_amount: number | null;
  status: string | null;
  fully_paid?: boolean;
};

/**
 * Rechazos de las RPC de 0467 → mensaje del Studio. Los de saldo son los
 * códigos de la 0464 (SDD-0484). Nunca se muestra el error crudo de Postgres.
 */
const COLLECTION_REJECTIONS: Record<string, string> = {
  PAYMENT_FORBIDDEN: "Tu rol no puede registrar ni anular cobros.",
  PAYMENT_INPUT: "Revisa el monto y la cuenta del cobro.",
  PAYMENT_INVOICE_NOT_FOUND: "Factura no encontrada.",
  PAYMENT_RECEIPT_NOT_FOUND: "Recibo no encontrado.",
  PAYMENT_STATE: "Solo se pueden registrar cobros en facturas emitidas o parciales.",
  PAYMENT_INVOICE_PAID:
    "La factura ya está pagada: otro cobro o reporte la saldó. Actualiza la página.",
  PAYMENT_EXCEEDS_BALANCE:
    "El monto supera el saldo vigente de la factura: otro cobro o reporte lo cambió. Actualiza la página.",
  PAYMENT_CURRENCY: "La moneda del pago no coincide con la de la factura.",
  PAYMENT_RECEIPT_APPLIED: "Este pago ya fue identificado y aplicado.",
  PAYMENT_RECEIPT_VOIDED: "Este recibo ya está anulado.",
};

function collectionRejection(
  error: { message?: string } | null,
  fallback: string,
  overrides: Record<string, string> = {},
): string {
  const code = error?.message?.trim() ?? "";
  return overrides[code] ?? COLLECTION_REJECTIONS[code] ?? fallback;
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
  const receivedAt = raw?.receivedAt === undefined ? fechaCaracas() : raw.receivedAt;
  // 1. Leer la factura (RLS la acota al tenant). Sólo para el mensaje y el
  // saldo del formulario: la RPC vuelve a validar con la factura bloqueada.
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
  const { input, fieldErrors } = validatePaymentInput({ ...raw, receivedAt }, balance);
  if (fieldErrors) return { fieldErrors };

  // 3. Cobro atómico (0467): factura FOR UPDATE, saldo estricto, receipt_code
  // serializado por tenant, recibo (pagador decisión #7 + fund_class HEREDADA
  // de la factura, decisión #5 — el sin-ref es el único camino que no hereda)
  // y paid_amount + status, todo en la misma transacción.
  const { data, error: rpcErr } = await supabase.rpc("register_collection_receipt", {
    p_invoice_id: inv.id,
    p_amount: input!.amount,
    p_cash_account_id: input!.cashAccountId,
    p_method: input!.method as PaymentMethod,
    p_received_at: input!.receivedAt,
    p_reference: input!.reference,
    p_notes: input!.notes,
    p_payer_kind: input!.payerKind,
    p_payer_name: input!.payerName,
    p_payer_relation: input!.payerRelation,
    p_licit_declared: input!.licitDeclared,
  });
  const receipt = data as CollectionRpcResult | null;
  if (rpcErr || !receipt?.receipt_id) {
    return { error: collectionRejection(rpcErr, "No se pudo registrar el cobro.") };
  }
  const receiptCode = receipt.receipt_code;

  // 4. Asiento del cobro (best-effort) — DR caja / CR 1.1.2. Guarda el id.
  try {
    const posting = await postReceiptJournalEntry({
      tenantId: receipt.tenant_id,
      receiptId: receipt.receipt_id,
      receiptCode,
      cashAccountId: input!.cashAccountId,
      amount: input!.amount,
      currency: receipt.currency ?? inv.currency,
      fxRate: receipt.fx_rate ?? null,
      entryDate: input!.receivedAt,
    });
    if (posting.ok && posting.entryId) {
      await supabase
        .from("payment_receipts")
        .update({ journal_entry_id: posting.entryId })
        .eq("id", receipt.receipt_id);
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

  return { ok: true, receiptCode, fullyPaid: receipt.fully_paid === true };
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
 *  2. rpc identify_collection_receipt (0467), con recibo y factura FOR UPDATE:
 *     setea invoice_id + snapshots + application_status='aplicado' +
 *     identified_at=now() — `received_at` NO se toca (la imputación es a la
 *     fecha ORIGINAL de recepción de fondos: eso ES la retroactividad en V1) —,
 *     hereda `fund_class` de la factura y sube paid_amount + status, junto.
 *  3. asiento de RECLASIFICACIÓN DR 2.1.8 / CR 1.1.2 con fecha = received_at
 *     (best-effort).
 */
export async function identifyPaymentFor(
  supabase: SupabaseClient,
  receiptId: string,
  invoiceId: string,
): Promise<IdentifyPaymentResult> {
  // 1. Leer el recibo. La RLS lo acota al tenant pero NO excluye anulados: la
  // 0230 sacó ese filtro del USING y la 0470 conservó el criterio (SDD-0494).
  // Acá no se agrega `.is("deleted_at", null)` a propósito — hace falta LEER el
  // anulado para poder rechazarlo con su mensaje, que es lo que hace la guarda
  // de abajo. Si se filtrara, un recibo anulado daría «no encontrado».
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

  // Regla estricta (decisión de Sam, igual que la 0464): nada sobre el saldo.
  const amount = round2(Number(receipt.amount));
  const balance = computeBalance({
    total_amount: Number(inv.total_amount),
    paid_amount: Number(inv.paid_amount),
  });
  if (amount > balance) {
    return {
      error: `El pago ($${amount.toFixed(2)}) supera el saldo de la factura ($${balance.toFixed(2)}).`,
    };
  }

  // 3. Identificación atómica (0467): recibo y factura FOR UPDATE; recibo
  // (factura + snapshots + aplicado + identified_at, received_at intacto,
  // fund_class heredada) y paid_amount + status en la misma transacción.
  const { data, error: rpcErr } = await supabase.rpc("identify_collection_receipt", {
    p_receipt_id: receipt.id,
    p_invoice_id: inv.id,
  });
  const identified = data as CollectionRpcResult | null;
  if (rpcErr || !identified?.receipt_id) {
    return {
      error: collectionRejection(rpcErr, "No se pudo identificar el pago.", {
        PAYMENT_STATE: "Solo se puede identificar contra facturas emitidas o parciales.",
      }),
    };
  }

  // 4. Reclasificación DR puente / CR 1.1.2 con fecha = received_at ORIGINAL.
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

  return {
    ok: true,
    receiptCode: receipt.receipt_code,
    invoiceCode: inv.invoice_code,
    fullyPaid: identified.fully_paid === true,
  };
}

/**
 * Anula un recibo: lo marca como anulado (deleted_at, con el motivo D2), baja
 * el paid_amount de su factura (si tiene — un sin-ref no apunta a ninguna) y
 * recalcula status en una transacción (rpc void_collection_receipt, 0467; una
 * factura anulada conserva su estado), y anula TODOS sus asientos (el inicial +
 * la reclasificación si fue identificado, SDD-0068). No borra (auditable).
 */
export async function voidReceiptFor(
  supabase: SupabaseClient,
  receiptId: string,
  reasonRaw: string,
): Promise<{ ok?: boolean; error?: string }> {
  const reasonResult = validateAuditReason(reasonRaw);
  if (!reasonResult.ok) return { error: reasonResult.error };

  // 1. Anulación atómica: recibo y factura FOR UPDATE, marca con motivo y
  // paid_amount + status, juntos. Si la factura no se puede ajustar, no anula.
  const { data, error: rpcErr } = await supabase.rpc("void_collection_receipt", {
    p_receipt_id: receiptId,
    p_reason: reasonResult.reason,
  });
  const voided = data as CollectionRpcResult | null;
  if (rpcErr || !voided?.receipt_id) {
    return { error: collectionRejection(rpcErr, "No se pudo anular el recibo.") };
  }

  // 2. Anular TODOS los asientos del recibo (inicial + reclasificación si fue
  // identificado). Best-effort. Cubre también el caso journal_entry_id null
  // con asientos atados por journal_entries.receipt_id.
  {
    const r = await voidEntriesForReceipt(voided.receipt_id);
    if (!r.ok) {
      console.error(
        `[contabilidad] no se pudieron anular los asientos del recibo ${voided.receipt_code}:`,
        r.error,
      );
    }
  }

  return { ok: true };
}
