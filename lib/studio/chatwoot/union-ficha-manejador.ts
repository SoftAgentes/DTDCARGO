import "server-only";

import type { ManejadorEvento } from "./webhook-procesar";

/**
 * SDD-0650 F2 (D4) · El webhook une el contacto de Chatwoot con la ficha.
 * Manejador de `procesarEventoChatwoot`.
 *
 * Solo cuando `chatwoot_registrar_evento` (0504) devolvió un `client_id`: el teléfono
 * cruzó con UNA ficha. El contacto sale del payload (`meta.sender.id`); en el
 * reproceso no viene y no se une (lo hará el siguiente evento). La RPC de la 0554
 * nunca pisa una unión que ya existe, ni manual ni del Archivo Kommo.
 *
 * Sin la 0554 (PGRST202 o 42883) no hace nada y lo anota una vez: el webhook sigue
 * igual. Otro error lanza, y el evento queda «fallido» para el reintento.
 * En los logs, solo códigos.
 */
const SIN_0554: ReadonlySet<string> = new Set(["PGRST202", "42883"]);
let avisadoSin0554 = false;

export const unirContactoAFicha: ManejadorEvento = async (ctx, _evento, registro) => {
  const contactoId = ctx.contacto?.contactoId ?? null;
  if (!registro.clientId || contactoId === null) return;

  const { error } = await ctx.admin.rpc("chatwoot_unir_contactos", {
    p_tenant_id: ctx.tenantId,
    p_origen: "webhook",
    p_pares: [{ client_id: registro.clientId, contact_id: contactoId }],
  });
  if (!error) return;
  if (SIN_0554.has(error.code ?? "")) {
    if (!avisadoSin0554) {
      avisadoSin0554 = true;
      console.warn("[chatwoot] chatwoot_unir_contactos todavía no existe (0554 sin aplicar)");
    }
    return;
  }
  throw new Error(`chatwoot_unir_contactos: ${error.code ?? "sin código"}`);
};
