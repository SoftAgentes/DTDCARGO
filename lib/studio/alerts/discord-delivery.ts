/**
 * Entrega de un aviso a Discord, con su respaldo · SDD-0606.
 *
 * Una sola función decide, para el despachador y para la cola, qué se hace
 * según lo que pasó con el mensaje (`estado` de `sendDiscordWebhook`):
 *
 *   - `entregado`              → listo.
 *   - `incierto`               → pudo quedar guardado: NO se repite en otro
 *                                canal ni por Telegram (M2). Se registra.
 *   - `rechazado`/`reintentable` en el canal propio → no se guardó: se prueba el
 *                                canal de respaldo, que es otro webhook.
 *   - nada se guardó           → `no-entregado`; quien llama decide (la cola o
 *                                Telegram).
 *
 * No escribe en la base: la cola está en `alert-outbox.ts`, que usa esto.
 */

import type { TelegramAlertCategory } from "@/lib/studio/telegram/alert-routing";
import { TELEGRAM_ALERT_CATEGORY_LABELS } from "@/lib/studio/telegram/alert-routing";
import {
  resolveDiscordFallbackTarget,
  resolveDiscordTarget,
} from "@/lib/studio/discord/channels";
import {
  buildDiscordContent,
  type MinimalAlert,
} from "@/lib/studio/discord/minimal-alert";
import { sendDiscordWebhook } from "@/lib/studio/discord/send-webhook";

export type DiscordDeliveryOutcome = "entregado" | "incierto" | "no-entregado";

export interface DiscordDelivery {
  /** false = Discord no aplica a esta categoría y este tenant. */
  configured: boolean;
  outcome: DiscordDeliveryOutcome;
  /** true si salió (o se intentó) por el canal de respaldo. */
  usedFallback: boolean;
  /** ID del mensaje guardado, si `entregado`. */
  messageId?: string;
  /** Último error, sin la dirección del webhook. */
  error?: string;
  /** Discord pidió esperar más de lo que se acepta: frenar el lote. */
  rateLimited: boolean;
}

export async function deliverDiscordAlert(
  tenantId: string,
  category: TelegramAlertCategory,
  aviso: MinimalAlert,
  mentionUserIds: ReadonlyArray<string>,
  tag: string,
): Promise<DiscordDelivery> {
  const none: DiscordDelivery = {
    configured: false,
    outcome: "no-entregado",
    usedFallback: false,
    rateLimited: false,
  };
  const target = resolveDiscordTarget(category, tenantId);
  if (!target) return none;

  const label = TELEGRAM_ALERT_CATEGORY_LABELS[category];
  const users = [...mentionUserIds];

  const first = await sendDiscordWebhook(
    target.url,
    buildDiscordContent(aviso, {
      mentionUserIds: users,
      respaldoDe: target.esRespaldo ? label : null,
    }),
    { mentionUserIds: users },
  );
  if (first.estado === "entregado") {
    if (target.esRespaldo) {
      console.warn(`[discord-delivery] "${tag}" sin canal propio — cae a ${target.canal}`);
    }
    return {
      configured: true,
      outcome: "entregado",
      usedFallback: target.esRespaldo,
      messageId: first.messageId,
      rateLimited: false,
    };
  }
  if (first.estado === "incierto") {
    console.warn(
      `[discord-delivery] "${tag}" entrega incierta en ${target.canal}; no se repite:`,
      first.error,
    );
    return {
      configured: true,
      outcome: "incierto",
      usedFallback: target.esRespaldo,
      error: first.error,
      rateLimited: false,
    };
  }
  console.error(`[discord-delivery] "${tag}" no se guardó en ${target.canal}:`, first.error);

  let lastError = first.error;
  let rateLimited = first.status === 429;

  // El canal propio no lo guardó: se prueba el de respaldo, si es otro.
  if (!target.esRespaldo) {
    const fallback = resolveDiscordFallbackTarget(tenantId);
    if (fallback && fallback.url !== target.url) {
      const second = await sendDiscordWebhook(
        fallback.url,
        buildDiscordContent(aviso, { mentionUserIds: users, respaldoDe: label }),
        { mentionUserIds: users },
      );
      if (second.estado === "entregado") {
        console.warn(`[discord-delivery] "${tag}" entregado por el respaldo ${fallback.canal}`);
        return {
          configured: true,
          outcome: "entregado",
          usedFallback: true,
          messageId: second.messageId,
          rateLimited: false,
        };
      }
      if (second.estado === "incierto") {
        console.warn(
          `[discord-delivery] "${tag}" entrega incierta en ${fallback.canal}; no se repite:`,
          second.error,
        );
        return {
          configured: true,
          outcome: "incierto",
          usedFallback: true,
          error: second.error,
          rateLimited: false,
        };
      }
      console.error(
        `[discord-delivery] "${tag}" tampoco se guardó en ${fallback.canal}:`,
        second.error,
      );
      lastError = second.error;
      rateLimited = rateLimited || second.status === 429;
    }
  }

  return {
    configured: true,
    outcome: "no-entregado",
    usedFallback: false,
    error: lastError,
    rateLimited,
  };
}
