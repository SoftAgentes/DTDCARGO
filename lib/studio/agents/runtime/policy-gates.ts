/**
 * Policy gates del runtime (SDD-0020 Fase 2D).
 *
 * Chequeos defensivos que se corren ANTES de invocar tools / arrancar
 * el LLM. Cada uno throwea un error tipado de `errors.ts` para que el
 * endpoint sepa qué status HTTP devolver.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BudgetExceededError,
  ToolNotGrantedError,
} from "./errors";

/**
 * Verifica que el agent tenga grant para ejecutar el tool. Usa el cliente
 * regular (RLS por tenant) — un agent de otro tenant tampoco devuelve grants.
 */
export async function assertToolGranted(
  supabase: SupabaseClient,
  agentId: string,
  toolKey: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("agent_tool_grants")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("tool_key", toolKey);
  if (error || data === null) {
    // Asumimos no granted si la query rompe — fail-closed.
    throw new ToolNotGrantedError(toolKey, agentId);
  }
}

/**
 * Verifica que el agent no haya excedido su budget mensual. Lectura
 * defensiva — si la query falla, asumimos NO excede (fail-open en este
 * gate; el RPC update_agent_spend hace el enforcement real al final).
 */
export async function assertBudgetAvailable(
  supabase: SupabaseClient,
  agentId: string,
): Promise<void> {
  const { data } = await supabase
    .from("agents")
    .select("spend_usd_mtd, budget_usd_monthly")
    .eq("id", agentId)
    .maybeSingle<{ spend_usd_mtd: number; budget_usd_monthly: number }>();
  if (!data) return; // si no podemos leer, dejamos pasar; insert de run falla solo
  const spend = Number(data.spend_usd_mtd) || 0;
  const budget = Number(data.budget_usd_monthly) || 0;
  if (budget > 0 && spend >= budget) {
    throw new BudgetExceededError(spend, budget);
  }
}
