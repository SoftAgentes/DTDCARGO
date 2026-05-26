/**
 * Queries del motor de reglas (SDD-0029 §5).
 * Devuelve siempre rules vivas: si no hay row para el tenant, devuelve DEFAULT.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_DISPATCH_RULES,
  type DispatchRules,
} from "./dispatch-rules-types";

export async function getDispatchRules(
  supabase: SupabaseClient,
): Promise<DispatchRules> {
  const { data, error } = await supabase
    .from("dispatch_rules")
    .select("*")
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  if (!data) {
    // Resolver tenant del usuario para devolver default con tenant_id correcto
    const { data: link } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .maybeSingle<{ tenant_id: string }>();
    return {
      tenant_id: link?.tenant_id ?? "",
      ...DEFAULT_DISPATCH_RULES,
      updated_by: null,
      updated_at: new Date().toISOString(),
    };
  }

  return data as DispatchRules;
}
