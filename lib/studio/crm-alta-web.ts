import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AtribucionUtm } from "@/lib/public/registro-atribucion";

/**
 * Tarjeta del CRM propio al registrarse en `/registro` (SDD-0587, paso 6.4).
 * Nunca lanza: corre en `after()`, cuando la persona ya tiene su Shipping Mark, y
 * un fallo aquí no puede tocar su alta. Si falla, la tarjeta se crea cuando la
 * persona escriba por Chatwoot. En el log, solo el código.
 */
export async function altaTarjetaWeb(
  admin: SupabaseClient,
  datos: { tenantId: string; clientId: string; origen: string; atribucion: AtribucionUtm },
): Promise<void> {
  try {
    const { error } = await admin.rpc("crm_alta_tarjeta_web", {
      p_tenant_id: datos.tenantId,
      p_client_id: datos.clientId,
      p_origen: datos.origen,
      p_utm_source: datos.atribucion.utm_source ?? null,
      p_utm_medium: datos.atribucion.utm_medium ?? null,
      p_utm_campaign: datos.atribucion.utm_campaign ?? null,
      p_utm_content: datos.atribucion.utm_content ?? null,
      p_utm_term: datos.atribucion.utm_term ?? null,
    });
    if (error) console.warn(`[registerClientAction] tarjeta del CRM sin crear: ${error.code ?? "sin código"}`);
  } catch (e) {
    console.warn(`[registerClientAction] tarjeta del CRM sin crear: ${e instanceof Error ? e.name : "error"}`);
  }
}

/**
 * D7 de la SDD-0587: dejar de empujar el alta web a Kommo. APAGADO: encenderlo
 * exige la lectura L3 de producción con OK de Sam (`KOMMO_PUSH_DRY_RUN`, §8). Solo
 * `"1"` lo enciende; vacío o cualquier otro valor deja la conducta de hoy.
 */
export function altaWebSinKommo(): boolean {
  return (process.env.CRM_ALTA_WEB_SIN_KOMMO ?? "").trim() === "1";
}
