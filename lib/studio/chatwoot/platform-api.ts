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
  opciones: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; sinCuerpo?: boolean } = {},
): Promise<{ ok: true; body: unknown } | { ok: false; error: ChatwootError }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { api_access_token: cfg.token, Accept: "application/json" };
    if (opciones.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${cfg.origin}${path}`, {
      method: opciones.method ?? "GET",
      headers,
      body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!res.ok) return { ok: false, error: errorDeEstado(res.status) };
    // `DELETE …/account_users` responde `head :ok`: no hay cuerpo que leer.
    if (opciones.sinCuerpo) return { ok: true, body: null };
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

/**
 * Token de API del agente (SDD-0585, E2-D22), para leer Chatwoot COMO ese
 * agente (con sus permisos) en la reconciliación. Solo servidor: no se guarda,
 * no se registra y no sale de la server action que lo pide.
 */
export async function obtenerTokenAgente(
  chatwootUserId: number,
  cfg: ChatwootConfig | null = chatwootConfig(),
): Promise<ChatwootResult<string>> {
  if (!cfg) return { ok: false, error: "sin_configurar" };
  const r = await pedir(cfg, `/platform/api/v1/users/${chatwootUserId}`);
  if (!r.ok) return r;
  const b = r.body as { id?: unknown; access_token?: unknown } | null;
  if (b?.id !== chatwootUserId || typeof b.access_token !== "string" || !b.access_token) {
    return { ok: false, error: "respuesta_invalida" };
  }
  return { ok: true, data: b.access_token };
}

// ─── Ciclo de vida de los agentes (SDD-0585, paso 2.5) ───────────────────────
//
// `config/routes.rb` de 4.19.1: `accounts/{id}/account_users` (index, create y
// un destroy de colección con `user_id`) y `users` (create). La cuenta la creó
// la Platform App (E1), así que es permisible: las tres de `account_users` sirven
// para cualquier usuario de la cuenta. `users#create` reusa un usuario existente
// por correo y lo vuelve permisible.

export type RolCuenta = "agent" | "administrator";

export interface MiembroCuenta {
  userId: number;
  rol: RolCuenta;
}

/** Los AccountUser de la cuenta: solo id y rol (la respuesta no trae correos). */
export async function listarMiembrosCuenta(
  cfg: ChatwootConfig | null = chatwootConfig(),
): Promise<ChatwootResult<MiembroCuenta[]>> {
  if (!cfg) return { ok: false, error: "sin_configurar" };
  const r = await pedir(cfg, `/platform/api/v1/accounts/${cfg.accountId}/account_users`);
  if (!r.ok) return r;
  if (!Array.isArray(r.body)) return { ok: false, error: "respuesta_invalida" };
  const data: MiembroCuenta[] = [];
  for (const fila of r.body as Array<{ user_id?: unknown; role?: unknown }>) {
    const userId = fila?.user_id;
    if (typeof userId !== "number" || !Number.isInteger(userId) || userId <= 0) continue;
    if (fila.role !== "agent" && fila.role !== "administrator") continue;
    data.push({ userId, rol: fila.role });
  }
  return { ok: true, data };
}

/** Saca al usuario de la cuenta: pierde el acceso a ella. No borra el usuario ni sus conversaciones. */
export async function quitarDeCuenta(
  chatwootUserId: number,
  cfg: ChatwootConfig | null = chatwootConfig(),
): Promise<ChatwootResult<null>> {
  if (!cfg) return { ok: false, error: "sin_configurar" };
  const r = await pedir(cfg, `/platform/api/v1/accounts/${cfg.accountId}/account_users`, {
    method: "DELETE",
    body: { user_id: chatwootUserId },
    sinCuerpo: true,
  });
  return r.ok ? { ok: true, data: null } : r;
}

/**
 * Mete al usuario en la cuenta con ese rol, o le cambia el rol si ya está:
 * `account_users#create` hace `find_or_initialize_by(user_id)` y `update!`. El
 * rol sale de la matriz del 2.7 (`rolChatwootDe`).
 */
export async function agregarACuenta(
  chatwootUserId: number,
  cfg: ChatwootConfig | null = chatwootConfig(),
  rol: RolCuenta = "agent",
): Promise<ChatwootResult<null>> {
  if (!cfg) return { ok: false, error: "sin_configurar" };
  const r = await pedir(cfg, `/platform/api/v1/accounts/${cfg.accountId}/account_users`, {
    method: "POST",
    body: { user_id: chatwootUserId, role: rol },
  });
  return r.ok ? { ok: true, data: null } : r;
}

const MAYUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz";
const DIGITOS = "23456789";
const SIGNOS = "!@#$%^&*-_=+";

/**
 * Clave aleatoria que nadie usa: el agente entra por SSO (E2-D12). Cumple
 * `password_has_required_content` de 4.19.1 (mayúscula, minúscula, número y
 * signo) y no sale de esta función.
 */
export function claveAleatoria(largo = 32): string {
  const todos = MAYUSCULAS + MINUSCULAS + DIGITOS + SIGNOS;
  const azar = new Uint32Array(largo);
  crypto.getRandomValues(azar);
  const elegir = (alfabeto: string, n: number) => alfabeto[n % alfabeto.length];
  return [
    elegir(MAYUSCULAS, azar[0]),
    elegir(MINUSCULAS, azar[1]),
    elegir(DIGITOS, azar[2]),
    elegir(SIGNOS, azar[3]),
    ...Array.from(azar.slice(4), (n) => elegir(todos, n)),
  ].join("");
}

/** Crea el usuario de Chatwoot (o adopta el que ya tenga ese correo). Devuelve solo el id. */
export async function crearAgente(
  datos: { nombre: string; correo: string },
  cfg: ChatwootConfig | null = chatwootConfig(),
): Promise<ChatwootResult<number>> {
  if (!cfg) return { ok: false, error: "sin_configurar" };
  const r = await pedir(cfg, "/platform/api/v1/users", {
    method: "POST",
    body: { name: datos.nombre, email: datos.correo, password: claveAleatoria() },
  });
  if (!r.ok) return r;
  const id = (r.body as { id?: unknown } | null)?.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return { ok: false, error: "respuesta_invalida" };
  return { ok: true, data: id };
}

/**
 * Pone una clave aleatoria nueva (SDD-0585, paso 2.7). Cierra el acceso directo:
 * `users#create` adopta por correo a un usuario que ya existía SIN tocarle la
 * clave, así que cada alta la cambia aquí. Además, con
 * `remove_tokens_after_password_reset = true` (devise_token_auth de 4.19.1),
 * cambiar la clave deja una sola sesión: la de vencimiento más lejano.
 */
export async function fijarClaveAleatoria(
  chatwootUserId: number,
  cfg: ChatwootConfig | null = chatwootConfig(),
): Promise<ChatwootResult<null>> {
  if (!cfg) return { ok: false, error: "sin_configurar" };
  const r = await pedir(cfg, `/platform/api/v1/users/${chatwootUserId}`, {
    method: "PATCH",
    body: { password: claveAleatoria() },
    sinCuerpo: true,
  });
  return r.ok ? { ok: true, data: null } : r;
}

/**
 * Borra el usuario de Chatwoot (`DeleteObjectJob`, en segundo plano). Solo para
 * las bajas de más de 12 meses (paso 2.7, propuesta del Director sin objeción de
 * Sam); los candados están en `purgarBajasVencidas`.
 */
export async function borrarUsuario(
  chatwootUserId: number,
  cfg: ChatwootConfig | null = chatwootConfig(),
): Promise<ChatwootResult<null>> {
  if (!cfg) return { ok: false, error: "sin_configurar" };
  const r = await pedir(cfg, `/platform/api/v1/users/${chatwootUserId}`, { method: "DELETE", sinCuerpo: true });
  return r.ok ? { ok: true, data: null } : r;
}
