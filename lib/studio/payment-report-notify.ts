/**
 * Aviso interno "un cliente reportó un pago desde el portal" (SDD-0134). Sin esto,
 * el reporte entra a la factura y el asesor no se entera de que hay algo que
 * confirmar. Avisa a los admins del tenant con la factura + el monto + método.
 *
 * Calca `cotizacion-request-notify.ts`: reusa resolveAdminEntries +
 * escapeHtml (mecánica "avisar al equipo"); el Telegram sale por la categoría
 * `equipo` (SDD-0271), una vez por chat. Y `sendEmail`
 * (subject+html crudos, sin template → sin migración). Best-effort por canal: cada
 * fallo se loguea pero NO rompe el alta del reporte.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import {
  resolveAdminEntries,
  escapeHtml,
} from "@/lib/studio/new-client-notify";
import { dispatchAlert } from "@/lib/studio/alerts/dispatch-alert";
import {
  paymentMethodLabel,
  type PaymentReportMethod,
} from "@/lib/portal/payment-report-types";
import { formatInvoiceAmount } from "@/lib/portal/portal-types";
import type { InvoiceCurrency } from "@/lib/studio/invoice-types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export interface PaymentReportNotifyPayload {
  invoiceCode: string;
  markbox: string;
  clientName: string;
  amount: number;
  currency: InvoiceCurrency;
  method: PaymentReportMethod;
  /** YYYY-MM-DD según el cliente. */
  paidAt: string;
  /** ¿Adjuntó comprobante? */
  hasProof: boolean;
}

/**
 * Avisa a los admins que un cliente reportó un pago. Best-effort, nunca tira.
 */
export async function notifyPaymentReportToAdmin(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  payload: PaymentReportNotifyPayload,
): Promise<void> {
  try {
    const admins = await resolveAdminEntries(supabaseAdmin, tenantId);
    if (admins.length === 0) {
      console.warn(
        "[payment-report-notify] sin admins para notificar",
        payload.invoiceCode,
      );
      return;
    }

    // El asesor confirma desde el detalle de la factura en Facturación.
    const studioUrl = `${SITE_URL}/studio/facturacion`;
    const monto = formatInvoiceAmount(payload.amount, payload.currency);
    const metodo = paymentMethodLabel(payload.method);

    const subject = `Pago reportado · ${payload.invoiceCode} — ${monto}`;
    const html = buildHtml(payload, { studioUrl, monto, metodo });
    const telegramText = buildTelegramText(payload, { studioUrl, monto, metodo });

    for (const admin of admins) {
      const res = await sendEmail(supabaseAdmin, tenantId, {
        subject,
        html,
        to: admin.email,
        to_name: "Equipo DTD",
        metadata: {
          source: "payment-report-notify",
          code: payload.invoiceCode,
        },
      });
      if (!res.ok) {
        console.error("[payment-report-notify] email falló:", res.error);
      }
    }

    // Telegram: UNA vez por CHAT, fuera del bucle de admins (SDD-0271).
    await dispatchAlert(
      supabaseAdmin,
      tenantId,
      "equipo",
      {
        telegramText,
        // Sin monto, método ni nombre: sólo el código de la factura (SDD-0606).
        discord: {
          titulo: "Reporte de pago del portal",
          codigo: payload.invoiceCode,
          url: studioUrl,
        },
      },
      { logTag: "payment-report-notify" },
    );
  } catch (err) {
    console.error(
      "[payment-report-notify] notifyPaymentReportToAdmin falló:",
      err,
    );
  }
}

type Derived = { studioUrl: string; monto: string; metodo: string };

function buildHtml(p: PaymentReportNotifyPayload, d: Derived): string {
  const rows: Array<[string, string]> = [
    ["Factura", p.invoiceCode],
    ["Shipping Mark", p.markbox],
    ["Cliente", p.clientName],
    ["Monto", d.monto],
    ["Método", d.metodo],
    ["Fecha del pago", p.paidAt],
    ["Comprobante", p.hasProof ? "Adjunto" : "Sin adjuntar"],
  ];
  const trs = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;font-size:13px;vertical-align:top">${escapeHtml(
          k,
        )}</td><td style="padding:4px 0;color:#0F1E3D;font-size:14px;font-weight:600">${escapeHtml(
          v,
        )}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 4px"><b>Pago reportado desde el portal</b></p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">Un cliente reportó un pago. Ábrelo en Facturación, revisa el comprobante y confírmalo o recházalo.</p>
<table style="border-collapse:collapse;margin:0 0 20px">${trs}</table>
<p style="margin:0 0 12px"><a href="${d.studioUrl}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Abrir Facturación en el Studio &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · aviso interno automático</p>
</div>`;
}

function buildTelegramText(
  p: PaymentReportNotifyPayload,
  d: Derived,
): string {
  return [
    `Pago reportado · ${p.invoiceCode}`,
    ``,
    `${p.clientName} (${p.markbox})`,
    `${d.monto} · ${d.metodo} · ${p.paidAt}`,
    `Comprobante: ${p.hasProof ? "adjunto" : "sin adjuntar"}`,
    ``,
    d.studioUrl,
  ].join("\n");
}
