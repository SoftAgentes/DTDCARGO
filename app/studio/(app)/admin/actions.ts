"use server";

/**
 * Server actions de Administración (sección "Permisos por rol", SDD-0252).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import type { StudioUserRole } from "@/lib/studio/user-types";

export type SetRoleModuleAccessState = { ok?: boolean; error?: string };

/**
 * Guarda un desvío EXPLÍCITO de la matriz para (rol, módulo) — incluido
 * (false, false), que es "este rol NO ve este módulo aunque el default lo
 * conceda", no un sinónimo de "sin override" (ver `resetRoleModuleAccessAction`
 * para volver al default). El candado de gobernanza real vive en el RPC
 * `studio_set_role_module_access` (migr 0357, rechaza LOCKED_MODULES) — acá
 * sólo se gatea que quien llama pueda editar el módulo `admin` (mismo nivel
 * que hoy abre esta pantalla).
 */
export async function setRoleModuleAccessAction(
  role: StudioUserRole,
  moduleId: string,
  canView: boolean,
  canEdit: boolean,
): Promise<SetRoleModuleAccessState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const { error } = await supabase.rpc("studio_set_role_module_access", {
    p_role: role,
    p_module_id: moduleId,
    p_can_view: canView,
    p_can_edit: canEdit,
  });
  if (error) {
    return {
      error: error.message.includes("candado")
        ? error.message
        : "No se pudo guardar el cambio. Reintenta.",
    };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}

/** Borra el desvío de (rol, módulo) — vuelve a aplicar el default de código. */
export async function resetRoleModuleAccessAction(
  role: StudioUserRole,
  moduleId: string,
): Promise<SetRoleModuleAccessState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const { error } = await supabase.rpc("studio_reset_role_module_access", {
    p_role: role,
    p_module_id: moduleId,
  });
  if (error) return { error: "No se pudo restablecer el default. Reintenta." };

  revalidatePath("/studio/admin");
  return { ok: true };
}
