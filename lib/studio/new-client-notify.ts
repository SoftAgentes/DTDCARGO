/**
 * Aviso interno "cliente nuevo se registró solo" (SDD-0059).
 *
 * Cuando alguien se da de alta por el registro self-service (/portal/registro),
 * el equipo no se entera salvo que mire la lista. Esto avisa a los admins del
 * tenant con los datos del cliente + su MARKBOX, para no perder de vista a los
 * leads que entran por SEO/Ads.
 *
 * Modelado sobre lib/studio/bug-email-notify.ts (SDD-0036 Fase 5):
 *   - Email a cada admin vía `sendEmail` (subject+html crudos, sin template → sin
 *     migración).
 *   - Telegram a cada admin que linkeó su cuenta (user_profiles.telegram_chat_id).
 *
 * Best-effort por canal: cada fallo se loguea a console.error pero NO rompe el
 * alta ni los otros canales. Se dispara SOLO en el alta self-service (el alta
 * admin la inicia un humano que ya conoce al cliente).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { sendTelegramMessage } from "@/lib/studio/telegram/send-message";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export interface NewClientNotifyPayload {
  markbox: string;
  /** Nombre a mostrar (razón social si empresa, si no el nombre de la persona). */
  name: string;
  /** Nombre de contacto cuando es empresa (opcional). */
  contactName?: string | null;
  /** Documento canónico (RIF empresa / cédula persona). */
  document: string;
  email: string;
  whatsapp: string;
  /** Ciudad VE (para ubicar al cliente de un vistazo). */
  city?: string | null;
  /** Estado VE. */
  state?: string | null;
  /** Canal de alta ('portal' = self-service). */
  channel: string;
}

/**
 * Avisa a los admins del tenant que entró un cliente nuevo. Best-effort, nunca
 * tira. Email siempre; Telegram solo a quien linkeó su chat.
 */
export async function notifyNewClientToAdmin(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  payload: NewClientNotifyPayload,
): Promise<void> {
  try {
    const admins = await resolveAdminEntries(supabaseAdmin, tenantId);
    if (admins.length === 0) {
      console.warn("[new-client-notify] sin admins para notificar", payload.markbox);
      return;
    }

    const clientUrl = `${SITE_URL}/studio/clientes/${payload.markbox}`;
    const ubicacion = [payload.city, payload.state].filter(Boolean).join(", ");
    const contacto = payload.contactName
      ? `${payload.name} (contacto: ${payload.contactName})`
      : payload.name;

    const subject = `Nuevo cliente · ${payload.markbox} — ${payload.name}`;
    const html = buildHtml(payload, { clientUrl, ubicacion, contacto });
    const telegramText = buildTelegramText(payload, { clientUrl, ubicacion, contacto });

    for (const admin of admins) {
      // Email (best-effort: un {ok:false} se loguea y seguimos al Telegram).
      const res = await sendEmail(supabaseAdmin, tenantId, {
        subject,
        html,
        to: admin.email,
        to_name: "Equipo DTD",
        metadata: { source: "new-client-notify", markbox: payload.markbox },
      });
      if (!res.ok) {
        console.error("[new-client-notify] email falló:", res.error);
      }

      // Telegram (skip silencioso si el admin no linkeó su chat).
      await sendAdminTelegram(supabaseAdmin, admin.user_id, telegramText);
    }
  } catch (err) {
    console.error("[new-client-notify] notifyNewClientToAdmin falló:", err);
  }
}

// ── Internos ────────────────────────────────────────────────────────────────

/** Admins activos del tenant con {user_id, email}. */
async function resolveAdminEntries(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
): Promise<Array<{ user_id: string; email: string }>> {
  const { data, error } = await supabaseAdmin
    .from("user_tenants")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "admin")
    .is("disabled_at", null);
  if (error || !data || data.length === 0) return [];

  const ids = (data as Array<{ user_id: string }>).map((r) => r.user_id);
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const list = users?.users ?? [];
  return list
    .filter((u) => ids.includes(u.id) && !!u.email)
    .map((u) => ({ user_id: u.id, email: u.email as string }));
}

/** Telegram a un admin si linkeó su chat. Best-effort, nunca tira. */
async function sendAdminTelegram(
  supabaseAdmin: SupabaseClient,
  userId: string,
  text: string,
): Promise<void> {
  try {
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("telegram_chat_id")
      .eq("user_id", userId)
      .maybeSingle<{ telegram_chat_id: string | null }>();
    const chatId = profile?.telegram_chat_id;
    if (!chatId) return;
    const res = await sendTelegramMessage(chatId, text);
    if (!res.ok) console.error("[new-client-notify] telegram falló:", res.error);
  } catch (err) {
    console.error("[new-client-notify] sendAdminTelegram falló:", err);
  }
}

type Derived = { clientUrl: string; ubicacion: string; contacto: string };

function buildHtml(p: NewClientNotifyPayload, d: Derived): string {
  const rows: Array<[string, string]> = [
    ["Shipping Mark", p.markbox],
    ["Nombre", d.contacto],
    ["Documento", p.document],
    ["Email", p.email],
    ["WhatsApp", p.whatsapp],
    ["Ubicación", d.ubicacion || "—"],
    ["Canal", p.channel === "portal" ? "Registro web (self-service)" : p.channel],
  ];
  const trs = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;font-size:13px">${escapeHtml(k)}</td><td style="padding:4px 0;color:#0F1E3D;font-size:14px;font-weight:600">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 4px"><b>Nuevo cliente registrado</b></p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">Se dio de alta solo desde el sitio. Revísalo y verifica su identidad.</p>
<table style="border-collapse:collapse;margin:0 0 20px">${trs}</table>
<p style="margin:0 0 12px"><a href="${d.clientUrl}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Abrir en el Studio &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · aviso interno automático</p>
</div>`;
}

function buildTelegramText(p: NewClientNotifyPayload, d: Derived): string {
  return [
    `Nuevo cliente · ${p.markbox}`,
    ``,
    d.contacto,
    `Doc: ${p.document}`,
    `Email: ${p.email}`,
    `WhatsApp: ${p.whatsapp}`,
    d.ubicacion ? `Ubicación: ${d.ubicacion}` : null,
    ``,
    d.clientUrl,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
