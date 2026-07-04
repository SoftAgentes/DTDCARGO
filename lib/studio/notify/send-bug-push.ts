/**
 * Bug push notification helper (SDD-0036 Fase 5, multi-dispositivo desde SDD-0146).
 *
 * Wrapper de web-push para el push de bugs a un user. Desde la Fase 5 de Bitácora
 * delega en `sendPushToUserDevices`, que envía a TODAS las subscriptions del user
 * (`user_push_subscriptions`, 0215) con **fallback de lectura** al jsonb legacy
 * `user_notification_prefs.push_subscription` gateado por `channel_push` — así un
 * user que solo tiene el jsonb legacy (sin filas en la tabla) recibe el push de
 * bug EXACTAMENTE igual que antes (sin regresión), y uno migrado gana multi-device.
 *
 * El gate de consentimiento (channel_push + notify_on_*) lo aplica upstream
 * `bug-email-notify.ts` (computeChannelDecision) ANTES de llamar acá — este
 * wrapper ya no re-chequea channel_push salvo en el fallback legacy (donde el
 * flag ES el único indicador de si la sub sigue vigente).
 *
 * Best-effort: errores se loguean pero NO se propagan. Sin VAPID (dev) → no-op.
 *
 * @returns `true` si se entregó a ≥1 dispositivo, `false` si no (sin subscription,
 *   opt-out, o falló).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUserDevices } from "./send-user-push";

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // a dónde llevar al hacer click
  tag?: string; // dedup tag (mismas tag se reemplazan)
  requireInteraction?: boolean;
}

/**
 * Manda push notification a un user específico (todos sus dispositivos). Best-effort.
 *
 * @param supabaseAdmin · cliente con service_role (lee subs + limpia muertas).
 */
export async function sendBugPushToUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<boolean> {
  const delivered = await sendPushToUserDevices(supabaseAdmin, userId, payload);
  return delivered > 0;
}
