/**
 * Aviso al equipo de un estimado web (POST /api/public/estimacion).
 *
 * Modelado sobre contact-lead-notify (mismo "avisar al equipo de un lead
 * inbound"), reusando los helpers de new-client-notify:
 *   - Email a la casilla general (info@) + a cada admin del tenant (dedup).
 *   - Telegram a cada admin que linkeó su chat.
 *
 * Por qué existe: el visitante no registrado NO genera un EST- en el ERP (su
 * cotización viaja por el WhatsApp que la calculadora abre sola); sin este aviso,
 * si el cliente no llega a escribir, el lead se pierde. El asesor se entera al
 * instante y puede escribirle ÉL al prospecto.
 *
 * Best-effort: devuelve { ok } = al menos un email salió. Un fallo del aviso NO
 * debe romper la respuesta al visitante (el WhatsApp ya se le abrió igual).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { CONTACT } from "@/lib/design-tokens";
import {
  resolveAdminEntries,
  escapeHtml,
} from "@/lib/studio/new-client-notify";
import { dispatchAlert } from "@/lib/studio/alerts/dispatch-alert";

export interface EstimadoLeadPayload {
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
  const subject = `Nuevo estimado web — ${payload.prospectName} ($${payload.totalUsd})`;
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
      metadata: { source: "estimado-lead" },
    });
    if (res.ok) emailedOk = true;
    else console.error("[estimado-lead-notify] email falló:", res.error);
  }

  // Telegram: UNA vez por CHAT, no una por admin (SDD-0271).
  await dispatchAlert(
    supabaseAdmin,
    tenantId,
    "equipo",
    {
      telegramText,
      // Un estimado web no queda en el ERP: el detalle va en el correo al
      // equipo. A Discord, sólo que llegó (SDD-0606).
      discord: { titulo: "Estimado nuevo desde la web · detalle en el correo del equipo" },
    },
    { logTag: "estimado-lead-notify" },
  );

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
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">Cotizó desde la web y probablemente te escriba por WhatsApp. Si no llega, escríbele tú — no queda registrado en el ERP.</p>
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
    `Nuevo estimado web · $${p.totalUsd}`,
    ``,
    p.prospectName,
    `WhatsApp: ${p.prospectWhatsapp}`,
    ...(p.prospectEmail ? [`Email: ${p.prospectEmail}`] : []),
    `${calcLabel} · ${p.origin} → ${p.destination}${carga ? ` · ${carga}` : ""}`,
    ...(p.nota ? [``, `Nota:`, p.nota] : []),
    ...(waLink ? [``, waLink] : []),
  ].join("\n");
}
