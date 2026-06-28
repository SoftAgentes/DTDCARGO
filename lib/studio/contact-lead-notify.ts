/**
 * Aviso al equipo de un lead del formulario de contacto (/contacto).
 *
 * Modelado sobre new-client-notify (mismo "avisar al equipo de un lead inbound"),
 * reusando sus helpers (resolveAdminEntries / sendAdminTelegram / escapeHtml):
 *   - Email a la casilla general (info@) + a cada admin del tenant (dedup).
 *   - Telegram a cada admin que linkeó su chat.
 *
 * Por qué info@ + admins: el founder quiere que el lead llegue sí o sí. info@ es
 * la casilla pública documentada (archivo formal); el email + Telegram a los
 * admins es el canal instantáneo a las personas reales aunque info@ no se mire.
 *
 * Best-effort: devuelve { ok } = al menos un email salió. El caller decide (el
 * route cae al WhatsApp si todo falla).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { CONTACT } from "@/lib/design-tokens";
import {
  resolveAdminEntries,
  sendAdminTelegram,
  escapeHtml,
} from "@/lib/studio/new-client-notify";

export interface ContactLeadPayload {
  /** Código de referencia del lead (DTD-XXXX). */
  code: string;
  /** Tema legible ("Cotizar un envío", etc.). */
  topicLabel: string;
  nombre: string;
  email: string;
  whatsapp: string;
  mensaje: string;
}

export async function notifyContactLeadToAdmin(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  payload: ContactLeadPayload,
): Promise<{ ok: boolean }> {
  const subject = `Nuevo contacto web · ${payload.topicLabel} — ${payload.nombre}`;
  const html = buildHtml(payload);
  const telegramText = buildTelegram(payload);

  // Email: casilla general (info@) + cada admin (dedup en minúsculas).
  const admins = await resolveAdminEntries(supabaseAdmin, tenantId);
  const recipients = new Set<string>([CONTACT.emailGeneral.toLowerCase()]);
  for (const a of admins) recipients.add(a.email.toLowerCase());

  let emailedOk = false;
  for (const to of recipients) {
    const res = await sendEmail(supabaseAdmin, tenantId, {
      subject,
      html,
      to,
      to_name: "Equipo DTD",
      metadata: { source: "contact-lead", code: payload.code },
    });
    if (res.ok) emailedOk = true;
    else console.error("[contact-lead-notify] email falló:", res.error);
  }

  // Telegram a cada admin que linkeó su chat (best-effort, skip silencioso).
  for (const a of admins) {
    await sendAdminTelegram(supabaseAdmin, a.user_id, telegramText);
  }

  return { ok: emailedOk };
}

function buildHtml(p: ContactLeadPayload): string {
  // Sin fila "Código": un lead inbound se identifica por nombre + email +
  // WhatsApp; el folio (WEB-XXXX) es ruido para el equipo. Sigue en metadata
  // del email y en el mensaje de WhatsApp por si el CRM lo quiere parsear.
  const rows: Array<[string, string]> = [
    ["Tema", p.topicLabel],
    ["Nombre", p.nombre],
    ["Email", p.email],
    ["WhatsApp", p.whatsapp],
  ];
  const trs = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;font-size:13px">${escapeHtml(k)}</td><td style="padding:4px 0;color:#0F1E3D;font-size:14px;font-weight:600">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 4px"><b>Nuevo contacto desde la web</b></p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">Llegó por el formulario de /contacto. Escríbele por WhatsApp.</p>
<table style="border-collapse:collapse;margin:0 0 16px">${trs}</table>
<p style="margin:0 0 6px;color:#6B6B6B;font-size:13px">Mensaje:</p>
<p style="margin:0 0 20px;color:#0F1E3D;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(p.mensaje)}</p>
<p style="margin:0 0 12px"><a href="https://wa.me/${CONTACT.ve.whatsappRaw}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Abrir WhatsApp del CRM &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · aviso interno automático</p>
</div>`;
}

function buildTelegram(p: ContactLeadPayload): string {
  return [
    `Nuevo contacto web · ${p.topicLabel}`,
    ``,
    p.nombre,
    `Email: ${p.email}`,
    `WhatsApp: ${p.whatsapp}`,
    ``,
    `Mensaje:`,
    p.mensaje,
    ``,
    `https://wa.me/${CONTACT.ve.whatsappRaw}`,
  ].join("\n");
}
