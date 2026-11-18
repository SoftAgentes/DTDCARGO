import "server-only";

import { chatwootAtributosContactoActivos, chatwootBandejasWhatsapp, chatwootRouterConfig } from "./config";
import { atributosPorEscribir, shippingMarkVisible, SIN_FICHA, type FichaErp } from "./contacto-erp";
import { escribirAtributosContacto, leerAtributosContacto, obtenerConversacionYContacto } from "./router-api";
import type { ContextoChatwoot, ManejadorEvento } from "./webhook-procesar";

/**
 * Segmento y Shipping Mark del ERP en el contacto de Chatwoot (SDD-0649).
 * Manejador de `procesarEventoChatwoot`, después de `clasificarContacto`.
 *
 * Solo para mensajes entrantes en las bandejas de WhatsApp, la de leads y la de
 * clientes (D5), y solo con `CHATWOOT_ATRIBUTOS_CONTACTO=1`:
 *   1. El segmento sale de la 0505 (`chatwoot_segmento_contacto`), en el momento.
 *   2. Si hay ficha, su Shipping Mark vigente (D2), leído con service_role de la
 *      ficha ÚNICA con esos 10 dígitos, la misma regla de la 0505.
 *   3. Se leen los atributos del contacto y solo se escribe si cambian.
 *
 * Si algo falla, lanza: el evento queda «fallido» y lo retoma el reproceso de
 * 2.3. La redirección de `clasificarContacto` no se repite porque tiene su
 * propia reserva (0505).
 *
 * En los logs, solo códigos: ni teléfono, ni código, ni nombre.
 */
export const marcarContactoErp: ManejadorEvento = async (ctx, evento) => {
  if (!evento.avisar) return;
  if (!chatwootAtributosContactoActivos()) return;
  const cfg = chatwootRouterConfig();
  if (!cfg) return;
  const bandejas = chatwootBandejasWhatsapp();

  let conv = evento.conversacion;
  let contactoId = ctx.contacto?.contactoId ?? null;
  if (conv.inboxId === null || contactoId === null) {
    // Reproceso, o un evento sin remitente: se lee de Chatwoot.
    const r = await obtenerConversacionYContacto(cfg, conv.id);
    if (!r.ok) throw new Error(`conversación: ${r.error}`);
    conv = r.data.conversacion;
    contactoId = r.data.contacto.contactoId;
  }
  if (conv.inboxId === null || (conv.inboxId !== bandejas.leads && conv.inboxId !== bandejas.clientes)) return;
  if (contactoId === null) return;

  const ficha = await fichaDelTelefono(ctx, conv.telefonoUltimos10);

  const actuales = await leerAtributosContacto(cfg, contactoId);
  if (!actuales.ok) throw new Error(`atributos: ${actuales.error}`);
  const nuevos = atributosPorEscribir(actuales.data, ficha);
  if (!nuevos) return;
  const escrito = await escribirAtributosContacto(cfg, contactoId, nuevos);
  if (!escrito.ok) throw new Error(`atributos: ${escrito.error}`);
};

async function fichaDelTelefono(ctx: ContextoChatwoot, ultimos10: string | null): Promise<FichaErp> {
  if (ultimos10 === null) return SIN_FICHA;

  const { data: segmento, error } = await ctx.admin.rpc("chatwoot_segmento_contacto", {
    p_tenant_id: ctx.tenantId,
    p_phone_last10: ultimos10,
  });
  if (error) throw new Error(`chatwoot_segmento_contacto: ${error.code ?? "sin código"}`);
  if (segmento !== "cliente" && segmento !== "lead_registrado" && segmento !== "lead_nuevo") throw new Error("segmento desconocido");
  if (segmento === "lead_nuevo") return SIN_FICHA;

  // Solo el código: ni nombre ni documento. Dos filas = ambiguo, como la 0505.
  const { data: fichas, error: errorFicha } = await ctx.admin
    .from("clients")
    .select("markbox")
    .eq("tenant_id", ctx.tenantId)
    .eq("phone_last10", ultimos10)
    .is("deleted_at", null)
    .limit(2);
  if (errorFicha) throw new Error(`clients: ${errorFicha.code ?? "sin código"}`);
  // Si entre la regla y esta lectura la ficha dejó de ser única, no se arriesga un código ajeno.
  if (!Array.isArray(fichas) || fichas.length !== 1) return SIN_FICHA;
  return { segmento, shippingMark: shippingMarkVisible((fichas[0] as { markbox?: unknown }).markbox) };
}
