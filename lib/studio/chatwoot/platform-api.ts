import "server-only";

import { chatwootConfig, type ChatwootConfig } from "./config";
import {
  validarEnlaceSso,
  type ChatwootAgent,
  type ChatwootError,
  type ChatwootResult,
} from "./chatwoot-types";

/**
 * Cliente de la Platform API de Chatwoot 4.19.1 (SDD-0585, E2-D11).
 *
 * Patrón de `lib/studio/searates/searates-api.ts`: fetch directo, timeout,
 * `cache: "no-store"` y una unión ok/error; nunca lanza. Solo dos llamadas en
 * 2.2:
 *   - `obtenerEnlaceSso(id)`: `GET /platform/api/v1/users/{id}/login` → enlace
 *     de un solo uso (5 min) a `/app/login?email=…&sso_auth_token=…`.
 *   - `obtenerAgente(id)`: `GET /platform/api/v1/users/{id}` → correo y cuentas,
 *     para el candado del vínculo (E2-D10).
 *
 * La Platform API solo ve los usuarios que creó (o adoptó) la Platform App: un
 * 404 o 401 sobre un id ajeno es lo esperado, no un fallo del cliente.
 *
 * Nada de lo que viaja se registra: el enlace lleva el correo y el token, y la
 * respuesta de usuario trae el `access_token` personal del agente.
 */

const TIMEOUT_MS = 10_000;

function errorDeEstado(status: number): ChatwootError {
  if (status === 401 || status === 403) return "no_autorizado";
  if (status === 404) return "no_encontrado";
  return `http_${status}`;
}

async function pedir(
  cfg: ChatwootConfig,
  path: string,
): Promise<{ ok: true; body: unknown } | { ok: false; error: ChatwootError }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.origin}${path}`, {
      method: "GET",
      headers: { api_access_token: cfg.token, Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!res.ok) return { ok: false, error: errorDeEstado(res.status) };
    try {
      return { ok: true, body: await res.json() };
    } catch {
      return { ok: false, error: "respuesta_invalida" };
    }
  } catch {
    return { ok: false, error: "red" };
  } finally {
    clearTimeout(timer);
  }
}

export async function obtenerEnlaceSso(
  chatwootUserId: number,
  cfg: ChatwootConfig | null = chatwootConfig(),
): Promise<ChatwootResult<string>> {
  if (!cfg) return { ok: false, error: "sin_configurar" };
  const r = await pedir(cfg, `/platform/api/v1/users/${chatwootUserId}/login`);
  if (!r.ok) return r;
  const url = (r.body as { url?: unknown } | null)?.url;
  if (typeof url !== "string") return { ok: false, error: "respuesta_invalida" };
  const enlace = validarEnlaceSso(url, cfg.origin);
  return enlace ? { ok: true, data: enlace } : { ok: false, error: "origen_invalido" };
}

export async function obtenerAgente(
  chatwootUserId: number,
  cfg: ChatwootConfig | null = chatwootConfig(),
): Promise<ChatwootResult<ChatwootAgent>> {
  if (!cfg) return { ok: false, error: "sin_configurar" };
  const r = await pedir(cfg, `/platform/api/v1/users/${chatwootUserId}`);
  if (!r.ok) return r;
  const b = r.body as {
    id?: unknown;
    email?: unknown;
    name?: unknown;
    accounts?: Array<{ id?: unknown }>;
  } | null;
  if (typeof b?.id !== "number" || b.id !== chatwootUserId || typeof b.email !== "string") {
    return { ok: false, error: "respuesta_invalida" };
  }
  // Se copian SOLO estos campos: el resto (access_token, pubsub_token…) no sale de acá.
  return {
    ok: true,
    data: {
      id: b.id,
      email: b.email,
      name: typeof b.name === "string" ? b.name : "",
      accountIds: Array.isArray(b.accounts)
        ? b.accounts.map((a) => a?.id).filter((id): id is number => typeof id === "number")
        : [],
    },
  };
}
