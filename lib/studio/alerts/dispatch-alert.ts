/**
 * Despachador de avisos al equipo, por categoría · SDD-0606.
 *
 * Reemplaza a `dispatchTelegramAlert` (SDD-0271) como puerta de entrada de los
 * módulos de aviso. Conserva sus cinco categorías y su regla central —una
 * categoría sin destino nunca calla— y agrega Discord delante:
 *
 *   1. Canal de Discord de la categoría (sólo para el tenant dueño de los
 *      canales, `DISCORD_TENANT_ID`).
 *   2. Si no tiene dirección, o Discord no lo guardó: canal de respaldo
 *      (`#avisos-equipo`), marcando de qué categoría venía.
 *   3. Si tampoco se guardó y la categoría no puede perderse (`registro`,
 *      `bugs`, `reportes`): la cola durable, que reintenta por Discord.
 *   4. Si Discord no aplica, o la categoría no va a la cola: el camino de
 *      SDD-0271 (rutas de Telegram). Desde el 2026-11-06 Telegram está retirado
 *      (`lib/studio/telegram/send-message.ts` no manda nada): ese camino ya no
 *      entrega, y el aviso queda en el correo y la campana del Studio.
 *
 * Si Discord entrega, Telegram NO se usa: el corte es directo, sin doble envío.
 * Si la entrega quedó INCIERTA (pudo guardarse), no se repite por ningún lado.
 *
 * ── Privacidad ───────────────────────────────────────────────────────────────
 * Un aviso trae dos textos y no se mezclan nunca:
 *   - `telegramText`: el texto completo de siempre. Sólo va a Telegram.
 *   - `discord`: lo mínimo (título, código y enlace). Es lo único que sale a
 *     Discord o entra a la cola. Hay una prueba que lo mide sobre el pedido HTTP.
 *
 * Best-effort de punta a punta: nunca lanza.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dispatchTelegramAlert,
  type DispatchOptions,
  type TelegramAlertCategory,
} from "@/lib/studio/telegram/alert-routing";
import { resolveDiscordTarget } from "@/lib/studio/discord/channels";
import type { MinimalAlert } from "@/lib/studio/discord/minimal-alert";
import { isDiscordUserId } from "@/lib/studio/discord/send-webhook";
import { deliverDiscordAlert } from "./discord-delivery";
import { ALERT_OUTBOX_CATEGORIES, enqueueAlert } from "./alert-outbox";

export interface AlertPayload {
  /** Texto completo. SÓLO para Telegram; nunca sale a Discord. */
  telegramText: string;
  /** Lo mínimo que sale a Discord. */
  discord: MinimalAlert;
}

export type AlertChannel = "discord" | "cola" | "telegram" | "ninguno";

export interface AlertDispatchResult {
  /** Por dónde salió el aviso (`cola` = quedó para reintentar por Discord). */
  canal: AlertChannel;
  /** Destinos a los que se intentó entregar (canal de Discord o chats de Telegram). */
  intentados: number;
  sent: number;
  failed: number;
  /** true si no salió por el destino propio de la categoría sino por un respaldo. */
  usedFallback: boolean;
  /** true si Discord pudo haberlo guardado sin confirmarlo: no se repitió. */
  incierto: boolean;
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

export type DiscordAlertOutcome = "entregado" | "incierto" | "en-cola" | "no-entregado";

export interface DiscordCategoryAlertResult {
  /** false = Discord no aplica (sin canal, otro tenant o entorno de prueba). */
  configured: boolean;
  outcome: DiscordAlertOutcome;
  /**
   * true = el aviso ya está resuelto por Discord (entregado, incierto o en la
   * cola): quien llama NO debe mandarlo por Telegram.
   */
  handled: boolean;
  usedFallback: boolean;
}

/**
 * La parte de Discord de un aviso, con la cola para las categorías que no
 * pueden perderse. La usan `dispatchAlert` y los módulos cuyo camino de
 * Telegram no pasa por `dispatchTelegramAlert` (bugs, reporte diario, tarifas,
 * solicitudes de cambio). Nunca lanza.
 */
export async function sendDiscordCategoryAlert(
  admin: SupabaseClient,
  tenantId: string,
  category: TelegramAlertCategory,
  aviso: MinimalAlert,
  opts: { alsoUserIds?: string[]; logTag?: string } = {},
): Promise<DiscordCategoryAlertResult> {
  const fuera: DiscordCategoryAlertResult = {
    configured: false,
    outcome: "no-entregado",
    handled: false,
    usedFallback: false,
  };
  try {
    // Sin canal no se consulta la base: el llamador sigue como antes.
    if (!resolveDiscordTarget(category, tenantId)) return fuera;
    const tag = opts.logTag ?? category;
    const mentionUserIds = opts.alsoUserIds?.length
      ? await resolveDiscordUserIds(admin, opts.alsoUserIds)
      : [];

    const entrega = await deliverDiscordAlert(tenantId, category, aviso, mentionUserIds, tag);
    if (!entrega.configured) return fuera;
    if (entrega.outcome !== "no-entregado") {
      return {
        configured: true,
        outcome: entrega.outcome,
        handled: true,
        usedFallback: entrega.usedFallback,
      };
    }

    if (ALERT_OUTBOX_CATEGORIES.has(category)) {
      const enCola = await enqueueAlert(admin, {
        tenantId,
        category,
        aviso,
        mentionUserIds,
        lastError: entrega.error,
      });
      if (enCola) {
        console.warn(`[dispatch-alert] "${tag}" no se guardó en Discord: queda en la cola`);
        return { configured: true, outcome: "en-cola", handled: true, usedFallback: false };
      }
    }
    return { configured: true, outcome: "no-entregado", handled: false, usedFallback: false };
  } catch (err) {
    console.error("[dispatch-alert] sendDiscordCategoryAlert falló:", err);
    return { configured: true, outcome: "no-entregado", handled: false, usedFallback: false };
  }
}

/**
 * Manda un aviso de `category`: Discord primero; si Discord no aplica o no lo
 * resolvió (ni entregado, ni incierto, ni en la cola), el camino de Telegram
 * de SDD-0271.
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
    incierto: false,
    chatIds: [],
  };

  try {
    const discord = await sendDiscordCategoryAlert(admin, tenantId, category, payload.discord, {
      alsoUserIds: opts.alsoUserIds,
      logTag: tag,
    });
    if (discord.handled) {
      return {
        canal: discord.outcome === "en-cola" ? "cola" : "discord",
        intentados: 1,
        sent: discord.outcome === "entregado" ? 1 : 0,
        failed: 0,
        usedFallback: discord.usedFallback,
        incierto: discord.outcome === "incierto",
        chatIds: [],
      };
    }
    const discordFailed = discord.configured ? 1 : 0;

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
      // Si Discord estaba configurado y no lo guardó, Telegram ya es un respaldo.
      usedFallback: tg.usedFallback || discordFailed > 0,
      incierto: false,
      chatIds: tg.chatIds,
    };
  } catch (err) {
    console.error(`[dispatch-alert] dispatchAlert("${tag}") falló:`, err);
    return empty;
  }
}
