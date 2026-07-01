"use server";

/**
 * Confirmar / rechazar reportes de pago del cliente (SDD-0134 · Slice B).
 *
 * El cliente reporta un pago desde el portal (payment_reports en `reportado`); el
 * asesor lo procesa acá. Confirmar = "solo marca" (decisión founder): el RPC
 * atómico `confirm_payment_report` suma el monto a invoices.paid_amount y recomputa
 * el status. Rechazar solo marca el reporte con el motivo. Sin asiento contable
 * (eso es Slice C). Gate por RBAC del módulo Facturación.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import type { PaymentReportStatus } from "@/lib/portal/payment-report-types";

export type ResolveReportResult = { ok?: boolean; error?: string };

/**
 * Confirma o rechaza el reporte `reportId`. `action` ∈ {confirmado, rechazado}.
 * `note` es opcional (motivo del rechazo). El RPC valida el tenant del caller y
 * bloquea la doble resolución.
 */
export async function resolvePaymentReport(
  reportId: string,
  action: Extract<PaymentReportStatus, "confirmado" | "rechazado">,
  note?: string,
): Promise<ResolveReportResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "invoices");
  if (denial) return { error: denial };

  if (action !== "confirmado" && action !== "rechazado") {
    return { error: "Acción no válida." };
  }

  const cleanNote = (note ?? "").trim().slice(0, 500) || null;

  const { data, error } = await supabase.rpc("confirm_payment_report", {
    p_report_id: reportId,
    p_action: action,
    p_note: cleanNote,
  });

  if (error) {
    // Errores de negocio del RPC (ya procesado, ajeno, sin permiso) llegan como
    // message; los mostramos tal cual (son amables).
    return {
      error:
        error.message?.replace(/^.*?:\s*/, "") ??
        "No se pudo procesar el reporte.",
    };
  }

  // El RPC devuelve la fila; revalidamos el detalle por su invoice_code.
  const invoiceCode =
    (data as { invoice_code?: string } | null)?.invoice_code ?? null;

  revalidatePath("/studio/facturacion");
  if (invoiceCode) {
    revalidatePath(`/studio/facturacion/${invoiceCode}`);
  }
  return { ok: true };
}
