import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lecturas de `public.chatwoot_conversations` (0504, SDD-0585) con el cliente
 * de SESIÓN: la RLS deja ver solo el tenant propio. El tenant se filtra igual.
 * Nunca hay texto ni datos del contacto en esta tabla.
 */

export interface ConversacionNoLeida {
  /** `conversation_id::text` (columna generada): la clave de useRealtimeTable. */
  id: string;
  conversation_id: number;
  unread_count: number;
  status: string;
}

export interface ConversacionDeCliente {
  conversation_id: number;
  status: string;
  unread_count: number;
  last_activity_at: string | null;
}

/** Abiertas con no leídos, para el contador del sidebar (E2-D21). */
export async function listNoLeidasBandeja(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ConversacionNoLeida[]> {
  const { data, error } = await supabase
    .from("chatwoot_conversations")
    .select("id, conversation_id, unread_count, status")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .gt("unread_count", 0)
    .limit(200);
  if (error || !data) return [];
  return data as ConversacionNoLeida[];
}

/** El contador: cuántas conversaciones abiertas tienen no leídos. */
export function contarNoLeidas(filas: readonly { unread_count: number; status: string }[]): number {
  return filas.filter((f) => f.status === "open" && f.unread_count > 0).length;
}

/** Las más recientes de un cliente, para la tarjeta de la ficha (E2-D23). */
export async function listConversacionesDeCliente(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string,
  limite = 5,
): Promise<ConversacionDeCliente[]> {
  const { data, error } = await supabase
    .from("chatwoot_conversations")
    .select("conversation_id, status, unread_count, last_activity_at")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(limite);
  if (error || !data) return [];
  return data as ConversacionDeCliente[];
}

export interface EventoDescartado {
  event_key: string;
  event: string;
  conversation_id: number;
  attempts: number;
  updated_at: string;
}

/**
 * Eventos que el reintento propio dejó «descartado» (0504, E2-D26), para el
 * admin en la Bandeja. La RLS solo se los deja ver al admin del tenant.
 */
export async function listEventosDescartados(
  supabase: SupabaseClient,
  tenantId: string,
  limite = 10,
): Promise<EventoDescartado[]> {
  const { data, error } = await supabase
    .from("chatwoot_webhook_events")
    .select("event_key, event, conversation_id, attempts, updated_at")
    .eq("tenant_id", tenantId)
    .eq("status", "descartado")
    .order("updated_at", { ascending: false })
    .limit(limite);
  if (error || !data) return [];
  return data as EventoDescartado[];
}
