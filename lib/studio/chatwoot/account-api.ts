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
