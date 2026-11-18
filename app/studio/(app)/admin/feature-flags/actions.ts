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

/** El superadmin que no es admin de este equipo (la guarda de audit_d1_execute). */
const NO_ES_ADMIN_DEL_EQUIPO =
  "Para encender o apagar los módulos de este equipo tienes que ser también su administrador. Si lo eres, vuelve a iniciar sesión.";

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
    // SDD-0634: dos causas dan `permission_denied` (42501):
    //  · el disparador de la 0543: la base dice que no es superadmin (manda
    //    la base, con el mismo aviso);
    //  · `audit_d1_admin_tenant` (0289): es superadmin, pero no admin de este
    //    tenant (o la sesión se perdió). Decirle «no eres superadministrador»
    //    sería falso.
    if (err instanceof D1OperationError && err.code === "permission_denied") {
      return {
        error: err.dbMessage?.includes("Solo el superadministrador")
          ? SUPERADMIN_DENIAL
          : NO_ES_ADMIN_DEL_EQUIPO,
        flagKey: key,
      };
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
