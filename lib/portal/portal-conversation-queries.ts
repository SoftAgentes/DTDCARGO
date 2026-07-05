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

/**
 * Ventana rodante del hilo del lado del CLIENTE (SDD-0148 · retención): el cliente
 * ve solo los últimos N días en el portal. NO se borra nada — el registro completo
 * vive para siempre del lado del ERP (buena práctica: data-minimization para el
 * cliente + la empresa conserva el activo). Buena práctica de la industria = 60-90
 * días; founder eligió 90 (3 meses). El resumen mensual (Fase 2) cubre el histórico.
 */
export const PORTAL_CLIENT_WINDOW_DAYS = 90;

export type PortalThreadMessage = {
  id: string;
  direction: "in" | "out";
  body: string;
  authorName: string | null;
  sentAt: string;
};

/**
 * Timestamp del ÚLTIMO mensaje del equipo (direction='out') en el hilo `portal`
 * del cliente, o null si no hay respuestas. Sirve para el badge de no-leídos del
 * nav del portal (SDD-0148 #4): el client compara este ISO con lo que guardó en
 * localStorage la última vez que abrió Soporte → punto si hay algo más nuevo.
 * Best-effort (admin, scope por client_id); null ante cualquier problema.
 */
export async function getPortalLastReplyAt(
  admin: SupabaseClient,
  clientId: string,
): Promise<string | null> {
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("client_id", clientId)
    .eq("channel", "portal")
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();
  if (!conv) return null;

  const { data } = await admin
    .from("conversation_messages")
    .select("sent_at")
    .eq("conversation_id", conv.id)
    .eq("direction", "out")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ sent_at: string }>();
  return data?.sent_at ?? null;
}

/**
 * Id del hilo `portal` del cliente (o null si aún no escribió). Lo usa la pantalla
 * de Soporte para el subscribe de realtime (SDD-0148 #3): el componente client se
 * suscribe a `conversation_messages` filtrando por este id. Best-effort.
 */
export async function getPortalConversationId(
  admin: SupabaseClient,
  clientId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("conversations")
    .select("id")
    .eq("client_id", clientId)
    .eq("channel", "portal")
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

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

  // Ventana rodante del cliente (retención · SDD-0148): solo los últimos N días.
  // Filtro de LECTURA, no borra — el registro completo sigue en la DB para el ERP.
  const cutoff = new Date(
    Date.now() - PORTAL_CLIENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await admin
    .from("conversation_messages")
    .select("id, direction, body, author_name, sent_at")
    .eq("conversation_id", conv.id)
    .gte("sent_at", cutoff)
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
