/**
 * Vista STAFF de la cola de avisos al cliente (Motor de Crecimiento · F2-T04).
 *
 * Manómetro FUND-S3-02: cuántos avisos el motor SDD-0156 programó, envió, saltó
 * o falló. A diferencia de `notification-history-queries` (portal, solo `sent`,
 * por envío), esto es la vista INTERNA de toda la cola del tenant, por estado —
 * para ver de un vistazo si el motor de avisos está vivo (o si sigue en 0, que
 * es el hallazgo de la auditoría).
 *
 * `client_notification_schedule` es service_role only (el cliente no la lee) →
 * se lee con el admin client scopeado explícito por `tenant_id`. Best-effort:
 * ante error → vacío/ceros.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import {
  createComponentLogger,
  type StructuredLogger,
} from "@/lib/observability/structured-logger";
import { journeyEventLabel } from "./client-notification-types";

export type NotificationStatus =
  | "scheduled"
  | "sent"
  | "skipped"
  | "failed"
  | "canceled";

/** Orden de presentación (lo vivo primero, lo terminal al final). */
export const NOTIFICATION_STATUSES: readonly NotificationStatus[] = [
  "scheduled",
  "sent",
  "skipped",
  "failed",
  "canceled",
] as const;

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  scheduled: "Programado",
  sent: "Enviado",
  skipped: "Saltado",
  failed: "Fallido",
  canceled: "Cancelado",
};

export type NotificationStatusCounts = Record<NotificationStatus, number>;

export function emptyStatusCounts(): NotificationStatusCounts {
  return { scheduled: 0, sent: 0, skipped: 0, failed: 0, canceled: 0 };
}

/**
 * Suma filas `{ status }` a un contador por estado. Puro. Los estados
 * desconocidos se ignoran (no rompen el manómetro si aparece uno nuevo en DB).
 */
export function tallyStatusCounts(
  rows: Array<{ status: string }>,
): NotificationStatusCounts {
  const counts = emptyStatusCounts();
  const known = new Set<string>(NOTIFICATION_STATUSES);
  for (const r of rows) {
    if (known.has(r.status)) counts[r.status as NotificationStatus] += 1;
  }
  return counts;
}

/** Un aviso de la cola, en forma legible para la vista staff. */
export interface StaffNotificationItem {
  id: string;
  /** Etiqueta legible del evento (ej. "Embarcado"). */
  eventLabel: string;
  status: NotificationStatus;
  channel: string;
  /** Cuándo estaba/está programado (ISO). */
  scheduledFor: string;
  /** Cuándo se envió, si aplica (ISO). */
  sentAt: string | null;
  /** Mensaje de error si falló. */
  error: string | null;
  /** Código del envío (del snapshot en payload), si está. */
  shipmentCode: string | null;
  clientMarkbox: string;
}

interface StaffRow {
  id: string;
  trigger_event: string;
  status: string;
  channel: string;
  scheduled_for: string;
  sent_at: string | null;
  error: string | null;
  client_markbox: string;
  payload: Record<string, unknown> | null;
}

function isNotificationStatus(v: string): v is NotificationStatus {
  return (NOTIFICATION_STATUSES as readonly string[]).includes(v);
}

function mapStaffRow(r: StaffRow): StaffNotificationItem {
  const code = r.payload?.["shipmentCode"];
  return {
    id: r.id,
    eventLabel: journeyEventLabel(r.trigger_event),
    status: isNotificationStatus(r.status) ? r.status : "scheduled",
    channel: r.channel,
    scheduledFor: r.scheduled_for,
    sentAt: r.sent_at,
    error: r.error,
    shipmentCode: typeof code === "string" ? code : null,
    clientMarkbox: r.client_markbox,
  };
}

/**
 * Conteos por estado de toda la cola del tenant. Lee solo la columna `status`
 * (acotado a 5000 filas — la cola es interna y crece despacio) y tallea en
 * memoria con `tallyStatusCounts`. Ante error → ceros.
 */
export async function getNotificationStatusCounts(
  admin: SupabaseClient,
  tenantId: string,
  logger: StructuredLogger = createComponentLogger(
    "internal.notification-staff",
  ),
): Promise<NotificationStatusCounts> {
  try {
    // Paginado: son CONTEOS por estado de la cola de avisos al cliente.
    const { rows, complete } = await fetchAllPaged<{ status: string }>(
      (d, h) =>
        admin
          .from("client_notification_schedule")
          .select("id, status")
          .eq("tenant_id", tenantId)
          .order("id", { ascending: true })
          .range(d, h),
    );
    if (!complete) return emptyStatusCounts();
    return tallyStatusCounts(rows);
  } catch (err) {
    logger.error("client_notification.query_failed", {
      error: err,
      operation: "status_counts",
      stage: "read",
    });
    return emptyStatusCounts();
  }
}

/**
 * Avisos recientes de la cola del tenant, del más nuevo al más viejo, para la
 * tabla de la vista staff. `limit` acota (default 30). Ante error → [].
 */
export async function listRecentStaffNotifications(
  admin: SupabaseClient,
  tenantId: string,
  limit = 30,
  logger: StructuredLogger = createComponentLogger(
    "internal.notification-staff",
  ),
): Promise<StaffNotificationItem[]> {
  try {
    const { data, error } = await admin
      .from("client_notification_schedule")
      .select(
        "id, trigger_event, status, channel, scheduled_for, sent_at, error, client_markbox, payload",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as StaffRow[]).map(mapStaffRow);
  } catch (err) {
    logger.error("client_notification.query_failed", {
      error: err,
      operation: "staff_recent",
      stage: "read",
    });
    return [];
  }
}
