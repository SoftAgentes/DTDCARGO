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
      shipmentId: t.shipmentId,
      shipmentCode: t.shipmentCode,
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
 * Programa `received_ve` para los envíos de las cajas de un recibo VE. Las cajas
 * no guardan shipment_id → se resuelve el envío por el Shipping Mark (el envío no
 * terminal más reciente de ese cliente). Sin envío resoluble para un Shipping
 * Mark → esa caja se salta (no se mal-notifica a otro cliente).
 */
export async function scheduleReceiptVeReceived(
  admin: SupabaseClient,
  tenantId: string,
  markboxes: Array<string | null | undefined>,
  eventTime: Date = new Date(),
): Promise<number> {
  try {
    const marks = Array.from(
      new Set(
        markboxes
          .map((m) => (m ?? "").trim())
          .filter((m): m is string => m.length > 0),
      ),
    );
    if (marks.length === 0) return 0;

    let scheduled = 0;
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
      if (!shipment) continue;

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
    return scheduled;
  } catch (err) {
    console.error(`[client-notif] scheduleReceiptVeReceived falló:`, err);
    return 0;
  }
}
