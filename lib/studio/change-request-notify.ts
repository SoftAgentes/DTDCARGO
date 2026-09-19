/**
 * Aviso interno "un cliente pidió cambiar sus datos" (SDD-0151). Cuando el
 * cliente propone un cambio de identidad desde el portal, el equipo no se entera
 * salvo que entre a su ficha. Esto avisa por Telegram con el diff propuesto.
 *
 * Ruteo (SDD-0148): si el cliente tiene asesor asignado (`advisor_id`) Y ese
 * asesor tiene Telegram vinculado → le avisa SOLO a él (maneja lo suyo, sin
 * ruido al resto). Sin asesor / asesor sin Telegram → broadcast a los admins del
 * tenant (no perder el aviso). SIEMPRE con service_role. Best-effort: loguea
 * pero NUNCA tira — un fallo del aviso no debe romper la creación de la solicitud.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchTelegramAlert } from "@/lib/studio/telegram/alert-routing";
import { sendTelegramToUser } from "@/lib/studio/notify/send-user-telegram";
import { sendPushToUserDevices } from "@/lib/studio/notify/send-user-push";
import type { ChangeRequestDiffRow } from "@/lib/portal/change-request-types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export async function notifyChangeRequestToAdmin(
  supabaseAdmin: SupabaseClient,
  args: {
    tenantId: string;
    markbox: string;
    clientName: string;
    advisorId: string | null;
    diff: ChangeRequestDiffRow[];
  },
): Promise<void> {
  try {
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

    await routeToAdvisorOrTeam(supabaseAdmin, args, text, "change-request-notify");
  } catch (err) {
    console.error("[change-request-notify] falló:", err);
  }
}

/**
 * Ruteo SDD-0148: al asesor asignado si tiene Telegram; si no, broadcast al
 * equipo del tenant, UNA vez por chat (SDD-0271).
 */
async function routeToAdvisorOrTeam(
  supabaseAdmin: SupabaseClient,
  args: { tenantId: string; advisorId: string | null },
  text: string,
  logTag: string,
): Promise<void> {
  if (args.advisorId) {
    const { data: prof } = await supabaseAdmin
      .from("user_profiles")
      .select("telegram_chat_id")
      .eq("user_id", args.advisorId)
      .maybeSingle<{ telegram_chat_id: string | null }>();
    if (prof?.telegram_chat_id) {
      await sendTelegramToUser(supabaseAdmin, args.advisorId, text);
      return;
    }
  }
  await dispatchTelegramAlert(supabaseAdmin, args.tenantId, "equipo", text, {
    logTag,
  });
}

export type BlockedProfileField = "document" | "phone" | "company_rif" | "personal_doc";

const BLOCKED_FIELD_LABEL: Record<BlockedProfileField, string> = {
  document: "un documento",
  phone: "un teléfono",
  company_rif: "el RIF de una empresa",
  personal_doc: "una cédula para facturar a su nombre",
};

/**
 * SDD-0482 · Aviso interno cuando el Portal bloquea un cambio directo porque
 * el documento o el teléfono ya pertenecen a otra ficha (decisión de Sam:
 * «Bloquear y avisar al asesor»). Lleva los Shipping Marks de las dos fichas,
 * NUNCA el valor intentado: el registro 0462 tampoco lo guarda. Best-effort.
 */
export async function notifyBlockedProfileEditToAdmin(
  supabaseAdmin: SupabaseClient,
  args: {
    tenantId: string;
    markbox: string;
    clientName: string;
    advisorId: string | null;
    /** SDD-0487 suma el RIF de la empresa y la cédula de la identidad secundaria. */
    field: BlockedProfileField;
    conflictingMarkbox: string | null;
  },
): Promise<void> {
  try {
    const what = BLOCKED_FIELD_LABEL[args.field];
    const other = args.conflictingMarkbox
      ? `que ya tiene la ficha ${args.conflictingMarkbox}`
      : "que ya tiene otra ficha";
    const text = [
      `Cambio de datos bloqueado · ${args.markbox}`,
      ``,
      args.clientName,
      `Intentó guardar ${what} ${other}. No se guardó nada.`,
      `Puede ser la misma persona con dos cuentas.`,
      ``,
      `Revisar:`,
      `${SITE_URL}/studio/clientes/${args.markbox}`,
    ].join("\n");
    await routeToAdvisorOrTeam(supabaseAdmin, args, text, "profile-edit-blocked");
  } catch (err) {
    console.error("[profile-edit-blocked-notify] falló:", err);
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
