/**
 * Correo del enlace de acceso al portal (SDD-0278).
 *
 * Antes este correo lo mandaba **Supabase Auth** con su plantilla del dashboard.
 * Ahora lo mandamos nosotros por el mismo pipeline que el resto (`sendEmail` →
 * mail_config + blacklist + mail_logs → Resend), por tres razones:
 *
 *  1. El enlace tiene que ser `token_hash`, y ése lo acuña `generateLink` —
 *     que devuelve el token pero **no manda ningún correo** (ver `magic-link.ts`).
 *  2. Queda registrado en `mail_logs`, así que "¿le llegó el correo?" pasa de ser
 *     una conjetura a una consulta.
 *  3. No depende de una plantilla pegada a mano en el dashboard, que es
 *     justamente el tipo de configuración que driftea sin avisar.
 *
 * Subject + HTML inline (no plantilla en `mail_templates`) → cero migración, igual
 * que la invitación al portal. Mismo molde de marca: Archivo · navy `#0F1E3D` ·
 * papel `#FBFAF7` · acento wine `#7F0F1A` · cierre "Con Confianza".
 *
 * Best-effort: NUNCA tira excepción; devuelve `ok:false` y el caller decide.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "../mail/send-email";

const SUBJECT = "Tu enlace de acceso al portal · DTD Cargo";

/** Escapa lo mínimo para no romper el HTML con el nombre del cliente. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function magicLinkHtml(url: string, name: string | null | undefined): string {
  const saludo = name && name.trim() ? `Hola ${esc(name.trim())},` : "Hola,";
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Tu enlace de acceso</b></p>
<p style="margin:0 0 16px">${saludo} pediste entrar a tu portal de DTD Cargo. Toca el botón y entras — sin contraseña.</p>
<p style="margin:0 0 20px">
  <a href="${url}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Entrar a mi portal</a>
</p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">¿El botón no funciona? <a href="${url}" style="color:#7F0F1A;text-decoration:underline">Ábrelo aquí</a>.</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">El enlace vale por una hora y se usa una sola vez. Puedes abrirlo en el teléfono o en la computadora, da igual dónde lo hayas pedido.</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">¿No pediste esto? Ignora este correo, tu cuenta sigue segura.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>`;
}

export type MagicLinkEmailResult =
  | { ok: true; log_id: string; queued: boolean }
  | { ok: false; error: string };

/**
 * Dispara el correo con el enlace de acceso.
 *
 * @param supabaseAdmin cliente service_role — el INSERT en `mail_logs` está
 *   bloqueado para `authenticated`.
 * @param url enlace ya construido con {@link portalOpenUrl}.
 */
export async function sendPortalMagicLinkEmail(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  input: { email: string; name?: string | null; url: string },
): Promise<MagicLinkEmailResult> {
  if (!input.email || !input.email.trim()) {
    return { ok: false, error: "destinatario vacío" };
  }

  const result = await sendEmail(supabaseAdmin, tenantId, {
    subject: SUBJECT,
    html: magicLinkHtml(input.url, input.name),
    to: input.email,
    to_name: input.name ?? undefined,
    metadata: { source: "portal_magic_link" },
  });

  if (result.ok) return { ok: true, log_id: result.logId, queued: result.queued };
  return { ok: false, error: result.error };
}
