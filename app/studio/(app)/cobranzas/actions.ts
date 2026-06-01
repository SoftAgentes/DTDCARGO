/**
 * Server actions del módulo Cobranzas (SDD-0041).
 *
 * - registerCollection: registra un cobro sobre una factura (delega en la
 *   lógica compartida `registerCollectionFor`: recibo + saldo + asiento).
 * - logActivity: registra una gestión de cobranza (contacto/promesa/nota/
 *   recordatorio).
 * - voidReceipt: anula un recibo (revierte saldo + anula su asiento).
 *
 * Sin Zod: validación con `validate*Input()` propio. Las acciones sensibles
 * (cobro, anular recibo) escriben en entity_audit_log via la lógica compartida
 * (entity_type 'payment_receipt', habilitado en la migración 0079).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  registerCollectionFor,
  voidReceiptFor,
} from "@/lib/studio/collections-actions";
import {
  validateActivityInput,
  type ActivityInput,
  type PaymentInput,
} from "@/lib/studio/payment-types";

/**
 * Registra un cobro desde el módulo Cobranzas. Mismo camino que el detalle de
 * factura (SDD-0021). Devuelve receiptCode + fullyPaid para la traza.
 */
export async function registerCollection(
  invoiceId: string,
  payload: Partial<PaymentInput>,
): Promise<{
  ok?: boolean;
  error?: string;
  receiptCode?: string;
  fullyPaid?: boolean;
}> {
  const supabase = await createClient();
  const result = await registerCollectionFor(supabase, invoiceId, payload);

  if (!result.ok) {
    const firstFieldError = result.fieldErrors
      ? Object.values(result.fieldErrors)[0]
      : undefined;
    return {
      error: result.error ?? firstFieldError ?? "No se pudo registrar el cobro.",
    };
  }

  revalidatePath("/studio/cobranzas");
  revalidatePath("/studio/facturacion");
  return { ok: true, receiptCode: result.receiptCode, fullyPaid: result.fullyPaid };
}

/**
 * Registra una gestión de cobranza (log liviano). El stage de la cola se
 * deriva de estas gestiones + saldo/vencimiento, no se persiste como estado.
 */
export async function logActivity(
  invoiceId: string,
  raw: Partial<ActivityInput>,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { input, fieldErrors } = validateActivityInput(raw);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos de gestión inválidos." };
  }

  // Resolver tenant del usuario logueado (RLS) + validar que la factura existe.
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { data: inv } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .maybeSingle<{ id: string }>();
  if (!inv) return { error: "Factura no encontrada." };

  const { data: user } = await supabase.auth.getUser();

  const { error } = await supabase.from("collection_activities").insert({
    tenant_id: link.tenant_id,
    invoice_id: invoiceId,
    kind: input!.kind,
    promised_amount: input!.promisedAmount,
    promised_date: input!.promisedDate,
    next_followup: input!.nextFollowup,
    body: input!.body,
    created_by: user.user?.id ?? null,
  });
  if (error) return { error: `No se pudo registrar la gestión: ${error.message}` };

  revalidatePath("/studio/cobranzas");
  return { ok: true };
}

/** Anula un recibo: revierte saldo de la factura + anula su asiento. */
export async function voidReceipt(
  receiptId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const r = await voidReceiptFor(supabase, receiptId);
  if (!r.ok) return { error: r.error };

  revalidatePath("/studio/cobranzas");
  revalidatePath("/studio/facturacion");
  return { ok: true };
}

/**
 * Lee los recibos + gestiones de una factura (para el historial del drawer).
 * Devuelve datos serializables (el drawer es client).
 */
export async function getReceivableHistory(invoiceId: string): Promise<{
  receipts: import("@/lib/studio/payment-types").PaymentReceipt[];
  activities: import("@/lib/studio/payment-types").CollectionActivity[];
}> {
  const supabase = await createClient();
  const { listReceipts, listActivities } = await import(
    "@/lib/studio/payment-queries"
  );
  const [receipts, activities] = await Promise.all([
    listReceipts(supabase, { invoiceId }),
    listActivities(supabase, invoiceId),
  ]);
  return { receipts, activities };
}
