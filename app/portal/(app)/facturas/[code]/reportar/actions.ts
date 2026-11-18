"use server";

/** SDD-0365: comandos auditados por sesión; admin sólo para contexto y Storage. */
import { revalidatePath } from "next/cache";
import { fechaCaracas } from "@/lib/shared/fechas-caracas";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import { countPendingReports, isAtPendingLimit } from "@/lib/portal/payment-report-queries";
import { validatePaymentReportInput, type PaymentCreationContext, type PaymentReportFieldErrors } from "@/lib/portal/payment-report-types";
import { validateProofFile, uploadPaymentProof } from "@/lib/portal/payment-proof";
import { runPaymentReportCommand, type PaymentCommandReceipt } from "@/lib/portal/payment-report-commands";
import { notifyPaymentReportToAdmin } from "@/lib/studio/payment-report-notify";
import type { InvoiceCurrency, InvoiceStatus } from "@/lib/studio/invoice-types";

export type PaymentReportFormState = {
  ok?: boolean;
  error?: string;
  uncertain?: boolean;
  receipt?: PaymentCommandReceipt;
  fieldErrors?: PaymentReportFieldErrors;
};
const CONSULT_ERROR = "No pudimos consultar tus reportes. No se envió esta operación. Intenta más tarde. Código: PAGO-CONSULTA.";
const INPUT_ERROR = "No se envió la operación. Actualiza la página y revisa los datos. Código: PAGO-DATOS.";
function uuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && value.length === 36
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
function validCode(code: string): boolean {
  return typeof code === "string" && code.trim().length > 0 && code.length <= 80
    && !/[\u0000-\u001f\u007f-\u009f]/.test(code);
}

export async function reportPaymentAction(
  invoiceCode: string,
  _prev: PaymentReportFormState,
  formData: FormData,
): Promise<PaymentReportFormState> {
  const businessDay = fechaCaracas();
  const requestId = formData.get("request_id");
  const reportId = formData.get("report_id");
  if (!uuid(requestId) || !uuid(reportId) || !validCode(invoiceCode)) return { error: INPUT_ERROR };
  const code = invoiceCode.trim();
  const proof = validateProofFile(formData.get("proof"));
  if (!proof.ok) return { fieldErrors: { proof: proof.error } };

  try {
    const session = await createClient();
    const principal = await getPortalClientPrincipal(session);
    if (!principal) return { error: "Tu sesión expiró o no eres un cliente del portal. Vuelve a entrar." };
    const { client, tenantId } = principal;
    const admin = createAdminClient();
    const { data: invoice, error: invoiceError } = await admin.from("invoices")
      .select("id, currency, status").eq("tenant_id", tenantId).eq("invoice_code", code)
      .eq("client_markbox", client.markbox).is("deleted_at", null)
      .maybeSingle<{ id: string; currency: InvoiceCurrency; status: InvoiceStatus }>();
    if (invoiceError) return { error: CONSULT_ERROR };
    if (!invoice) return { error: "No encontramos esa factura a tu nombre." };

    // Un replay debe seguir siendo recuperable después de confirmarse el pago
    // o llenarse el cupo. Esta lectura NO autoriza el comando: SQL reautoriza.
    const { data: existing, error: lookupError } = await admin.from("payment_reports")
      .select("id, proof_path").eq("tenant_id", tenantId).eq("invoice_id", invoice.id)
      .eq("client_markbox", client.markbox).eq("id", reportId).is("deleted_at", null)
      .maybeSingle<{ id: string; proof_path: string | null }>();
    if (lookupError) return { error: CONSULT_ERROR };
    if (existing && !existing.proof_path) return { error: "No pudimos verificar el comprobante original. Revisa el reporte con tu asesor. Código: PAGO-COMPROBANTE." };
    const context: PaymentCreationContext = existing
      ? { kind: "recovery-candidate" } : { kind: "new", businessDay };
    const { input, fieldErrors } = validatePaymentReportInput({
      amount: formData.get("amount"), method: formData.get("method"),
      paidAt: formData.get("paid_at"), note: formData.get("note"),
    }, context);
    if (!input || fieldErrors) return { fieldErrors: fieldErrors ?? {} };
    if (!existing) {
      if (["borrador", "pagada", "anulada"].includes(invoice.status)) {
        return { error: "Esta factura no admite nuevos reportes de pago. Revisa su estado con tu asesor. Código: PAGO-ESTADO." };
      }
      const pending = await countPendingReports(admin, { tenantId, invoiceId: invoice.id });
      if (pending === null) return { error: CONSULT_ERROR };
      if (isAtPendingLimit(pending)) return { error: "Ya tienes cinco reportes pendientes de revisión en esta factura. Espera su revisión. Código: PAGO-LIMITE." };
    }
    const uploaded = await uploadPaymentProof(admin, {
      tenantId, invoiceId: invoice.id, reportId, file: proof.file,
      ...(existing ? { expectedPath: existing.proof_path! } : {}),
    });
    if (uploaded.error || !uploaded.path) return { error: uploaded.error ?? "No pudimos verificar el comprobante. Código: PAGO-COMPROBANTE." };

    const result = await runPaymentReportCommand(session, {
      verb: "create", requestId, reportId, invoiceId: invoice.id,
      invoiceCode: code, input, proofPath: uploaded.path, context,
    });
    if (!result.ok) return result;
    // Best-effort: perder el aviso no invalida la transacción ya confirmada.
    // Un replay no vuelve a enviarlo; esto no promete un outbox exactly-once.
    if (!result.receipt.replayed) {
      try {
        await notifyPaymentReportToAdmin(admin, tenantId, {
          invoiceCode: code, markbox: client.markbox, clientName: client.name,
          amount: input.amount, currency: invoice.currency, method: input.method,
          paidAt: input.paidAt, hasProof: true,
        });
      } catch { /* El recibo sigue siendo válido. */ }
    }
    revalidateAfterReport(result.receipt.invoiceCode);
    return { ok: true, receipt: result.receipt };
  } catch {
    // El helper de comandos contiene todas las excepciones después del envío.
    // Llegar aquí sólo representa fallo de contexto/preflight/upload.
    return { error: CONSULT_ERROR };
  }
}

/** Cancela conservando reporte/evidencia; motivo y autorización viven en SQL. */
export async function cancelPaymentReportAction(
  invoiceCode: string,
  _prev: PaymentReportFormState,
  formData: FormData,
): Promise<PaymentReportFormState> {
  const requestId = formData.get("request_id");
  const reportId = formData.get("report_id");
  const reason = formData.get("reason");
  if (!uuid(requestId) || !uuid(reportId) || !validCode(invoiceCode)) return { error: INPUT_ERROR };
  if (typeof reason !== "string") return { error: "Escribe el motivo de la cancelación. Código: PAGO-MOTIVO." };
  try {
    const session = await createClient();
    if (!await getPortalClientPrincipal(session)) return { error: "Tu sesión expiró. Vuelve a entrar." };
    const result = await runPaymentReportCommand(session, {
      verb: "cancel", requestId, reportId, invoiceCode: invoiceCode.trim(), reason,
    });
    if (!result.ok) return result;
    revalidateAfterReport(result.receipt.invoiceCode);
    return { ok: true, receipt: result.receipt };
  } catch {
    return { error: CONSULT_ERROR };
  }
}

function revalidateAfterReport(invoiceCode: string): void {
  const code = encodeURIComponent(invoiceCode);
  for (const path of ["/portal/facturas", "/portal/facturas/" + code,
    "/portal/facturas/" + code + "/reportar", "/studio/facturacion", "/studio/facturacion/" + code]) {
    try { revalidatePath(path); } catch { /* No convertir un recibo confirmado en fallo. */ }
  }
}
