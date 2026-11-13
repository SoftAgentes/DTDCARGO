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
 * SDD-0489: el pago y el saldo de la CxP se escriben en UNA transacción, con
 * la CxP tomada FOR UPDATE, por las RPC de la migración 0468
 * (`register_supplier_payment_order`, `void_supplier_payment_order`), igual que
 * Cobranzas con la 0467 (SDD-0488). Antes se leía la CxP sin lock y se escribía
 * `paid_amount` absoluto en otro request: dos pagos simultáneos, o un pago y una
 * anulación, perdían una suma. Las lecturas previas que quedan acá sólo dan el
 * mensaje al usuario; la RPC vuelve a validar todo. Regla de saldo estricta,
 * la de Cobranzas: nada por encima de total − pagado.
 *
 * `registerPaymentFor`:
 *   1. valida (amount>0, ≤saldo, cuenta de caja)
 *   2. rpc register_supplier_payment_order: genera el payment_code, inserta la
 *      supplier_payment, sube paid_amount y recalcula status (parcial/pagada),
 *      todo junto
 *   3. asiento del pago (DR 2.1.1 / CR caja), best-effort → journal_entry_id
 *   4. audit (supplier_payment · payment_registered), en el trigger D2
 *
 * `voidPaymentFor`: rpc void_supplier_payment_order anula la orden (deleted_at,
 *   con el motivo D2) + baja paid_amount + recalcula status en una transacción
 *   (una CxP anulada conserva su estado) + anula su asiento. No borra
 *   (auditable).
 *
 * `voidBillFor`: anula la CxP sin pagos (status='anulada' + anula su asiento).
 */

import { fechaCaracas, isCalendarDate } from "@/lib/shared/fechas-caracas";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateAuditReason } from "@/lib/studio/audit/reason";
import { tasaDelDocumento } from "@/lib/studio/fx-rates";
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
  validateBillCostLink,
  validatePaymentInput,
  type BillCostLink,
  type BillInput,
  type PaymentMethod,
  type SupplierPaymentInput,
} from "./types";
import { isMissingCostLinkColumns, shipmentInContainer } from "./cost-link-queries";

/** SDD-0631: mensaje cuando la base todavía no tiene la 0536. */
export const COST_LINK_UNAVAILABLE =
  "La base todavía no tiene el vínculo de CxP con contenedor (migración 0536).";

/** El embarque elegido tiene que estar asignado al contenedor elegido. */
async function costLinkError(
  supabase: SupabaseClient,
  link: BillCostLink,
): Promise<string | null> {
  if (!link.consolidationId || !link.shipmentId) return null;
  const inside = await shipmentInContainer(supabase, link.consolidationId, link.shipmentId);
  return inside ? null : "Ese embarque no está asignado al contenedor elegido.";
}

/** Las columnas de la 0536, solo si hay vínculo: sin él, la base vieja sigue sirviendo. */
function costLinkColumns(link: BillCostLink): Record<string, string | null> {
  if (!link.consolidationId && !link.shipmentId) return {};
  return { consolidation_id: link.consolidationId, cost_category: link.costCategory };
}

/** Lo que devuelven las RPC de pagos de 0468 (jsonb). */
type PaymentOrderRpcResult = {
  payment_id: string;
  payment_code: string;
  tenant_id: string;
  bill_id: string;
  bill_code?: string;
  currency?: string;
  fx_rate?: number | null;
  amount?: number;
  paid_amount: number | null;
  total_amount?: number;
  status: string | null;
  fully_paid?: boolean;
};

/**
 * Rechazos de las RPC de 0468 → mensaje del Studio. Mismos criterios de saldo
 * que Cobranzas (0467). Nunca se muestra el error crudo de Postgres.
 */
const PAYMENT_ORDER_REJECTIONS: Record<string, string> = {
  PAYMENT_FORBIDDEN: "Tu rol no puede registrar ni anular pagos a proveedores.",
  PAYMENT_INPUT: "Revisa el monto y la cuenta del pago.",
  PAYMENT_BILL_NOT_FOUND: "CxP no encontrada.",
  PAYMENT_ORDER_NOT_FOUND: "Orden de pago no encontrada.",
  PAYMENT_STATE: "Solo se pueden registrar pagos en CxP pendientes o parciales.",
  PAYMENT_BILL_PAID: "La CxP ya está pagada: otro pago la saldó. Actualiza la página.",
  PAYMENT_EXCEEDS_BALANCE:
    "El monto supera el saldo vigente de la CxP: otro pago lo cambió. Actualiza la página.",
  PAYMENT_ORDER_VOIDED: "Esta orden ya está anulada.",
};

function paymentOrderRejection(error: { message?: string } | null, fallback: string): string {
  return PAYMENT_ORDER_REJECTIONS[error?.message?.trim() ?? ""] ?? fallback;
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
  const businessDay = fechaCaracas();
  const issueDate = raw?.issueDate === undefined ? businessDay : raw.issueDate;
  if (!isCalendarDate(issueDate)) return { fieldErrors: { issueDate: "Fecha de emisión inválida (YYYY-MM-DD)." } };
  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // SDD-0569: fuera de USD y USDT, la tasa escrita o la vigente de fx_rates,
  // congelada en la CxP con su fuente y su fecha.
  const tasa = await tasaDelDocumento(
    supabase, tenantId, raw.currency ?? "USD", raw.fxRate ?? null,
    issueDate,
  );
  if (!tasa.ok) return { fieldErrors: { fxRate: tasa.error } };
  const { input, fieldErrors } = validateBillInput(
    { ...raw, issueDate, ...(tasa.tasa.fxRate !== null ? { fxRate: tasa.tasa.fxRate } : {}) },
  );
  if (fieldErrors) return { fieldErrors };

  // Snapshot del proveedor (nombre) + validar que existe en el tenant.
  const { data: supplier, error: supErr } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("id", input!.supplierId)
    .maybeSingle<{ id: string; name: string }>();
  if (supErr || !supplier) return { error: "Proveedor no encontrado." };

  const link: BillCostLink = {
    consolidationId: input!.consolidationId ?? null,
    shipmentId: input!.shipmentId,
    costCategory: input!.costCategory ?? null,
  };
  const linkErr = await costLinkError(supabase, link);
  if (linkErr) return { fieldErrors: { shipmentId: linkErr } };

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
      // Solo en VES o CNY: en USD y USDT no se nombran las columnas de la 0495.
      ...(tasa.tasa.fxRateSource
        ? {
            fx_rate_source: tasa.tasa.fxRateSource, fx_rate_valid_on: tasa.tasa.fxRateValidOn,
            fx_rate_is_override: tasa.tasa.fxRateIsOverride,
          }
        : {}),
      total_amount: input!.totalAmount,
      status: "pendiente",
      issue_date: input!.issueDate,
      due_date: input!.dueDate,
      reference: input!.reference,
      shipment_id: input!.shipmentId,
      ...costLinkColumns(link),
      notes: input!.notes,
    })
    // SDD-0569 (revisión, hallazgo 6): la tasa que quedó guardada (numeric(20,8)),
    // para que el asiento y el documento usen la misma.
    .select("id, fx_rate")
    .single<{ id: string; fx_rate: number | string | null }>();
  if (insErr || !insertedBill) {
    if (isMissingCostLinkColumns(insErr?.message)) return { error: COST_LINK_UNAVAILABLE };
    return { error: `No se pudo crear la CxP: ${insErr?.message}` };
  }
  const tasaGuardada = insertedBill.fx_rate == null ? null : Number(insertedBill.fx_rate);

  // Asiento de causación (best-effort) — DR gasto / CR 2.1.1.
  try {
    const posting = await postBillJournalEntry({
      tenantId,
      billId: insertedBill.id,
      billCode,
      expenseAccountId: input!.expenseAccountId,
      amount: input!.totalAmount,
      currency: input!.currency,
      fxRate: tasaGuardada,
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

// ── SDD-0631 · Ligar una CxP existente a contenedor/embarque ───

/**
 * Liga, cambia o quita el vínculo de costo de una CxP no anulada. No toca el
 * asiento ni el saldo: solo a qué contenedor/embarque pertenece el costo.
 * RLS (0470) exige accounting o admin; el trigger de la 0536 repite la regla.
 */
export async function linkBillCostFor(
  supabase: SupabaseClient,
  billId: string,
  raw: { consolidationId?: string | null; shipmentId?: string | null; costCategory?: string | null },
): Promise<{ ok?: boolean; error?: string }> {
  const { link, error } = validateBillCostLink(raw);
  if (error || !link) return { error: error ?? "Vínculo inválido." };

  const { data: bill, error: readErr } = await supabase
    .from("supplier_bills")
    .select("id, status, deleted_at")
    .eq("id", billId)
    .maybeSingle<{ id: string; status: string; deleted_at: string | null }>();
  if (readErr || !bill || bill.deleted_at) return { error: "CxP no encontrada." };
  if (bill.status === "anulada") return { error: "Una CxP anulada no se liga a un contenedor." };

  const linkErr = await costLinkError(supabase, link);
  if (linkErr) return { error: linkErr };

  const { data: updated, error: updErr } = await supabase
    .from("supplier_bills")
    .update({
      consolidation_id: link.consolidationId,
      shipment_id: link.shipmentId,
      cost_category: link.costCategory,
    })
    .eq("id", billId)
    // La lectura de arriba no bloquea: si la anularon en el medio, no se liga.
    .neq("status", "anulada")
    .select("id");
  if (updErr) {
    if (isMissingCostLinkColumns(updErr.message)) return { error: COST_LINK_UNAVAILABLE };
    return { error: "No se pudo ligar la CxP. Revisa el contenedor y el embarque." };
  }
  // RLS sin permiso de escritura no da error: devuelve cero filas.
  if (!updated || updated.length === 0) {
    return { error: "No se ligó: tu rol no puede cambiar esta CxP o la anularon mientras tanto." };
  }
  return { ok: true };
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
  status: string;
  total_amount: number;
  paid_amount: number;
};

const BILL_PAY_COLUMNS = "id, tenant_id, bill_code, status, total_amount, paid_amount";

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
  const paidAt = raw?.paidAt === undefined ? fechaCaracas() : raw.paidAt;
  // 1. Leer la CxP (RLS la acota al tenant). Sólo para el mensaje y el saldo
  // del formulario: la RPC vuelve a validar con la CxP bloqueada.
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

  const { input, fieldErrors } = validatePaymentInput({ ...raw, paidAt }, balance);
  if (fieldErrors) return { fieldErrors };

  // 2. Pago atómico (0468): CxP FOR UPDATE, saldo estricto, payment_code
  // serializado por tenant y la orden (hereda moneda y fx_rate de la CxP, una
  // orden por CxP en el MVP) + paid_amount + status, en la misma transacción.
  const { data, error: rpcErr } = await supabase.rpc("register_supplier_payment_order", {
    p_bill_id: bill.id,
    p_amount: input!.amount,
    p_cash_account_id: input!.cashAccountId,
    p_method: input!.method as PaymentMethod,
    p_paid_at: input!.paidAt,
    p_reference: input!.reference,
    p_notes: input!.notes,
  });
  const payment = data as PaymentOrderRpcResult | null;
  if (rpcErr || !payment?.payment_id) {
    return { error: paymentOrderRejection(rpcErr, "No se pudo registrar el pago.") };
  }
  const paymentCode = payment.payment_code;

  // 3. Asiento del pago (best-effort) — DR 2.1.1 / CR caja. Guarda el id.
  try {
    const posting = await postSupplierPaymentJournalEntry({
      tenantId: payment.tenant_id,
      paymentId: payment.payment_id,
      paymentCode,
      cashAccountId: input!.cashAccountId,
      amount: input!.amount,
      currency: payment.currency ?? "USD",
      fxRate: payment.fx_rate ?? null,
      entryDate: input!.paidAt,
    });
    if (posting.ok && posting.entryId) {
      await supabase
        .from("supplier_payments")
        .update({ journal_entry_id: posting.entryId })
        .eq("id", payment.payment_id);
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

  return { ok: true, paymentCode, fullyPaid: payment.fully_paid === true };
}

// ── Anular orden de pago ───────────────────────────────────────

export async function voidPaymentFor(
  supabase: SupabaseClient,
  paymentId: string,
  reasonRaw: string,
): Promise<{ ok?: boolean; error?: string }> {
  const reasonResult = validateAuditReason(reasonRaw);
  if (!reasonResult.ok) return { error: reasonResult.error };

  // 1. Anulación atómica (0468): orden y CxP FOR UPDATE, marca con motivo D2 y
  // paid_amount + status, juntos. Si la CxP no se puede ajustar, no anula.
  const { data, error: rpcErr } = await supabase.rpc("void_supplier_payment_order", {
    p_payment_id: paymentId,
    p_reason: reasonResult.reason,
  });
  const voided = data as (PaymentOrderRpcResult & { journal_entry_id?: string | null }) | null;
  if (rpcErr || !voided?.payment_id) {
    return { error: paymentOrderRejection(rpcErr, "No se pudo anular la orden de pago.") };
  }

  // 2. Anular el asiento del pago (si lo tiene). Best-effort.
  if (voided.journal_entry_id) {
    const r = await voidSupplierPaymentJournalEntry(voided.journal_entry_id);
    if (!r.ok) {
      console.error(
        `[contabilidad] no se pudo anular el asiento del pago ${voided.payment_code}:`,
        r.error,
      );
    }
  }

  return { ok: true };
}
