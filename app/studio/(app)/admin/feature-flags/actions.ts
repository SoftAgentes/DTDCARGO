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
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Iniciá sesión primero." };

  // Anti-locked-out check: si el flag a apagar es del módulo que el
  // user está usando ahora mismo, igual lo permitimos — al recargar el
  // sidebar él mismo verá que perdió acceso y puede re-encenderlo
  // desde admin/feature-flags (que NO está flagged).

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) return { error: "Sin tenant." };
  if (link.role !== "admin") {
    return { error: "Solo admins pueden cambiar feature flags." };
  }

  const { error } = await supabase
    .from("feature_flags")
    .update({
      enabled,
      updated_at: new Date().toISOString(),
      updated_by: userResp.user.id,
    })
    .eq("tenant_id", link.tenant_id)
    .eq("key", key);

  if (error) {
    if (error.code === "42501") {
      return { error: "RLS bloqueó el cambio (no sos admin)." };
    }
    return { error: `No se pudo guardar: ${error.message}` };
  }

  // Revalidar el layout para que el sidebar tome los flags nuevos.
  revalidatePath("/studio", "layout");

  return { ok: true, flagKey: key };
}
