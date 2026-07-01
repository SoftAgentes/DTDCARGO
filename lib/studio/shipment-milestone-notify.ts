/**
 * Aviso al CLIENTE de un hito de su envío (SDD-0132 · Slice C).
 *
 * Cuando la operación cambia el status a un hito notificable, se le manda al
 * cliente un correo directo (best-effort). NO usa el motor de reglas de mail
 * (templates por evento) — que solo cubre `shipment_arrived` — sino `sendEmail`
 * con subject+html crudos (sin template → sin migración), igual que los avisos
 * internos. El arribo (`arrived_destination`) ya avisa por su template, así que
 * NO está en este set (evita doble correo).
 *
 * Correo TRANSACCIONAL (estado de una operación en curso) → no lleva unsubscribe.
 * Un fallo de envío se loguea pero NO rompe el cambio de estado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { escapeHtml } from "@/lib/studio/new-client-notify";
import { STATUS_LABELS } from "@/lib/shared/shipment-public";
import type { ShipmentStatus } from "@/lib/shared/shipment-public";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/**
 * Hitos que disparan aviso al cliente (decisión founder 2026-07-01). `arrived_
 * destination` NO está: ya avisa por su template `shipment_arrived`.
 */
export const CLIENT_NOTIFIABLE_MILESTONES: ReadonlySet<ShipmentStatus> =
  new Set<ShipmentStatus>([
    "in_warehouse",
    "shipped",
    "out_for_delivery",
    "delivered",
  ]);

export function isClientNotifiableMilestone(status: ShipmentStatus): boolean {
  return CLIENT_NOTIFIABLE_MILESTONES.has(status);
}

/** Copy amable por hito (título + cuerpo), de cara al cliente. */
const MILESTONE_COPY: Partial<
  Record<ShipmentStatus, { title: string; body: string }>
> = {
  in_warehouse: {
    title: "Tu carga llegó a nuestra bodega en China",
    body: "Recibimos tu mercancía en Yiwu. Ya arrancó el proceso hacia Venezuela.",
  },
  shipped: {
    title: "Tu carga fue embarcada",
    body: "Tu mercancía zarpó de China rumbo a Venezuela. Te avisamos cuando llegue.",
  },
  out_for_delivery: {
    title: "Tu carga salió a entrega",
    body: "Tu mercancía va en camino a la dirección de entrega. ¡Ya casi!",
  },
  delivered: {
    title: "Tu carga fue entregada",
    body: "Tu envío se entregó. Gracias por confiar en DTD Cargo.",
  },
};

export interface ShipmentMilestonePayload {
  shipmentCode: string;
  status: ShipmentStatus;
  clientMarkbox: string | null;
  clientName: string | null;
}

/**
 * Avisa al cliente del hito `status` de su envío. Resuelve su correo por markbox.
 * Best-effort: sin correo → no hace nada; un fallo se loguea, nunca tira.
 */
export async function notifyShipmentMilestoneToClient(
  admin: SupabaseClient,
  tenantId: string,
  payload: ShipmentMilestonePayload,
): Promise<void> {
  try {
    if (!isClientNotifiableMilestone(payload.status)) return;
    if (!payload.clientMarkbox) return;

    const { data: clientRow } = await admin
      .from("clients")
      .select("email, name")
      .eq("tenant_id", tenantId)
      .eq("markbox", payload.clientMarkbox)
      .is("deleted_at", null)
      .maybeSingle<{ email: string | null; name: string | null }>();

    const email = (clientRow?.email ?? "").trim();
    if (!email) return; // sin correo → nada que enviar (best-effort)

    const name = payload.clientName ?? clientRow?.name ?? "cliente";
    const copy = MILESTONE_COPY[payload.status] ?? {
      title: STATUS_LABELS[payload.status] ?? "Actualización de tu envío",
      body: "Tu envío tuvo una actualización de estado.",
    };
    const trackUrl = `${SITE_URL}/portal/envios/${encodeURIComponent(payload.shipmentCode)}`;

    const res = await sendEmail(admin, tenantId, {
      subject: `${copy.title} · ${payload.shipmentCode}`,
      html: buildHtml({ name, copy, shipmentCode: payload.shipmentCode, trackUrl }),
      to: email,
      to_name: name,
      metadata: {
        source: "shipment-milestone-notify",
        code: payload.shipmentCode,
        status: payload.status,
      },
    });
    if (!res.ok) {
      console.error("[shipment-milestone-notify] email falló:", res.error);
    }
  } catch (err) {
    console.error("[shipment-milestone-notify] falló:", err);
  }
}

function buildHtml(d: {
  name: string;
  copy: { title: string; body: string };
  shipmentCode: string;
  trackUrl: string;
}): string {
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:18px;margin:0 0 4px"><b>${escapeHtml(d.copy.title)}</b></p>
<p style="margin:0 0 16px;color:#333;font-size:14px;line-height:1.5">Hola ${escapeHtml(
    d.name,
  )}, ${escapeHtml(d.copy.body)}</p>
<table style="border-collapse:collapse;margin:0 0 20px">
<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;font-size:13px">Envío</td>
<td style="padding:4px 0;color:#0F1E3D;font-size:14px;font-weight:700">${escapeHtml(
    d.shipmentCode,
  )}</td></tr></table>
<p style="margin:0 0 12px"><a href="${d.trackUrl}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Ver el seguimiento en tu portal &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · logística puerta a puerta China–Venezuela</p>
</div>`;
}
