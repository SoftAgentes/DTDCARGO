"use server";

/**
 * Estado de la guía por usuario (SDD-0589, paso 9.3).
 *
 * `guardarEstadoGuiaAction`: guarda con un upsert la fila del propio usuario en
 * `user_guide_prefs` (migración 0517). La forma se valida con `validarEstadoGuia`,
 * que descarta lo que no esté en el catálogo, y la RLS de la 0517 deja escribir
 * solo la fila propia en un tenant activo. No toca datos de negocio ni de otros
 * usuarios, igual que `saveDashboardConfigAction`.
 *
 * Sin `revalidatePath`: el estado ya está aplicado en el cliente y la guía no
 * cambia nada de la pantalla.
 */

import { createClient } from "@/lib/db/server";
import { validarEstadoGuia } from "@/lib/studio/guia/estado-types";

export type GuardarEstadoGuiaResultado = { ok: true } | { error: string };

/** Tope del texto que llega del cliente, antes de parsearlo. */
const MAX_ENTRADA = 16_384;

export async function guardarEstadoGuiaAction(entrada: string): Promise<GuardarEstadoGuiaResultado> {
  if (typeof entrada !== "string" || entrada.length > MAX_ENTRADA) return { error: "Estado inválido." };
  let crudo: unknown;
  try {
    crudo = JSON.parse(entrada);
  } catch {
    return { error: "Estado inválido." };
  }
  const state = validarEstadoGuia(crudo);

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp.user?.id;
  if (!userId) return { error: "Inicia sesión primero." };
  const { data: tenantId, error: tenantError } = await supabase.rpc("get_user_tenant_id");
  if (tenantError || typeof tenantId !== "string") return { error: "Sin tenant asignado." };

  const { error } = await supabase
    .from("user_guide_prefs")
    .upsert({ tenant_id: tenantId, user_id: userId, state }, { onConflict: "tenant_id,user_id" });
  if (error) return { error: "No se pudo guardar." };
  return { ok: true };
}
