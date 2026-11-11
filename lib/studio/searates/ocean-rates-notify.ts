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

import { resolveAdminEntries } from "@/lib/studio/new-client-notify";
import { dispatchAlert } from "@/lib/studio/alerts/dispatch-alert";
import { sendEmail } from "@/lib/studio/mail/send-email";
import type { OceanRatesAlert } from "./ocean-rates-alert";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dtdcargo.com").replace(/\/+$/, "");

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
): Promise<OceanRatesNotifyResult> {
  const result: OceanRatesNotifyResult = { emailSent: 0, telegramAttempted: 0 };

  try {
    const admins = await resolveAdminEntries(admin, tenantId);
    if (admins.length === 0) {
      console.warn("[searates-refresh] sin admins para notificar");
    }

    for (const a of admins) {
      const res = await sendEmail(admin, tenantId, {
        subject: alert.subject,
        html: alert.html,
        to: a.email,
        to_name: "Equipo DTD",
      });
      if (res.ok) result.emailSent += 1;
      else console.error("[searates-refresh] email de aviso falló:", res.error);
    }

    // Telegram es independiente de Resend: si el correo está roto, este llega.
    const tg = await dispatchAlert(
      admin,
      tenantId,
      "equipo",
      {
        telegramText: alert.text,
        // Aviso técnico, sin datos de personas; el detalle está en Debug.
        discord: {
          titulo: "Tarifas de fletes: el refresco falló o volvió incompleto",
          url: `${SITE_URL}/studio/debug`,
        },
      },
      { logTag: "searates-refresh" },
    );
    // Nombre histórico: cuenta los destinos de mensajería intentados
    // (canal de Discord o chats de Telegram).
    result.telegramAttempted = tg.intentados;
  } catch (err) {
    console.error("[searates-refresh] notifyOceanRatesHealth falló:", err);
  }

  return result;
}
