import "server-only";

import type { ChatwootConfig } from "./config";
import type { ChatwootError } from "./chatwoot-types";
import { fijarClaveAleatoria, obtenerEnlaceSso, obtenerTokenAgente } from "./platform-api";

/**
 * Cierre forzado de las sesiones de un agente dado de baja (SDD-0585, paso 2.7).
 * Sam, 2026-10-30: «Quiero cierre forzado».
 *
 * La Platform API de 4.19.1 no revoca sesiones (E2-D13), pero la API de
 * perfil sí, con el token de API del propio agente (`Api::V1::Profile::SessionsController`:
 * `index` y `destroy`, que borra el token de devise_token_auth y su
 * `user_session`). Lo que ese listado no ve son los tokens sin `user_session`,
 * así que primero se deja una sola sesión y es una que Studio controla:
 *
 *  1. Lee el token de API del agente (`GET platform/…/users/{id}`).
 *  2. Abre una sesión propia por SSO (`/login` + `POST /auth/sign_in` con el
 *     `sso_auth_token`). Es la de vencimiento más lejano y queda registrada
 *     (`track_user_session`).
 *  3. Le pone una clave aleatoria (`PATCH platform/…/users/{id}`). Con
 *     `remove_tokens_after_password_reset = true` sobrevive SOLO el token de
 *     vencimiento más lejano, el del paso 2, y `sync_user_sessions` borra los
 *     demás registros.
 *  4. Lista las sesiones (`GET /api/v1/profile/sessions`) y borra cada una
 *     (`DELETE …/sessions/{id}`). Sin cabecera `client`, ninguna es «la actual»
 *     y todas se pueden borrar, también la del paso 2.
 *  5. Comprueba que no quede ninguna.
 *  6. Rota el token de API (`POST /api/v1/profile/reset_access_token`,
 *     `regenerate_token`) y comprueba que cambió. La Platform API no lo rota:
 *     `users/{id}/token` devuelve el mismo.
 *
 * El navegador del agente se entera en su próximo pedido: Chatwoot responde 401
 * y el panel vuelve al login. Nada de esto se registra: ni el enlace, ni el
 * correo que lleva, ni los tokens. Los errores son códigos.
 */

export type PasoCierre = "token" | "enlace" | "entrada" | "clave" | "sesiones" | "quedan_sesiones" | "rotacion";

export type ResultadoCierre =
  | { ok: true; data: { sesionesCerradas: number } }
  | { ok: false; paso: PasoCierre; error: ChatwootError };

const TIMEOUT_MS = 10_000;

async function pedirChat(
  cfg: ChatwootConfig,
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; token?: string; body?: unknown },
): Promise<{ ok: true; res: Response } | { ok: false; error: ChatwootError }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.token) headers.api_access_token = init.token;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${cfg.origin}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!res.ok) {
      const error: ChatwootError =
        res.status === 401 || res.status === 403 ? "no_autorizado" : res.status === 404 ? "no_encontrado" : `http_${res.status}`;
      return { ok: false, error };
    }
    return { ok: true, res };
  } catch {
    return { ok: false, error: "red" };
  } finally {
    clearTimeout(timer);
  }
}

async function listarSesiones(cfg: ChatwootConfig, token: string): Promise<{ ok: true; ids: number[] } | { ok: false; error: ChatwootError }> {
  const r = await pedirChat(cfg, "/api/v1/profile/sessions", { method: "GET", token });
  if (!r.ok) return r;
  const body = (await r.res.json().catch(() => null)) as unknown;
  if (!Array.isArray(body)) return { ok: false, error: "respuesta_invalida" };
  const ids: number[] = [];
  for (const s of body as Array<{ id?: unknown }>) {
    if (typeof s?.id === "number" && Number.isInteger(s.id) && s.id > 0) ids.push(s.id);
  }
  return { ok: true, ids };
}

export async function cerrarSesionesAgente(chatwootUserId: number, cfg: ChatwootConfig): Promise<ResultadoCierre> {
  const token = await obtenerTokenAgente(chatwootUserId, cfg);
  if (!token.ok) return { ok: false, paso: "token", error: token.error };

  const enlace = await obtenerEnlaceSso(chatwootUserId, cfg);
  if (!enlace.ok) return { ok: false, paso: "enlace", error: enlace.error };
  // `validarEnlaceSso` ya exige el origen del chat, `/app/login`, el correo y el token.
  const params = new URL(enlace.data).searchParams;
  const entrada = await pedirChat(cfg, "/auth/sign_in", {
    method: "POST",
    body: { email: params.get("email"), sso_auth_token: params.get("sso_auth_token") },
  });
  if (!entrada.ok) return { ok: false, paso: "entrada", error: entrada.error };

  const clave = await fijarClaveAleatoria(chatwootUserId, cfg);
  if (!clave.ok) return { ok: false, paso: "clave", error: clave.error };

  const sesiones = await listarSesiones(cfg, token.data);
  if (!sesiones.ok) return { ok: false, paso: "sesiones", error: sesiones.error };
  for (const id of sesiones.ids) {
    const borrada = await pedirChat(cfg, `/api/v1/profile/sessions/${id}`, { method: "DELETE", token: token.data });
    // Un 404 es una sesión que ya no estaba: no es un fallo.
    if (!borrada.ok && borrada.error !== "no_encontrado") return { ok: false, paso: "sesiones", error: borrada.error };
  }
  const quedan = await listarSesiones(cfg, token.data);
  if (!quedan.ok) return { ok: false, paso: "sesiones", error: quedan.error };
  if (quedan.ids.length > 0) return { ok: false, paso: "quedan_sesiones", error: "respuesta_invalida" };

  const rotado = await pedirChat(cfg, "/api/v1/profile/reset_access_token", { method: "POST", token: token.data });
  if (!rotado.ok) return { ok: false, paso: "rotacion", error: rotado.error };
  const nuevo = await obtenerTokenAgente(chatwootUserId, cfg);
  if (!nuevo.ok) return { ok: false, paso: "rotacion", error: nuevo.error };
  if (nuevo.data === token.data) return { ok: false, paso: "rotacion", error: "respuesta_invalida" };

  return { ok: true, data: { sesionesCerradas: sesiones.ids.length } };
}
