import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChatwootAgentLink } from "./chatwoot-types";

/**
 * Lecturas de `public.chatwoot_agent_links` (migración 0503, SDD-0585 E2-D10).
 * Reciben el cliente de SESIÓN: la RLS deja a cada usuario ver su fila y al
 * admin las de su tenant. El tenant se filtra igual, como defensa en
 * profundidad.
 */

const COLUMNAS = "tenant_id, user_id, chatwoot_user_id, created_by, created_at";

export async function getVinculoPropio(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<ChatwootAgentLink | null> {
  const { data, error } = await supabase
    .from("chatwoot_agent_links")
    .select(COLUMNAS)
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ChatwootAgentLink;
}

export async function listVinculos(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ChatwootAgentLink[]> {
  const { data, error } = await supabase
    .from("chatwoot_agent_links")
    .select(COLUMNAS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as ChatwootAgentLink[];
}
