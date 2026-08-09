"use server";

/**
 * Server actions de feature flags (SUPERADMIN only desde la migr 0355).
 *
 * Encender o apagar un módulo del ERP le cambia el sistema a TODO el equipo, así
 * que dejó de ser una facultad de cualquier `admin` y pasó a la capa de
 * plataforma — fue el primer permiso que el founder pidió subir.
 *
 * El control REAL es la policy `feature_flags_platform_admin_update` (migr
 * 0355): sin ella, gatear sólo acá dejaría el hueco abierto para quien invoque
 * PostgREST directo. El guard de abajo existe para dar un error legible —
 * sin él, la RLS descarta el UPDATE en silencio y el interruptor "no hace nada"
 * sin explicar por qué.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { platformAdminDenial } from "@/lib/studio/platform-admin";
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

  const denial = await platformAdminDenial(supabase);
  if (denial) return { error: denial };

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
