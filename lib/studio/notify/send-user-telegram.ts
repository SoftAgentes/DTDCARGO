/**
 * sendTelegramToUser — Telegram best-effort a un user staff (SDD-0146).
 *
 * Genérico (no bug-flavored): resuelve el chat_id de user_profiles.telegram_chat_id
 * (donde lo escribe el flujo de link SDD-0036) y manda texto plano. El gate de
 * CONSENTIMIENTO (`channel_telegram`, default OFF) se aplica UPSTREAM en la
 * máscara de canales — acá solo se hace skip silencioso si no linkeó o si
 * TELEGRAM_BOT_TOKEN no está configurado.
 *
 * SIEMPRE con service_role (lee el perfil de cualquier user). Best-effort: registra
 * pero nunca throwea.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createComponentLogger,
  type StructuredLogger,
} from "@/lib/observability/structured-logger";
import { sendTelegramMessage } from "@/lib/studio/telegram/send-message";

export async function sendTelegramToUser(
  admin: SupabaseClient,
  userId: string,
  text: string,
  logger: StructuredLogger = createComponentLogger("internal.send-user-telegram"),
): Promise<boolean> {
  try {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("telegram_chat_id")
      .eq("user_id", userId)
      .maybeSingle<{ telegram_chat_id: string | null }>();

    const chatId = profile?.telegram_chat_id;
    if (!chatId) return false;

    const result = await sendTelegramMessage(chatId, text);
    if (!result.ok) {
      logger.error("notification.telegram_delivery_failed", {
        error: result.error,
        failed: 1,
        stage: "send",
      });
      return false;
    }
    return true;
  } catch (err) {
    logger.error("notification.telegram_delivery_failed", {
      error: err,
      failed: 1,
      stage: "dispatch",
    });
    return false;
  }
}
