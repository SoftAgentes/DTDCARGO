/**
 * Outbox de push (Sprint 4 v3 · operarios + SDD-0146 Fase 5 · users staff).
 *
 * Responsabilidades:
 *  1. `enqueueOperarioPush` / `enqueueUserPush` · encolan un push (server-side,
 *     desde acciones/crons). Best-effort · no rompen la operación principal.
 *  2. `drainOperarioPushOutbox` · drena los eventos pending de
 *     `outbox_push_events`, los envía via web-push, marca sent_at. Maneja
 *     target_type 'operario' (subs de operario_push_subscriptions) Y 'user'
 *     (subs de user_push_subscriptions + fallback jsonb legacy). Lo llama el
 *     cron `/api/cron/push-drain` Y se dispara inline tras encolar.
 *
 * Patrón: encolar → drain inline best-effort → cron backstop reintenta los que
 * quedaron sent_at=null (durabilidad ante crashes / cold starts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushPayload } from "./send-bug-push";
import { sendPushToOperario } from "./send-operario-push";
import { sendPushToUserDevices } from "./send-user-push";

const MAX_DRAIN_BATCH = 50;
const MAX_ATTEMPTS = 5;

/**
 * Encola un push para un operario en outbox_push_events (via RPC con
 * idempotency por tag). Best-effort · loguea pero no throwea.
 *
 * @returns el id del evento encolado, o null si falló.
 */
export async function enqueueOperarioPush(
  admin: SupabaseClient,
  tenantId: string,
  operarioId: string,
  payload: PushPayload,
): Promise<string | null> {
  try {
    const { data, error } = await admin.rpc("enqueue_operario_push", {
      p_tenant_id: tenantId,
      p_operario_id: operarioId,
      p_payload: {
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/m",
        tag: payload.tag ?? null,
        requireInteraction: payload.requireInteraction ?? false,
      },
    });
    if (error) {
      console.error("[operario-push-outbox] enqueue error:", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    console.error("[operario-push-outbox] enqueue threw:", err);
    return null;
  }
}

/**
 * Encola un push para un user (auth.uid) staff en outbox_push_events (target_type
 * 'user', vía RPC enqueue_user_push con idempotency 60s por tag). Best-effort ·
 * loguea pero no throwea. SDD-0146 Fase 5 (Bitácora: asignaciones + digest).
 *
 * @returns el id del evento encolado, o null si falló.
 */
export async function enqueueUserPush(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  payload: PushPayload,
): Promise<string | null> {
  try {
    const { data, error } = await admin.rpc("enqueue_user_push", {
      p_tenant_id: tenantId,
      p_user_id: userId,
      p_payload: {
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/studio",
        tag: payload.tag ?? null,
        requireInteraction: payload.requireInteraction ?? false,
      },
    });
    if (error) {
      console.error("[operario-push-outbox] enqueue_user error:", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    console.error("[operario-push-outbox] enqueue_user threw:", err);
    return null;
  }
}

/**
 * Drena los eventos pending del outbox y los envía. Procesa hasta
 * MAX_DRAIN_BATCH por corrida. Eventos que superan MAX_ATTEMPTS quedan
 * abandonados (sent_at sigue null pero el cron los salta por attempts).
 *
 * @returns resumen { processed, delivered, failed }.
 */
export async function drainOperarioPushOutbox(
  admin: SupabaseClient,
): Promise<{ processed: number; delivered: number; failed: number }> {
  const { data: events, error } = await admin
    .from("outbox_push_events")
    .select("id, target_type, target_id, payload, attempts")
    .is("sent_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(MAX_DRAIN_BATCH);

  if (error || !events || events.length === 0) {
    return { processed: 0, delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;

  for (const ev of events as Array<{
    id: string;
    target_type: string;
    target_id: string;
    payload: PushPayload;
    attempts: number;
  }>) {
    if (ev.target_type === "operario") {
      const count = await sendPushToOperario(admin, ev.target_id, ev.payload);
      if (count > 0) {
        await admin.rpc("mark_push_sent", { p_event_id: ev.id });
        delivered += 1;
      } else {
        // 0 entregas: o no hay subscription (marcar sent · no reintentar
        // eternamente algo sin destino) o falló transitorio (bump attempts).
        const { count: subCount } = await admin
          .from("operario_push_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("operario_id", ev.target_id);
        if (!subCount || subCount === 0) {
          await admin.rpc("mark_push_sent", { p_event_id: ev.id });
        } else {
          await admin.rpc("bump_push_attempt", { p_event_id: ev.id });
          failed += 1;
        }
      }
    } else if (ev.target_type === "user") {
      // SDD-0146 Fase 5: push a un user staff (todos sus dispositivos + fallback
      // jsonb legacy). sendPushToUserDevices ya borra las subs muertas (410/404).
      const count = await sendPushToUserDevices(admin, ev.target_id, ev.payload);
      if (count > 0) {
        await admin.rpc("mark_push_sent", { p_event_id: ev.id });
        delivered += 1;
      } else {
        // 0 entregas: si el user no tiene NINGUNA sub (ni tabla ni jsonb legacy),
        // marcar sent (sin destino → no reintentar 5 veces). Si aún tiene sub,
        // fue transitorio → bump attempts.
        const hasSub = await userHasAnySubscription(admin, ev.target_id);
        if (!hasSub) {
          await admin.rpc("mark_push_sent", { p_event_id: ev.id });
        } else {
          await admin.rpc("bump_push_attempt", { p_event_id: ev.id });
          failed += 1;
        }
      }
    } else {
      // Target desconocido: mark_sent con log (NUNCA bump en loop — el bump
      // viejo quemaba los 5 attempts en cada corrida del cron del minuto).
      console.warn(
        `[operario-push-outbox] target_type desconocido "${ev.target_type}" (evento ${ev.id}) → mark_sent`,
      );
      await admin.rpc("mark_push_sent", { p_event_id: ev.id });
    }
  }

  return { processed: events.length, delivered, failed };
}

/**
 * ¿El user tiene ALGÚN destino de push? (fila en user_push_subscriptions O el
 * jsonb legacy con channel_push ON). Decide si un evento 'user' con 0 entregas
 * se marca sent (sin destino) o se reintenta (transitorio). Fail-open a `true`
 * si la lectura falla (mejor reintentar que perder el push).
 */
async function userHasAnySubscription(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { count } = await admin
      .from("user_push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (count && count > 0) return true;

    const { data: prefs } = await admin
      .from("user_notification_prefs")
      .select("channel_push, push_subscription")
      .eq("user_id", userId)
      .maybeSingle<{
        channel_push: boolean;
        push_subscription: Record<string, unknown> | null;
      }>();
    return !!(prefs?.channel_push && prefs.push_subscription);
  } catch (err) {
    console.error("[operario-push-outbox] userHasAnySubscription threw:", err);
    return true; // fail-open: no perder el push por una lectura fallida.
  }
}
