import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { chatwootPortalConfig } from "./config";

/**
 * Studio en solo lectura para los hilos del portal (SDD-0586, paso 10.5, 1c-1: E10-D41).
 *
 * Con `chatwoot_portal` encendido para el tenant y la bandeja del portal configurada en el
 * servidor (`chatwootPortalConfig()`, con ese tenant), los hilos del portal se responden desde la
 * Bandeja de Chatwoot: Conversaciones de Studio no los responde ni les cambia el estado. Es la
 * misma condición con la que corren la ida y la vuelta. Si falta la configuración no se traba: la
 * ida no manda nada y Studio es la única vía para responderle al cliente.
 *
 * El flag se lee de su fila en `feature_flags` con la sesión (la RLS deja ver las del tenant). Si
 * la lectura falla, la traba queda puesta (fail-closed), y solo para el portal: mejor «no se pudo
 * comprobar» que una respuesta que Chatwoot no ve. `listFeatureFlags` no sirve aquí: ante un error
 * cae al valor por defecto, apagado, y dejaría pasar. Sin fila, apagado, como para la ida.
 */

export type EstadoTrabaPortal = "activa" | "apagada" | "no_se_sabe";

export const MENSAJE_SOLO_LECTURA = "Este hilo del portal se responde desde la Bandeja de Chatwoot.";
export const MENSAJE_NO_SE_SABE =
  "No se pudo comprobar si este hilo del portal se responde desde la Bandeja de Chatwoot. Vuelve a intentar.";

/** ¿Está puesta la traba de los hilos del portal en el tenant? */
export async function trabaPortal(supabase: SupabaseClient, tenantId: string | null): Promise<EstadoTrabaPortal> {
  const cfg = chatwootPortalConfig();
  if (!cfg) return "apagada";
  if (!tenantId) return "no_se_sabe";
  if (cfg.tenantId !== tenantId) return "apagada";
  const { data, error } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("tenant_id", tenantId)
    .eq("key", "chatwoot_portal")
    .maybeSingle<{ enabled: boolean }>();
  if (error) return "no_se_sabe";
  return data?.enabled === true ? "activa" : "apagada";
}

/**
 * Para una acción de Conversaciones: `null` si puede seguir; si no, el mensaje para el equipo.
 * Solo mira los hilos del portal: los demás canales ni leen el flag.
 */
export async function rechazoPortal(
  supabase: SupabaseClient,
  tenantId: string | null,
  canal: string | null | undefined,
): Promise<string | null> {
  if (canal !== "portal") return null;
  const estado = await trabaPortal(supabase, tenantId);
  if (estado === "apagada") return null;
  return estado === "activa" ? MENSAJE_SOLO_LECTURA : MENSAJE_NO_SE_SABE;
}
