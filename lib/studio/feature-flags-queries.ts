/**
 * Feature flags · queries server-side.
 *
 * Cualquier server component / page que necesita filtrar UI por flags
 * llama a `listFeatureFlags(supabase)` y pasa el resultado al client.
 *
 * El layout del Studio fetcha los flags una vez y los propaga al sidebar
 * via prop para evitar re-fetches en cada navegación.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FEATURE_FLAG_DEFAULTS,
  mergeFlagsWithDefaults,
  type FeatureFlagRow,
  type FeatureFlags,
} from "./feature-flags-types";

/**
 * Lee los feature flags del tenant del user logueado (RLS filtra).
 * Si la query falla o no devuelve nada, fallback a los defaults del
 * handoff (defensa contra migrations incompletas).
 *
 * Pasar el tenantId explícito sirve cuando se usa admin client
 * (service_role bypassea RLS y veria rows de otros tenants).
 */
export async function listFeatureFlags(
  supabase: SupabaseClient,
  tenantId?: string,
): Promise<FeatureFlags> {
  let q = supabase.from("feature_flags").select("*");
  if (tenantId) q = q.eq("tenant_id", tenantId);

  const { data, error } = await q;
  if (error || !data) {
    return { ...FEATURE_FLAG_DEFAULTS };
  }
  return mergeFlagsWithDefaults(data as FeatureFlagRow[]);
}
