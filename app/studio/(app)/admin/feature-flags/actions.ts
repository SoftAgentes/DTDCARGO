"use server";

/**
 * Server actions de feature flags (admin only).
 *
 * RLS de feature_flags ya bloquea UPDATE a no-admins (policy
 * `feature_flags_admin_update`). Acá replicamos el check antes de la
 * query para devolver un error claro al UI antes de pegar al DB.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { executeD1Operation } from "@/lib/studio/audit/d1-access-config-adapters";
import { FEATURE_FLAG_KEYS, type FeatureFlagKey } from "@/lib/studio/feature-flags-types";

export interface ToggleFlagState {
  ok?: boolean;
  error?: string;
  flagKey?: FeatureFlagKey;
}

export async function toggleFeatureFlagAction(
  _prev: ToggleFlagState,
  formData: FormData,
): Promise<ToggleFlagState> {
  const keyRaw = formData.get("key");
  const enabledRaw = formData.get("enabled");

  if (typeof keyRaw !== "string") {
    return { error: "Falta flag key." };
  }
  if (!(FEATURE_FLAG_KEYS as readonly string[]).includes(keyRaw)) {
    return { error: `Flag key inválida: ${keyRaw}` };
  }
  const key = keyRaw as FeatureFlagKey;
  const enabled = enabledRaw === "on" || enabledRaw === "true" || enabledRaw === "1";

  const supabase = await createClient();
  try {
    await executeD1Operation(supabase, {
      operationType: "feature_flag.toggle",
      input: { key, enabled },
    });
  } catch {
    return { error: "No se pudo guardar el feature flag." };
  }

  // Revalidar el layout para que el sidebar tome los flags nuevos.
  revalidatePath("/studio", "layout");

  return { ok: true, flagKey: key };
}
