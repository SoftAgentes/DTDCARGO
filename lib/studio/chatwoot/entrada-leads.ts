import "server-only";

import { chatwootBandejasWhatsapp, chatwootRouterConfig } from "./config";
import { obtenerConversacionYContacto } from "./router-api";
import type { ContactoEntrada, ConversacionChatwoot } from "./webhook-events";
import type { ContextoChatwoot, ManejadorEvento } from "./webhook-procesar";

/**
 * Entrada de leads desde Chatwoot (SDD-0587, paso 6.4). Manejador de
 * `procesarEventoChatwoot`:
 *   - `conversation_created` o un mensaje entrante: crea la tarjeta si no existe,
 *     o la completa (`crm_entrada_chatwoot`). Quien estaba en «Perdido» y escribe
 *     vuelve a «Registrado / recontacto» con tarea.
 *   - `conversation_updated` con asignado: da asesor a la tarjeta que no lo tiene
 *     (`crm_asesor_desde_chatwoot`). No crea tarjetas.
 *
 * Puede correr dos veces sin efecto doble: la idempotencia está en las RPC. Si la
 * base falla, lanza: el evento queda «fallido» y lo reintenta el cron de 2.3. Sin
 * la migración no lanza: un evento fallido repetiría el aviso push y clasificar
 * en cada reintento, y la tarjeta se crea con el siguiente mensaje.
 *
 * En los logs, solo códigos: ni nombre, ni teléfono, ni BSUID.
 */
export const entrarLead: ManejadorEvento = async (ctx, evento) => {
  const entra = evento.evento === "conversation_created" || evento.avisar;
  const asigna = evento.evento === "conversation_updated";
  if (!entra && !asigna) return;

  const datos = await datosDelContacto(ctx, evento.conversacion);
  if (!datos) return;
  const { conversacion: conv, contacto } = datos;
  const agente = contacto.asignadoEsBot ? null : conv.asignadoId;
  const bsuid = conv.bsuid ?? null;

  if (asigna) {
    if (agente === null) return;
    const { error } = await ctx.admin.rpc("crm_asesor_desde_chatwoot", {
      p_tenant_id: ctx.tenantId,
      p_contact_id: contacto.contactoId,
      p_bsuid: bsuid,
      p_phone_last10: conv.telefonoUltimos10,
      p_agente_chatwoot_id: agente,
    });
    if (error) fallarSalvoSinMigracion("crm_asesor_desde_chatwoot", error);
    return;
  }

  const fuente = fuenteDeCanal(contacto.canal, conv.inboxId);
  if (!fuente || (contacto.contactoId === null && bsuid === null)) return;
  const { error } = await ctx.admin.rpc("crm_entrada_chatwoot", {
    p_tenant_id: ctx.tenantId,
    p_contact_id: contacto.contactoId,
    p_bsuid: bsuid,
    p_phone_last10: conv.telefonoUltimos10,
    p_nombre_visible: contacto.nombre,
    p_fuente: fuente,
    p_agente_chatwoot_id: agente,
    p_clave_mensaje: evento.evento === "message_created" ? evento.clave : null,
    p_ocurrio_at: conv.ultimaActividad,
  });
  if (error) fallarSalvoSinMigracion("crm_entrada_chatwoot", error);
};

async function datosDelContacto(
  ctx: ContextoChatwoot,
  conversacion: ConversacionChatwoot,
): Promise<{ conversacion: ConversacionChatwoot; contacto: ContactoEntrada } | null> {
  if (ctx.contacto) return { conversacion, contacto: ctx.contacto };
  // Reproceso: el evento no guardó el contacto (0504). Se lee de Chatwoot; sin el
  // token de E10 no hay cómo, y el siguiente mensaje la crea.
  const cfg = chatwootRouterConfig();
  if (!cfg) {
    console.warn("[chatwoot] entrada de leads sin token para releer la conversación");
    return null;
  }
  const r = await obtenerConversacionYContacto(cfg, conversacion.id);
  if (!r.ok) throw new Error(`conversación: ${r.error}`);
  return r.data;
}

/**
 * La fuente sale del canal y no se pisa nunca (§3). Sin fuente no hay tarjeta:
 * la bandeja API «Archivo Kommo» de E5 y las de prueba no traen leads, y un número
 * de WhatsApp que no es ni el de leads ni el de clientes no se atribuye a ciegas.
 */
export function fuenteDeCanal(
  canal: string | null,
  bandeja: number | null,
): "whatsapp_leads" | "whatsapp_clientes" | "instagram" | "messenger" | "correo" | null {
  switch (canal) {
    case "Channel::Whatsapp": {
      const { leads, clientes } = chatwootBandejasWhatsapp();
      if (bandeja !== null && bandeja === leads) return "whatsapp_leads";
      if (bandeja !== null && bandeja === clientes) return "whatsapp_clientes";
      console.warn("[chatwoot] bandeja de WhatsApp sin configurar: no se crea tarjeta");
      return null;
    }
    case "Channel::Instagram":
      return "instagram";
    case "Channel::FacebookPage":
      return "messenger";
    case "Channel::Email":
      return "correo";
    default:
      return null;
  }
}

/** Función o tabla que todavía no existe: la migración de 6.4 o la 0506 sin aplicar. */
const SIN_MIGRACION: ReadonlySet<string> = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);

function fallarSalvoSinMigracion(rpc: string, error: { code?: string }): void {
  const codigo = error.code ?? "sin código";
  if (SIN_MIGRACION.has(codigo)) {
    console.warn(`[chatwoot] ${rpc} todavía no existe: ${codigo}`);
    return;
  }
  throw new Error(`${rpc}: ${codigo}`);
}
