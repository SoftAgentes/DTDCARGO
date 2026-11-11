/**
 * Aviso al equipo: hay correos que no llegaron.
 *
 * Reusa los dos canales que ya usa el aviso de cliente nuevo
 * (`lib/studio/new-client-notify.ts`): email a cada admin + Telegram a los que
 * linkearon su chat. No inventa canal nuevo.
 *
 * ⚠️ **El canal Telegram es el que importa acá.** Este aviso existe porque el
 * correo falla; mandarlo SOLO por correo sería avisar del incendio por la casa
 * que se está quemando. Telegram es independiente de Resend y llega igual.
 *
 * Los correos que manda este módulo van marcados con
 * `metadata.source = 'mail-health'` para que la próxima corrida los ignore
 * (ver el aviso de bucle infinito en `mail-health.ts`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./send-email";
import {
  resolveAdminEntries,
  escapeHtml,
} from "@/lib/studio/new-client-notify";
import { dispatchAlert } from "@/lib/studio/alerts/dispatch-alert";
import { MAIL_HEALTH_SOURCE, type MailFailure } from "./mail-health";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export type MailHealthNotifyResult = {
  emailSent: number;
  /**
   * Admins a los que se intentó el Telegram. NO es "entregados":
   * El despachador hace skip silencioso si no hay ningún chat resuelto y no
   * devuelve estado. Se llama `Attempted` para no mentir en el resumen del cron.
   */
  telegramAttempted: number;
};

const LABEL: Record<MailFailure["kind"], string> = {
  nunca_salio: "NUNCA SALIÓ",
  no_llego: "NO LLEGÓ",
};

/**
 * Avisa a los admins del tenant del lote de correos fallidos.
 *
 * Best-effort por canal, como el resto de los avisos internos: un fallo se
 * loguea y se sigue. Nunca tira.
 *
 * @returns cuántos envíos salieron por cada canal (para el resumen del cron).
 */
export async function notifyMailHealth(
  admin: SupabaseClient,
  tenantId: string,
  failures: MailFailure[],
): Promise<MailHealthNotifyResult> {
  const result: MailHealthNotifyResult = { emailSent: 0, telegramAttempted: 0 };
  if (failures.length === 0) return result;

  try {
    const admins = await resolveAdminEntries(admin, tenantId);
    if (admins.length === 0) {
      console.warn("[mail-health] sin admins para notificar");
      return result;
    }

    const subject = `⚠️ ${failures.length} correo(s) no llegaron · DTD Cargo`;
    const html = buildHtml(failures);
    const telegramText = buildTelegramText(failures);

    for (const a of admins) {
      const res = await sendEmail(admin, tenantId, {
        subject,
        html,
        to: a.email,
        to_name: "Equipo DTD",
        // Marca anti-bucle · ver mail-health.ts
        metadata: { source: MAIL_HEALTH_SOURCE, failures: failures.length },
      });
      if (res.ok) result.emailSent += 1;
      else console.error("[mail-health] email de aviso falló:", res.error);
    }

    // Telegram: independiente de Resend. Si el correo está roto, este llega.
    // UNA vez por CHAT, fuera del bucle de admins (SDD-0271).
    const tg = await dispatchAlert(
      admin,
      tenantId,
      "equipo",
      {
        telegramText,
        // Sin destinatarios ni asuntos: sólo cuántos y dónde verlos (SDD-0606).
        discord: {
          titulo: "Correos que no llegaron",
          conteos: [{ etiqueta: "Correos fallidos", valor: failures.length }],
          url: `${SITE_URL}/studio/mailing`,
        },
      },
      { logTag: "mail-health" },
    );
    // Nombre histórico: cuenta los destinos de mensajería intentados
    // (canal de Discord o chats de Telegram).
    result.telegramAttempted = tg.intentados;
  } catch (err) {
    console.error("[mail-health] notifyMailHealth falló:", err);
  }

  return result;
}

// ── Render ──────────────────────────────────────────────────────────────────

function buildHtml(failures: MailFailure[]): string {
  const rows = failures
    .map(({ row, kind }) => {
      const cuando = row.created_at.slice(0, 10);
      return `<tr>
<td style="padding:6px 12px 6px 0;font-size:13px;color:#7F0F1A;font-weight:600">${LABEL[kind]}</td>
<td style="padding:6px 12px 6px 0;font-size:13px;color:#0F1E3D">${escapeHtml(row.subject ?? "(sin asunto)")}</td>
<td style="padding:6px 12px 6px 0;font-size:13px;color:#6B6B6B">${escapeHtml(row.to_email)}</td>
<td style="padding:6px 0;font-size:13px;color:#6B6B6B">${cuando}</td>
</tr>`;
    })
    .join("");

  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:680px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 4px"><b>Correos que no llegaron</b></p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">
<b>NUNCA SALIÓ</b> = se puede reenviar. <b>NO LLEGÓ</b> = la dirección no sirve, hay que contactar al cliente por otro canal y corregirle el correo.
</p>
<table style="border-collapse:collapse;margin:0 0 20px">${rows}</table>
<p style="margin:0 0 12px"><a href="${SITE_URL}/studio/mailing" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Abrir Mailing en el Studio &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · aviso interno automático</p>
</div>`;
}

function buildTelegramText(failures: MailFailure[]): string {
  const lines = failures
    .slice(0, 15)
    .map(({ row, kind }) => `· [${LABEL[kind]}] ${row.to_email} — ${row.subject ?? "(sin asunto)"}`);
  const extra =
    failures.length > 15 ? [`… y ${failures.length - 15} más`] : [];

  return [
    `⚠️ ${failures.length} correo(s) no llegaron`,
    ``,
    ...lines,
    ...extra,
    ``,
    `${SITE_URL}/studio/mailing`,
  ].join("\n");
}
