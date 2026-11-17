/**
 * Conversación de Chatwoot de una tarjeta del CRM (SDD-0648 §4, D7).
 *
 * El chat se abre a pantalla completa en la Bandeja (`/studio/bandeja?c=N`).
 * Aquí solo se decide QUÉ conversación: no se lee ni se copia ningún mensaje.
 *   1. Con ficha (`client_id`): la conversación más reciente del espejo
 *      `chatwoot_conversations` (0504), bajo la RLS de quien mira.
 *   2. Sin ficha: las conversaciones del contacto en Chatwoot
 *      (`chatwoot_contact_id`); la de id mayor es la más nueva.
 * Chatwoot decide después si el agente puede abrirla (permisos de bandeja).
 *
 * Las lecturas llegan inyectadas para poder probar la regla sin red ni base.
 */

export interface TarjetaParaChat {
  client_id: string | null;
  chatwoot_contact_id: number | null;
}

export interface LecturasChat {
  /** id de la conversación más reciente de la ficha, o null. */
  ultimaDeFicha: (clientId: string) => Promise<number | null>;
  /** ids de las conversaciones del contacto en Chatwoot; null = no se pudo leer. */
  delContacto: (contactId: number) => Promise<number[] | null>;
}

export type ResultadoChat =
  | { ok: true; conversacion: number }
  | { ok: false; motivo: "sin_chat" | "sin_bandeja" | "error" };

export async function resolverConversacion(
  t: TarjetaParaChat,
  leer: LecturasChat,
): Promise<ResultadoChat> {
  if (t.client_id) {
    const id = await leer.ultimaDeFicha(t.client_id);
    if (id != null) return { ok: true, conversacion: id };
  }
  if (t.chatwoot_contact_id != null) {
    const ids = await leer.delContacto(t.chatwoot_contact_id);
    if (ids === null) return { ok: false, motivo: "error" };
    if (ids.length > 0) return { ok: true, conversacion: Math.max(...ids) };
  }
  return { ok: false, motivo: "sin_chat" };
}

/**
 * A dónde va el navegador: la Bandeja en la conversación (pestaña del CRM desde
 * SDD-0655, que ya trae la pestaña Embudos para volver), o el tablero con aviso.
 */
export function destinoChat(r: ResultadoChat): string {
  return r.ok
    ? `/studio/bandeja?c=${r.conversacion}`
    : `/studio/crm?tab=embudos&chat=${r.motivo === "sin_chat" ? "sin" : r.motivo}`;
}
