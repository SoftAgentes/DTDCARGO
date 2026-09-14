"use server";

/** SDD-0365: resolución con motivo, clave estable y recibo auditado. */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { runPaymentReportCommand, type PaymentCommandReceipt } from "@/lib/portal/payment-report-commands";
import type { PaymentReportStatus } from "@/lib/portal/payment-report-types";

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
