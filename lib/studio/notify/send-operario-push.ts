/**
 * Operario push helper (Sprint 4 v3).
 *
 * Envía Web Push a TODAS las subscriptions de un operario (puede tener
 * varias: teléfono personal + tablet del hub). El operario usa PIN auth
 * (sin auth.uid), así que sus subscriptions viven en
 * `operario_push_subscriptions`, NO en `user_notification_prefs`.
 *
 * Best-effort + auto-cleanup: una subscription que devuelve 410/404 está
 * muerta (el usuario desinstaló la PWA o revocó el permiso) → la borramos.
 *
 * Llamado desde el worker drain (/api/cron/push-drain) que consume
 * outbox_push_events. NO se llama inline en hot paths · siempre vía outbox
 * para durabilidad + retry.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureVapid, webpush } from "./vapid";
import type { PushPayload } from "./send-bug-push";

type OperarioSubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

const MAX_FAILURES_BEFORE_DROP = 3;

/**
 * Envía push a todas las subscriptions activas del operario.
 *
 * @returns número de subscriptions a las que se entregó OK.
 */
export async function sendPushToOperario(
  admin: SupabaseClient,
  operarioId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensureVapid()) return 0;

  const { data: subs, error } = await admin
    .from("operario_push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("operario_id", operarioId);

  if (error || !subs || subs.length === 0) return 0;

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    requireInteraction: payload.requireInteraction,
    data: { url: payload.url ?? "/m" },
  });

  let delivered = 0;
  const deadIds: string[] = [];
  const bumpIds: string[] = [];

  await Promise.all(
    (subs as OperarioSubRow[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
          { TTL: 60 * 60 * 12 }, // 12h · turno del operario
        );
        delivered += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription muerta · borrar
          deadIds.push(s.id);
        } else if (s.failure_count + 1 >= MAX_FAILURES_BEFORE_DROP) {
          // Demasiados fallos transitorios consecutivos · descartar
          deadIds.push(s.id);
        } else {
          bumpIds.push(s.id);
          console.error(
            `[send-operario-push] fallo (op ${operarioId}, status ${statusCode}):`,
            (err as Error)?.message ?? err,
          );
        }
      }
    }),
  );

  // Cleanup post-envío (todo best-effort · no bloquea el resultado)
  if (deadIds.length > 0) {
    await admin.from("operario_push_subscriptions").delete().in("id", deadIds);
  }

  // Bump failure_count de las que fallaron transitoriamente (no hay RPC ·
  // update individual incrementando desde el valor leído).
  await Promise.all(
    (subs as OperarioSubRow[])
      .filter((s) => bumpIds.includes(s.id))
      .map((s) =>
        admin
          .from("operario_push_subscriptions")
          .update({ failure_count: s.failure_count + 1 } as never)
          .eq("id", s.id),
      ),
  );

  // Reset failure_count + last_used_at en las exitosas
  const okIds = (subs as OperarioSubRow[])
    .filter((s) => !deadIds.includes(s.id) && !bumpIds.includes(s.id))
    .map((s) => s.id);
  if (okIds.length > 0) {
    await admin
      .from("operario_push_subscriptions")
      .update({ last_used_at: new Date().toISOString(), failure_count: 0 } as never)
      .in("id", okIds);
  }

  return delivered;
}
