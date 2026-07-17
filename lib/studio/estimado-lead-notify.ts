/**
 * Aviso al equipo de un estimado web (POST /api/public/estimacion).
 *
 * Modelado sobre contact-lead-notify (mismo "avisar al equipo de un lead
 * inbound"), reusando los helpers de new-client-notify:
 *   - Email a la casilla general (info@) + a cada admin del tenant (dedup).
 *   - Telegram a cada admin que linkeó su chat.
 *
 * Por qué existe: el estimado web quedaba guardado en `quotes` (filtro "web" del
 * cotizador) SIN avisar a nadie — si el visitante no llegaba a mandar el
 * WhatsApp, el lead moría huérfano. Este aviso cierra esa fuga: el asesor se
 * entera al instante y puede escribirle ÉL al prospecto.
 *
 * Best-effort: devuelve { ok } = al menos un email salió. A diferencia de
 * /contacto, acá el caller NO debe fallar la respuesta al visitante si el aviso
 * falla — el estimado ya quedó persistido en el ERP.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { CONTACT } from "@/lib/design-tokens";
import {
  resolveAdminEntries,
  sendAdminTelegram,
  escapeHtml,
} from "@/lib/studio/new-client-notify";

export interface EstimadoLeadPayload {
  /** Código EST-YYYY-NNNN del estimado ya persistido. */
  estimateCode: string;
  prospectName: string;
  prospectWhatsapp: string;
  prospectEmail: string | null;
  nota: string | null;
  /** Calculadora de origen (lcl | aereo | maritimo). */
  calc: string;
  origin: string;
  destination: string;
  cbm: number | null;
  weightKg: number | null;
  totalUsd: number;
}

const CALC_LABELS: Record<string, string> = {
  lcl: "Calculadora LCL",
  aereo: "Estimación aérea",
  maritimo: "Estimación marítima",
};

// wa.me del PROSPECTO (no el del CRM): la acción que importa es que el asesor
// le escriba. La implementación vive en estimado-linking (pura, client-safe —
// también la usa la campaña de recuperación SDD-0157); acá se re-exporta.
import { buildProspectWaLink } from "./estimado-linking";
export { buildProspectWaLink };

export async function notifyEstimadoLeadToAdmin(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  payload: EstimadoLeadPayload,
): Promise<{ ok: boolean }> {
  const subject = `Nuevo estimado web · ${payload.estimateCode} — ${payload.prospectName} ($${payload.totalUsd})`;
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
      metadata: { source: "estimado-lead", code: payload.estimateCode },
    });
    if (res.ok) emailedOk = true;
    else console.error("[estimado-lead-notify] email falló:", res.error);
  }

  // Telegram a cada admin que linkeó su chat (best-effort, skip silencioso).
  for (const a of admins) {
    await sendAdminTelegram(supabaseAdmin, a.user_id, telegramText);
  }

  return { ok: emailedOk };
}

function fmtCarga(p: EstimadoLeadPayload): string {
  const parts: string[] = [];
  if (p.cbm != null) parts.push(`${p.cbm} m³`);
  if (p.weightKg != null) parts.push(`${p.weightKg} kg`);
  return parts.join(" · ");
}

function buildHtml(p: EstimadoLeadPayload): string {
  const calcLabel = CALC_LABELS[p.calc] ?? p.calc;
  const carga = fmtCarga(p);
  const rows: Array<[string, string]> = [
    ["Estimado", p.estimateCode],
    ["Nombre", p.prospectName],
    ["WhatsApp", p.prospectWhatsapp],
    ...(p.prospectEmail ? ([["Email", p.prospectEmail]] as Array<[string, string]>) : []),
    ["Origen", calcLabel],
    ["Ruta", `${p.origin} → ${p.destination}`],
    ...(carga ? ([["Carga", carga]] as Array<[string, string]>) : []),
    ["Total estimado", `$${p.totalUsd}`],
  ];
  const trs = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;font-size:13px">${escapeHtml(k)}</td><td style="padding:4px 0;color:#0F1E3D;font-size:14px;font-weight:600">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  const waLink = buildProspectWaLink(p.prospectWhatsapp);
  const cta = waLink
    ? `<p style="margin:0 0 12px"><a href="${waLink}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Escribirle por WhatsApp &rarr;</a></p>`
    : "";
  const notaBlock = p.nota
    ? `<p style="margin:0 0 6px;color:#6B6B6B;font-size:13px">Nota del prospecto:</p>
<p style="margin:0 0 20px;color:#0F1E3D;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(p.nota)}</p>`
    : "";
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 4px"><b>Nuevo estimado desde la web</b></p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">Quedó guardado en el Studio &rsaquo; Cotizador (filtro &ldquo;web&rdquo;). No esperes su WhatsApp: escríbele tú.</p>
<table style="border-collapse:collapse;margin:0 0 16px">${trs}</table>
${notaBlock}${cta}<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · aviso interno automático</p>
</div>`;
}

function buildTelegram(p: EstimadoLeadPayload): string {
  const calcLabel = CALC_LABELS[p.calc] ?? p.calc;
  const carga = fmtCarga(p);
  const waLink = buildProspectWaLink(p.prospectWhatsapp);
  return [
    `Nuevo estimado web · ${p.estimateCode} · $${p.totalUsd}`,
    ``,
    p.prospectName,
    `WhatsApp: ${p.prospectWhatsapp}`,
    ...(p.prospectEmail ? [`Email: ${p.prospectEmail}`] : []),
    `${calcLabel} · ${p.origin} → ${p.destination}${carga ? ` · ${carga}` : ""}`,
    ...(p.nota ? [``, `Nota:`, p.nota] : []),
    ...(waLink ? [``, waLink] : []),
  ].join("\n");
}
