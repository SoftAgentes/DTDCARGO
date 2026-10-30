import "server-only";

import { chatwootRouterConfig, type ChatwootRouterConfig } from "./config";
import { asignarEquipo, enviarMensaje, leerEtiquetas, obtenerConversacion, ponerEtiquetas } from "./router-api";
import { respuestaPara, etiquetasConSegmento, type Segmento } from "./segmento";
import type { ContextoChatwoot, ManejadorEvento } from "./webhook-procesar";

/**
 * Enrutamiento por segmento (SDD-0586, E10, pasos 10.2 y 10.3). Manejador de
 * `procesarEventoChatwoot`: corre después de registrar el evento y, si lanza,
 * el evento queda «fallido» y lo reintenta el cron de 2.3 con
 * `reprocesarEventosChatwoot` (Chatwoot 4.19.1 no reintenta).
 *
 * Solo para mensajes entrantes en la bandeja del número de leads:
 *   1. El segmento lo calcula el ERP en el momento (`chatwoot_segmento_contacto`,
 *      0505). Sin teléfono (usuario con username, 10.3) no se busca nada: es
 *      lead nuevo y, si trae BSUID, se guarda.
 *   2. Al cliente se le responde con la redirección al número de clientes; al
 *      que no tiene teléfono, con la respuesta neutra, igual para todos. Un solo
 *      mensaje, sin IA, y una vez por conversación cada 24 h (reserva en la
 *      0505): cada mensaje cuenta contra el cupo de Meta. Va primero porque es
 *      lo que el contacto ve; si después falla la etiqueta, el reintento no
 *      vuelve a responder.
 *   3. Etiqueta del segmento (reemplaza las de otros segmentos y conserva el
 *      resto) y equipo: Clientes o Leads.
 *
 * En los logs, solo códigos de error: ni teléfono, ni BSUID, ni texto.
 */
export const clasificarContacto: ManejadorEvento = async (ctx, evento) => {
  if (!evento.avisar) return;
  const cfg = chatwootRouterConfig();
  if (!cfg) return;

  let conv = evento.conversacion;
  if (conv.inboxId === null) {
    // Reproceso: el evento no guardó bandeja ni teléfono. Se leen de Chatwoot.
    const r = await obtenerConversacion(cfg, conv.id);
    if (!r.ok) throw new Error(`conversación: ${r.error}`);
    conv = r.data;
  }
  if (conv.inboxId !== cfg.inboxLeadsId) return;

  let segmento: Segmento;
  const sinTelefono = conv.telefonoUltimos10 === null;
  if (sinTelefono) {
    segmento = "lead_nuevo";
    if (conv.bsuid) {
      const { error } = await ctx.admin.rpc("chatwoot_guardar_bsuid", {
        p_tenant_id: ctx.tenantId,
        p_bsuid: conv.bsuid,
        p_conversation_id: conv.id,
      });
      if (error) throw new Error(`chatwoot_guardar_bsuid: ${error.code ?? "sin código"}`);
    }
  } else {
    const { data, error } = await ctx.admin.rpc("chatwoot_segmento_contacto", {
      p_tenant_id: ctx.tenantId,
      p_phone_last10: conv.telefonoUltimos10,
    });
    if (error) throw new Error(`chatwoot_segmento_contacto: ${error.code ?? "sin código"}`);
    if (data !== "cliente" && data !== "lead_registrado" && data !== "lead_nuevo") throw new Error("segmento desconocido");
    segmento = data;
  }

  const respuesta = respuestaPara(segmento, sinTelefono, cfg.numeroClientes);
  if (respuesta) await responderUnaVez(ctx, cfg, conv.id, respuesta.tipo, respuesta.texto);

  const actuales = conv.etiquetas ?? (await leerOLanzar(cfg, conv.id));
  const nuevas = etiquetasConSegmento(actuales, segmento);
  if (nuevas) {
    const r = await ponerEtiquetas(cfg, conv.id, nuevas);
    if (!r.ok) throw new Error(`etiquetas: ${r.error}`);
  }

  const equipo = segmento === "cliente" ? cfg.teamClientesId : cfg.teamLeadsId;
  if (conv.equipoId !== equipo) {
    const r = await asignarEquipo(cfg, conv.id, equipo);
    if (!r.ok) throw new Error(`equipo: ${r.error}`);
  }
};

async function leerOLanzar(cfg: ChatwootRouterConfig, conversacionId: number): Promise<string[]> {
  const r = await leerEtiquetas(cfg, conversacionId);
  if (!r.ok) throw new Error(`etiquetas: ${r.error}`);
  return r.data;
}

/**
 * Reserva → envía → confirma. Si Chatwoot rechaza el envío (`http_*`), libera
 * la reserva y lanza: el reintento vuelve a responder. Si el resultado es
 * incierto (`red`), deja la reserva y sigue: preferimos no responder dos veces
 * (la persona igual queda etiquetada y en su equipo para un humano). Una
 * reserva sin confirmar vence a los 10 min.
 */
async function responderUnaVez(
  ctx: ContextoChatwoot,
  cfg: ChatwootRouterConfig,
  conversacionId: number,
  tipo: "redireccion_cliente" | "neutra_sin_telefono",
  texto: string,
): Promise<void> {
  const reserva = await ctx.admin.rpc("chatwoot_reservar_respuesta", {
    p_tenant_id: ctx.tenantId,
    p_conversation_id: conversacionId,
    p_tipo: tipo,
  });
  if (reserva.error) throw new Error(`chatwoot_reservar_respuesta: ${reserva.error.code ?? "sin código"}`);
  if (reserva.data !== true) return;

  const envio = await enviarMensaje(cfg, conversacionId, texto);
  if (!envio.ok && envio.error === "red") {
    console.warn("[chatwoot] respuesta del bot incierta; no se repite");
    return;
  }
  const cierre = await ctx.admin.rpc("chatwoot_cerrar_respuesta", {
    p_tenant_id: ctx.tenantId,
    p_conversation_id: conversacionId,
    p_enviada: envio.ok,
  });
  if (cierre.error) console.warn(`[chatwoot] chatwoot_cerrar_respuesta: ${cierre.error.code ?? "sin código"}`);
  if (!envio.ok) throw new Error(`respuesta: ${envio.error}`);
}
