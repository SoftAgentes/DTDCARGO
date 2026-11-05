/**
 * Avisos POR PERSONA · SDD-0606.
 *
 * En Telegram un aviso por persona era un mensaje al chat privado enlazado en
 * su perfil. En Discord no hay chat privado: se escribe en el canal de la
 * categoría MENCIONANDO a la persona, y sólo si enlazó su ID de Discord en el
 * perfil. Sin ID no hay mención y tampoco se escribe en el canal un aviso que
 * era para una sola persona.
 *
 * Sólo para el tenant dueño de los canales (`DISCORD_TENANT_ID`, A5).
 *
 * Mientras exista el token de Telegram en el servidor, quien no enlazó Discord
 * sigue recibiendo por Telegram. Una mención INCIERTA (pudo guardarse) no se
 * repite por Telegram (M2).
 *
 * El consentimiento de cada módulo (`channel_telegram`, el interruptor de la
 * bitácora, el del portal) se aplica ANTES de llamar acá, igual que antes.
 *
 * Best-effort: nunca lanza.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TelegramAlertCategory } from "@/lib/studio/telegram/alert-routing";
import { resolveDiscordTarget } from "@/lib/studio/discord/channels";
import type { MinimalAlert } from "@/lib/studio/discord/minimal-alert";
import { sendTelegramToUser } from "@/lib/studio/notify/send-user-telegram";
import { resolveDiscordUserIds, type AlertPayload } from "./dispatch-alert";
import { deliverDiscordAlert, type DiscordDeliveryOutcome } from "./discord-delivery";

export interface DiscordMentionResult {
  /**
   * false = no correspondía Discord (sin canal, otro tenant, o la persona no
   * enlazó su ID): el llamador sigue con su camino anterior.
   */
  attempted: boolean;
  /** true sólo si Discord confirmó el mensaje guardado. */
  ok: boolean;
  outcome?: DiscordDeliveryOutcome;
  error?: string;
}

/**
 * Escribe el aviso mínimo en el canal de `category` mencionando a `userId`
 * (con el canal de respaldo si el propio no lo guarda). No cae a Telegram ni a
 * la cola: eso lo decide quien llama.
 */
export async function sendDiscordMentionToUser(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  category: TelegramAlertCategory,
  aviso: MinimalAlert,
): Promise<DiscordMentionResult> {
  try {
    if (!resolveDiscordTarget(category, tenantId)) return { attempted: false, ok: false };

    const mentionUserIds = await resolveDiscordUserIds(admin, [userId]);
    if (mentionUserIds.length === 0) return { attempted: false, ok: false };

    const entrega = await deliverDiscordAlert(
      tenantId,
      category,
      aviso,
      mentionUserIds,
      `mencion:${category}`,
    );
    if (!entrega.configured) return { attempted: false, ok: false };
    return {
      attempted: true,
      ok: entrega.outcome === "entregado",
      outcome: entrega.outcome,
      error: entrega.error,
    };
  } catch (err) {
    console.error("[user-alert] sendDiscordMentionToUser falló:", err);
    return {
      attempted: true,
      ok: false,
      outcome: "no-entregado",
      error: err instanceof Error ? err.name : "error",
    };
  }
}

/**
 * Aviso a una persona: mención en Discord si la enlazó; si no, o si Discord no
 * lo guardó, su Telegram enlazado (mientras exista). Devuelve si se entregó o
 * quedó incierto (en ese caso no se repite).
 */
export async function sendAlertToUser(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  category: TelegramAlertCategory,
  payload: AlertPayload,
): Promise<boolean> {
  const discord = await sendDiscordMentionToUser(
    admin,
    tenantId,
    userId,
    category,
    payload.discord,
  );
  if (discord.attempted && (discord.ok || discord.outcome === "incierto")) return true;
  return sendTelegramToUser(admin, userId, payload.telegramText);
}
