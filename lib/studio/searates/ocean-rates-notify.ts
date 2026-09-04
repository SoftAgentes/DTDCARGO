/**
 * Aviso de salud del refresco de fletes marítimos (SDD-0291).
 *
 * Calca `lib/studio/mail/mail-health-notify.ts` —el hermano más cercano: también
 * es un aviso de SALUD de una integración, global, disparado por un cron— y reusa
 * los rieles ya canónicos del repo: `resolveAdminEntries` para el correo y
 * `dispatchTelegramAlert` (categoría `equipo`) para Telegram.
 *
 * Categoría `equipo` a propósito, sin categoría nueva ni migración: su hint ya
 * dice "…y avisos de salud del correo", así que la salud de una integración cae
 * ahí de forma natural, y hereda el ruteo configurable de SDD-0271 más el
 * respaldo a los admins cuando nadie tiene ruta.
 *
 * Best-effort por canal: un fallo de Telegram no bloquea el correo ni al cron.
 * NUNCA tira.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createComponentLogger,
  type StructuredLogger,
} from "@/lib/observability/structured-logger";

import { resolveAdminEntries } from "@/lib/studio/new-client-notify";
import { dispatchTelegramAlert } from "@/lib/studio/telegram/alert-routing";
import { sendEmail } from "@/lib/studio/mail/send-email";
import type { OceanRatesAlert } from "./ocean-rates-alert";

export type OceanRatesNotifyResult = {
  emailSent: number;
  telegramAttempted: number;
};

/**
 * Manda el aviso por los dos canales. `alert` ya viene armado por
 * `buildOceanRatesAlert` (que devuelve `null` cuando no hay nada que avisar), así
 * que si llegaste acá es porque hay algo que decir.
 *
 * Telegram va FUERA del bucle de admins: una vez por chat, no una por persona
 * (SDD-0271 — en producción hay dos admins compartiendo `telegram_chat_id`).
 */
export async function notifyOceanRatesHealth(
  admin: SupabaseClient,
  tenantId: string,
  alert: OceanRatesAlert,
  logger: StructuredLogger = createComponentLogger("internal.searates-health"),
): Promise<OceanRatesNotifyResult> {
  const result: OceanRatesNotifyResult = { emailSent: 0, telegramAttempted: 0 };

  try {
    const admins = await resolveAdminEntries(admin, tenantId);
    if (admins.length === 0) {
      logger.warn("notification.targets_missing", {
        persons: 0,
        stage: "email",
      });
    }

    for (const a of admins) {
      const res = await sendEmail(admin, tenantId, {
        subject: alert.subject,
        html: alert.html,
        to: a.email,
        to_name: "Equipo DTD",
      });
      if (res.ok) result.emailSent += 1;
      else {
        logger.error("notification.delivery_failed", {
          error: res.error,
          failed: 1,
          stage: "email",
        });
      }
    }

    // Telegram es independiente de Resend: si el correo está roto, este llega.
    const tg = await dispatchTelegramAlert(admin, tenantId, "equipo", alert.text, {
      logTag: "searates-refresh",
      logger,
    });
    result.telegramAttempted = tg.chatIds.length;
  } catch (err) {
    logger.error("notification.dispatch_failed", {
      error: err,
      stage: "searates-health",
    });
  }

  return result;
}
