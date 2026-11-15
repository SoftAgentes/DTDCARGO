"use server";

/**
 * Server actions de feature flags (SUPERADMIN only desde la migr 0355).
 *
 * Encender o apagar un módulo del ERP le cambia el sistema a TODO el equipo, así
 * que dejó de ser una facultad de cualquier `admin` y pasó a la capa de
 * plataforma — fue el primer permiso que el founder pidió subir.
 *
 * El control real es el disparador `feature_flags_exige_superadmin` (migr
 * 0543, SDD-0634): con sesión de usuario, solo el superadministrador cambia un
 * flag, también por `audit_d1_execute` (0289:632-650), que es DEFINER y escribe
 * como dueño, así que la policy `feature_flags_platform_admin_update` (0355) no
 * lo alcanzaba. `platformAdminDenial` de aquí avisa antes; si la base igual
 * niega, el catch muestra el mismo aviso.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { SUPERADMIN_DENIAL, platformAdminDenial } from "@/lib/studio/platform-admin";
import { D1OperationError, executeD1Operation } from "@/lib/studio/audit/d1-access-config-adapters";
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

  // SDD-0633: todo error de aquí en adelante lleva `flagKey`, para que lo pinte
  // la tarjeta pulsada. Antes la denegación y el catch salían sin él y el
  // interruptor "no hacía nada".
  const denial = await platformAdminDenial(supabase);
  if (denial) return { error: denial, flagKey: key };

  try {
    await executeD1Operation(supabase, {
      operationType: "feature_flag.toggle",
      input: { key, enabled },
    });
  } catch (err) {
    // SDD-0634: desde la 0543 la base frena por su cuenta (42501 →
    // permission_denied) a quien no es superadmin, por cualquier camino. Si
    // llega aquí, la comprobación de arriba dijo que sí y la base dijo que no:
    // manda la base, con el mismo aviso.
    if (err instanceof D1OperationError && err.code === "permission_denied") {
      return { error: SUPERADMIN_DENIAL, flagKey: key };
    }
    return {
      error: "No se pudo guardar el cambio del módulo. Intenta de nuevo.",
      flagKey: key,
    };
  }

  // Revalidar el layout para que el sidebar tome los flags nuevos.
  revalidatePath("/studio", "layout");

  return { ok: true, flagKey: key };
}
