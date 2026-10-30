import "server-only";

import type { ChatwootConfig } from "./config";
import type { ChatwootError, ChatwootResult } from "./chatwoot-types";

/**
 * Miembros de bandejas y equipos de Chatwoot 4.19.1 (SDD-0585, paso 2.7).
 *
 * La Platform API no los maneja: es la API de cuenta, con el token del USUARIO
 * DE SERVICIO (administrator de la cuenta 1; lo creó la Platform App en E1, así
 * que `obtenerTokenAgente` lo puede leer). `InboxPolicy#update?` y
 * `TeamMemberPolicy#update?` exigen administrator.
 *
 *  - `GET  …/inbox_members/{inbox_id}` → { payload: [agente] }
 *  - `PATCH …/inbox_members` { inbox_id, user_ids } → reemplaza la lista
 *  - `GET  …/teams/{id}/team_members` → [agente]
 *  - `PATCH …/teams/{id}/team_members` { user_ids } → reemplaza la lista
 *
 * Solo se leen los ids: los agentes vienen con nombre y correo y no salen de acá.
 */

const TIMEOUT_MS = 10_000;

function errorDeEstado(status: number): ChatwootError {
  if (status === 401 || status === 403) return "no_autorizado";
  if (status === 404) return "no_encontrado";
  return `http_${status}`;
}

async function pedir(
  cfg: ChatwootConfig,
  token: string,
  path: string,
  opciones: { method?: "GET" | "PATCH"; body?: unknown } = {},
): Promise<{ ok: true; body: unknown } | { ok: false; error: ChatwootError }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { api_access_token: token, Accept: "application/json" };
    if (opciones.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${cfg.origin}/api/v1/accounts/${cfg.accountId}${path}`, {
      method: opciones.method ?? "GET",
      headers,
      body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
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

function ids(lista: unknown): number[] | null {
  if (!Array.isArray(lista)) return null;
  const out: number[] = [];
  for (const a of lista as Array<{ id?: unknown }>) {
    const id = a?.id;
    if (typeof id === "number" && Number.isInteger(id) && id > 0) out.push(id);
  }
  return out;
}

export async function leerMiembrosBandeja(
  cfg: ChatwootConfig,
  token: string,
  bandejaId: number,
): Promise<ChatwootResult<number[]>> {
  const r = await pedir(cfg, token, `/inbox_members/${bandejaId}`);
  if (!r.ok) return r;
  const lista = ids((r.body as { payload?: unknown } | null)?.payload);
  return lista ? { ok: true, data: lista } : { ok: false, error: "respuesta_invalida" };
}

export async function fijarMiembrosBandeja(
  cfg: ChatwootConfig,
  token: string,
  bandejaId: number,
  userIds: readonly number[],
): Promise<ChatwootResult<null>> {
  const r = await pedir(cfg, token, "/inbox_members", {
    method: "PATCH",
    body: { inbox_id: bandejaId, user_ids: [...userIds] },
  });
  return r.ok ? { ok: true, data: null } : r;
}

export async function leerMiembrosEquipo(
  cfg: ChatwootConfig,
  token: string,
  equipoId: number,
): Promise<ChatwootResult<number[]>> {
  const r = await pedir(cfg, token, `/teams/${equipoId}/team_members`);
  if (!r.ok) return r;
  const lista = ids(r.body);
  return lista ? { ok: true, data: lista } : { ok: false, error: "respuesta_invalida" };
}

export async function fijarMiembrosEquipo(
  cfg: ChatwootConfig,
  token: string,
  equipoId: number,
  userIds: readonly number[],
): Promise<ChatwootResult<null>> {
  const r = await pedir(cfg, token, `/teams/${equipoId}/team_members`, {
    method: "PATCH",
    body: { user_ids: [...userIds] },
  });
  return r.ok ? { ok: true, data: null } : r;
}
