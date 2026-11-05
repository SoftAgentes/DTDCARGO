/**
 * Avisos POR PERSONA · SDD-0606.
 *
 * En Telegram un aviso por persona era un mensaje al chat privado enlazado en
 * su perfil. En Discord no hay chat privado: se escribe en el canal de la
 * categoría MENCIONANDO a la persona, y sólo si enlazó su ID de Discord en el
 * perfil. Enlazar el ID es lo que enciende las menciones; sin ID no hay
 * mención y tampoco se escribe en el canal un aviso que era para una sola
 * persona.
 *
 * Mientras exista el token de Telegram en el servidor, quien no enlazó Discord
 * sigue recibiendo por Telegram. Al retirar el token, esos avisos quedan sólo
 * en la campana del Studio y el correo, que nunca dependieron de esto.
 *
 * El consentimiento de cada módulo (`channel_telegram`, el interruptor de la
 * bitácora, el del portal) se aplica ANTES de llamar acá, igual que antes: ese
 * interruptor gobierna «avísame por mensajería», sea Telegram o Discord.
 *
 * Best-effort: nunca lanza.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TelegramAlertCategory } from "@/lib/studio/telegram/alert-routing";
import { resolveDiscordTarget } from "@/lib/studio/discord/channels";
import {
  buildDiscordContent,
  type MinimalAlert,
} from "@/lib/studio/discord/minimal-alert";
import { sendDiscordWebhook } from "@/lib/studio/discord/send-webhook";
import { sendTelegramToUser } from "@/lib/studio/notify/send-user-telegram";
import { resolveDiscordUserIds, type AlertPayload } from "./dispatch-alert";

export interface DiscordMentionResult {
  /**
   * false = no correspondía Discord (sin canal para la categoría, o la persona
   * no enlazó su ID): el llamador sigue con su camino anterior.
   */
  attempted: boolean;
  ok: boolean;
  error?: string;
}

/**
 * Escribe el aviso mínimo en el canal de `category` mencionando a `userId`.
 * No cae al respaldo de Telegram: eso lo decide quien llama.
 */
export async function sendDiscordMentionToUser(
  admin: SupabaseClient,
  userId: string,
  category: TelegramAlertCategory,
  aviso: MinimalAlert,
): Promise<DiscordMentionResult> {
  try {
    const target = resolveDiscordTarget(category);
    if (!target) return { attempted: false, ok: false };

    const mentionUserIds = await resolveDiscordUserIds(admin, [userId]);
    if (mentionUserIds.length === 0) return { attempted: false, ok: false };

    const res = await sendDiscordWebhook(
      target.url,
      buildDiscordContent(aviso, { mentionUserIds }),
      { mentionUserIds },
    );
    if (!res.ok) {
      console.error(`[user-alert] mención en ${target.canal} falló:`, res.error);
    }
    return { attempted: true, ok: res.ok, error: res.error };
  } catch (err) {
    console.error("[user-alert] sendDiscordMentionToUser falló:", err);
    return {
      attempted: true,
      ok: false,
      error: err instanceof Error ? err.name : "error",
    };
  }
}

/**
 * Aviso a una persona: mención en Discord si la enlazó; si no, o si Discord
 * no entrega, su Telegram enlazado (mientras exista). Devuelve si se entregó.
 */
export async function sendAlertToUser(
  admin: SupabaseClient,
  userId: string,
  category: TelegramAlertCategory,
  payload: AlertPayload,
): Promise<boolean> {
  const discord = await sendDiscordMentionToUser(admin, userId, category, payload.discord);
  if (discord.attempted && discord.ok) return true;
  return sendTelegramToUser(admin, userId, payload.telegramText);
}
