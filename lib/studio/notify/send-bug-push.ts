/**
 * Bug push notification helper (SDD-0036 Fase 5).
 *
 * Wrapper de web-push para enviar Web Push notifications al
 * user_notification_prefs.push_subscription de un user dado.
 *
 * Best-effort: errores se loguean a console.error pero NO se propagan
 * (consistente con bug-email-notify). Si Resend / Web Push fallan, la
 * operación principal del bug NO se rompe.
 *
 * VAPID keys en env vars:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY (client + server)
 *   - VAPID_PRIVATE_KEY (server only)
 *   - VAPID_SUBJECT (mailto: del admin de contacto)
 *
 * Si las env vars no están seteadas (dev local), el helper hace no-op
 * con un warning.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

interface PushSubscriptionStored {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // a dónde llevar al hacer click
  tag?: string; // dedup tag (mismas tag se reemplazan)
  requireInteraction?: boolean;
}

let vapidConfigured = false;
let vapidWarned = false;

function configureVapidOnce(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:vzla@dtdcargo.com";

  if (!publicKey || !privateKey) {
    if (!vapidWarned) {
      console.warn(
        "[send-bug-push] VAPID keys no configuradas en env. Push notifications quedan en no-op.",
      );
      vapidWarned = true;
    }
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * Manda push notification a un user específico. Best-effort.
 *
 * @param supabaseAdmin · cliente con service_role (queries
 *   user_notification_prefs bypassa RLS para resolver subscription).
 * @returns `true` si se envió, `false` si skip (no subscription, no
 *   prefs, opt-out, etc) o falló.
 */
export async function sendBugPushToUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<boolean> {
  if (!configureVapidOnce()) return false;

  try {
    const { data: prefs } = await supabaseAdmin
      .from("user_notification_prefs")
      .select("channel_push, push_subscription")
      .eq("user_id", userId)
      .maybeSingle<{
        channel_push: boolean;
        push_subscription: PushSubscriptionStored | null;
      }>();

    if (!prefs?.channel_push || !prefs.push_subscription) {
      // El user no opted-in para push, skip silencioso
      return false;
    }

    const subscription = prefs.push_subscription;
    const data = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag,
      requireInteraction: payload.requireInteraction,
      data: { url: payload.url ?? "/studio" },
    });

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      data,
      { TTL: 60 * 60 * 24 }, // 24h
    );

    return true;
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    // 410 Gone = endpoint dead → unsubscribe automático
    if (statusCode === 410 || statusCode === 404) {
      await supabaseAdmin
        .from("user_notification_prefs")
        .update({ push_subscription: null, channel_push: false })
        .eq("user_id", userId);
      console.warn(
        `[send-bug-push] subscription ${statusCode} para user ${userId}, auto-unsubscribed.`,
      );
      return false;
    }
    console.error(`[send-bug-push] sendNotification failed (user ${userId}):`, err);
    return false;
  }
}
