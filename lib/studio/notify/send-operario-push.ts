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
 * ⚠️ SOLO 410/404 BORRA. Antes, 3 fallos TRANSITORIOS acumulados (red caída,
 * 500 del push service, timeout) también borraban la subscription, y el
 * operario dejaba de recibir avisos para siempre sin que nadie lo supiera: para
 * volver tenía que desinstalar y reinstalar la PWA. Un corte de red de la
 * oficina de Yiwu podía dejar sordo a todo el turno. `failure_count` se sigue
 * llevando —sirve para diagnosticar— pero ya no mata.
 *
 * La contra aceptada: una subscription rota que NUNCA devuelve 410 se queda en
 * la tabla acumulando fallos. Es barato (una fila y un POST fallido por aviso) y
 * es el lado correcto en el que equivocarse: perder un aviso es peor que
 * conservar una fila muerta.
 *
 * Llamado desde el worker drain (/api/cron/push-drain) que consume
 * outbox_push_events. NO se llama inline en hot paths · siempre vía outbox
 * para durabilidad + retry.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createComponentLogger,
  type StructuredLogger,
} from "@/lib/observability/structured-logger";
import { ensureVapid, webpush } from "./vapid";
import type { PushPayload } from "./send-bug-push";
import { parsePushSubscription, PUSH_SOCKET_TIMEOUT_MS } from "./push-subscription";

type OperarioSubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

/**
 * Envía push a todas las subscriptions activas del operario.
 *
 * @returns número de subscriptions a las que se entregó OK.
 */
export async function sendPushToOperario(
  admin: SupabaseClient,
  operarioId: string,
  payload: PushPayload,
  logger: StructuredLogger = createComponentLogger(
    "internal.send-operario-push",
  ),
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
  const okIds: string[] = [];

  await Promise.all(
    (subs as OperarioSubRow[]).map(async (s) => {
      const sub = parsePushSubscription({
        endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth },
      });
      if (!sub) {
        logger.warn("push.subscription_invalid", { skipped: 1, stage: "parse" });
        return;
      }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          data,
          { TTL: 60 * 60 * 12, timeout: PUSH_SOCKET_TIMEOUT_MS }, // 12h; timeout de socket
        );
        delivered += 1;
        okIds.push(s.id);
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription muerta de verdad (el push service dice que ya no
          // existe) · única causa de borrado.
          deadIds.push(s.id);
        } else {
          // Fallo TRANSITORIO: contamos y seguimos. NO se borra — ver la nota
          // del encabezado. El operario tiene que poder recibir el próximo
          // aviso aunque la red se haya caído tres veces.
          bumpIds.push(s.id);
          logger.error("push.delivery_failed", {
            error: err,
            failed: 1,
            stage: "delivery",
            status: typeof statusCode === "number" ? statusCode : 0,
          });
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
  if (okIds.length > 0) {
    await admin
      .from("operario_push_subscriptions")
      .update({ last_used_at: new Date().toISOString(), failure_count: 0 } as never)
      .in("id", okIds);
  }

  return delivered;
}
