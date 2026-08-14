/**
 * Queries del historial de Shipping Mark (SDD-0258).
 *
 * Funciones puras que reciben el SupabaseClient, patrón del proyecto. El
 * aislamiento por tenant lo hace la RLS de `client_markbox_history` (política
 * "client_markbox_history by tenant", migr 0367).
 *
 * ⚠️ La tabla NO tiene política de escritura a propósito: con RLS activa y sin
 * política, todo INSERT directo queda negado. La única vía es la RPC
 * `rename_client_markbox()`, que es security definer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { MarkboxHistoryEntry } from "./markbox-history-types";

/** Los códigos que este cliente TUVO, del más reciente al más viejo. */
export async function listMarkboxHistory(
  supabase: SupabaseClient,
  clientId: string,
): Promise<MarkboxHistoryEntry[]> {
  const { data, error } = await supabase
    .from("client_markbox_history")
    .select("id, markbox, reason, retired_at")
    .eq("client_id", clientId)
    .order("retired_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id as string,
    markbox: r.markbox as string,
    reason: (r.reason as string | null) ?? null,
    retiredAt: r.retired_at as string,
  }));
}
