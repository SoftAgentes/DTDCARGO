/**
 * Portal · canal Conversaciones (SDD-0056 · Fase 1).
 *
 * El cliente del portal NO tiene RLS de lectura sobre `conversations` /
 * `conversation_messages` (esas tablas son del EQUIPO del tenant). Para mostrarle
 * SU propio hilo del canal `portal` usamos el admin client, scopeado EXPLÍCITO
 * por el client_id ya resuelto por sesión (mismo patrón que loadPendingAcceptance
 * del dashboard). El cliente escribe vía la RPC SECURITY DEFINER
 * `portal_post_message` (no toca estas tablas directo).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type PortalThreadMessage = {
  id: string;
  direction: "in" | "out";
  body: string;
  authorName: string | null;
  sentAt: string;
};

/**
 * El hilo del canal `portal` del cliente (mensajes cronológicos). Recibe el
 * ADMIN client + el client_id resuelto por sesión. Devuelve [] si no hay hilo
 * todavía. Scope EXPLÍCITO por client_id + channel='portal'.
 */
export async function getPortalThread(
  admin: SupabaseClient,
  clientId: string,
): Promise<PortalThreadMessage[]> {
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("client_id", clientId)
    .eq("channel", "portal")
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();

  if (!conv) return [];

  const { data, error } = await admin
    .from("conversation_messages")
    .select("id, direction, body, author_name, sent_at")
    .eq("conversation_id", conv.id)
    .order("sent_at", { ascending: true })
    .limit(200);

  if (error || !data) return [];

  return (
    data as Array<{
      id: string;
      direction: "in" | "out";
      body: string;
      author_name: string | null;
      sent_at: string;
    }>
  ).map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    authorName: m.author_name,
    sentAt: m.sent_at,
  }));
}
