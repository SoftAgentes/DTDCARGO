/**
 * Aviso al CLIENTE cuando el equipo confirma o rechaza su reporte de pago
 * (SDD-0556). Hasta ahora el cliente reportaba desde el portal y no se enteraba
 * de nada: tenía que volver a entrar para ver si su pago se aceptó.
 *
 * ## Cómo sale
 *
 * - Correo best-effort con `sendEmail` (subject + html crudos, sin plantilla y
 *   sin migración), como `payment-report-notify.ts`. Respeta `test_mode` y la
 *   lista negra del tenant.
 * - Lo programa `resolvePaymentReport` con `after()`, sólo si el comando dio un
 *   recibo ok que NO es replay. Nunca cambia el resultado de la acción.
 * - **Límite aceptado:** si el primer intento quedó incierto (la respuesta se
 *   perdió) y el reintento vuelve como replay, no sale correo.
 *
 * ## Qué lee y con qué cliente
 *
 * 1. El reporte, con la SESIÓN del asesor (RLS: accounting/admin del tenant),
 *    filtrado por el id y la factura del recibo. Si la fila no está, no
 *    coincide con el recibo o fue cancelada, no se avisa y el admin ni se
 *    construye.
 * 2. Recién entonces el cliente admin: el correo de la ficha vive en `clients`
 *    y `mail_logs` está cerrado para `authenticated`. El destinatario sale de
 *    `emailDelShippingMark` (ficha vigente, sigue la fusión, nada si se eliminó
 *    sin fusión — SDD-0511), con el tenant DE LA FILA del reporte.
 *
 * NO lee `invoices` (inventario SDD-0357 congelado) y por eso el correo no trae
 * el saldo de la factura: lleva al portal, donde se ve. No promete recibo:
 * confirmar hoy no crea un recibo R- (fase 3).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { emailDelShippingMark } from "@/lib/studio/mail/mail-rule-engine";
import { EMAIL_FONT_STACK } from "@/lib/studio/mail/email-typography";
import { escapeHtml } from "@/lib/studio/new-client-notify";
import {
  PAYMENT_METHODS,
  paymentMethodLabel,
  type PaymentReportMethod,
} from "@/lib/portal/payment-report-types";
import type { PaymentCommandReceipt } from "@/lib/portal/payment-report-commands";
import { formatInvoiceAmount } from "@/lib/portal/portal-types";
import type { InvoiceCurrency } from "@/lib/studio/invoice-types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
const TAG = "[payment-report-resolution-notify]";
const CURRENCIES: readonly InvoiceCurrency[] = ["USD", "VES", "USDT", "CNY"];

export type PaymentResolutionEmailInput = {
  status: "confirmado" | "rechazado";
  invoiceCode: string;
  amount: number;
  currency: InvoiceCurrency;
  method: PaymentReportMethod;
  /** `YYYY-MM-DD`, la fecha del pago según el cliente. */
  paidAt: string;
  /** Motivo del asesor. Sólo se usa en el rechazo. */
  reason: string | null;
  /** Enlace a la factura en el portal. */
  portalUrl: string;
};

/** `2026-09-01` → `01/09/2026`; si no tiene esa forma, tal cual. */
function fechaLegible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Asunto y cuerpo del correo. Pura: todo valor que entra al HTML pasa por
 * `escapeHtml`, el motivo del asesor incluido.
 */
export function buildPaymentResolutionEmail(input: PaymentResolutionEmailInput): {
  subject: string;
  html: string;
} {
  const confirmado = input.status === "confirmado";
  const monto = formatInvoiceAmount(input.amount, input.currency);
  const subject = confirmado
    ? `Confirmamos tu pago · ${input.invoiceCode}`
    : `No pudimos confirmar tu pago · ${input.invoiceCode}`;

  const rows: Array<[string, string]> = [
    ["Factura", input.invoiceCode],
    ["Monto", monto],
    ["Método", paymentMethodLabel(input.method)],
    ["Fecha del pago", fechaLegible(input.paidAt)],
  ];
  if (!confirmado && input.reason) rows.push(["Motivo", input.reason]);

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

  const titulo = confirmado ? "Confirmamos tu pago" : "No pudimos confirmar tu pago";
  const intro = confirmado
    ? `Registramos tu pago de ${escapeHtml(monto)} en la factura ${escapeHtml(input.invoiceCode)}.`
    : `Revisamos el pago que reportaste en la factura ${escapeHtml(input.invoiceCode)} y no pudimos confirmarlo.`;
  const salida = confirmado
    ? "En tu portal puedes ver la factura y su estado de pago."
    : "Escríbele a tu asesor o repórtalo de nuevo desde tu portal.";

  const html = `<div style="font-family:${EMAIL_FONT_STACK.brand};color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 4px"><b>${titulo}</b></p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">${intro}</p>
<table style="border-collapse:collapse;margin:0 0 16px">${trs}</table>
<p style="margin:0 0 12px;font-size:13px;color:#0F1E3D">${salida}</p>
<p style="margin:0 0 12px"><a href="${escapeHtml(input.portalUrl)}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Ver la factura en tu portal &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · aviso automático</p>
</div>`;

  return { subject, html };
}

type ReportRow = {
  tenant_id: unknown;
  invoice_code: unknown;
  client_markbox: unknown;
  amount: unknown;
  currency: unknown;
  method: unknown;
  paid_at: unknown;
  status: unknown;
  resolution_reason: unknown;
  cancelled_at: unknown;
};

const texto = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * Avisa al cliente que su reporte se confirmó o se rechazó. Best-effort: nunca
 * lanza, y sus registros no llevan el correo ni el monto.
 */
export async function notifyPaymentReportResolutionToClient(
  session: SupabaseClient,
  receipt: PaymentCommandReceipt,
): Promise<void> {
  try {
    if (receipt.replayed || receipt.cancelled) return;
    if (receipt.status !== "confirmado" && receipt.status !== "rechazado") return;

    const { data, error } = await session
      .from("payment_reports")
      .select(
        "tenant_id, invoice_code, client_markbox, amount, currency, method, paid_at, status, resolution_reason, cancelled_at",
      )
      .eq("id", receipt.reportId)
      .eq("invoice_id", receipt.invoiceId)
      .is("deleted_at", null)
      .maybeSingle<ReportRow>();
    if (error || !data) return;

    // El reporte tiene que decir lo mismo que el recibo: mismo estado, misma
    // factura, sin cancelar. Si no, no se le escribe a nadie.
    if (data.status !== receipt.status) return;
    if (data.cancelled_at != null) return;
    if (data.invoice_code !== receipt.invoiceCode) return;
    if (!texto(data.tenant_id) || !texto(data.client_markbox) || !texto(data.paid_at)) return;
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const currency = data.currency as InvoiceCurrency;
    const method = data.method as PaymentReportMethod;
    if (!CURRENCIES.includes(currency) || !PAYMENT_METHODS.includes(method)) return;

    const admin = createAdminClient();
    const to = await emailDelShippingMark(admin, data.tenant_id, data.client_markbox);
    if (!to) {
      console.warn(`${TAG} sin correo para avisar`, receipt.invoiceCode);
      return;
    }

    const { subject, html } = buildPaymentResolutionEmail({
      status: receipt.status,
      invoiceCode: receipt.invoiceCode,
      amount,
      currency,
      method,
      paidAt: data.paid_at,
      reason: typeof data.resolution_reason === "string" ? data.resolution_reason : null,
      portalUrl: `${SITE_URL}/portal/facturas/${encodeURIComponent(receipt.invoiceCode)}`,
    });

    const res = await sendEmail(admin, data.tenant_id, {
      subject,
      html,
      to,
      metadata: {
        source: "payment-report-resolution-notify",
        code: receipt.invoiceCode,
        status: receipt.status,
        report_id: receipt.reportId,
      },
    });
    if (!res.ok) console.error(`${TAG} el correo no salió`, receipt.invoiceCode);
  } catch {
    console.error(`${TAG} el aviso falló`, receipt.invoiceCode);
  }
}
