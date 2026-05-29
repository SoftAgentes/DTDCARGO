/**
 * Notificaciones push de eventos del despacho (Sprint 4 v3).
 *
 * Helpers que encolan pushes en momentos clave del flujo OD → entrega.
 * Todos best-effort: si fallan, loguean pero NO rompen la mutación
 * principal (consistente con el patrón mail/telegram).
 *
 * Patrón: encolar en outbox (durable) + drain inline fire-and-forget
 * (push casi-instantáneo). El cron /api/cron/push-drain es backstop.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  drainOperarioPushOutbox,
  enqueueOperarioPush,
} from "./operario-push-outbox";

/**
 * OD pasó a `lista` (bodeguero cerró carga) → notificar al camionero
 * asignado que su ruta está lista para salir.
 *
 * Resuelve el operario camionero desde dispatch_orders.driver_id →
 * operario_pins.tms_driver_id (link de Sprint 0).
 */
export async function notifyCamioneroOdLista(
  admin: SupabaseClient,
  odId: string,
): Promise<void> {
  try {
    const { data: od } = await admin
      .from("dispatch_orders")
      .select(
        "id, tenant_id, order_code, driver_id, route:dispatch_routes!route_id ( name )",
      )
      .eq("id", odId)
      .maybeSingle<{
        id: string;
        tenant_id: string;
        order_code: string;
        driver_id: string | null;
        route: { name: string } | { name: string }[] | null;
      }>();

    if (!od || !od.driver_id) return;

    // Operario camionero linkeado a ese driver
    const { data: op } = await admin
      .from("operario_pins")
      .select("id")
      .eq("tenant_id", od.tenant_id)
      .eq("tms_driver_id", od.driver_id)
      .eq("active", true)
      .maybeSingle<{ id: string }>();

    if (!op) return;

    const routeName = Array.isArray(od.route)
      ? od.route[0]?.name
      : od.route?.name;

    await enqueueOperarioPush(admin, od.tenant_id, op.id, {
      title: "Ruta lista para salir",
      body: `${od.order_code}${routeName ? ` · ${routeName}` : ""} está cargada. Tocá para ver la ruta.`,
      url: "/m/ve/camionero",
      tag: `od-lista-${od.id}`,
    });

    // Drain inline best-effort (no await bloqueante crítico, pero sí lo
    // esperamos para aprovechar el mismo invocation serverless).
    await drainOperarioPushOutbox(admin);
  } catch (err) {
    console.error("[notify-dispatch] notifyCamioneroOdLista error:", err);
  }
}

/**
 * Receipt VE pasó a `recibiendo`/`sellado` o llega un contenedor nuevo →
 * (futuro) notificar al bodeguero de guardia. Stub para extensión.
 */
export async function notifyBodegueroReceiptVe(): Promise<void> {
  // Reservado para iteración futura · el bodeguero ya ve el receipt en
  // su lista al refrescar. Push acá tendría sentido si el contenedor se
  // anuncia mientras el bodeguero no está mirando la PWA.
}
