/**
 * Push al CLIENTE cuando el equipo responde en Conversaciones (SDD-0148 #3b).
 *
 * El cliente del portal ES un `auth.users` (entra por magic-link), así que su push
 * vive en la MISMA tabla `user_push_subscriptions` (RLS self) que el staff → se
 * reusa `sendPushToUserDevices` sin nada nuevo. Resolvemos los auth uid del cliente
 * por `client_users` (status='active') y le mandamos a todos sus dispositivos.
 *
 * El click de la notificación abre `/portal/soporte` (la URL viaja en el payload;
 * el SW raíz `public/sw.js` la lee de `data.url`). Best-effort: si no tiene push
 * activado o falla, no pasa nada (el badge del nav + el realtime ya avisan igual;
 * NO se manda email — decisión founder 2026-07-05). SIEMPRE con service_role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUserDevices } from "@/lib/studio/notify/send-user-push";

function preview(body: string, max = 120): string {
  const one = body.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/**
 * Manda push a los dispositivos del cliente (todos sus auth users activos) con la
 * respuesta del asesor. Best-effort, nunca tira.
 */
export async function notifyClientReplyPush(
  admin: SupabaseClient,
  args: { clientId: string; body: string },
): Promise<void> {
  try {
    const { data: users } = await admin
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

    const payload = {
      title: "DTD Cargo · tu asesor respondió",
      body: preview(args.body),
      tag: `portal-reply-${args.clientId}`,
      url: "/portal/soporte",
    };

    for (const id of ids) {
      await sendPushToUserDevices(admin, id, payload);
    }
  } catch (err) {
    console.error("[conversation-reply-push] notifyClientReplyPush falló:", err);
  }
}
