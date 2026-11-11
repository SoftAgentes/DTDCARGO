/**
 * Cola durable de avisos a Discord · SDD-0606 (A3, migr 0515).
 *
 * Cuando Discord no guardó un aviso de una categoría que no puede perderse
 * (`registro`, `bugs`, `reportes`), el aviso entra a `studio_alert_outbox` en
 * vez de caer a Telegram, y el cron de reintentos lo vuelve a mandar.
 *
 * Qué guarda: SÓLO el aviso mínimo (título, código, enlace, conteos) y los IDs
 * de Discord a mencionar. Nunca el texto completo de Telegram. Las filas
 * entregadas o abandonadas se borran a los 30 días.
 *
 * Reglas del reintento, cada una con su prueba:
 *   - Una fila se toma con un candado optimista (`next_attempt_at` como versión):
 *     dos corridas del cron a la vez no la mandan dos veces.
 *   - Una entrega incierta cierra la fila sin repetir (M2).
 *   - Si Discord pide esperar demasiado, se frena el lote (M1).
 *   - Tras `ALERT_OUTBOX_MAX_ATTEMPTS` intentos la fila queda abandonada, con su
 *     último error, para que se vea.
 *
 * Tolerante a la migración sin aplicar: encolar devuelve `false` y el aviso
 * sigue por el camino anterior; drenar devuelve ceros.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TELEGRAM_ALERT_CATEGORIES,
  type TelegramAlertCategory,
} from "@/lib/studio/telegram/alert-routing";
import type { MinimalAlert } from "@/lib/studio/discord/minimal-alert";
import { isDiscordUserId } from "@/lib/studio/discord/send-webhook";
import { deliverDiscordAlert } from "./discord-delivery";

export const ALERT_OUTBOX_TABLE = "studio_alert_outbox";

/** Las categorías que, si Discord no las guarda, van a la cola. */
export const ALERT_OUTBOX_CATEGORIES: ReadonlySet<TelegramAlertCategory> = new Set([
  "registro",
  "bugs",
  "reportes",
]);

export const ALERT_OUTBOX_MAX_ATTEMPTS = 8;

/** Espera antes del intento N+1, en minutos. El último se repite. */
const BACKOFF_MINUTES = [1, 5, 15, 30, 60, 120, 240];

/** Cuánto dura el candado de una fila tomada por un drenado. */
const LEASE_MINUTES = 10;

const DRAIN_BATCH = 50;
const RETENTION_DAYS = 30;

const MAX_ERROR = 300;

export function nextAttemptDelayMs(attemptsSoFar: number): number {
  const i = Math.min(Math.max(attemptsSoFar, 1), BACKOFF_MINUTES.length) - 1;
  return BACKOFF_MINUTES[i] * 60_000;
}

function errorText(err: string | undefined): string | null {
  return err ? err.slice(0, MAX_ERROR) : null;
}

/** Sólo lo que `MinimalAlert` admite; cualquier otra cosa se descarta. */
export function minimalFromPayload(payload: unknown): MinimalAlert | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.titulo !== "string" || !p.titulo.trim()) return null;
  const conteos = Array.isArray(p.conteos)
    ? p.conteos
        .filter(
          (c): c is { etiqueta: string; valor: number } =>
            !!c &&
            typeof (c as { etiqueta?: unknown }).etiqueta === "string" &&
            typeof (c as { valor?: unknown }).valor === "number",
        )
        .map((c) => ({ etiqueta: c.etiqueta, valor: c.valor }))
    : undefined;
  return {
    titulo: p.titulo,
    codigo: typeof p.codigo === "string" ? p.codigo : null,
    url: typeof p.url === "string" ? p.url : null,
    ...(conteos && conteos.length > 0 ? { conteos } : {}),
  };
}

/** Lo que se guarda del aviso: nada fuera de `MinimalAlert`. */
function payloadOf(aviso: MinimalAlert): Record<string, unknown> {
  const out: Record<string, unknown> = { titulo: aviso.titulo };
  if (aviso.codigo != null) out.codigo = aviso.codigo;
  if (aviso.url != null) out.url = aviso.url;
  if (aviso.conteos?.length) out.conteos = aviso.conteos.map((c) => ({ ...c }));
  return out;
}

/**
 * Encola un aviso que Discord no guardó. `true` si quedó en la cola; `false` si
 * no (la tabla no existe todavía, o falló el INSERT): entonces quien llama
 * sigue por el camino anterior. Nunca lanza.
 */
export async function enqueueAlert(
  admin: SupabaseClient,
  row: {
    tenantId: string;
    category: TelegramAlertCategory;
    aviso: MinimalAlert;
    mentionUserIds?: ReadonlyArray<string>;
    lastError?: string;
  },
  now: Date = new Date(),
): Promise<boolean> {
  try {
    const { error } = await admin.from(ALERT_OUTBOX_TABLE).insert({
      tenant_id: row.tenantId,
      category: row.category,
      payload: payloadOf(row.aviso),
      mention_user_ids: [...new Set((row.mentionUserIds ?? []).filter(isDiscordUserId))],
      attempts: 1,
      next_attempt_at: new Date(now.getTime() + nextAttemptDelayMs(1)).toISOString(),
      last_error: errorText(row.lastError),
    });
    if (error) {
      console.error("[alert-outbox] no se pudo encolar:", (error as { code?: string }).code);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[alert-outbox] encolar lanzó:", err instanceof Error ? err.name : err);
    return false;
  }
}

export interface AlertOutboxDrainResult {
  processed: number;
  delivered: number;
  /** Cerradas sin repetir porque la entrega quedó incierta. */
  uncertain: number;
  retried: number;
  abandoned: number;
  /** Filas cerradas borradas por antigüedad. */
  purged: number;
  /** true si se frenó el lote porque Discord pidió esperar. */
  throttled: boolean;
}

interface OutboxRow {
  id: string;
  tenant_id: string;
  category: string;
  payload: unknown;
  mention_user_ids: string[] | null;
  attempts: number;
  next_attempt_at: string;
}

function isCategory(value: string): value is TelegramAlertCategory {
  return (TELEGRAM_ALERT_CATEGORIES as ReadonlyArray<string>).includes(value);
}

/** Reintenta las filas vencidas. Lo llama el cron cada 5 minutos. Nunca lanza. */
export async function drainAlertOutbox(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<AlertOutboxDrainResult> {
  const result: AlertOutboxDrainResult = {
    processed: 0,
    delivered: 0,
    uncertain: 0,
    retried: 0,
    abandoned: 0,
    purged: 0,
    throttled: false,
  };

  try {
    const nowIso = now.toISOString();
    const { data, error } = await admin
      .from(ALERT_OUTBOX_TABLE)
      .select("id, tenant_id, category, payload, mention_user_ids, attempts, next_attempt_at")
      .is("delivered_at", null)
      .is("abandoned_at", null)
      .lte("next_attempt_at", nowIso)
      .order("created_at", { ascending: true })
      .limit(DRAIN_BATCH);

    if (!error && data) {
      for (const row of data as OutboxRow[]) {
        // Candado optimista: sólo sigue quien movió `next_attempt_at` desde el
        // valor leído. Otra corrida a la vez encuentra 0 filas y la salta.
        const lease = new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString();
        const { data: tomada } = await admin
          .from(ALERT_OUTBOX_TABLE)
          .update({ next_attempt_at: lease })
          .eq("id", row.id)
          .eq("next_attempt_at", row.next_attempt_at)
          .select("id");
        if (!tomada || (tomada as unknown[]).length === 0) continue;
        result.processed += 1;

        const aviso = minimalFromPayload(row.payload);
        if (!aviso || !isCategory(row.category)) {
          await admin
            .from(ALERT_OUTBOX_TABLE)
            .update({ abandoned_at: nowIso, last_error: "fila inválida" })
            .eq("id", row.id);
          result.abandoned += 1;
          continue;
        }

        const entrega = await deliverDiscordAlert(
          row.tenant_id,
          row.category,
          aviso,
          (row.mention_user_ids ?? []).filter(isDiscordUserId),
          `cola:${row.category}`,
        );

        if (entrega.outcome === "entregado") {
          await admin
            .from(ALERT_OUTBOX_TABLE)
            .update({
              delivered_at: nowIso,
              discord_message_id: entrega.messageId ?? null,
              last_error: null,
            })
            .eq("id", row.id);
          result.delivered += 1;
          continue;
        }

        if (entrega.outcome === "incierto") {
          // Pudo quedar guardado: se cierra sin repetir.
          await admin
            .from(ALERT_OUTBOX_TABLE)
            .update({ delivered_at: nowIso, last_error: errorText(`incierto: ${entrega.error ?? ""}`) })
            .eq("id", row.id);
          result.uncertain += 1;
          continue;
        }

        const attempts = row.attempts + 1;
        const motivo = entrega.configured ? entrega.error : "Discord no configurado para este tenant";
        if (attempts >= ALERT_OUTBOX_MAX_ATTEMPTS) {
          await admin
            .from(ALERT_OUTBOX_TABLE)
            .update({ attempts, abandoned_at: nowIso, last_error: errorText(motivo) })
            .eq("id", row.id);
          console.error(`[alert-outbox] aviso ${row.id} abandonado tras ${attempts} intentos`);
          result.abandoned += 1;
        } else {
          await admin
            .from(ALERT_OUTBOX_TABLE)
            .update({
              attempts,
              next_attempt_at: new Date(now.getTime() + nextAttemptDelayMs(attempts)).toISOString(),
              last_error: errorText(motivo),
            })
            .eq("id", row.id);
          result.retried += 1;
        }

        if (entrega.rateLimited) {
          // Discord pidió esperar: el resto del lote espera a la próxima corrida.
          result.throttled = true;
          break;
        }
      }
    }

    // Retención: las filas cerradas no se guardan para siempre.
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString();
    for (const col of ["delivered_at", "abandoned_at"] as const) {
      const { data: borradas } = await admin
        .from(ALERT_OUTBOX_TABLE)
        .delete()
        .lt(col, cutoff)
        .select("id");
      result.purged += (borradas as unknown[] | null)?.length ?? 0;
    }
  } catch (err) {
    console.error("[alert-outbox] drenado lanzó:", err instanceof Error ? err.name : err);
  }

  return result;
}
