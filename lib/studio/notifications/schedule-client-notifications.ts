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

/**
 * De qué cuelga el aviso. **Exactamente una** — lo garantiza el CHECK
 * `client_notif_sched_una_ancla` de la migr 0389, no la buena voluntad de los
 * llamadores.
 *
 * SDD-0283: hasta la 0389 sólo existía el ancla de envío, y eso dejaba sin
 * avisar justo el momento que el cliente más espera —"mi carga llegó a Yiwu"—,
 * porque el envío nace al consolidar, semanas después.
 */
export type AnclaDelAviso =
  | { kind: "shipment"; shipmentId: string; shipmentCode: string }
  | { kind: "prealerta"; prealertaId: string; prealertaCode: string };

export interface ClientDomainEvent {
  ancla: AnclaDelAviso;
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
  /**
   * SDD-0283: `true` cuando el aviso no se pudo programar porque la migr 0389
   * todavía no está aplicada. NO es un fallo del cambio de estado ni del
   * llamador: es el sistema comportándose exactamente como antes de la
   * migración. Se distingue de un `skipped` normal para que el llamador pueda
   * decirlo con esas palabras en vez de inventar una causa.
   */
  faltaMigracion?: boolean;
}

/** Códigos de Postgres que significan "la migr 0389 no está aplicada acá". */
function esColumnaInexistente(code: string | undefined): boolean {
  // 42703 = undefined_column · PGRST204 = PostgREST no encontró la columna en
  // su caché de schema (el mismo caso, visto desde el otro lado).
  return code === "42703" || code === "PGRST204";
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
    const anchorTime = await resolveAnchorTime(admin, ev, chosen.anchor);
    if (!anchorTime) {
      // ancla ETA/ETD sin fecha disponible aún (envío no consolidado / sin
      // itinerario, o un aviso de COMPRA que por definición no tiene ETA) → se
      // salta, no rompe.
      console.warn(
        `[client-notif] regla ${chosen.id} anclada en '${chosen.anchor}' sin fecha disponible (${codigoDelAncla(ev.ancla)}) → skip`,
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

    // Insert idempotente. Los índices únicos parciales (uno por ancla) where
    // status<>'canceled' garantizan no re-programar; un 2º intento choca con
    // 23505 y lo tratamos como no-op (idempotencia entre dispatchers).
    // Se captura la variante en una const para que TypeScript la estreche en
    // todo el bloque de abajo: un booleano suelto no narrowea nada.
    const ancla = ev.ancla;
    const esCompra = ancla.kind === "prealerta";
    const { error: insErr } = await admin
      .from("client_notification_schedule")
      .insert({
        tenant_id: tenantId,
        ...(esCompra
          ? { prealerta_id: ancla.prealertaId }
          : { shipment_id: ancla.shipmentId }),
        client_markbox: ev.clientMarkbox,
        rule_id: chosen.id,
        trigger_event: ev.event,
        channel: chosen.channel as DispatchChannel,
        template_key: chosen.template_key,
        custom_title: chosen.custom_title,
        custom_body: chosen.custom_body,
        scheduled_for: scheduledFor.toISOString(),
        payload: {
          // `shipmentCode` se conserva SÓLO para el ancla de envío: las filas
          // que ya están en vuelo lo traen y el drain viejo lo lee. Los campos
          // `anchor*` son los nuevos y sirven para las dos anclas.
          ...(ancla.kind === "shipment" ? { shipmentCode: ancla.shipmentCode } : {}),
          anchorKind: ancla.kind,
          anchorCode: codigoDelAncla(ancla),
          anchorLabel: esCompra ? "Compra" : "Envío",
          portalPath: rutaDelPortal(ancla),
          clientName: ev.clientName,
          title: copy.title,
          body: copy.body,
        },
        status: "scheduled",
      });

    if (insErr) {
      // 🔴 La migr 0389 todavía no está aplicada acá. NO es un error del
      // llamador ni algo que reintentar: es el sistema comportándose como antes
      // de la migración. Se avisa una vez, claro, y se sigue — la recepción ya
      // quedó registrada y SDD-0282 deja la nota en su bitácora.
      if (esCompra && esColumnaInexistente(insErr.code)) {
        console.warn(
          "[client-notif] aviso de COMPRA no programado: falta aplicar la migración " +
            "0389_aviso_que_cuelga_de_la_compra. Hasta entonces sólo se avisa por envío.",
        );
        return { scheduled: 0, skipped: 1, faltaMigracion: true };
      }
      if (insErr.code === "23505") {
        // Ya estaba programado (mismo envío+evento+regla) → idempotente.
        // Para anclas EXTERNAS (eta/etd), la fecha puede haberse corregido desde
        // que se programó (la naviera mueve el ETA seguido). Re-anclamos el aviso
        // AÚN PENDIENTE a la fecha fresca; si ya se envió (status≠'scheduled') no
        // se toca (no se reenvía). Las anclas 'event' no cambian → no se re-anclan.
        // Un aviso de COMPRA nunca se re-ancla: sus reglas sólo resuelven con
        // anchor='event' (no hay ETA de una compra), y esas no se mueven.
        if (ancla.kind === "shipment" && (chosen.anchor === "eta" || chosen.anchor === "etd")) {
          await admin
            .from("client_notification_schedule")
            .update({ scheduled_for: scheduledFor.toISOString() })
            .eq("shipment_id", ancla.shipmentId)
            .eq("trigger_event", ev.event)
            .eq("rule_id", chosen.id)
            .eq("status", "scheduled");
        }
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

/** El código que el humano reconoce: `ENV-7` o `DTD-1-2-3`. PURA. */
export function codigoDelAncla(ancla: AnclaDelAviso): string {
  return ancla.kind === "shipment" ? ancla.shipmentCode : ancla.prealertaCode;
}

/**
 * A dónde lleva el aviso dentro del portal. PURA.
 *
 * El aviso de una COMPRA lleva a `/portal/compras/[code]` (SDD-0307), que es
 * donde el cliente ve qué llegó a Yiwu. Mandarlo a `/portal/envios/...` sería
 * mandarlo a una pantalla que todavía no tiene nada suyo — justamente porque el
 * envío aún no existe.
 */
export function rutaDelPortal(ancla: AnclaDelAviso): string {
  const code = encodeURIComponent(codigoDelAncla(ancla));
  return ancla.kind === "shipment"
    ? `/portal/envios/${code}`
    : `/portal/compras/${code}`;
}

/**
 * Resuelve el timestamp-ancla de una regla (SDD-0156 · Slice D).
 *  - 'event' → la hora del evento (default: ahora).
 *  - 'eta'   → ETA real del envío: pod_eta de SeaRates → sailings.eta →
 *              warehouse_receipts_ve.eta (`resolveShipmentEta`).
 *  - 'etd'   → sailings.etd del itinerario (`resolveShipmentEtd`).
 *
 * Sin fecha disponible (envío no consolidado / sin itinerario) → null: la regla
 * anclada en ETA/ETD se salta, no rompe.
 *
 * SDD-0283 · **una COMPRA no tiene ETA ni ETD**, y no es una carencia temporal:
 * esas fechas nacen del itinerario de la naviera, que no existe hasta que hay
 * contenedor. Una regla anclada ahí sobre un aviso de compra devuelve null y se
 * salta — que es lo correcto. Inventarle "ahora" la convertiría en un aviso
 * inmediato que el tenant nunca pidió.
 */
async function resolveAnchorTime(
  admin: SupabaseClient,
  ev: ClientDomainEvent,
  anchor: NotificationAnchor,
): Promise<Date | null> {
  const eventTime = ev.eventTime ?? new Date();
  if (anchor === "event") return eventTime;
  if (ev.ancla.kind !== "shipment") return null;
  if (anchor === "eta") return resolveShipmentEta(admin, ev.ancla.shipmentId);
  if (anchor === "etd") return resolveShipmentEtd(admin, ev.ancla.shipmentId);
  return null;
}
