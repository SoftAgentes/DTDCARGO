"use server";

/**
 * SDD-0365: resolución con motivo, clave estable y recibo auditado.
 * SDD-0556: después de un recibo ok que NO es replay se programa con `after()`
 * el correo al cliente. El comando corre sólo con la sesión; el cliente admin
 * se construye dentro del aviso, nunca acá.
 * SDD-0630: confirmar exige la cuenta de caja o banco donde entró el dinero. El
 * comando (migración 0537) crea el recibo de cobro en la misma transacción, con
 * la RPC de Cobranzas. Después, como en Cobranzas, se asienta el recibo
 * (best-effort, idempotente por recibo). Un replay también lo intenta: si el
 * primer intento no llegó a asentarlo, el reintento lo completa sin duplicar.
 */
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { runPaymentReportCommand, type PaymentCommandReceipt } from "@/lib/portal/payment-report-commands";
import type { PaymentReportStatus } from "@/lib/portal/payment-report-types";
import { notifyPaymentReportResolutionToClient } from "@/lib/studio/payment-report-resolution-notify";
import { postCollectionReceiptEntry } from "@/lib/studio/collections-actions";

export type ResolveReportResult = {
  ok?: boolean; error?: string; uncertain?: boolean; receipt?: PaymentCommandReceipt;
};

export async function resolvePaymentReport(
  reportId: string,
  action: Extract<PaymentReportStatus, "confirmado" | "rechazado">,
  reason: string,
  requestId: string,
  cashAccountId?: string,
): Promise<ResolveReportResult> {
  if (action !== "confirmado" && action !== "rechazado") return { error: "Acción no válida." };
  if (action === "confirmado" && !cashAccountId) {
    return { error: "Elige la cuenta de caja o banco donde entró el dinero." };
  }
  try {
    const session = await createClient();
    const denial = await moduleEditDenial(session, "invoices");
    if (denial) return { error: denial };
    const result = await runPaymentReportCommand(session, action === "confirmado"
      ? { verb: "confirm", reportId, requestId, reason, cashAccountId: cashAccountId as string }
      : { verb: "reject", reportId, requestId, reason });
    if (!result.ok) return result;
    const receipt = result.receipt;
    const collection = receipt.collection;
    if (collection) {
      await postCollectionReceiptEntry(session, {
        tenantId: collection.tenantId,
        receiptId: collection.id,
        receiptCode: collection.code,
        cashAccountId: collection.cashAccountId,
        amount: collection.amount,
        currency: collection.currency,
        fxRate: collection.fxRate,
        entryDate: collection.receivedAt,
      });
    }
    // Un replay ya avisó (o quedó incierto) en su primer intento: no se repite.
    if (!receipt.replayed) {
      try {
        after(() => notifyPaymentReportResolutionToClient(session, receipt));
      } catch {
        // `after()` sólo vale dentro de un request scope y lanza fuera de él. El
        // aviso es best-effort: el recibo ya quedó firme y no se toca.
      }
    }
    const code = encodeURIComponent(result.receipt.invoiceCode);
    for (const path of ["/studio/facturacion", "/studio/facturacion/" + code, "/studio/cobranzas",
      "/portal/facturas", "/portal/facturas/" + code]) {
      try { revalidatePath(path); } catch { /* El recibo confirmado sigue siendo válido. */ }
    }
    return { ok: true, receipt: result.receipt };
  } catch {
    return { error: "No pudimos comprobar tu sesión o permisos. Vuelve a entrar. Código: PAGO-ACCESO." };
  }
}
