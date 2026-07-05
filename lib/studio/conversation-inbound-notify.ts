/**
 * Aviso interno "un cliente escribió por el portal" (SDD-0148). Sin esto, el
 * mensaje entra a Conversaciones y solo sube el contador "sin leer" — a nadie le
 * suena nada. Esto avisa al equipo para que responda, cerrando el lazo que hace
 * el chat de Soporte un canal vivo.
 *
 * A quién:
 *   - Hilo con asesor asignado (`assigned_to`) → a ESE agente (Telegram).
 *   - Hilo sin asignar → broadcast a los admins del tenant (Telegram).
 * (La señal in-app es el badge del topbar `ConversationsIndicator`, siempre a la
 * vista — por eso acá no escribimos la campanita; push queda para Fase 2.)
 *
 * Anti-spam (sin migración): notifica SOLO cuando `unread_count == 1` tras el post
 * — la PRIMERA actividad de una tanda no leída. Si ya había pendientes, el equipo
 * ya fue avisado por esta tanda → se omite.
 *
 * Calca el patrón de `payment-report-notify.ts` / `new-client-notify.ts`: reusa
 * `sendTelegramToUser` (per-usuario) + `resolveAdminEntries`/`sendAdminTelegram`
 * (broadcast). SIEMPRE con service_role. Best-effort: loguea pero NUNCA tira — un
 * fallo del aviso no debe romper el envío del mensaje del cliente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTelegramToUser } from "@/lib/studio/notify/send-user-telegram";
import {
  resolveAdminEntries,
  sendAdminTelegram,
} from "@/lib/studio/new-client-notify";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/** Recorta el preview del mensaje para el aviso (una línea, sin reventar). */
function preview(body: string, max = 140): string {
  const one = body.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/**
 * Avisa al equipo que entró un mensaje inbound del portal. Recibe el ADMIN client
 * + el `conversationId` que devuelve `portal_post_message` + el cuerpo del mensaje
 * (para el preview). Best-effort, nunca tira.
 */
export async function notifyConversationInbound(
  admin: SupabaseClient,
  args: { conversationId: string; body: string },
): Promise<void> {
  try {
    const { data: conv } = await admin
      .from("conversations")
      .select("tenant_id, client_id, assigned_to, unread_count, ref")
      .eq("id", args.conversationId)
      .maybeSingle<{
        tenant_id: string;
        client_id: string;
        assigned_to: string | null;
        unread_count: number;
        ref: string | null;
      }>();
    if (!conv) return;

    // Anti-spam: solo la primera actividad de una tanda no leída.
    if ((conv.unread_count ?? 0) !== 1) return;

    const { data: client } = await admin
      .from("clients")
      .select("name, markbox")
      .eq("id", conv.client_id)
      .maybeSingle<{ name: string; markbox: string }>();

    const who = client
      ? `${client.name} (${client.markbox})`
      : "Un cliente";
    const url = `${SITE_URL}/studio/conversaciones`;
    const text = [
      `Nuevo mensaje del portal${conv.ref ? ` · ${conv.ref}` : ""}`,
      ``,
      `${who} te escribió:`,
      `"${preview(args.body)}"`,
      ``,
      url,
    ].join("\n");

    if (conv.assigned_to) {
      // Hilo asignado → solo a ese agente.
      await sendTelegramToUser(admin, conv.assigned_to, text);
    } else {
      // Sin asignar → a los admins, para que alguien lo tome.
      const admins = await resolveAdminEntries(admin, conv.tenant_id);
      for (const a of admins) {
        await sendAdminTelegram(admin, a.user_id, text);
      }
    }
  } catch (err) {
    console.error("[conversation-inbound-notify] falló:", err);
  }
}
