"use server";

/**
 * Reportar un pago + comprobante sobre una factura del portal (SDD-0134 · Slice A).
 *
 * Patrón portal (espeja aceptar/actions.ts): identidad por SESIÓN primero
 * (getPortalClient); recién después el admin client (service_role) escribe,
 * scopeando TODO explícito por markbox/tenant. El comprobante va a un bucket
 * PRIVADO server-side (un cliente puro no matchea get_user_tenant_id() → no sube
 * por RLS). Insert real vía admin (bypassa RLS = defensa en profundidad); el
 * trigger de la migr 0195 igual valida invoice↔tenant↔markbox para todo cliente.
 *
 * "Confirmar" NO ocurre acá (es del asesor, Slice B). Acá solo se crea el reporte
 * en `reportado` y se avisa al equipo (best-effort).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  countPendingReports,
  isAtPendingLimit,
} from "@/lib/portal/payment-report-queries";
import {
  validatePaymentReportInput,
  type PaymentReportFieldErrors,
} from "@/lib/portal/payment-report-types";
import {
  validateProofFile,
  hasProofFile,
  uploadPaymentProof,
  removePaymentProof,
} from "@/lib/portal/payment-proof";
import { notifyPaymentReportToAdmin } from "@/lib/studio/payment-report-notify";
import type { InvoiceCurrency, InvoiceStatus } from "@/lib/studio/invoice-types";

export type PaymentReportFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: PaymentReportFieldErrors;
};

/** Estados de factura donde ya no tiene sentido reportar un pago. */
const CLOSED_INVOICE_STATUSES: ReadonlySet<InvoiceStatus> = new Set<InvoiceStatus>([
  "borrador",
  "pagada",
  "anulada",
]);

/**
 * Registra un reporte de pago para la factura `invoiceCode`. El code viaja por
 * `.bind()` desde el form (useActionState pasa _prev + formData).
 */
export async function reportPaymentAction(
  invoiceCode: string,
  _prev: PaymentReportFormState,
  formData: FormData,
): Promise<PaymentReportFormState> {
  // 1. Identidad por SESIÓN. Si no es cliente del portal → corte.
  const session = await createClient();
  const client = await getPortalClient(session);
  if (!client) {
    return { error: "Tu sesión expiró o no eres un cliente del portal. Vuelve a entrar." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No pudimos procesar el reporte ahora. Prueba de nuevo en un rato." };
  }

  // 2. tenant_id del cliente.
  const { data: clientRow } = await admin
    .from("clients")
    .select("tenant_id")
    .eq("id", client.id)
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = String(clientRow?.tenant_id ?? "").trim();
  if (!tenantId) {
    return { error: "No pudimos resolver tu cuenta. Contacta a tu asesor." };
  }

  // 3. La factura DEBE ser suya, no-borrador y con saldo abierto.
  const { data: invRow } = await admin
    .from("invoices")
    .select("id, currency, status, total_amount, paid_amount")
    .eq("tenant_id", tenantId)
    .eq("invoice_code", invoiceCode)
    .eq("client_markbox", client.markbox)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      currency: InvoiceCurrency;
      status: InvoiceStatus;
      total_amount: number;
      paid_amount: number;
    }>();

  if (!invRow) {
    return { error: "No encontramos esa factura a tu nombre." };
  }
  if (CLOSED_INVOICE_STATUSES.has(invRow.status)) {
    return {
      error:
        invRow.status === "pagada"
          ? "Esta factura ya está pagada. No hace falta reportar un pago."
          : "Esta factura no admite reportes de pago en este momento. Contacta a tu asesor.",
    };
  }

  // 4. Anti-abuso: tope de reportes pendientes por factura.
  const pending = await countPendingReports(admin, {
    tenantId,
    invoiceId: invRow.id,
  });
  if (isAtPendingLimit(pending)) {
    return {
      error:
        "Ya tienes varios reportes pendientes de revisión en esta factura. Espera a que tu asesor los procese.",
    };
  }

  // 5. Validación del form (fecha de hoy inyectada server-side → sin futuros).
  const todayIso = new Date().toISOString().slice(0, 10);
  const { input, fieldErrors } = validatePaymentReportInput(
    {
      amount: formData.get("amount"),
      method: formData.get("method"),
      paidAt: formData.get("paid_at"),
      note: formData.get("note"),
    },
    todayIso,
  );
  if (fieldErrors || !input) {
    return { fieldErrors: fieldErrors ?? {} };
  }

  // 6. Comprobante (obligatorio). Distingue "sin adjuntar" de "formato inválido".
  const rawProof = formData.get("proof");
  if (!hasProofFile(rawProof)) {
    return { fieldErrors: { proof: "Adjunta el comprobante de tu pago." } };
  }
  const proofCheck = validateProofFile(rawProof);
  if (!proofCheck.ok) {
    return { fieldErrors: { proof: proofCheck.error } };
  }

  // 7. Sube el comprobante ANTES del insert (path usa el reportId que fijamos).
  const reportId = crypto.randomUUID();
  const up = await uploadPaymentProof(admin, {
    tenantId,
    invoiceId: invRow.id,
    reportId,
    file: proofCheck.file,
  });
  if (up.error || !up.path) {
    return { error: "No pudimos subir el comprobante. Prueba de nuevo." };
  }

  // 8. Insert del reporte (el trigger sella invoice_code + valida coherencia). La
  //    moneda la toma de la FACTURA (el cliente no la elige).
  const { error: insErr } = await admin.from("payment_reports").insert({
    id: reportId,
    tenant_id: tenantId,
    invoice_id: invRow.id,
    invoice_code: invoiceCode, // el trigger lo re-sella desde la factura
    client_markbox: client.markbox,
    amount: input.amount,
    currency: invRow.currency,
    method: input.method,
    paid_at: input.paidAt,
    proof_path: up.path,
    status: "reportado",
    note: input.note,
  });

  if (insErr) {
    // Rollback del objeto subido (no dejar comprobante huérfano).
    await removePaymentProof(admin, up.path);
    return { error: "No pudimos registrar tu reporte. Prueba de nuevo." };
  }

  // 9. Aviso al equipo (best-effort, nunca rompe el alta).
  await notifyPaymentReportToAdmin(admin, tenantId, {
    invoiceCode,
    markbox: client.markbox,
    clientName: client.name,
    amount: input.amount,
    currency: invRow.currency,
    method: input.method,
    paidAt: input.paidAt,
    hasProof: true,
  });

  revalidateAfterReport(invoiceCode);
  return { ok: true };
}

/**
 * Cancela (soft-delete) un reporte del cliente MIENTRAS siga en `reportado`. Es el
 * "borrar antes de que el asesor confirme" (decisión founder). Para EDITAR, el
 * cliente cancela y reporta de nuevo. El code viaja por `.bind()`.
 */
export async function cancelPaymentReportAction(
  invoiceCode: string,
  _prev: PaymentReportFormState,
  formData: FormData,
): Promise<PaymentReportFormState> {
  const session = await createClient();
  const client = await getPortalClient(session);
  if (!client) {
    return { error: "Tu sesión expiró. Vuelve a entrar." };
  }

  const reportId = String(formData.get("report_id") ?? "").trim();
  if (!reportId) {
    return { error: "Reporte no válido." };
  }

  // Soft-delete por SESIÓN (la RLS portal self update exige markbox + status
  // 'reportado' → un cliente no puede tocar el de otro ni uno ya confirmado).
  const { error } = await session
    .from("payment_reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("client_markbox", client.markbox)
    .eq("status", "reportado")
    .is("deleted_at", null);

  if (error) {
    return { error: "No pudimos cancelar el reporte. Prueba de nuevo." };
  }

  revalidateAfterReport(invoiceCode);
  return { ok: true };
}

function revalidateAfterReport(invoiceCode: string): void {
  revalidatePath("/portal/facturas");
  revalidatePath(`/portal/facturas/${invoiceCode}`);
  revalidatePath(`/portal/facturas/${invoiceCode}/reportar`);
}
