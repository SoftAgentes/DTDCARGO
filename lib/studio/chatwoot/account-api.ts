import "server-only";

import type { ChatwootConfig } from "./config";
import type { ChatwootError, ChatwootResult } from "./chatwoot-types";
import { interpretarConversacion, type ConversacionChatwoot } from "./webhook-events";

/**
 * API de cuenta de Chatwoot, leída con el token DEL AGENTE (SDD-0585, E2-D22).
 *
 * Sirve para reconciliar el contador: un agente que lee sin responder no
 * dispara ningún webhook, así que al abrir la Bandeja se piden las
 * conversaciones más recientes (orden por actividad, todas las del agente
 * según sus permisos) y se aplica su estado con la misma RPC del webhook.
 *
 * `GET /api/v1/accounts/{id}/conversations?status=all&page=N` → { data: {
 * meta, payload: [<conversación>] } }, 25 por página. Se leen hasta `paginas`
 * páginas. Solo pasa por `interpretarConversacion`: el texto del último mensaje
 * y los datos del contacto no salen de acá.
 */

const TIMEOUT_MS = 10_000;

export async function listarConversacionesRecientes(
  cfg: ChatwootConfig,
  tokenAgente: string,
  paginas = 4,
): Promise<ChatwootResult<ConversacionChatwoot[]>> {
  const out: ConversacionChatwoot[] = [];
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let lote: unknown[];
    try {
      const res = await fetch(
        `${cfg.origin}/api/v1/accounts/${cfg.accountId}/conversations?status=all&assignee_type=all&page=${pagina}`,
        { headers: { api_access_token: tokenAgente, Accept: "application/json" }, signal: ctrl.signal, cache: "no-store", redirect: "error" },
      );
      if (!res.ok) {
        const error: ChatwootError =
          res.status === 401 || res.status === 403 ? "no_autorizado" : res.status === 404 ? "no_encontrado" : `http_${res.status}`;
        return { ok: false, error };
      }
      const body = (await res.json().catch(() => null)) as { data?: { payload?: unknown } } | null;
      if (!Array.isArray(body?.data?.payload)) return { ok: false, error: "respuesta_invalida" };
      lote = body.data.payload;
    } catch {
      return { ok: false, error: "red" };
    } finally {
      clearTimeout(timer);
    }
    for (const raw of lote) {
      const c = interpretarConversacion(raw);
      if (c) out.push(c);
    }
    if (lote.length < 25) break;
  }
  return { ok: true, data: out };
}

/**
 * UNA conversación, leída con el token DEL AGENTE (SDD-0585, paso 2.4, E2-D30).
 *
 * `GET /api/v1/accounts/{id}/conversations/{display_id}` hace
 * `authorize @conversation, :show?` (`conversations_controller.rb#conversation`):
 * si el agente no es de esa bandeja, Chatwoot responde 401 o 404. Es el amarre
 * que pone Chatwoot: la Ficha DTD solo existe para una conversación que el
 * propio agente puede abrir. La respuesta es la conversación en la raíz.
 */
export async function obtenerConversacion(
  cfg: ChatwootConfig,
  tokenAgente: string,
  conversacionId: number,
): Promise<ChatwootResult<ConversacionChatwoot>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.origin}/api/v1/accounts/${cfg.accountId}/conversations/${conversacionId}`, {
      headers: { api_access_token: tokenAgente, Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!res.ok) {
      const error: ChatwootError =
        res.status === 401 || res.status === 403 ? "no_autorizado" : res.status === 404 ? "no_encontrado" : `http_${res.status}`;
      return { ok: false, error };
    }
    const c = interpretarConversacion(await res.json().catch(() => null));
    if (!c || c.id !== conversacionId) return { ok: false, error: "respuesta_invalida" };
    return { ok: true, data: c };
  } catch {
    return { ok: false, error: "red" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mensajes que DTD envió por WhatsApp en UNA conversación (SDD-0585, paso 2.8), con el
 * token DEL AGENTE: Chatwoot autoriza la conversación igual que en la Ficha.
 *
 * `GET …/conversations/{id}/messages?after=N` devuelve hasta 100 mensajes en orden,
 * con `meta.contact` (`messages_controller#index` y `MessageFinder#messages_after` de
 * 4.19.1). Cuenta los salientes (`message_type` 1), no privados, con `source_id`
 * `wamid.…`: el id que pone Meta al aceptar el envío, así que no cuenta notas internas,
 * mensajes de otros canales ni envíos fallidos. Lee hasta `paginas` páginas; si hay más,
 * `completo` es false.
 *
 * Del contenido no se lee nada. El teléfono del contacto sale solo para elegir el
 * mercado de la tarifa y no se guarda ni se registra.
 */
export async function contarEnviadosWhatsapp(
  cfg: ChatwootConfig,
  tokenAgente: string,
  conversacionId: number,
  paginas = 10,
): Promise<ChatwootResult<{ enviados: number; completo: boolean; telefono: string | null }>> {
  let enviados = 0;
  let telefono: string | null = null;
  let despues = 0;
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let lote: Array<{ id?: unknown; message_type?: unknown; private?: unknown; source_id?: unknown }>;
    try {
      const res = await fetch(
        `${cfg.origin}/api/v1/accounts/${cfg.accountId}/conversations/${conversacionId}/messages?after=${despues}`,
        { headers: { api_access_token: tokenAgente, Accept: "application/json" }, signal: ctrl.signal, cache: "no-store", redirect: "error" },
      );
      if (!res.ok) {
        const error: ChatwootError =
          res.status === 401 || res.status === 403 ? "no_autorizado" : res.status === 404 ? "no_encontrado" : `http_${res.status}`;
        return { ok: false, error };
      }
      const body = (await res.json().catch(() => null)) as { meta?: { contact?: { phone_number?: unknown } }; payload?: unknown } | null;
      if (!Array.isArray(body?.payload)) return { ok: false, error: "respuesta_invalida" };
      if (pagina === 1) {
        const tel = body.meta?.contact?.phone_number;
        telefono = typeof tel === "string" && tel.trim() ? tel : null;
      }
      lote = body.payload as typeof lote;
    } catch {
      return { ok: false, error: "red" };
    } finally {
      clearTimeout(timer);
    }
    for (const m of lote) {
      if (m?.message_type === 1 && m.private !== true && typeof m.source_id === "string" && m.source_id.startsWith("wamid.")) {
        enviados += 1;
      }
    }
    const ultimo = lote.at(-1)?.id;
    if (lote.length < 100 || typeof ultimo !== "number") return { ok: true, data: { enviados, completo: true, telefono } };
    despues = ultimo;
  }
  return { ok: true, data: { enviados, completo: false, telefono } };
}
