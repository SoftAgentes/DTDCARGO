/**
 * sendPushToUserDevices — Web Push a TODOS los dispositivos de un user (SDD-0146).
 *
 * Fuente de verdad = `user_push_subscriptions` (N filas por user, 0215). Si esa
 * tabla está vacía para el user, cae al **fallback de lectura** del jsonb legacy
 * `user_notification_prefs.push_subscription` (SDD-0036, mono-dispositivo) —
 * gateado por `channel_push` para preservar EXACTO el comportamiento viejo de
 * `sendBugPushToUser` (un user con solo el jsonb legacy sigue recibiendo push
 * igual que hoy; si desactivó push, channel_push=false → no manda).
 *
 * Limpieza: una subscription que devuelve 410/404 está muerta → se borra (fila de
 * la tabla, o el jsonb legacy + channel_push=false si fue por fallback). En éxito
 * se estampa last_used_at (solo filas de la tabla). Best-effort · nunca throwea.
 *
 * SIEMPRE con service_role (lee subs de cualquier user + limpia muertas).
 * @returns número de dispositivos a los que se entregó OK.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureVapid, webpush } from "./vapid";
import type { PushPayload } from "./send-bug-push";

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

/** Una subscription a enviar + de dónde salió (para limpiar la muerta). */
type Target =
  | { source: "table"; rowId: string; sub: StoredSubscription }
  | { source: "legacy"; sub: StoredSubscription };

async function loadTargets(
  admin: SupabaseClient,
  userId: string,
): Promise<Target[]> {
  const { data: rows } = await admin
    .from("user_push_subscriptions")
    .select("id, subscription")
    .eq("user_id", userId);

  const table = (rows ?? [])
    .map((r) => {
      const sub = (r as { subscription: StoredSubscription | null }).subscription;
      if (!sub || typeof sub.endpoint !== "string" || !sub.keys?.p256dh || !sub.keys?.auth) {
        return null;
      }
      return {
        source: "table" as const,
        rowId: (r as { id: string }).id,
        sub,
      };
    })
    .filter((t): t is Extract<Target, { source: "table" }> => t !== null);

  if (table.length > 0) return table;

  // Fallback de lectura: el jsonb legacy (gateado por channel_push, como el
  // viejo sendBugPushToUser). Solo cuando la tabla no tiene NINGUNA fila.
  const { data: prefs } = await admin
    .from("user_notification_prefs")
    .select("channel_push, push_subscription")
    .eq("user_id", userId)
    .maybeSingle<{
      channel_push: boolean;
      push_subscription: StoredSubscription | null;
    }>();

  if (
    prefs?.channel_push &&
    prefs.push_subscription &&
    typeof prefs.push_subscription.endpoint === "string" &&
    prefs.push_subscription.keys?.p256dh &&
    prefs.push_subscription.keys?.auth
  ) {
    return [{ source: "legacy", sub: prefs.push_subscription }];
  }

  return [];
}

export async function sendPushToUserDevices(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensureVapid()) return 0;

  const targets = await loadTargets(admin, userId);
  if (targets.length === 0) return 0;

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    requireInteraction: payload.requireInteraction,
    data: { url: payload.url ?? "/studio" },
  });

  let delivered = 0;
  const deadRowIds: string[] = [];
  const okRowIds: string[] = [];
  let legacyDead = false;

  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.sub.endpoint, keys: t.sub.keys },
          data,
          { TTL: 60 * 60 * 24 }, // 24h
        );
        delivered += 1;
        if (t.source === "table") okRowIds.push(t.rowId);
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Endpoint muerto (PWA desinstalada / permiso revocado).
          if (t.source === "table") deadRowIds.push(t.rowId);
          else legacyDead = true;
        } else {
          console.error(
            `[send-user-push] sendNotification falló (user ${userId}, status ${statusCode}):`,
            (err as Error)?.message ?? err,
          );
        }
      }
    }),
  );

  // Cleanup post-envío (best-effort).
  if (deadRowIds.length > 0) {
    await admin.from("user_push_subscriptions").delete().in("id", deadRowIds);
  }
  if (legacyDead) {
    // Mismo cleanup que el viejo sendBugPushToUser: limpia el jsonb + apaga push.
    await admin
      .from("user_notification_prefs")
      .update({ push_subscription: null, channel_push: false })
      .eq("user_id", userId);
  }
  if (okRowIds.length > 0) {
    await admin
      .from("user_push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .in("id", okRowIds);
  }

  return delivered;
}
