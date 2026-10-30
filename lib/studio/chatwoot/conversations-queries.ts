import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lecturas de `public.chatwoot_conversations` (0504, SDD-0585) con el cliente
 * de SESIÓN: la RLS deja ver solo el tenant propio. El tenant se filtra igual.
 * Nunca hay texto ni datos del contacto en esta tabla.
 */

export interface ConversacionNoLeida {
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
    .select("conversation_id, unread_count, status")
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
