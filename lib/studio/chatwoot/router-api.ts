import "server-only";

import type { ChatwootRouterConfig } from "./config";
import type { ChatwootError, ChatwootResult } from "./chatwoot-types";
import { interpretarConversacion, type ConversacionChatwoot } from "./webhook-events";

/**
 * API de cuenta de Chatwoot para el enrutamiento por segmento (SDD-0586, E10).
 *
 * Con el token del usuario de servicio (`CHATWOOT_ROUTER_TOKEN`). Las funciones
 * nunca lanzan: devuelven `ChatwootResult`. Lo que vuelve de Chatwoot pasa por
 * `interpretarConversacion` y no se registra: ni texto, ni nombre, ni teléfono.
 *
 *   GET  /conversations/{id}              → la conversación (para el reproceso,
 *                                           que no guardó bandeja ni teléfono)
 *   GET  /conversations/{id}/labels       → { payload: [etiqueta] }
 *   POST /conversations/{id}/labels       → reemplaza TODAS las etiquetas
 *   POST /conversations/{id}/assignments  → { team_id }: asigna el equipo
 *   POST /conversations/{id}/messages     → la respuesta del bot, saliente y pública
 *
 * En el envío, `red` (caída o tiempo agotado), un 5xx y un 408 son INCIERTOS:
 * un proxy puede responder 502/504 después de que Chatwoot aceptó el mensaje
 * (revisión de Codex; NV contra el VPS). Los demás 4xx son rechazos: no salió.
 */

export function envioIncierto(error: ChatwootError): boolean {
  if (error === "red") return true;
  const m = /^http_(\d{3})$/.exec(error);
  return m !== null && (Number(m[1]) >= 500 || Number(m[1]) === 408);
}

const TIMEOUT_MS = 10_000;

async function llamar(
  cfg: ChatwootRouterConfig,
  ruta: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<ChatwootResult<unknown>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.origin}/api/v1/accounts/${cfg.accountId}/conversations/${ruta}`, {
      method: init.method,
      headers: {
        api_access_token: cfg.token,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!res.ok) {
      const error: ChatwootError =
        res.status === 401 || res.status === 403 ? "no_autorizado" : res.status === 404 ? "no_encontrado" : `http_${res.status}`;
      return { ok: false, error };
    }
    return { ok: true, data: await res.json().catch(() => null) };
  } catch {
    return { ok: false, error: "red" };
  } finally {
    clearTimeout(timer);
  }
}

export async function obtenerConversacion(
  cfg: ChatwootRouterConfig,
  conversacionId: number,
): Promise<ChatwootResult<ConversacionChatwoot>> {
  const r = await llamar(cfg, String(conversacionId));
  if (!r.ok) return r;
  const c = interpretarConversacion(r.data);
  return c ? { ok: true, data: c } : { ok: false, error: "respuesta_invalida" };
}

export async function leerEtiquetas(cfg: ChatwootRouterConfig, conversacionId: number): Promise<ChatwootResult<string[]>> {
  const r = await llamar(cfg, `${conversacionId}/labels`);
  if (!r.ok) return r;
  const payload = (r.data as { payload?: unknown } | null)?.payload;
  if (!Array.isArray(payload)) return { ok: false, error: "respuesta_invalida" };
  return { ok: true, data: payload.filter((l): l is string => typeof l === "string") };
}

export async function ponerEtiquetas(
  cfg: ChatwootRouterConfig,
  conversacionId: number,
  etiquetas: string[],
): Promise<ChatwootResult<null>> {
  const r = await llamar(cfg, `${conversacionId}/labels`, { method: "POST", body: { labels: etiquetas } });
  return r.ok ? { ok: true, data: null } : r;
}

export async function asignarEquipo(
  cfg: ChatwootRouterConfig,
  conversacionId: number,
  equipoId: number,
): Promise<ChatwootResult<null>> {
  const r = await llamar(cfg, `${conversacionId}/assignments`, { method: "POST", body: { team_id: equipoId } });
  return r.ok ? { ok: true, data: null } : r;
}

export async function enviarMensaje(
  cfg: ChatwootRouterConfig,
  conversacionId: number,
  texto: string,
): Promise<ChatwootResult<null>> {
  const r = await llamar(cfg, `${conversacionId}/messages`, {
    method: "POST",
    body: { content: texto, message_type: "outgoing", private: false },
  });
  return r.ok ? { ok: true, data: null } : r;
}
