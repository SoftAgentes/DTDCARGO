/**
 * Avisos del flujo "operario pide contenedor → oficina autoriza" (SDD-0157).
 *
 * Best-effort por diseño: cada canal se envuelve en try/catch y NUNCA rompe el
 * flujo del caller (la bandeja visible en Studio ya cumple el requisito duro).
 *
 *  - notifyConsolidationRequestToOffice → Telegram a los admins del tenant que
 *    linkearon su chat (reusa el patrón de new-client-notify). Se dispara cuando
 *    el operario CN crea la solicitud.
 *  - notifyConsolidationAuthorizedToOperario → Web Push al operario que pidió,
 *    cuando la oficina autoriza (reusa sendPushToOperario).
 *
 * Ambas reciben un admin client (service_role): las subscriptions del operario y
 * el linkeo de Telegram no son accesibles por RLS del usuario común.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAdminEntries, sendAdminTelegram } from "@/lib/studio/new-client-notify";
import { sendPushToOperario } from "@/lib/studio/notify/send-operario-push";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/** Avisa a la oficina (Telegram) que un operario pidió abrir un contenedor. */
export async function notifyConsolidationRequestToOffice(
  admin: SupabaseClient,
  tenantId: string,
  payload: { containerType: string; operarioName?: string | null },
): Promise<void> {
  try {
    const admins = await resolveAdminEntries(admin, tenantId);
    if (admins.length === 0) return;

    const quien = payload.operarioName ? ` · ${payload.operarioName}` : "";
    const text = [
      `Solicitud de consolidado${quien}`,
      ``,
      `El hub (China) pidió abrir un contenedor ${payload.containerType}.`,
      `Autorízalo o recházalo en el Studio.`,
      ``,
      `${SITE_URL}/studio/naviera`,
    ].join("\n");

    for (const a of admins) {
      await sendAdminTelegram(admin, a.user_id, text);
    }
  } catch (err) {
    console.error("[consolidation-request-notify] office falló:", err);
  }
}

/** Avisa al operario (push) que la oficina autorizó su contenedor. */
export async function notifyConsolidationAuthorizedToOperario(
  admin: SupabaseClient,
  operarioId: string,
  payload: { ref: string; containerType: string | null },
): Promise<void> {
  try {
    const tipo = payload.containerType ? ` ${payload.containerType}` : "";
    await sendPushToOperario(admin, operarioId, {
      title: "Contenedor autorizado",
      body: `La oficina autorizó tu contenedor${tipo} (${payload.ref}). Ya puedes estibar.`,
      tag: `consolidation-authorized-${payload.ref}`,
      url: "/m/cn/estibar",
    });
  } catch (err) {
    console.error("[consolidation-request-notify] operario falló:", err);
  }
}
