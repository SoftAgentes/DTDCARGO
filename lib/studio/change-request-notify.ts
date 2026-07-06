/**
 * Aviso interno "un cliente pidió cambiar sus datos" (SDD-0151). Cuando el
 * cliente propone un cambio de identidad desde el portal, el equipo no se entera
 * salvo que entre a su ficha. Esto avisa por Telegram a los admins del tenant
 * con el diff propuesto, para que lo revisen y aprueben/rechacen.
 *
 * Reusa `resolveAdminEntries` + `sendAdminTelegram` de new-client-notify (mismo
 * "avisar al equipo de un evento del cliente"). SIEMPRE con service_role.
 * Best-effort: loguea pero NUNCA tira — un fallo del aviso no debe romper la
 * creación de la solicitud.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAdminEntries, sendAdminTelegram } from "@/lib/studio/new-client-notify";
import type { ChangeRequestDiffRow } from "@/lib/portal/change-request-types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export async function notifyChangeRequestToAdmin(
  supabaseAdmin: SupabaseClient,
  args: {
    tenantId: string;
    markbox: string;
    clientName: string;
    diff: ChangeRequestDiffRow[];
  },
): Promise<void> {
  try {
    const admins = await resolveAdminEntries(supabaseAdmin, args.tenantId);
    if (admins.length === 0) return;

    const clientUrl = `${SITE_URL}/studio/clientes/${args.markbox}`;
    const changes = args.diff
      .map((d) => `• ${d.label}: ${d.from ?? "—"} → ${d.to}`)
      .join("\n");
    const text = [
      `Solicitud de cambio de datos · ${args.markbox}`,
      ``,
      args.clientName,
      changes,
      ``,
      `Revisar y aprobar:`,
      clientUrl,
    ].join("\n");

    for (const admin of admins) {
      await sendAdminTelegram(supabaseAdmin, admin.user_id, text);
    }
  } catch (err) {
    console.error("[change-request-notify] falló:", err);
  }
}
