/**
 * Correo de comprobación para quien se registró con el link de registro
 * (SDD-0646, D-1 opción C).
 *
 * El link llega por WhatsApp y prueba quién es la persona, pero no que el correo
 * que escribió sea suyo. Este correo le llega a esa dirección con un enlace de
 * un solo uso que SOLO comprueba el correo.
 *
 * Reglas:
 *   - identifica al cliente por su Shipping Mark, NUNCA por su nombre: el
 *     destinatario podría no ser el cliente;
 *   - dice «si no fuiste tú, escríbenos» con el contacto de soporte;
 *   - trae UN solo enlace, el de comprobación. No abre sesión ni da acceso a
 *     nada, y sin la sesión del portal del cliente tampoco comprueba: quien lo
 *     reciba por error no entra al portal de nadie ni confirma nada;
 *   - no invita a pedir un enlace de acceso con este correo;
 *   - la URL de ese enlace no lleva el correo ni el Shipping Mark, sólo el token.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTACT } from "@/lib/design-tokens";
import { COMPROBAR_CORREO_TTL_DAYS } from "@/lib/portal/correo-comprobacion";
import { sendEmail } from "./mail/send-email";

export const REGISTRO_LINK_AVISO_SUBJECT = "Comprueba tu correo · DTD Cargo";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML del correo. Un solo enlace: el de comprobación. */
export function registroLinkAvisoHtml(markbox: string, url: string): string {
  const mb = esc(markbox);
  const href = esc(url);
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Comprueba tu correo</b></p>
<p style="margin:0 0 16px">Este correo quedó asociado al Shipping Mark <b>${mb}</b> en el portal de clientes de DTD Cargo.</p>
<p style="margin:0 0 20px">
  <a href="${href}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Comprobar mi correo</a>
</p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">Este enlace solo comprueba que el correo es tuyo: no abre tu portal. Ábrelo en el mismo teléfono o computadora donde ya entraste a tu portal. Es de un solo uso y vence en ${COMPROBAR_CORREO_TTL_DAYS} días.</p>
<p style="margin:0 0 16px"><b>Si no fuiste tú, no lo confirmes</b> y escríbenos a ${esc(CONTACT.emailGeneral)} o por WhatsApp al ${esc(CONTACT.ve.whatsapp)}.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>`;
}

/** Envía el correo de comprobación. Nunca tira. */
export async function sendRegistroLinkAvisoEmail(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  input: { email: string; markbox: string; url: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await sendEmail(supabaseAdmin, tenantId, {
      subject: REGISTRO_LINK_AVISO_SUBJECT,
      html: registroLinkAvisoHtml(input.markbox, input.url),
      to: input.email,
      metadata: { source: "portal_register_link_aviso" },
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
