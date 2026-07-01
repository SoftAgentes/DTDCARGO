/**
 * Email de invitación al portal del cliente (SDD-0042).
 *
 * Cuando un admin habilita el portal de un cliente desde Studio → cliente →
 * "Acceso al portal" → "Invitar al portal", este correo AVISA al cliente y lo
 * lleva a `/portal/login` con su email precargado. Ahí el cliente pide su
 * propio enlace de acceso (magic-link) y entra.
 *
 * Por qué NO mandamos el magic-link directo desde acá: el magic-link lo emite
 * Supabase Auth y caduca en ~1h; si la invitación tarda en abrirse, el enlace
 * ya venció. Mandando al cliente a /portal a pedir el suyo, la invitación NO
 * caduca — el enlace fresco se genera cuando el cliente está listo para entrar.
 *
 * Envío real vía Resend reusando el pipeline `sendEmail` (mail_config +
 * blacklist + mail_logs). Usa subject+html inline (no template en DB) → cero
 * migración/seed. Best-effort: NUNCA tira excepción — habilitar el portal NO
 * debe romperse si el correo falla.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./mail/send-email";

/** Base del sitio (el portal del cliente vive en una ruta de este dominio). */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/** URL del login del portal con el email precargado (`?email=…`). */
export function portalInviteUrl(email: string): string {
  return `${SITE_URL}/portal/login?email=${encodeURIComponent(email.trim().toLowerCase())}`;
}

export type PortalInviteInput = {
  email: string;
  /** Nombre del cliente para el saludo (opcional). */
  name?: string | null;
};

export type PortalInviteResult =
  | { ok: true; log_id: string }
  | { ok: false; error: string };

const SUBJECT = "Te damos acceso a tu portal · DTD Cargo";

/** Escapa lo mínimo para no romper el HTML del correo con el nombre del cliente. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * HTML branded (molde de docs/runbooks/setup-portal-auth.md · "Invite user"):
 * Archivo · navy #0F1E3D · papel #FBFAF7 · acento wine #7F0F1A · cierre
 * "Con Confianza". CTA → /portal/login con el email precargado.
 */
function inviteHtml(url: string, name?: string | null): string {
  const saludo = name && name.trim() ? `Hola ${esc(name.trim())},` : "Hola,";
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Te damos acceso a tu portal</b></p>
<p style="margin:0 0 16px">${saludo} tu asesor de DTD Cargo te habilitó el portal de clientes. Entra para ver tus envíos, facturas y tu Shipping Mark.</p>
<p style="margin:0 0 20px">
  <a href="${url}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Entrar a mi portal</a>
</p>
<p style="margin:0 0 8px;color:#6B6B6B;font-size:13px">Al entrar, toca "Enviarme el enlace de acceso" y te llega un enlace seguro a este correo para entrar sin contraseña.</p>
<p style="margin:0 0 8px;color:#6B6B6B;font-size:13px">Si el botón no funciona, copia y pega este enlace:</p>
<p style="margin:0 0 16px"><a href="${url}" style="color:#7F0F1A;text-decoration:underline;font-size:13px;word-break:break-all">${url}</a></p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">¿No esperabas esto? Escríbenos antes de entrar.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>`;
}

/**
 * Dispara el email de invitación al portal (envío real vía Resend).
 *
 * @param supabaseAdmin cliente service_role — el INSERT en `mail_logs` está
 *   bloqueado para `authenticated`; el caller pasa `createAdminClient()`.
 * @returns `log_id` en éxito o `error` string en falla. NUNCA tira excepción.
 */
export async function sendPortalInviteEmail(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  input: PortalInviteInput,
): Promise<PortalInviteResult> {
  if (!input.email || !input.email.trim()) {
    return { ok: false, error: "cliente sin email" };
  }

  const url = portalInviteUrl(input.email);
  const result = await sendEmail(supabaseAdmin, tenantId, {
    subject: SUBJECT,
    html: inviteHtml(url, input.name),
    to: input.email,
    to_name: input.name ?? undefined,
    metadata: { source: "portal_invite" },
  });

  if (result.ok) return { ok: true, log_id: result.logId };
  return { ok: false, error: result.error };
}
