/**
 * Aviso interno "un cliente pidió una cotización desde el portal" (Norte ·
 * cotizaciones del portal). Sin esto, una solicitud entra a `/studio/cotizador`
 * como un estimado draft más y el asesor no se entera de que el cliente espera
 * respuesta. Avisa a los admins del tenant con el código + el detalle.
 *
 * Reusa los helpers de lib/studio/new-client-notify (resolveAdminEntries +
 * escapeHtml) — misma mecánica "avisar al equipo"; el Telegram sale por la
 * categoría `equipo` (SDD-0271), una vez por chat. Email vía
 * `sendEmail` (subject+html crudos, sin template → sin migración). Best-effort por
 * canal: cada fallo se loguea pero NO rompe el alta de la cotización.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import {
  resolveAdminEntries,
  escapeHtml,
} from "@/lib/studio/new-client-notify";
import { dispatchTelegramAlert } from "@/lib/studio/telegram/alert-routing";
import { SERVICE_LABELS } from "@/lib/shared/shipment-public";
import type { ShipmentService } from "@/lib/shared/shipment-public";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export interface CotizacionRequestNotifyPayload {
  /** Código del estimado/cotización (EST-YYYY-NNNN). */
  code: string;
  markbox: string;
  clientName: string;
  service: ShipmentService;
  origin: string;
  destination: string;
  /** Detalle que escribió el cliente. */
  description: string;
}

/**
 * Avisa a los admins del tenant que un cliente pidió cotizar. Best-effort, nunca
 * tira. Email siempre; Telegram sólo a quien linkeó su chat.
 */
export async function notifyCotizacionRequestToAdmin(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  payload: CotizacionRequestNotifyPayload,
): Promise<void> {
  try {
    const admins = await resolveAdminEntries(supabaseAdmin, tenantId);
    if (admins.length === 0) {
      console.warn(
        "[cotizacion-request-notify] sin admins para notificar",
        payload.code,
      );
      return;
    }

    // El asesor cotiza desde el módulo Estimados del Studio.
    const studioUrl = `${SITE_URL}/studio/cotizador`;
    const svc = SERVICE_LABELS[payload.service]?.primary ?? payload.service;
    const ruta = `${payload.origin} → ${payload.destination}`;

    const subject = `Cotización pedida · ${payload.markbox} — ${payload.clientName}`;
    const html = buildHtml(payload, { studioUrl, svc, ruta });
    const telegramText = buildTelegramText(payload, { studioUrl, svc, ruta });

    for (const admin of admins) {
      const res = await sendEmail(supabaseAdmin, tenantId, {
        subject,
        html,
        to: admin.email,
        to_name: "Equipo DTD",
        metadata: { source: "cotizacion-request-notify", code: payload.code },
      });
      if (!res.ok) {
        console.error("[cotizacion-request-notify] email falló:", res.error);
      }
    }

    // Telegram: UNA vez por CHAT, fuera del bucle de admins (SDD-0271).
    await dispatchTelegramAlert(supabaseAdmin, tenantId, "equipo", telegramText, {
      logTag: "cotizacion-request-notify",
    });
  } catch (err) {
    console.error(
      "[cotizacion-request-notify] notifyCotizacionRequestToAdmin falló:",
      err,
    );
  }
}

type Derived = { studioUrl: string; svc: string; ruta: string };

function buildHtml(p: CotizacionRequestNotifyPayload, d: Derived): string {
  const rows: Array<[string, string]> = [
    ["Código", p.code],
    ["Shipping Mark", p.markbox],
    ["Cliente", p.clientName],
    ["Servicio", d.svc],
    ["Ruta", d.ruta],
    ["Pedido", p.description],
  ];
  const trs = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;font-size:13px;vertical-align:top">${escapeHtml(
          k,
        )}</td><td style="padding:4px 0;color:#0F1E3D;font-size:14px;font-weight:600">${escapeHtml(
          v,
        )}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 4px"><b>Cotización pedida desde el portal</b></p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">Un cliente registrado pidió que le cotices. Ábrelo en Estimados y mándale el precio.</p>
<table style="border-collapse:collapse;margin:0 0 20px">${trs}</table>
<p style="margin:0 0 12px"><a href="${d.studioUrl}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Abrir Estimados en el Studio &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · aviso interno automático</p>
</div>`;
}

function buildTelegramText(
  p: CotizacionRequestNotifyPayload,
  d: Derived,
): string {
  return [
    `Cotización pedida · ${p.code}`,
    ``,
    `${p.clientName} (${p.markbox})`,
    `${d.svc} · ${d.ruta}`,
    `Pedido: ${p.description}`,
    ``,
    d.studioUrl,
  ].join("\n");
}
