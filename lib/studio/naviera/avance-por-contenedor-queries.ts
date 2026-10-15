/**
 * SDD-0530 · La parte de servidor del zarpe y el arribo con sus envíos: la RPC
 * y los avisos. La regla, los tipos y los textos viven en
 * `avance-por-contenedor.ts`, que no importa nada de servidor y por eso lo
 * puede usar la pantalla.
 *
 * ⚠️ NOTA PARA UNIFICAR: el aviso por cambio de estado se programa hoy en dos
 * lugares con la misma llamada: `transitionShipment`
 * (`app/studio/(app)/tracking/[id]/actions.ts`, que edita la SDD-0522) y
 * `programarAvisosDelAvance` de aquí. Cuando entre la 0522, conviene que
 * Tracking use esta función (o una común) en vez de repetir el bloque.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";
import { scheduleClientNotifications } from "@/lib/studio/notifications/schedule-client-notifications";
import { statusEvent } from "@/lib/studio/notifications/client-notification-types";
import {
  leerResultadoAvance,
  mensajeErrorAvance,
  type AvanceContenedor,
  type EnvioAvanzado,
  type ResultadoAvance,
} from "./avance-por-contenedor";

export type AvanceGobernado =
  | { ok: true; resultado: ResultadoAvance }
  | { ok: false; error: string; code: string };

/**
 * Llama la RPC con el cliente de la SESIÓN (la base resuelve `auth.uid()`,
 * tenant y permisos). Nunca lanza.
 */
export async function avanzarContenedorGobernado(
  supabase: SupabaseClient,
  consolidationId: string,
  to: AvanceContenedor,
): Promise<AvanceGobernado> {
  try {
    const { data, error } = await supabase.rpc("advance_consolidation_governed", {
      p_consolidation_id: consolidationId,
      p_to: to,
    });
    if (error) {
      const code = String(error.code ?? "");
      if (code === "PGRST202" || code === "42883") {
        console.error(
          "[naviera] advance_consolidation_governed no existe: falta aplicar la migración " +
            "0477_naviera_zarpe_avanza_envios. El contenedor no cambió.",
        );
      }
      return { ok: false, code, error: mensajeErrorAvance(code) };
    }
    const resultado = leerResultadoAvance(data);
    if (!resultado || resultado.to !== to) {
      console.error("[naviera] advance_consolidation_governed devolvió una forma inesperada", data);
      return {
        ok: false,
        code: "forma",
        error:
          "El contenedor cambió, pero no se pudo leer el resultado. Revisa los envíos en Tracking.",
      };
    }
    return { ok: true, resultado };
  } catch (err) {
    console.error("[naviera] advance_consolidation_governed falló:", err);
    return { ok: false, code: "red", error: mensajeErrorAvance("red") };
  }
}

/**
 * Programa el aviso `status:<destino>` de cada envío que avanzó, con la MISMA
 * llamada que `transitionShipment` en Tracking: ancla de envío, Shipping Mark y
 * nombre del envío, hora del evento ahora. Las reglas del tenant deciden canal,
 * texto y si sale; los índices únicos de la agenda (0247/0389) impiden un
 * segundo aviso del mismo envío por el mismo evento.
 *
 * En serie a propósito, como el fan-out de la consolidación
 * (`scheduleForTargets`): cada aviso programado dispara un drain inline, y en
 * paralelo serían N drains a la vez.
 *
 * @returns cuántos avisos quedaron en la agenda.
 */
export async function programarAvisosDelAvance(
  admin: SupabaseClient,
  tenantId: string,
  destino: ShipmentStatus,
  avanzados: readonly EnvioAvanzado[],
  eventTime: Date = new Date(),
): Promise<number> {
  let programados = 0;
  for (const a of avanzados) {
    const res = await scheduleClientNotifications(admin, tenantId, {
      ancla: { kind: "shipment", shipmentId: a.shipmentId, shipmentCode: a.code },
      clientMarkbox: a.clientMarkbox,
      clientName: a.clientName,
      event: statusEvent(destino),
      eventTime,
    });
    programados += res.scheduled;
  }
  return programados;
}
