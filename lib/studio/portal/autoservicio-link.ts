/**
 * SDD-0672 (entrega 2) · enlace de autoservicio para que el cliente sin portal
 * cree el suyo desde el correo de su ficha.
 *
 * Lo llama `/entrar` cuando el correo es de un cliente vivo del ERP sin ninguna
 * fila de acceso. La base decide si aplica (migración 0562,
 * `portal_registration_link_create_self`): el correo tiene que ser el de la
 * ficha, la ficha tiene que tener documento o teléfono con qué comprobar, y no
 * puede haber un enlace del equipo vivo.
 *
 * 🔴 El correo NO lleva el nombre ni el Shipping Mark, a propósito: la dirección
 * sale de `clients` y la cargó el equipo. Si tiene un tipeo y es de otra persona,
 * un correo genérico no le entrega nada (mismo criterio de la SDD-0279). Y el
 * portal no se activa con sólo abrir el enlace: la página pide la cédula o el
 * WhatsApp que ya tiene la ficha (la guarda de la 0562).
 *
 * Best-effort: NUNCA tira. Si no aplica, falta la migración o el correo no sale,
 * `/entrar` sigue con el aviso al equipo de la SDD-0279.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateRegistroToken, hashRegistroToken } from "@/lib/portal/registro-link";
import {
  REGISTRO_AUTOSERVICIO_TTL_HORAS,
  registroAutoservicioUrl,
} from "@/lib/portal/registro-link-types";
import { sendEmail } from "@/lib/studio/mail/send-email";
import type { ClienteSinAcceso } from "./sin-acceso";

const SUBJECT = "Crea tu portal · DTD Cargo";

function autoservicioHtml(url: string): string {
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Crea tu portal de DTD Cargo</b></p>
<p style="margin:0 0 16px">Hola, pediste entrar al portal de DTD Cargo con esta dirección de correo. Ya eres cliente, pero tu portal todavía no está activo.</p>
<p style="margin:0 0 16px">Con este botón llenas tus datos y queda listo, con tu código de siempre. Para cuidar tu cuenta, te vamos a pedir tu cédula o RIF, o tu WhatsApp.</p>
<p style="margin:0 0 20px">
  <a href="${url}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Crear mi portal</a>
</p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">¿El botón no funciona? <a href="${url}" style="color:#7F0F1A;text-decoration:underline">Ábrelo aquí</a>.</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">El enlace vale por ${REGISTRO_AUTOSERVICIO_TTL_HORAS} horas y se usa una sola vez. Es personal: no lo reenvíes.</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">¿No pediste esto? Ignora este correo: sin tus datos, nadie puede activar el portal.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>`;
}

export type EmisionAutoservicio =
  /** El enlace se emitió y el correo salió de verdad. */
  | { estado: "enviado" }
  /** La base dice que no aplica: correo que no es el de la ficha, ya tiene fila de acceso, sin documento ni teléfono, o hay un enlace del equipo vivo. */
  | { estado: "no-aplica" }
  /** Falta la migración 0562. */
  | { estado: "sin-migracion" }
  /** Se emitió, pero el correo no salió. */
  | { estado: "no-salio" }
  | { estado: "error" };

/** Emite el enlace de autoservicio y lo manda al correo de la ficha. Nunca tira. */
export async function emitirLinkAutoservicio(
  admin: SupabaseClient,
  cliente: ClienteSinAcceso,
  email: string,
): Promise<EmisionAutoservicio> {
  try {
    const token = generateRegistroToken();
    const { error } = await admin.rpc("portal_registration_link_create_self", {
      p_client_id: cliente.id,
      p_email: email.trim().toLowerCase(),
      p_token_hash: hashRegistroToken(token),
    });
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") return { estado: "sin-migracion" };
      if (error.code === "P0002" || error.code === "22023" || error.code === "55000") {
        return { estado: "no-aplica" };
      }
      console.error("[autoservicio] no se pudo emitir el enlace:", error.code);
      return { estado: "error" };
    }

    const res = await sendEmail(admin, cliente.tenant_id, {
      subject: SUBJECT,
      html: autoservicioHtml(registroAutoservicioUrl(token)),
      to: email,
      metadata: { source: "portal_autoservicio", client_id: cliente.id },
    });
    // `queued` = quedó el mail_log pero el correo no salió (nadie lo reintenta).
    if (!res.ok || res.queued) {
      console.error("[autoservicio] el enlace no salió:", res.ok ? "queued" : "failed");
      return { estado: "no-salio" };
    }
    return { estado: "enviado" };
  } catch {
    return { estado: "error" };
  }
}
