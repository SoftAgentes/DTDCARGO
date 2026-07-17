/**
 * Motor de programación de avisos al cliente (SDD-0156 · Slice A).
 *
 * `scheduleClientNotifications` corre cuando ocurre un evento del dominio (hoy:
 * cambio de `shipments.status` en `transitionShipment`). Resuelve la regla
 * aplicable (override por cliente → default del tenant), calcula
 * `scheduled_for = ancla + offset` e inserta una fila idempotente en la agenda
 * `client_notification_schedule`. Después dispara un drain inline best-effort
 * (para los offsets ≤0 = inmediatos); el cron `client-notifications-drain` es el
 * backstop de durabilidad.
 *
 * Best-effort: nunca throwea — un fallo acá no rompe el cambio de estado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveNotifCopy,
  type ClientNotificationRule,
  type DispatchChannel,
  type NotificationAnchor,
} from "./client-notification-types";
import { drainClientNotifications } from "./drain-client-notifications";
import { resolveShipmentEta, resolveShipmentEtd } from "./resolve-shipment-eta";

export interface ClientDomainEvent {
  shipmentId: string;
  shipmentCode: string;
  clientMarkbox: string | null;
  clientName: string | null;
  /** Clave de evento (ej. 'status:shipped'). */
  event: string;
  /** Ancla para anchor='event'. Default: ahora. */
  eventTime?: Date;
}

export interface ScheduleResult {
  scheduled: number;
  skipped: number;
}

/**
 * Programa los avisos de un evento para un envío según las reglas del tenant.
 * @returns cuántos avisos se agendaron / se saltaron.
 */
export async function scheduleClientNotifications(
  admin: SupabaseClient,
  tenantId: string,
  ev: ClientDomainEvent,
): Promise<ScheduleResult> {
  try {
    if (!ev.clientMarkbox) return { scheduled: 0, skipped: 0 };

    // Resolver el cliente por markbox (para overrides + destino).
    const { data: client } = await admin
      .from("clients")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("markbox", ev.clientMarkbox)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();
    const clientId = client?.id ?? null;

    // Reglas activas del evento: el default del tenant (client_id null) + el
    // override de ESTE cliente (client_id = clientId), si existe.
    const orFilter =
      clientId != null
        ? `client_id.is.null,client_id.eq.${clientId}`
        : `client_id.is.null`;
    const { data: rulesRaw } = await admin
      .from("client_notification_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("trigger_event", ev.event)
      .eq("active", true)
      .or(orFilter);

    const rules = (rulesRaw ?? []) as ClientNotificationRule[];
    if (rules.length === 0) return { scheduled: 0, skipped: 0 };

    // Precedencia: override del cliente gana al default del tenant.
    const chosen =
      rules.find((r) => r.client_id === clientId && clientId != null) ??
      rules.find((r) => r.client_id === null);
    if (!chosen) return { scheduled: 0, skipped: 0 };
    if (chosen.channel === "none") return { scheduled: 0, skipped: 1 };

    // Ancla + offset → scheduled_for.
    const anchorTime = await resolveAnchorTime(
      admin,
      ev.shipmentId,
      chosen.anchor,
      ev.eventTime ?? new Date(),
    );
    if (!anchorTime) {
      // ancla ETA/ETD sin fecha disponible aún (envío no consolidado / sin
      // itinerario) → se salta, no rompe.
      console.warn(
        `[client-notif] regla ${chosen.id} anclada en '${chosen.anchor}' sin fecha disponible (envío ${ev.shipmentCode}) → skip`,
      );
      return { scheduled: 0, skipped: 1 };
    }
    const scheduledFor = new Date(
      anchorTime.getTime() + chosen.offset_minutes * 60_000,
    );

    const copy = resolveNotifCopy({
      event: ev.event,
      templateKey: chosen.template_key,
      customTitle: chosen.custom_title,
      customBody: chosen.custom_body,
    });

    // Insert idempotente. El índice único parcial (shipment, event, rule) where
    // status<>'canceled' garantiza no re-programar; un 2º intento choca con
    // 23505 y lo tratamos como no-op (idempotencia entre dispatchers).
    const { error: insErr } = await admin
      .from("client_notification_schedule")
      .insert({
        tenant_id: tenantId,
        shipment_id: ev.shipmentId,
        client_markbox: ev.clientMarkbox,
        rule_id: chosen.id,
        trigger_event: ev.event,
        channel: chosen.channel as DispatchChannel,
        template_key: chosen.template_key,
        custom_title: chosen.custom_title,
        custom_body: chosen.custom_body,
        scheduled_for: scheduledFor.toISOString(),
        payload: {
          shipmentCode: ev.shipmentCode,
          clientName: ev.clientName,
          title: copy.title,
          body: copy.body,
        },
        status: "scheduled",
      });

    if (insErr) {
      if (insErr.code === "23505") {
        // Ya estaba programado (mismo envío+evento+regla) → idempotente.
        return { scheduled: 0, skipped: 1 };
      }
      console.error(`[client-notif] insert agenda falló:`, insErr.message);
      return { scheduled: 0, skipped: 1 };
    }

    // Drain inline best-effort: entrega los inmediatos (offset ≤0) sin esperar al
    // cron. Si falla, el cron los recoge. No bloquea ni throwea.
    void drainClientNotifications(admin).catch((err) => {
      console.error("[client-notif] drain inline falló:", err);
    });

    return { scheduled: 1, skipped: 0 };
  } catch (err) {
    console.error(`[client-notif] scheduleClientNotifications falló:`, err);
    return { scheduled: 0, skipped: 0 };
  }
}

/**
 * Resuelve el timestamp-ancla de una regla (SDD-0156 · Slice D).
 *  - 'event' → la hora del evento (default: ahora).
 *  - 'eta'   → ETA real del envío: pod_eta de SeaRates → sailings.eta →
 *              warehouse_receipts_ve.eta (`resolveShipmentEta`).
 *  - 'etd'   → sailings.etd del itinerario (`resolveShipmentEtd`).
 * Sin fecha disponible (envío no consolidado / sin itinerario) → null: la regla
 * anclada en ETA/ETD se salta, no rompe.
 */
async function resolveAnchorTime(
  admin: SupabaseClient,
  shipmentId: string,
  anchor: NotificationAnchor,
  eventTime: Date,
): Promise<Date | null> {
  if (anchor === "event") return eventTime;
  if (anchor === "eta") return resolveShipmentEta(admin, shipmentId);
  if (anchor === "etd") return resolveShipmentEtd(admin, shipmentId);
  return null;
}
