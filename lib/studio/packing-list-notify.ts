/**
 * SDD-0096 · Aviso al equipo cuando un PROVEEDOR envía su packing list online
 * desde /p/{token}. Modelado sobre contact-lead-notify (mismo "avisar al equipo
 * de un inbound"), reusando sus helpers (resolveAdminEntries / escapeHtml
 * / escapeHtml):
 *   - Email a la casilla general (info@) + a cada admin del tenant (dedup).
 *   - Telegram a cada admin que linkeó su chat.
 *
 * Best-effort: devuelve { ok } = al menos un email salió. El route NO falla si
 * esto falla (la fila del packing list YA quedó guardada por la RPC → reintentar
 * duplicaría la versión). Solo loguea.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { CONTACT } from "@/lib/design-tokens";
import {
  resolveAdminEntries,
  escapeHtml,
} from "@/lib/studio/new-client-notify";
import { dispatchAlert } from "@/lib/studio/alerts/dispatch-alert";

export interface PackingListNotifyPayload {
  /** Folio del documento (DTD-PL-YYYY-NNNN). */
  folio: string;
  /** Nº de versión de la cadena (1 = nuevo, >1 = corrección). */
  versionNo: number;
  /** Código de la compra (DTD-XXXX-p-c). */
  code: string;
  /** Shipping Mark del cliente. */
  markbox: string;
  /** true si el markbox NO resolvió a un cliente (no aplica acá: el token ya ata
   *  a una compra real). Reservado por simetría con otros notifies. */
  supplierCompany: string | null;
  supplierContact: string | null;
  supplierEmail: string | null;
  supplierWechat: string | null;
  supplierPhone: string | null;
  currency: string;
  totalAmount: number;
  totalCtns: number;
}

function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://dtdcargo.com";
  return raw.replace(/\/+$/, "");
}

export async function notifyPackingListToAdmin(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  payload: PackingListNotifyPayload,
): Promise<{ ok: boolean }> {
  const isUpdate = payload.versionNo > 1;
  const who = payload.supplierCompany || payload.supplierContact || "proveedor";
  const subject = `Packing list ${isUpdate ? `(corrección v${payload.versionNo})` : "nuevo"} · ${payload.code} — ${who}`;
  const html = buildHtml(payload, isUpdate);
  const telegramText = buildTelegram(payload, isUpdate);

  const admins = await resolveAdminEntries(supabaseAdmin, tenantId);
  const recipients = new Set<string>([CONTACT.emailGeneral.toLowerCase()]);
  for (const a of admins) recipients.add(a.email.toLowerCase());

  let emailedOk = false;
  for (const to of recipients) {
    const res = await sendEmail(supabaseAdmin, tenantId, {
      subject,
      html,
      to,
      to_name: "Equipo DTD",
      metadata: { source: "packing-list", folio: payload.folio },
    });
    if (res.ok) emailedOk = true;
    else console.error("[packing-list-notify] email falló:", res.error);
  }

  // Telegram: UNA vez por CHAT, no una por admin (SDD-0271).
  await dispatchAlert(
    supabaseAdmin,
    tenantId,
    "equipo",
    {
      telegramText,
      // Sin proveedor, contactos ni montos: sólo el folio (SDD-0606).
      discord: {
        titulo: isUpdate ? "Packing list actualizado" : "Packing list nuevo",
        codigo: payload.folio,
        url: `${siteUrl()}/studio/proveedores`,
      },
    },
    { logTag: "packing-list-notify" },
  );

  return { ok: emailedOk };
}

function buildHtml(p: PackingListNotifyPayload, isUpdate: boolean): string {
  const rows: Array<[string, string]> = [
    ["Folio", p.folio],
    ["Compra", p.code],
    ["Shipping Mark", p.markbox],
    ["Proveedor", p.supplierCompany || p.supplierContact || "—"],
    ["Email", p.supplierEmail || "—"],
    ["WeChat", p.supplierWechat || "—"],
    ["Teléfono", p.supplierPhone || "—"],
    ["Total declarado", `${p.currency} ${p.totalAmount.toFixed(2)}`],
    ["Cajas", String(p.totalCtns)],
  ];
  const trs = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;font-size:13px">${escapeHtml(k)}</td><td style="padding:4px 0;color:#0F1E3D;font-size:14px;font-weight:600">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  const link = `${siteUrl()}/studio/proveedores`;
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 4px"><b>${isUpdate ? "Corrección de packing list" : "Nuevo packing list del proveedor"}</b></p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">El proveedor envió su packing list online desde el link de su compra.${isUpdate ? " Es una corrección (versión más reciente)." : ""}</p>
<table style="border-collapse:collapse;margin:0 0 16px">${trs}</table>
<p style="margin:0 0 12px"><a href="${link}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Ver en el Studio &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · aviso interno automático</p>
</div>`;
}

function buildTelegram(p: PackingListNotifyPayload, isUpdate: boolean): string {
  return [
    `${isUpdate ? `Packing list corregido (v${p.versionNo})` : "Nuevo packing list"} · ${p.code}`,
    ``,
    `Folio: ${p.folio}`,
    `Shipping Mark: ${p.markbox}`,
    `Proveedor: ${p.supplierCompany || p.supplierContact || "—"}`,
    `Contacto: ${p.supplierWechat || p.supplierEmail || p.supplierPhone || "—"}`,
    `Total: ${p.currency} ${p.totalAmount.toFixed(2)} · ${p.totalCtns} cajas`,
    ``,
    `${siteUrl()}/studio/proveedores`,
  ].join("\n");
}
