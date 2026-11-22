import "server-only";

import { chatwootFichaUnirActivo } from "./config";
import type { ManejadorEvento } from "./webhook-procesar";

/**
 * SDD-0650 F2 (D4) · El webhook une el contacto de Chatwoot con la ficha.
 * Manejador de `procesarEventoChatwoot`.
 *
 * Apagado salvo `CHATWOOT_FICHA_UNIR=1` (decisión del DG, M1): con la 0554 aplicada y
 * sin la variable, no escribe ni llama a la RPC.
 *
 * Solo cuando `chatwoot_registrar_evento` dice que el cliente salió del TELÉFONO, que
 * cruzó con UNA ficha (`origenCliente === "telefono"`). Desde la SDD-0676 la función
 * también devuelve el cliente de una unión que ya existe y el que la conversación
 * conserva: ninguno de los dos prueba un cruce por teléfono, y unir con ellos volvería
 * permanente lo que solo se conservó (el chat del portal, un teléfono que ya no coincide).
 * El contacto sale del payload (`meta.sender.id`); en el
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
  if (!chatwootFichaUnirActivo()) return;
  const contactoId = ctx.contacto?.contactoId ?? null;
  if (!registro.clientId || registro.origenCliente !== "telefono" || contactoId === null) return;

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
