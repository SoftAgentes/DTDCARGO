/**
 * Historial de avisos al cliente para el portal (SDD-0156 · Slice C · loose end).
 *
 * Expone las filas `sent` de `client_notification_schedule` de UN envío como una
 * lista read-only ("Avisos que te enviamos"). El cliente NO tiene RLS sobre esta
 * cola (es service_role para el cron), así que se lee con el admin client
 * scopeado al envío PROPIO del cliente (shipment.id ya verificado por
 * `getMyShipment`) — mismo patrón que el snapshot naviero del portal.
 *
 * Sólo muestra lo REALMENTE despachado (`status='sent'`), nunca lo programado
 * pendiente, saltado o fallido: el cliente ve lo que le llegó, no la mecánica
 * interna de la agenda.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createComponentLogger,
  type StructuredLogger,
} from "@/lib/observability/structured-logger";
import { journeyEventLabel } from "./client-notification-types";

/** Un aviso ya enviado, en forma amigable para el portal. */
export type PortalNotificationHistoryItem = {
  id: string;
  /** Etiqueta legible del evento del journey (ej. "Embarcado"). */
  eventLabel: string;
  /** Canal por el que se despachó. */
  channel: "email" | "push" | "both";
  /** Título del aviso (del snapshot en payload). */
  title: string;
  /** Cuerpo del aviso. */
  body: string;
  /** Cuándo se envió (ISO). */
  sentAt: string | null;
};

function strFromPayload(
  payload: Record<string, unknown> | null,
  key: string,
): string | null {
  const v = payload?.[key];
  return typeof v === "string" ? v : null;
}

/**
 * Avisos enviados de un envío, del más reciente al más antiguo. Best-effort: ante
 * error o sin filas → []. `limit` acota (default 20).
 */
export async function listShipmentNotificationHistory(
  admin: SupabaseClient,
  shipmentId: string,
  limit = 20,
  logger: StructuredLogger = createComponentLogger(
    "internal.notification-history",
  ),
): Promise<PortalNotificationHistoryItem[]> {
  try {
    const { data, error } = await admin
      .from("client_notification_schedule")
      .select("id, trigger_event, channel, payload, sent_at")
      .eq("shipment_id", shipmentId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];

    const rows = data as Array<{
      id: string;
      trigger_event: string;
      channel: string;
      payload: Record<string, unknown> | null;
      sent_at: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      eventLabel: journeyEventLabel(r.trigger_event),
      channel: (r.channel as "email" | "push" | "both") ?? "email",
      title: strFromPayload(r.payload, "title") ?? "Actualización de tu envío",
      body:
        strFromPayload(r.payload, "body") ?? "Tu envío tuvo una actualización.",
      sentAt: r.sent_at,
    }));
  } catch (err) {
    logger.error("client_notification.query_failed", {
      error: err,
      operation: "shipment_history",
      stage: "read",
    });
    return [];
  }
}
