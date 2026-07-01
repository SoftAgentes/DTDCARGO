/**
 * Email de invitación al portal del cliente (SDD-0042).
 *
 * Cuando un admin habilita el portal de un cliente desde Studio → cliente →
 * "Acceso al portal" → "Invitar al portal", este correo lo lleva **directo**:
 * el botón "Entrar a mi portal" trae un enlace mágico REAL → un clic y adentro,
 * sin pasos extra (founder 2026-07-01, cambió la decisión previa de mandarlo a
 * pedir su propio enlace).
 *
 * El enlace directo es de UN SOLO USO y **caduca** (TTL de Auth, hoy 30 min). Si
 * la invitación se abre tarde, muere → el admin lo reenvía, o comparte un enlace
 * fresco por WhatsApp desde la tarjeta del cliente (coordinación en vivo). Si por
 * algo no se pudo generar el enlace directo, se cae al viejo flujo (`/portal/login`
 * con el email precargado) para no romper la invitación.
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

/** URL del login del portal con el email precargado — fallback si no se pudo generar el enlace directo. */
export function portalInviteUrl(email: string): string {
  return `${SITE_URL}/portal/login?email=${encodeURIComponent(email.trim().toLowerCase())}`;
}

/**
 * Genera un enlace de acceso DIRECTO al portal (un clic → adentro) con el admin de
 * Supabase Auth. El link cae en `/portal/callback?token_hash=…&type=magiclink` →
 * `verifyOtp` → `portal_bind_session` → `/portal` (el callback ya acepta links
 * server-side, SDD-0042).
 *
 * ⚠️ **Seguridad:** este enlace LOGUEA a quien lo abra COMO el cliente. Mandarlo
 * SOLO a su canal (su correo / su WhatsApp). Es de un solo uso y caduca (TTL de Auth).
 *
 * Si el cliente aún no tiene `auth.user` (invitado sin 1er ingreso), lo crea
 * confirmado y reintenta — como `signInWithOtp({ shouldCreateUser: true })` del
 * login. Devuelve el `action_link` o `null` (el caller cae al fallback).
 */
export async function generatePortalAccessLink(
  supabaseAdmin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const clean = email.trim().toLowerCase();
  const redirectTo = `${SITE_URL}/portal/callback`;
  const gen = () =>
    supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: clean,
      options: { redirectTo },
    });

  // Best-effort: cualquier fallo (red, admin mal formado) → null y el caller cae al
  // fallback. NUNCA tira (habilitar el portal no debe romperse por esto).
  try {
    let { data, error } = await gen();
    if (error || !data?.properties?.action_link) {
      // magiclink exige que el auth.user exista; el cliente invitado puede no tenerlo
      // todavía → crearlo confirmado y reintentar una vez. `createUser` sobre uno ya
      // existente devuelve error (no tira) → se ignora y el reintento igual corre.
      await supabaseAdmin.auth.admin.createUser({ email: clean, email_confirm: true });
      ({ data, error } = await gen());
    }
    if (error || !data?.properties?.action_link) return null;
    return data.properties.action_link;
  } catch {
    return null;
  }
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
 * "Con Confianza". `direct` = el botón lleva un enlace mágico de un clic (vence
 * pronto); si es false, es el fallback al login donde el cliente pide su enlace.
 */
function inviteHtml(url: string, name: string | null | undefined, direct: boolean): string {
  const saludo = name && name.trim() ? `Hola ${esc(name.trim())},` : "Hola,";
  const intro = direct
    ? `${saludo} tu asesor de DTD Cargo te habilitó el portal de clientes. Entra con un clic para ver tus envíos, facturas y tu Shipping Mark.`
    : `${saludo} tu asesor de DTD Cargo te habilitó el portal de clientes. Entra para ver tus envíos, facturas y tu Shipping Mark.`;
  const note = direct
    ? `<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">Este enlace es de un solo uso y vence pronto. Si ya no funciona, pídele otro a tu asesor.</p>`
    : `<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">Al entrar, toca "Enviarme el enlace de acceso" y te llega un enlace seguro a este correo para entrar sin contraseña.</p>`;
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Te damos acceso a tu portal</b></p>
<p style="margin:0 0 16px">${intro}</p>
<p style="margin:0 0 20px">
  <a href="${url}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Entrar a mi portal</a>
</p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">¿El botón no funciona? <a href="${url}" style="color:#7F0F1A;text-decoration:underline">Ábrelo aquí</a>.</p>
${note}
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

  // Enlace directo de un clic; si no se pudo generar, fallback al login con el
  // email precargado (el cliente pide su propio enlace ahí) para no romper el envío.
  const directLink = await generatePortalAccessLink(supabaseAdmin, input.email);
  const url = directLink ?? portalInviteUrl(input.email);
  const result = await sendEmail(supabaseAdmin, tenantId, {
    subject: SUBJECT,
    html: inviteHtml(url, input.name, Boolean(directLink)),
    to: input.email,
    to_name: input.name ?? undefined,
    metadata: { source: "portal_invite" },
  });

  if (result.ok) return { ok: true, log_id: result.logId };
  return { ok: false, error: result.error };
}
