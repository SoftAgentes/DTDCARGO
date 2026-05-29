/**
 * Outbox de push para operarios (Sprint 4 v3).
 *
 * Dos responsabilidades:
 *  1. `enqueueOperarioPush` · encola un push (server-side, desde acciones
 *     del despacho/recepción). Best-effort · no rompe la operación
 *     principal si falla.
 *  2. `drainOperarioPushOutbox` · drena los eventos pending de
 *     `outbox_push_events`, los envía via web-push, marca sent_at.
 *     Lo llama el cron `/api/cron/push-drain` Y se dispara inline tras
 *     encolar (push casi-instantáneo sin esperar al cron).
 *
 * Patrón: encolar → drain inline best-effort → cron backstop reintenta
 * los que quedaron sent_at=null (durabilidad ante crashes / cold starts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushPayload } from "./send-bug-push";
import { sendPushToOperario } from "./send-operario-push";

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
    // V1: solo operario. target_type='user' usa el path de bugs (SDD-0036)
    // y no se encola acá todavía.
    if (ev.target_type !== "operario") {
      // Marcar sent para no reprocesar un target_type que no manejamos
      await admin.rpc("bump_push_attempt", { p_event_id: ev.id });
      continue;
    }

    const count = await sendPushToOperario(admin, ev.target_id, ev.payload);
    if (count > 0) {
      await admin.rpc("mark_push_sent", { p_event_id: ev.id });
      delivered += 1;
    } else {
      // 0 entregas: o no hay subscription (marcar sent · no reintentar
      // eternamente algo sin destino) o falló transitorio (bump attempts).
      // Distinguir: si el operario no tiene subscriptions, marcar sent.
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
  }

  return { processed: events.length, delivered, failed };
}
