/**
 * Outbox durable de `bug_notifications` · SDD-0036 Fase 5 P3.
 *
 * Los 3 notify* de bug-email-notify.ts disparan email/telegram INLINE al
 * ocurrir el evento (respuesta rápida — la mayoría de los envíos sale bien a
 * la primera). Cuando un envío falla (Resend caído, rate-limit, Bot API con
 * hiccup), este módulo es el backstop: el fallo queda marcado en la fila
 * (`<canal>_attempts` + `<canal>_last_error`, migración 0232) y el cron
 * `/api/cron/bug-notifications-drain` la reintenta hasta MAX_BUG_NOTIF_ATTEMPTS
 * veces. Antes de esto un fallo transitorio perdía la notificación para
 * siempre (dispatch inline sin ningún backstop).
 *
 * Push NO vive acá: ya tenía su propio outbox durable
 * (./operario-push-outbox.ts + cron push-drain, cada minuto, 5 intentos) que
 * bug-email-notify.ts simplemente no usaba — el fix ahí es de código
 * (enqueueUserPush en vez de sendBugPushToUser directo), sin columnas nuevas.
 *
 * Reconstrucción del mensaje en el drain: el payload guardado en la fila
 * (`label` / `excerpt` / `url` / `actionLabel`) alcanza para el cuerpo; el bug
 * (folio/título/estado/severidad) se RE-lee fresco por bug_id — más correcto
 * que cachear un snapshot viejo (si el bug ya se resolvió entre el fallo y el
 * reintento, el email de reintento refleja el estado actual).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { sendTelegramMessage } from "@/lib/studio/telegram/send-message";
import { sendDiscordMentionToUser } from "@/lib/studio/alerts/user-alert";
import { getBugDetail } from "@/lib/studio/bug-queries";
import {
  BUG_STATE_LABELS,
  BUG_SEVERITY_LABELS,
} from "@/lib/studio/bug-types";
import { resolveUserEmail, resolveUserDisplayName } from "./resolve-recipient";

export const MAX_BUG_NOTIF_ATTEMPTS = 5;
const DRAIN_BATCH = 50;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type OutboxChannel = "email" | "telegram";

interface RetryPayload {
  label?: string;
  excerpt?: string;
  url?: string;
  actionLabel?: string;
}

/** Trunca el error antes de guardarlo (evita blobs gigantes en la fila). */
function errMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 500);
}

/** Marca un fallo de canal en la fila del outbox (best-effort, no throwea). */
export async function recordBugNotifChannelFailure(
  admin: SupabaseClient,
  notifId: string,
  channel: OutboxChannel,
  attemptsSoFar: number,
  error: unknown,
): Promise<void> {
  try {
    await admin
      .from("bug_notifications")
      .update({
        [`${channel}_attempts`]: attemptsSoFar + 1,
        [`${channel}_last_error`]: errMessage(error),
      })
      .eq("id", notifId);
  } catch (err) {
    console.error("[bug-notif-outbox] recordChannelFailure threw:", err);
  }
}

/** Marca un canal como entregado y limpia el error previo (best-effort). */
async function recordBugNotifChannelSuccess(
  admin: SupabaseClient,
  notifId: string,
  channel: OutboxChannel,
): Promise<void> {
  try {
    await admin
      .from("bug_notifications")
      .update({
        [`delivered_${channel}_at`]: new Date().toISOString(),
        [`${channel}_last_error`]: null,
      })
      .eq("id", notifId);
  } catch (err) {
    console.error("[bug-notif-outbox] recordChannelSuccess threw:", err);
  }
}

/** Reintenta las filas con email pendiente (ya falló ≥1 vez, < MAX intentos). */
async function drainEmailOutbox(
  admin: SupabaseClient,
): Promise<{ processed: number; delivered: number; failed: number }> {
  const { data, error } = await admin
    .from("bug_notifications")
    .select("id, user_id, bug_id, payload, email_attempts")
    .is("delivered_email_at", null)
    .gt("email_attempts", 0)
    .lt("email_attempts", MAX_BUG_NOTIF_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(DRAIN_BATCH);

  if (error || !data || data.length === 0) {
    return { processed: 0, delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;

  for (const row of data as Array<{
    id: string;
    user_id: string;
    bug_id: string | null;
    payload: RetryPayload;
    email_attempts: number;
  }>) {
    if (!row.bug_id) {
      // Sin bug asociado (no debería pasar para email de bugs): no hay cómo
      // reconstruir el mensaje. Abandona sin seguir reintentando.
      await recordBugNotifChannelFailure(
        admin,
        row.id,
        "email",
        MAX_BUG_NOTIF_ATTEMPTS,
        "sin bug_id — no reconstruible",
      );
      failed += 1;
      continue;
    }

    const bug = await getBugDetail(admin, row.bug_id);
    if (!bug) {
      await recordBugNotifChannelFailure(
        admin,
        row.id,
        "email",
        MAX_BUG_NOTIF_ATTEMPTS,
        "el bug ya no existe",
      );
      failed += 1;
      continue;
    }

    const email = await resolveUserEmail(admin, row.user_id);
    if (!email) {
      await recordBugNotifChannelFailure(
        admin,
        row.id,
        "email",
        MAX_BUG_NOTIF_ATTEMPTS,
        "el destinatario no tiene email",
      );
      failed += 1;
      continue;
    }
    const recipientName = await resolveUserDisplayName(admin, row.user_id);
    const payload = row.payload ?? {};

    const result = await sendEmail(admin, bug.tenant_id, {
      templateSlug: "bug_notification",
      to: email,
      vars: {
        bug_folio: bug.folio,
        bug_title: bug.title,
        bug_state: BUG_STATE_LABELS[bug.state] ?? bug.state,
        bug_severity: bug.severity
          ? BUG_SEVERITY_LABELS[bug.severity] ?? bug.severity
          : "—",
        notif_type_label: payload.label ?? "Actualización de tu reporte",
        reporter_name: recipientName,
        message_excerpt: payload.excerpt ?? "",
        bug_url: `${SITE_URL}${payload.url ?? "/studio/bugs"}`,
        action_label: payload.actionLabel ?? "Ver bug",
      },
      metadata: {
        source: "bug-notif-outbox-drain",
        bug_id: bug.id,
        bug_folio: bug.folio,
      },
    });

    if (result.ok) {
      await recordBugNotifChannelSuccess(admin, row.id, "email");
      delivered += 1;
    } else {
      await recordBugNotifChannelFailure(
        admin,
        row.id,
        "email",
        row.email_attempts,
        result.error,
      );
      failed += 1;
    }
  }

  return { processed: data.length, delivered, failed };
}

/** Tenant activo de un usuario, para las filas sin bug. `null` si no se sabe. */
async function tenantOfUser(admin: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await admin
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", userId)
      .is("disabled_at", null)
      .limit(1)
      .maybeSingle<{ tenant_id: string | null }>();
    return data?.tenant_id ?? null;
  } catch {
    return null;
  }
}

/** Reintenta las filas con Telegram pendiente (ya falló ≥1 vez, < MAX intentos). */
async function drainTelegramOutbox(
  admin: SupabaseClient,
): Promise<{ processed: number; delivered: number; failed: number }> {
  const { data, error } = await admin
    .from("bug_notifications")
    .select("id, user_id, bug_id, payload, telegram_attempts")
    .is("delivered_telegram_at", null)
    .gt("telegram_attempts", 0)
    .lt("telegram_attempts", MAX_BUG_NOTIF_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(DRAIN_BATCH);

  if (error || !data || data.length === 0) {
    return { processed: 0, delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;

  for (const row of data as Array<{
    id: string;
    user_id: string;
    bug_id: string | null;
    payload: RetryPayload;
    telegram_attempts: number;
  }>) {
    // SDD-0606 · el reintento prueba primero la mención en Discord. La columna
    // se sigue llamando `telegram`: es el canal de mensajería de la fila.
    const bugParaDiscord = row.bug_id ? await getBugDetail(admin, row.bug_id) : null;
    const tenantId = bugParaDiscord?.tenant_id ?? (await tenantOfUser(admin, row.user_id));
    const mencion = tenantId
      ? await sendDiscordMentionToUser(admin, tenantId, row.user_id, "bugs", {
          titulo: "Aviso pendiente de un reporte",
          codigo: bugParaDiscord?.folio ?? null,
          url: `${SITE_URL}${row.payload?.url ?? "/studio/bugs"}`,
        })
      : { attempted: false, ok: false };
    // Confirmada, o incierta (pudo guardarse: no se repite, M2).
    if (mencion.attempted && (mencion.ok || mencion.outcome === "incierto")) {
      await recordBugNotifChannelSuccess(admin, row.id, "telegram");
      delivered += 1;
      continue;
    }

    const { data: profile } = await admin
      .from("user_profiles")
      .select("telegram_chat_id")
      .eq("user_id", row.user_id)
      .maybeSingle<{ telegram_chat_id: string | null }>();
    const chatId = profile?.telegram_chat_id;
    if (!chatId && mencion.attempted) {
      // A4 · Discord aplica a esta persona y no guardó la mención (caída,
      // 429, 5xx): la fila sigue viva para el próximo tick, aunque no tenga
      // Telegram. Abandonar acá perdía el aviso por una falla pasajera.
      await recordBugNotifChannelFailure(
        admin,
        row.id,
        "telegram",
        row.telegram_attempts,
        mencion.error ?? "Discord no guardó la mención",
      );
      failed += 1;
      continue;
    }
    if (!chatId) {
      // Sin Discord para esta persona y sin Telegram: no hay por dónde mandarlo.
      await recordBugNotifChannelFailure(
        admin,
        row.id,
        "telegram",
        MAX_BUG_NOTIF_ATTEMPTS,
        "sin telegram_chat_id",
      );
      failed += 1;
      continue;
    }

    const bug = bugParaDiscord;
    const payload = row.payload ?? {};
    const title = [payload.label, bug?.folio].filter(Boolean).join(" · ");
    const text = `${title}\n\n${payload.excerpt ?? ""}\n\n${SITE_URL}${payload.url ?? "/studio/bugs"}`;

    const result = await sendTelegramMessage(chatId, text);
    if (result.ok) {
      await recordBugNotifChannelSuccess(admin, row.id, "telegram");
      delivered += 1;
    } else {
      await recordBugNotifChannelFailure(
        admin,
        row.id,
        "telegram",
        row.telegram_attempts,
        result.error,
      );
      failed += 1;
    }
  }

  return { processed: data.length, delivered, failed };
}

/** Drena email + Telegram pendientes. Lo llama el cron cada 5 min. */
export async function drainBugNotificationOutbox(admin: SupabaseClient): Promise<{
  email: { processed: number; delivered: number; failed: number };
  telegram: { processed: number; delivered: number; failed: number };
}> {
  const email = await drainEmailOutbox(admin);
  const telegram = await drainTelegramOutbox(admin);
  return { email, telegram };
}
