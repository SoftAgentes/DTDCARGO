/**
 * Aviso al correo que se registró con el link de registro (SDD-0646, D-1).
 *
 * El link llega por WhatsApp y prueba quién es la persona, pero no que el correo
 * que escribió sea suyo. Si se equivocó al teclearlo (o puso uno ajeno), el dueño
 * de ese correo se entera por este aviso y nos escribe.
 *
 * Reglas del DG (2026-11-16):
 *   - identifica al cliente por su Shipping Mark, NUNCA por su nombre: el
 *     destinatario podría no ser el cliente;
 *   - dice «si no fuiste tú, escríbenos» con el contacto de soporte;
 *   - NO trae ningún enlace de entrada al portal (sería una llave para quien no
 *     es el cliente).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTACT } from "@/lib/design-tokens";
import { sendEmail } from "./mail/send-email";

export const REGISTRO_LINK_AVISO_SUBJECT = "Tu correo quedó registrado en DTD Cargo";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML del aviso. Sin enlaces: ni de entrada ni de ningún otro tipo. */
export function registroLinkAvisoHtml(markbox: string): string {
  const mb = esc(markbox);
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Tu correo quedó registrado</b></p>
<p style="margin:0 0 16px">Este correo quedó asociado al Shipping Mark <b>${mb}</b> en el portal de clientes de DTD Cargo.</p>
<p style="margin:0 0 16px">Si fuiste tú, no tienes que hacer nada.</p>
<p style="margin:0 0 16px"><b>Si no fuiste tú, escríbenos</b> a ${esc(CONTACT.emailGeneral)} o por WhatsApp al ${esc(CONTACT.ve.whatsapp)} y lo resolvemos.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>`;
}

/** Envía el aviso. Best-effort: nunca tira; el registro no depende de él. */
export async function sendRegistroLinkAvisoEmail(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  input: { email: string; markbox: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await sendEmail(supabaseAdmin, tenantId, {
      subject: REGISTRO_LINK_AVISO_SUBJECT,
      html: registroLinkAvisoHtml(input.markbox),
      to: input.email,
      metadata: { source: "portal_register_link_aviso" },
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
