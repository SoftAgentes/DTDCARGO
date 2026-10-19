"use server";

/**
 * SDD-0365: resolución con motivo, clave estable y recibo auditado.
 * SDD-0556: después de un recibo ok que NO es replay se programa con `after()`
 * el correo al cliente. El comando corre sólo con la sesión; el cliente admin
 * se construye dentro del aviso, nunca acá.
 */
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { runPaymentReportCommand, type PaymentCommandReceipt } from "@/lib/portal/payment-report-commands";
import type { PaymentReportStatus } from "@/lib/portal/payment-report-types";
import { notifyPaymentReportResolutionToClient } from "@/lib/studio/payment-report-resolution-notify";

export type ResolveReportResult = {
  ok?: boolean; error?: string; uncertain?: boolean; receipt?: PaymentCommandReceipt;
};

export async function resolvePaymentReport(
  reportId: string,
  action: Extract<PaymentReportStatus, "confirmado" | "rechazado">,
  reason: string,
  requestId: string,
): Promise<ResolveReportResult> {
  if (action !== "confirmado" && action !== "rechazado") return { error: "Acción no válida." };
  try {
    const session = await createClient();
    const denial = await moduleEditDenial(session, "invoices");
    if (denial) return { error: denial };
    const result = await runPaymentReportCommand(session, {
      verb: action === "confirmado" ? "confirm" : "reject", reportId, requestId, reason,
    });
    if (!result.ok) return result;
    const receipt = result.receipt;
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
    for (const path of ["/studio/facturacion", "/studio/facturacion/" + code,
      "/portal/facturas", "/portal/facturas/" + code]) {
      try { revalidatePath(path); } catch { /* El recibo confirmado sigue siendo válido. */ }
    }
    return { ok: true, receipt: result.receipt };
  } catch {
    return { error: "No pudimos comprobar tu sesión o permisos. Vuelve a entrar. Código: PAGO-ACCESO." };
  }
}
