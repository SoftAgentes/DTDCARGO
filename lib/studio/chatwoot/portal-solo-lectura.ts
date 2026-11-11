import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Studio en solo lectura para los hilos del portal (SDD-0586, paso 10.5, 1c-1: E10-D41).
 *
 * Con `chatwoot_portal` encendido para el tenant, los hilos del portal se responden desde la
 * Bandeja de Chatwoot: Conversaciones de Studio no los responde ni les cambia el estado.
 *
 * **Solo el flag decide, aunque falte la configuración** (SDD-0586 1c-2, decisión del DG del
 * 2026-11-08, opción b: fallar cerrado). La base no ve `chatwootPortalConfig()`, y la guarda de la
 * 0521 traba los salientes y el estado de un hilo del portal con el flag encendido: así la pantalla
 * y la base dicen lo mismo. Con el flag encendido sin la bandeja configurada nadie responde un hilo
 * del portal hasta configurarla o apagar el flag; el guion de encendido pide la configuración antes.
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
  if (!tenantId) return "no_se_sabe";
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
