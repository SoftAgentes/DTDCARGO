/**
 * Los dos avisos de "cliente sin acceso al portal" (SDD-0279).
 *
 * Cuando alguien pide entrar con el correo de un cliente que existe en el ERP
 * pero no tiene fila de acceso, salen dos mensajes distintos:
 *
 *  1. **Al cliente** — que sepa que su pedido llegó y que no siga esperando un
 *     enlace que nadie le va a mandar.
 *  2. **Al equipo** — con el Shipping Mark, para habilitarlo por el flujo de
 *     invitación que ya existe.
 *
 * 🔴 **El correo al cliente NO lleva su nombre ni su Shipping Mark, a propósito.**
 * La dirección sale de `clients`, y ese dato lo cargó el equipo (importaciones,
 * planillas), no lo confirmó el titular. Si tiene un tipeo y pertenece a otra
 * persona, un correo que dijera "Hola Fulano, tu Shipping Mark es DTD-1234" le
 * entrega a un desconocido el nombre y el identificador del cliente. Genérico,
 * lo peor que pasa es que alguien reciba un aviso que no le tocaba.
 *
 * El aviso INTERNO sí los lleva: va a las casillas del equipo y sin el Shipping
 * Mark nadie sabe a quién habilitar.
 *
 * Best-effort: nunca tira. `/entrar` responde igual pase lo que pase acá.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { CONTACT } from "@/lib/design-tokens";
import { resolveAdminEntries, escapeHtml } from "@/lib/studio/new-client-notify";
import { dispatchTelegramAlert } from "@/lib/studio/telegram/alert-routing";
import type { ClienteSinAcceso } from "./sin-acceso";

const SUBJECT_CLIENTE = "Sobre tu acceso al portal · DTD Cargo";

/** Correo al CLIENTE. Sin nombre y sin Shipping Mark — ver la cabecera. */
function clienteHtml(): string {
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Recibimos tu pedido de acceso</b></p>
<p style="margin:0 0 16px">Hola, pediste entrar al portal de DTD Cargo con esta dirección de correo.</p>
<p style="margin:0 0 16px">Tu acceso <b>todavía no está activo</b>, así que no vas a recibir el enlace de siempre. Nuestro equipo ya está al tanto y te va a contactar para activarlo.</p>
<p style="margin:0 0 16px">Si prefieres que sea ahora, escríbenos y lo resolvemos en el momento:</p>
<p style="margin:0 0 20px">
  <a href="https://wa.me/${CONTACT.ve.whatsappRaw}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Escribirnos por WhatsApp</a>
</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">¿No pediste esto? Ignora este correo — nadie entró a ninguna cuenta.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>`;
}

/** Correo al EQUIPO. Sí lleva Shipping Mark: sin él no se sabe a quién habilitar. */
function equipoHtml(c: ClienteSinAcceso, email: string): string {
  const rows: Array<[string, string]> = [
    ["Cliente", c.name],
    ["Shipping Mark", c.markbox],
    ["Correo con el que pidió entrar", email],
  ];
  const trs = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;font-size:13px">${escapeHtml(k)}</td><td style="padding:4px 0;color:#0F1E3D;font-size:14px;font-weight:600">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 4px"><b>Un cliente pidió entrar y no tiene acceso al portal</b></p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">Existe en el ERP pero no tiene fila de acceso. Habilítalo desde su ficha en Clientes (invitación al portal). <b>No lo mandes a /registro</b>: le crearía un Shipping Mark nuevo o lo dejaría dando vueltas.</p>
<table style="border-collapse:collapse;margin:0 0 16px">${trs}</table>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · aviso interno automático</p>
</div>`;
}

function equipoTelegram(c: ClienteSinAcceso, email: string): string {
  return [
    "Pidió entrar al portal y no tiene acceso",
    "",
    c.name,
    `Shipping Mark: ${c.markbox}`,
    `Correo: ${email}`,
    "",
    "Habilítalo desde su ficha en Clientes. NO a /registro.",
  ].join("\n");
}

export interface AvisoSinAccesoResult {
  /** El cliente recibió el correo (salió de verdad, no quedó en `queued`). */
  avisadoCliente: boolean;
  /** Al menos una casilla del equipo lo recibió. */
  avisadoEquipo: boolean;
}

/**
 * Manda los dos avisos. El del equipo corre aunque el del cliente falle: que no
 * le llegue el correo es justamente cuando más falta hace que un humano lo vea.
 */
export async function avisarClienteSinAcceso(
  supabaseAdmin: SupabaseClient,
  cliente: ClienteSinAcceso,
  email: string,
): Promise<AvisoSinAccesoResult> {
  const tenantId = cliente.tenant_id;
  let avisadoCliente = false;
  let avisadoEquipo = false;

  try {
    const res = await sendEmail(supabaseAdmin, tenantId, {
      subject: SUBJECT_CLIENTE,
      html: clienteHtml(),
      to: email,
      metadata: { source: "portal_sin_acceso", client_id: cliente.id },
    });
    // `queued` = quedó el mail_log pero el correo no salió. No es un aviso.
    avisadoCliente = res.ok && !res.queued;
    if (!res.ok) console.error("[sin-acceso-aviso] correo al cliente:", res.error);
  } catch (err) {
    console.error("[sin-acceso-aviso] correo al cliente tiró:", err);
  }

  try {
    const admins = await resolveAdminEntries(supabaseAdmin, tenantId);
    const recipients = new Set<string>([CONTACT.emailGeneral.toLowerCase()]);
    for (const a of admins) recipients.add(a.email.toLowerCase());

    const subject = `Acceso al portal · ${cliente.markbox} — ${cliente.name}`;
    const html = equipoHtml(cliente, email);
    for (const to of recipients) {
      const res = await sendEmail(supabaseAdmin, tenantId, {
        subject,
        html,
        to,
        to_name: "Equipo DTD",
        metadata: { source: "portal_sin_acceso_interno", client_id: cliente.id },
      });
      if (res.ok) avisadoEquipo = true;
      else console.error("[sin-acceso-aviso] correo al equipo:", res.error);
    }

    await dispatchTelegramAlert(
      supabaseAdmin,
      tenantId,
      "registro",
      equipoTelegram(cliente, email),
      { logTag: "portal-sin-acceso" },
    );
  } catch (err) {
    console.error("[sin-acceso-aviso] aviso al equipo tiró:", err);
  }

  return { avisadoCliente, avisadoEquipo };
}
