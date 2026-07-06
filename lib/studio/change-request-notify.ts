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
import { sendPushToUserDevices } from "@/lib/studio/notify/send-user-push";
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

/**
 * Push al CLIENTE cuando su solicitud se resuelve (aprobada/rechazada). El cliente
 * propuso un cambio y hasta ahora no se enteraba del veredicto salvo que volviera
 * al perfil. Reusa `sendPushToUserDevices` + `client_users` activos (mismo patrón
 * que notifyClientReplyPush, SDD-0148). El click abre `/portal/perfil`.
 * Best-effort: si no tiene push o falla, no pasa nada (al volver al perfil igual
 * ve el estado). SIEMPRE con service_role.
 */
export async function notifyChangeRequestResolvedToClient(
  supabaseAdmin: SupabaseClient,
  args: { clientId: string; approved: boolean; note?: string | null },
): Promise<void> {
  try {
    const { data: users } = await supabaseAdmin
      .from("client_users")
      .select("auth_user_id")
      .eq("client_id", args.clientId)
      .eq("status", "active")
      .not("auth_user_id", "is", null);

    const ids = [
      ...new Set(
        (users ?? [])
          .map((u) => (u as { auth_user_id: string | null }).auth_user_id)
          .filter((v): v is string => !!v),
      ),
    ];
    if (ids.length === 0) return;

    const note = (args.note ?? "").trim();
    const payload = args.approved
      ? {
          title: "DTD Cargo · datos actualizados",
          body: "Tu asesor aprobó el cambio. Ya puedes verlo en tu perfil.",
          tag: `portal-change-request-${args.clientId}`,
          url: "/portal/perfil",
        }
      : {
          title: "DTD Cargo · sobre tu solicitud de cambio",
          body: note
            ? `No se aplicó el cambio: ${note}`
            : "No se aplicó el cambio. Escríbenos por el chat si tienes dudas.",
          tag: `portal-change-request-${args.clientId}`,
          url: "/portal/perfil",
        };

    for (const id of ids) {
      await sendPushToUserDevices(supabaseAdmin, id, payload);
    }
  } catch (err) {
    console.error("[change-request-notify] notifyResolved falló:", err);
  }
}
