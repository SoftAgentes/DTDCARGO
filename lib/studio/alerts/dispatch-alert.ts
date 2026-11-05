/**
 * Despachador de avisos al equipo, por categoría · SDD-0606.
 *
 * Reemplaza a `dispatchTelegramAlert` (SDD-0271) como puerta de entrada de los
 * módulos de aviso. Conserva sus cinco categorías y su regla central —una
 * categoría sin destino nunca calla— y agrega Discord delante:
 *
 *   1. Canal de Discord de la categoría.
 *   2. Si no tiene dirección, o el envío falla: canal de respaldo de Discord
 *      (`#avisos-equipo`), marcando de qué categoría venía.
 *   3. Si Discord no entregó: el camino de SDD-0271 (rutas de Telegram y, sin
 *      rutas, los administradores). Deja de existir cuando se retire el token
 *      de Telegram del servidor; hasta entonces es la red que evita perder un
 *      aviso durante el corte.
 *
 * Si Discord entrega, Telegram NO se usa: el corte es directo, sin doble envío.
 *
 * ── Privacidad ───────────────────────────────────────────────────────────────
 * Un aviso trae dos textos y no se mezclan nunca:
 *   - `telegramText`: el texto completo de siempre. Sólo va a Telegram.
 *   - `discord`: lo mínimo (título, código y enlace). Es lo único que sale a
 *     Discord. Este módulo no le pasa `telegramText` a ninguna función de
 *     Discord, y hay una prueba que lo mide sobre el pedido HTTP.
 *
 * Best-effort de punta a punta: nunca lanza.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dispatchTelegramAlert,
  TELEGRAM_ALERT_CATEGORY_LABELS,
  type DispatchOptions,
  type TelegramAlertCategory,
} from "@/lib/studio/telegram/alert-routing";
import {
  resolveDiscordFallbackTarget,
  resolveDiscordTarget,
} from "@/lib/studio/discord/channels";
import {
  buildDiscordContent,
  type MinimalAlert,
} from "@/lib/studio/discord/minimal-alert";
import { isDiscordUserId, sendDiscordWebhook } from "@/lib/studio/discord/send-webhook";

export interface AlertPayload {
  /** Texto completo. SÓLO para Telegram; nunca sale a Discord. */
  telegramText: string;
  /** Lo mínimo que sale a Discord. */
  discord: MinimalAlert;
}

export type AlertChannel = "discord" | "telegram" | "ninguno";

export interface AlertDispatchResult {
  /** Por dónde salió el aviso. */
  canal: AlertChannel;
  /** Destinos a los que se intentó entregar (canal de Discord o chats de Telegram). */
  intentados: number;
  sent: number;
  failed: number;
  /** true si no salió por el destino propio de la categoría sino por un respaldo. */
  usedFallback: boolean;
  /** Chats de Telegram usados. Vacío si salió por Discord. */
  chatIds: string[];
}

/**
 * IDs de Discord de un conjunto de usuarios del Studio (los que lo enlazaron
 * en su perfil). Tolerante: si la columna todavía no existe —migración 0514
 * sin aplicar— devuelve `[]` y el aviso sale sin menciones.
 */
export async function resolveDiscordUserIds(
  admin: SupabaseClient,
  userIds: ReadonlyArray<string>,
): Promise<string[]> {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return [];
  try {
    const { data, error } = await admin
      .from("user_profiles")
      .select("discord_user_id")
      .in("user_id", ids)
      .not("discord_user_id", "is", null);
    if (error || !data) return [];
    const out = new Set<string>();
    for (const row of data as Array<{ discord_user_id: string | null }>) {
      const id = row.discord_user_id?.trim();
      if (id && isDiscordUserId(id)) out.add(id);
    }
    return [...out];
  } catch (err) {
    console.error("[dispatch-alert] resolveDiscordUserIds falló:", err);
    return [];
  }
}

/**
 * Intenta la entrega por Discord. `null` = Discord no está configurado para
 * esta categoría. `false` = estaba configurado y no entregó.
 */
async function tryDiscord(
  category: TelegramAlertCategory,
  aviso: MinimalAlert,
  mentionUserIds: string[],
  tag: string,
): Promise<{ delivered: boolean; usedFallback: boolean } | null> {
  const target = resolveDiscordTarget(category);
  if (!target) return null;

  const label = TELEGRAM_ALERT_CATEGORY_LABELS[category];

  const first = await sendDiscordWebhook(
    target.url,
    buildDiscordContent(aviso, {
      mentionUserIds,
      respaldoDe: target.esRespaldo ? label : null,
    }),
    { mentionUserIds },
  );
  if (first.ok) {
    if (target.esRespaldo) {
      console.warn(
        `[dispatch-alert] "${tag}" sin canal propio de Discord — cae a ${target.canal}`,
      );
    }
    return { delivered: true, usedFallback: target.esRespaldo };
  }
  console.error(`[dispatch-alert] "${tag}" falló en ${target.canal}:`, first.error);

  // El canal propio falló (webhook borrado, Discord pidió esperar demasiado…):
  // se prueba el de respaldo, si es otro.
  if (!target.esRespaldo) {
    const fallback = resolveDiscordFallbackTarget();
    if (fallback && fallback.url !== target.url) {
      const second = await sendDiscordWebhook(
        fallback.url,
        buildDiscordContent(aviso, { mentionUserIds, respaldoDe: label }),
        { mentionUserIds },
      );
      if (second.ok) {
        console.warn(
          `[dispatch-alert] "${tag}" entregado por el respaldo ${fallback.canal}`,
        );
        return { delivered: true, usedFallback: true };
      }
      console.error(
        `[dispatch-alert] "${tag}" falló también en ${fallback.canal}:`,
        second.error,
      );
    }
  }
  return { delivered: false, usedFallback: false };
}

/**
 * Sólo la parte de Discord, para los módulos cuyo camino de Telegram no pasa
 * por `dispatchTelegramAlert` (bugs, con su outbox por usuario; tarifas por
 * vencer; solicitudes de cambio). `configured: false` = Discord no aplica y el
 * llamador sigue con su camino de siempre. Nunca lanza.
 */
export async function sendDiscordCategoryAlert(
  admin: SupabaseClient,
  category: TelegramAlertCategory,
  aviso: MinimalAlert,
  opts: { alsoUserIds?: string[]; logTag?: string } = {},
): Promise<{ configured: boolean; delivered: boolean; usedFallback: boolean }> {
  try {
    // Sin canal no se consulta la base: el llamador sigue como antes.
    if (!resolveDiscordTarget(category)) {
      return { configured: false, delivered: false, usedFallback: false };
    }
    const mentionUserIds = opts.alsoUserIds?.length
      ? await resolveDiscordUserIds(admin, opts.alsoUserIds)
      : [];
    const res = await tryDiscord(category, aviso, mentionUserIds, opts.logTag ?? category);
    if (!res) return { configured: false, delivered: false, usedFallback: false };
    return { configured: true, ...res };
  } catch (err) {
    console.error("[dispatch-alert] sendDiscordCategoryAlert falló:", err);
    return { configured: true, delivered: false, usedFallback: false };
  }
}

/**
 * Manda un aviso de `category`: Discord primero; si Discord no está
 * configurado o no entrega, el camino de Telegram de SDD-0271.
 *
 * `opts.alsoUserIds` —el destinatario por persona del módulo, p. ej. el asesor
 * de una conversación— se resuelve en Discord como MENCIÓN en el canal: suena
 * sólo a quien enlazó su ID de Discord en el perfil.
 */
export async function dispatchAlert(
  admin: SupabaseClient,
  tenantId: string,
  category: TelegramAlertCategory,
  payload: AlertPayload,
  opts: DispatchOptions = {},
): Promise<AlertDispatchResult> {
  const tag = opts.logTag ?? category;
  const empty: AlertDispatchResult = {
    canal: "ninguno",
    intentados: 0,
    sent: 0,
    failed: 0,
    usedFallback: false,
    chatIds: [],
  };

  try {
    let discordFailed = 0;

    if (resolveDiscordTarget(category)) {
      const mentionUserIds = opts.alsoUserIds?.length
        ? await resolveDiscordUserIds(admin, opts.alsoUserIds)
        : [];
      const discord = await tryDiscord(category, payload.discord, mentionUserIds, tag);
      if (discord?.delivered) {
        return {
          canal: "discord",
          intentados: 1,
          sent: 1,
          failed: 0,
          usedFallback: discord.usedFallback,
          chatIds: [],
        };
      }
      if (discord) discordFailed = 1;
    }

    const tg = await dispatchTelegramAlert(
      admin,
      tenantId,
      category,
      payload.telegramText,
      opts,
    );
    if (tg.chatIds.length === 0) {
      return { ...empty, intentados: discordFailed, failed: discordFailed };
    }
    return {
      canal: "telegram",
      intentados: tg.chatIds.length + discordFailed,
      sent: tg.sent,
      failed: tg.failed + discordFailed,
      // Si Discord estaba configurado y falló, Telegram ya es un respaldo.
      usedFallback: tg.usedFallback || discordFailed > 0,
      chatIds: tg.chatIds,
    };
  } catch (err) {
    console.error(`[dispatch-alert] dispatchAlert("${tag}") falló:`, err);
    return empty;
  }
}
