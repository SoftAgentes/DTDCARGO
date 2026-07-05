/**
 * Aviso interno "un cliente escribió por el portal" (SDD-0148). Sin esto, el
 * mensaje entra a Conversaciones y solo sube el contador "sin leer" — a nadie le
 * suena nada. Esto avisa al equipo para que responda, cerrando el lazo que hace
 * el chat de Soporte un canal vivo.
 *
 * A quién:
 *   - Hilo con asesor asignado (`assigned_to`) → a ESE agente (Telegram).
 *   - Hilo sin asignar PERO el cliente tiene `advisor_id` → se AUTO-ASIGNA el hilo a
 *     ese asesor (SDD-0148 #2, reusa la relación existente) y el aviso va a él.
 *   - Sin asignar y sin asesor del cliente → broadcast a los admins del tenant.
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
import { resolveAdminEntries } from "@/lib/studio/new-client-notify";

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
      .select("name, markbox, advisor_id")
      .eq("id", conv.client_id)
      .maybeSingle<{ name: string; markbox: string; advisor_id: string | null }>();

    // #2 Auto-asignación: hilo sin asesor + el cliente tiene advisor_id → se lo
    // asignamos (guard `.is(assigned_to, null)` evita pisar una carrera).
    let assignedTo = conv.assigned_to;
    if (!assignedTo && client?.advisor_id) {
      const { error: upErr } = await admin
        .from("conversations")
        .update({ assigned_to: client.advisor_id })
        .eq("id", args.conversationId)
        .is("assigned_to", null);
      if (!upErr) assignedTo = client.advisor_id;
    }

    const who = client
      ? `${client.name} (${client.markbox})`
      : "Un cliente";
    // Deep-link al hilo puntual (SDD-0148 #1): la bandeja preselecciona `?c=<id>`.
    const url = `${SITE_URL}/studio/conversaciones?c=${args.conversationId}`;
    const text = [
      `Nuevo mensaje del portal${conv.ref ? ` · ${conv.ref}` : ""}`,
      ``,
      `${who} te escribió:`,
      `"${preview(args.body)}"`,
      ``,
      url,
    ].join("\n");

    if (assignedTo) {
      // Hilo asignado (o recién auto-asignado por advisor_id) → solo a ese agente.
      await sendTelegramToUser(admin, assignedTo, text);
    } else {
      // #2 Round-robin: sin asesor del cliente → asigna al ADMIN menos cargado
      // (menos conversaciones abiertas asignadas) y notifica SOLO a él. Reparte la
      // carga en vez de pingear a todos. Si no hay admins, no-op.
      const admins = await resolveAdminEntries(admin, conv.tenant_id);
      if (admins.length === 0) return;

      const { data: openRows } = await admin
        .from("conversations")
        .select("assigned_to")
        .eq("tenant_id", conv.tenant_id)
        .is("deleted_at", null)
        .neq("status", "resuelto")
        .not("assigned_to", "is", null);
      const load = new Map<string, number>();
      for (const r of openRows ?? []) {
        const a = (r as { assigned_to: string }).assigned_to;
        load.set(a, (load.get(a) ?? 0) + 1);
      }
      let best = admins[0].user_id;
      let bestLoad = load.get(best) ?? 0;
      for (const a of admins) {
        const l = load.get(a.user_id) ?? 0;
        if (l < bestLoad) {
          best = a.user_id;
          bestLoad = l;
        }
      }

      await admin
        .from("conversations")
        .update({ assigned_to: best })
        .eq("id", args.conversationId)
        .is("assigned_to", null);
      await sendTelegramToUser(admin, best, text);
    }
  } catch (err) {
    console.error("[conversation-inbound-notify] falló:", err);
  }
}
