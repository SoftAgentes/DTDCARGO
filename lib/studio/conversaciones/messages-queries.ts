/**
 * Queries de mensajes del módulo Conversaciones (SDD-0056 · Fase 1).
 * Funciones puras que reciben un `SupabaseClient`.
 *
 * - listMessages: hilo completo de un conversation (orden cronológico).
 * - insertOutboundMessage: respuesta del agente (direction='out').
 * - insertInboundMessage: mensaje inbound idempotente por external_msg_id
 *   (lo usarán los webhooks de Fases 2-3; en Fase 1 el canal portal entra por
 *   la RPC `portal_post_message`). Lo dejamos listo + testeado.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationMessage } from "./conversations-types";

/**
 * Mensajes de un hilo, cronológico (sent_at asc). RLS filtra por tenant.
 */
export async function listMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationMessage[]> {
  const { data, error } = await supabase
    .from("conversation_messages")
    .select(
      "id, tenant_id, conversation_id, direction, author_name, author_user_id, body, external_msg_id, sent_at, created_at",
    )
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .limit(500);
  if (error || !data) return [];
  return data as ConversationMessage[];
}

export type InsertOutboundInput = {
  tenantId: string;
  conversationId: string;
  body: string;
  authorName: string;
  authorUserId: string;
};

/**
 * Inserta la respuesta del agente (direction='out') y refresca los
 * denormalizados del hilo (last_message_at; el outbound NO suma unread y limpia
 * el unread del cliente: el agente respondió, "leyó" el hilo).
 */
export async function insertOutboundMessage(
  supabase: SupabaseClient,
  input: InsertOutboundInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nowIso = new Date().toISOString();
  const { error: msgErr } = await supabase.from("conversation_messages").insert({
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    direction: "out",
    author_name: input.authorName,
    author_user_id: input.authorUserId,
    body: input.body,
    sent_at: nowIso,
  });
  if (msgErr) return { ok: false, error: msgErr.message };

  const { error: convErr } = await supabase
    .from("conversations")
    .update({ last_message_at: nowIso, unread_count: 0 })
    .eq("id", input.conversationId);
  if (convErr) return { ok: false, error: convErr.message };

  return { ok: true };
}

export type InsertInboundInput = {
  tenantId: string;
  conversationId: string;
  body: string;
  authorName: string | null;
  /** id del proveedor (idempotencia). Si ya existe → no duplica. */
  externalMsgId?: string | null;
  sentAt?: string;
};

/**
 * Inserta un mensaje inbound (direction='in') idempotente por external_msg_id.
 * Si `externalMsgId` ya existe en el tenant → no inserta (devuelve duplicate
 * true). Bump unread_count + last_message_at del hilo. Pensado para los webhooks
 * de Fases 2-3; el canal portal de Fase 1 entra por la RPC `portal_post_message`.
 */
export async function insertInboundMessage(
  supabase: SupabaseClient,
  input: InsertInboundInput,
): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string }> {
  // Idempotencia: si hay external_msg_id y ya existe, cortar sin duplicar.
  if (input.externalMsgId) {
    const { data: existing } = await supabase
      .from("conversation_messages")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("external_msg_id", input.externalMsgId)
      .maybeSingle<{ id: string }>();
    if (existing) return { ok: true, duplicate: true };
  }

  const sentAt = input.sentAt ?? new Date().toISOString();
  const { error: msgErr } = await supabase.from("conversation_messages").insert({
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    direction: "in",
    author_name: input.authorName,
    body: input.body,
    external_msg_id: input.externalMsgId ?? null,
    sent_at: sentAt,
  });
  if (msgErr) {
    // unique violation por carrera del índice external → tratar como duplicado.
    if (msgErr.code === "23505") return { ok: true, duplicate: true };
    return { ok: false, error: msgErr.message };
  }

  // Bump unread + last_message_at via RPC atómico no disponible: leer + sumar.
  const { data: conv } = await supabase
    .from("conversations")
    .select("unread_count")
    .eq("id", input.conversationId)
    .maybeSingle<{ unread_count: number }>();
  const next = (conv?.unread_count ?? 0) + 1;
  await supabase
    .from("conversations")
    .update({ last_message_at: sentAt, unread_count: next })
    .eq("id", input.conversationId);

  return { ok: true, duplicate: false };
}
