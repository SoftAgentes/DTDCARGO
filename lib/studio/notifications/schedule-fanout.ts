/**
 * Fan-out de avisos al cliente para las MÁQUINAS PARALELAS del journey
 * (SDD-0156 · Slice D).
 *
 * `transitionShipment` dispara un evento por UN envío. Pero consolidar, fijar el
 * ETA de la naviera o recibir en Venezuela son operaciones que tocan un
 * CONTENEDOR o un RECIBO que agrupan N envíos. Estos helpers resuelven la lista
 * de envíos afectados y llaman `scheduleClientNotifications` uno por uno
 * (idempotente por sí mismo). Best-effort: nunca throwean — un fallo acá no
 * rompe la operación de naviera/recepción.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleClientNotifications } from "./schedule-client-notifications";

/** Un envío alcanzado por el fan-out, con lo mínimo para programar el aviso. */
interface FanoutTarget {
  shipmentId: string;
  shipmentCode: string;
  clientMarkbox: string | null;
  clientName: string | null;
}

async function scheduleForTargets(
  admin: SupabaseClient,
  tenantId: string,
  event: string,
  targets: FanoutTarget[],
  eventTime: Date,
): Promise<number> {
  let scheduled = 0;
  for (const t of targets) {
    if (!t.clientMarkbox) continue;
    const res = await scheduleClientNotifications(admin, tenantId, {
      ancla: {
        kind: "shipment",
        shipmentId: t.shipmentId,
        shipmentCode: t.shipmentCode,
      },
      clientMarkbox: t.clientMarkbox,
      clientName: t.clientName,
      event,
      eventTime,
    });
    scheduled += res.scheduled;
  }
  return scheduled;
}

/**
 * Programa un evento de contenedor (`consolidated`, `eta_set`) para todos los
 * envíos asignados a una consolidación. Resuelve los envíos por
 * `consolidation_items` (que ya guarda shipment_id + el Shipping Mark snapshot) y
 * completa el código real desde `shipments`.
 */
export async function scheduleConsolidationEvent(
  admin: SupabaseClient,
  tenantId: string,
  consolidationId: string,
  event: string,
  eventTime: Date = new Date(),
): Promise<number> {
  try {
    const { data: items } = await admin
      .from("consolidation_items")
      .select("shipment_id, client_markbox, client_name")
      .eq("tenant_id", tenantId)
      .eq("consolidation_id", consolidationId)
      .not("shipment_id", "is", null);

    const rows = (items ?? []) as Array<{
      shipment_id: string;
      client_markbox: string | null;
      client_name: string | null;
    }>;
    if (rows.length === 0) return 0;

    // Código real de cada envío (consolidation_items no lo guarda).
    const ids = rows.map((r) => r.shipment_id);
    const { data: shipments } = await admin
      .from("shipments")
      .select("id, code, client_markbox, client_name")
      .in("id", ids);
    const byId = new Map(
      ((shipments ?? []) as Array<{
        id: string;
        code: string;
        client_markbox: string | null;
        client_name: string | null;
      }>).map((s) => [s.id, s]),
    );

    const targets: FanoutTarget[] = rows.map((r) => {
      const s = byId.get(r.shipment_id);
      return {
        shipmentId: r.shipment_id,
        shipmentCode: s?.code ?? "",
        clientMarkbox: s?.client_markbox ?? r.client_markbox,
        clientName: s?.client_name ?? r.client_name,
      };
    });

    return await scheduleForTargets(admin, tenantId, event, targets, eventTime);
  } catch (err) {
    console.error(`[client-notif] scheduleConsolidationEvent falló:`, err);
    return 0;
  }
}

/**
 * Programa un evento de itinerario para TODAS las consolidaciones de un sailing
 * (`eta_set` cuando la naviera fija/actualiza el ETA). Fan-out sailing →
 * consolidations → consolidation_items → envíos.
 */
export async function scheduleSailingEvent(
  admin: SupabaseClient,
  tenantId: string,
  sailingId: string,
  event: string,
  eventTime: Date = new Date(),
): Promise<number> {
  try {
    const { data: consols } = await admin
      .from("consolidations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("sailing_id", sailingId)
      .is("deleted_at", null);

    const rows = (consols ?? []) as Array<{ id: string }>;
    let scheduled = 0;
    for (const c of rows) {
      scheduled += await scheduleConsolidationEvent(
        admin,
        tenantId,
        c.id,
        event,
        eventTime,
      );
    }
    return scheduled;
  } catch (err) {
    console.error(`[client-notif] scheduleSailingEvent falló:`, err);
    return 0;
  }
}

/**
 * Programa `received_ve` para los envíos de las cajas de un recibo VE — el aviso
 * «tu carga llegó a Venezuela». Desde el 2026-07-19 es el disparador CANÓNICO
 * del arribo: en ese cambio se quitó el mail `shipment_arrived` que mandaba la
 * transición de status, para no duplicarlo.
 *
 * Las cajas no guardan shipment_id → se resuelve el envío por el Shipping Mark
 * (el envío no terminal más reciente de ese cliente).
 *
 * 🔴 **Sin envío resoluble, el cliente se queda sin el aviso que más espera.**
 * Hasta SDD-0311 eso era un `continue` mudo: el recibo se creaba, la pantalla
 * decía que todo salió bien, y nadie se enteraba de que a ese cliente no se le
 * escribió. Es exactamente el hueco que SDD-0282 le cerró a la recepción en
 * China y que acá quedó abierto — en el lado que más importa, porque «llegó a
 * Yiwu» se puede esperar y «llegó a Venezuela» es la llamada que el cliente
 * hace al día siguiente.
 *
 * Ahora sale en `sinDestino` para que el llamador lo asiente y el operador de
 * oficina pueda escribirle a mano.
 *
 * Best-effort: nunca throwea. Un fallo acá no rompe la recepción del contenedor.
 */
export async function scheduleReceiptVeReceived(
  admin: SupabaseClient,
  tenantId: string,
  markboxes: Array<string | null | undefined>,
  eventTime: Date = new Date(),
): Promise<FanoutResultado> {
  const vacio: FanoutResultado = { scheduled: 0, sinDestino: [] };
  try {
    const marks = Array.from(
      new Set(
        markboxes
          .map((m) => (m ?? "").trim())
          .filter((m): m is string => m.length > 0),
      ),
    );
    if (marks.length === 0) return vacio;

    let scheduled = 0;
    const sinDestino: string[] = [];
    for (const markbox of marks) {
      const { data: shipment } = await admin
        .from("shipments")
        .select("id, code, client_markbox, client_name")
        .eq("tenant_id", tenantId)
        .eq("client_markbox", markbox)
        .not("status", "in", "(delivered,cancelled)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          code: string;
          client_markbox: string | null;
          client_name: string | null;
        }>();

      if (!shipment) {
        // El caso que antes se perdía. No se inventa un destino: mal-notificar
        // a otro cliente sería peor que no notificar.
        sinDestino.push(markbox);
        continue;
      }

      scheduled += await scheduleForTargets(
        admin,
        tenantId,
        "received_ve",
        [
          {
            shipmentId: shipment.id,
            shipmentCode: shipment.code,
            clientMarkbox: shipment.client_markbox,
            clientName: shipment.client_name,
          },
        ],
        eventTime,
      );
    }
    return { scheduled, sinDestino };
  } catch (err) {
    console.error(`[client-notif] scheduleReceiptVeReceived falló:`, err);
    return vacio;
  }
}

/**
 * Resultado de un fan-out que puede quedarse sin destino.
 *
 * SDD-0282: antes esto devolvía sólo un número y el salto era INVISIBLE. Un
 * `scheduled: 0` puede significar dos cosas opuestas —"no había nadie a quien
 * avisar" o "había un cliente esperando y no se le avisó"— y sin separarlas
 * nadie se entera nunca de la segunda.
 */
export interface FanoutResultado {
  /** Avisos efectivamente programados. */
  scheduled: number;
  /** Shipping Marks que NO se pudieron notificar por falta de envío abierto. */
  sinDestino: string[];
}

/**
 * Programa `status:in_warehouse` ("Recibido en bodega China") para los envíos de
 * los Shipping Mark recibidos en Yiwu (SDD-0162, puente 0154↔0156). Espeja
 * `scheduleReceiptVeReceived`: la caja recién recibida no trae shipment_id → se
 * resuelve el envío no terminal más reciente por Shipping Mark.
 *
 * 🔴 **El caso sin envío abierto NO es raro: es el normal en una primera
 * compra.** El cliente anuncia, la caja llega a Yiwu, y el envío recién se crea
 * al consolidar — que puede ser semanas después. En esa ventana
 * `client_notification_schedule.shipment_id` es `not null`, así que no hay
 * dónde colgar el aviso y el cliente se queda sin saber que su mercancía llegó.
 * Justo cuando más lo pregunta.
 *
 * Hasta SDD-0282 eso era un `continue` mudo. Ahora sale en `sinDestino` para que
 * el llamador lo deje asentado en la bitácora de la recepción: no arregla el
 * hueco de fondo —eso pide migración— pero deja de ser invisible.
 *
 * Best-effort: nunca throwea. Un fallo acá no rompe la recepción.
 */
/**
 * Una recepción a notificar. La compra es opcional: la recepción manual de la
 * oficina puede no tener una detrás (mercancía que nadie pre-declaró).
 */
export interface RecepcionANotificar {
  markbox: string | null | undefined;
  /** La compra que materializa esta caja, si se conoce. */
  prealertaId?: string | null;
  prealertaCode?: string | null;
}

export async function scheduleReceiptInWarehouse(
  admin: SupabaseClient,
  tenantId: string,
  recepciones: RecepcionANotificar[],
  eventTime: Date = new Date(),
): Promise<FanoutResultado> {
  const vacio: FanoutResultado = { scheduled: 0, sinDestino: [] };
  try {
    // Dedup por Shipping Mark, quedándose con la primera entrada que traiga
    // compra: si el mismo cliente aparece dos veces y sólo una sabe de qué
    // compra viene, esa es la útil.
    const porMark = new Map<string, RecepcionANotificar>();
    for (const r of recepciones) {
      const mark = (r.markbox ?? "").trim();
      if (!mark) continue;
      const previo = porMark.get(mark);
      if (!previo || (!previo.prealertaId && r.prealertaId)) {
        porMark.set(mark, { ...r, markbox: mark });
      }
    }
    if (porMark.size === 0) return vacio;

    let scheduled = 0;
    const sinDestino: string[] = [];
    for (const [markbox, rec] of porMark) {
      const { data: shipment } = await admin
        .from("shipments")
        .select("id, code, client_markbox, client_name")
        .eq("tenant_id", tenantId)
        .eq("client_markbox", markbox)
        .not("status", "in", "(delivered,cancelled)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          code: string;
          client_markbox: string | null;
          client_name: string | null;
        }>();

      if (shipment) {
        scheduled += await scheduleForTargets(
          admin,
          tenantId,
          "status:in_warehouse",
          [
            {
              shipmentId: shipment.id,
              shipmentCode: shipment.code,
              clientMarkbox: shipment.client_markbox,
              clientName: shipment.client_name,
            },
          ],
          eventTime,
        );
        continue;
      }

      // ── SDD-0283 · sin envío, el aviso cuelga de la COMPRA ──
      //
      // Éste es el caso que antes se perdía, y no es el raro: es el normal en
      // una primera compra. El MISMO `trigger_event` a propósito — significa lo
      // mismo cuelgue de donde cuelgue, así que el tenant que ya lo tenía
      // configurado no tiene que volver a configurar nada.
      if (rec.prealertaId && rec.prealertaCode) {
        const res = await scheduleClientNotifications(admin, tenantId, {
          ancla: {
            kind: "prealerta",
            prealertaId: rec.prealertaId,
            prealertaCode: rec.prealertaCode,
          },
          clientMarkbox: markbox,
          clientName: null,
          event: "status:in_warehouse",
          eventTime,
        });
        if (res.scheduled > 0) {
          scheduled += res.scheduled;
          continue;
        }
        // Si faltó la migración 0389, esto sigue siendo un cliente sin avisar y
        // tiene que salir en la nota de la bitácora igual que antes.
      }

      sinDestino.push(markbox);
    }
    return { scheduled, sinDestino };
  } catch (err) {
    console.error(`[client-notif] scheduleReceiptInWarehouse falló:`, err);
    return vacio;
  }
}

/**
 * La nota que queda en la bitácora de la recepción cuando un cliente se quedó
 * sin aviso. PURA — la escriben los dos caminos de recepción (el operario en
 * `/m/cn` y la oficina en `/studio/cn`), así que el texto vive en un solo lugar.
 *
 * Devuelve `null` si no hubo nadie sin avisar: así el llamador no escribe una
 * nota vacía en la bitácora.
 */
export function notaSinAviso(sinDestino: readonly string[]): string | null {
  if (sinDestino.length === 0) return null;
  const marks = sinDestino.join(", ");
  return (
    `Aviso al cliente NO enviado (${marks}): no tiene un envío abierto donde ` +
    `colgarlo. Se le avisa al consolidar. Si está esperando respuesta, ` +
    `escríbele.`
  );
}
