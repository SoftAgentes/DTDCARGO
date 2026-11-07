import "server-only";

import type { ChatwootRouterConfig } from "./config";
import type { ChatwootError, ChatwootResult } from "./chatwoot-types";
import { interpretarContacto, interpretarConversacion, type ContactoEntrada, type ConversacionChatwoot } from "./webhook-events";

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

/** Lo que cualquier llamada de cuenta necesita: el enrutador de E10 y la ida del portal (10.5). */
export type CuentaChatwoot = Pick<ChatwootRouterConfig, "origin" | "token" | "accountId">;

async function llamar(
  cfg: CuentaChatwoot,
  ruta: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<ChatwootResult<unknown>> {
  return llamarCuenta(cfg, `conversations/${ruta}`, init);
}

async function llamarCuenta(
  cfg: CuentaChatwoot,
  ruta: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<ChatwootResult<unknown>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.origin}/api/v1/accounts/${cfg.accountId}/${ruta}`, {
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

/** Para el reproceso de la entrada de leads (SDD-0587, 6.4): la conversación y su contacto. */
export async function obtenerConversacionYContacto(
  cfg: ChatwootRouterConfig,
  conversacionId: number,
): Promise<ChatwootResult<{ conversacion: ConversacionChatwoot; contacto: ContactoEntrada }>> {
  const r = await llamar(cfg, String(conversacionId));
  if (!r.ok) return r;
  const conversacion = interpretarConversacion(r.data);
  return conversacion
    ? { ok: true, data: { conversacion, contacto: interpretarContacto(r.data) } }
    : { ok: false, error: "respuesta_invalida" };
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

// ─── La ida del chat del portal (SDD-0586, paso 10.5, PR 1a) ──────────────────
//
//   POST /contacts                          → { inbox_id, name, identifier }: el contacto
//                                             y su contact_inbox (source_id) en la bandeja
//   GET  /contacts/search?q=<identificador> → en un reintento: el contacto ya creado
//   GET  /contacts/{id}/conversations       → en un reintento: la conversación ya creada
//   POST /conversations                     → { source_id, inbox_id, contact_id, status }
//   GET  /conversations/{id}/messages       → en un reintento: ¿ya entró ese source_id?
//   POST /conversations/{id}/messages       → el mensaje del cliente, `incoming` y público
//
// Lo que sale lleva solo el nombre, el identificador al azar y el texto (E10-D35). Lo que
// vuelve se reduce a ids y source_id: ni nombre ni texto salen de este archivo. Que
// Chatwoot 4.19.1 acepte y devuelva así cada cosa es NV (PoC-1, PoC-2, PoC-3 y PoC-5).

const ENTERO = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 2_147_483_647 ? v : null;
const TEXTO = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

export interface ContactoPortal {
  contactoId: number;
  sourceId: string;
}

/** El source_id del contact_inbox de esa bandeja, en cualquiera de las dos formas que da Chatwoot. */
function sourceIdDeBandeja(contactInboxes: unknown, inboxId: number): string | null {
  if (!Array.isArray(contactInboxes)) return null;
  for (const ci of contactInboxes) {
    const fila = ci as { source_id?: unknown; inbox?: { id?: unknown }; inbox_id?: unknown } | null;
    if (fila && (ENTERO(fila.inbox?.id) === inboxId || ENTERO(fila.inbox_id) === inboxId)) return TEXTO(fila.source_id);
  }
  return null;
}

export async function crearContactoPortal(
  cfg: CuentaChatwoot,
  datos: { inboxId: number; nombre: string; identificador: string },
): Promise<ChatwootResult<ContactoPortal>> {
  const r = await llamarCuenta(cfg, "contacts", {
    method: "POST",
    body: { inbox_id: datos.inboxId, name: datos.nombre, identifier: datos.identificador },
  });
  if (!r.ok) return r;
  const payload = (
    r.data as { payload?: { contact?: { id?: unknown; contact_inboxes?: unknown }; contact_inbox?: { source_id?: unknown } } } | null
  )?.payload;
  const contactoId = ENTERO(payload?.contact?.id);
  const sourceId = TEXTO(payload?.contact_inbox?.source_id) ?? sourceIdDeBandeja(payload?.contact?.contact_inboxes, datos.inboxId);
  return contactoId !== null && sourceId !== null
    ? { ok: true, data: { contactoId, sourceId } }
    : { ok: false, error: "respuesta_invalida" };
}

/** El contacto con ese identificador exacto y su source_id en la bandeja; `null` si no está. */
export async function buscarContactoPortal(
  cfg: CuentaChatwoot,
  identificador: string,
  inboxId: number,
): Promise<ChatwootResult<ContactoPortal | null>> {
  const r = await llamarCuenta(cfg, `contacts/search?q=${encodeURIComponent(identificador)}&include_contact_inboxes=true`);
  if (!r.ok) return r;
  const payload = (r.data as { payload?: unknown } | null)?.payload;
  if (!Array.isArray(payload)) return { ok: false, error: "respuesta_invalida" };
  for (const c of payload) {
    const fila = c as { id?: unknown; identifier?: unknown; contact_inboxes?: unknown } | null;
    if (!fila || fila.identifier !== identificador) continue;
    const contactoId = ENTERO(fila.id);
    const sourceId = sourceIdDeBandeja(fila.contact_inboxes, inboxId);
    if (contactoId !== null && sourceId !== null) return { ok: true, data: { contactoId, sourceId } };
  }
  return { ok: true, data: null };
}

export async function listarConversacionesContacto(
  cfg: CuentaChatwoot,
  contactoId: number,
): Promise<ChatwootResult<{ id: number; inboxId: number | null }[]>> {
  const r = await llamarCuenta(cfg, `contacts/${contactoId}/conversations`);
  if (!r.ok) return r;
  const payload = (r.data as { payload?: unknown } | null)?.payload;
  if (!Array.isArray(payload)) return { ok: false, error: "respuesta_invalida" };
  const out: { id: number; inboxId: number | null }[] = [];
  for (const c of payload) {
    const fila = c as { id?: unknown; inbox_id?: unknown } | null;
    const id = ENTERO(fila?.id);
    if (id !== null) out.push({ id, inboxId: ENTERO(fila?.inbox_id) });
  }
  return { ok: true, data: out };
}

export async function crearConversacionPortal(
  cfg: CuentaChatwoot,
  datos: { inboxId: number; contactoId: number; sourceId: string },
): Promise<ChatwootResult<number>> {
  const r = await llamarCuenta(cfg, "conversations", {
    method: "POST",
    body: { source_id: datos.sourceId, inbox_id: datos.inboxId, contact_id: datos.contactoId, status: "open" },
  });
  if (!r.ok) return r;
  const id = ENTERO((r.data as { id?: unknown } | null)?.id);
  return id !== null ? { ok: true, data: id } : { ok: false, error: "respuesta_invalida" };
}

/** Los últimos mensajes de la conversación (la primera página de Chatwoot), solo id y source_id. */
export async function listarMensajes(
  cfg: CuentaChatwoot,
  conversacionId: number,
): Promise<ChatwootResult<{ id: number; sourceId: string | null }[]>> {
  const r = await llamar(cfg, `${conversacionId}/messages`);
  if (!r.ok) return r;
  const payload = (r.data as { payload?: unknown } | null)?.payload;
  if (!Array.isArray(payload)) return { ok: false, error: "respuesta_invalida" };
  const out: { id: number; sourceId: string | null }[] = [];
  for (const m of payload) {
    const fila = m as { id?: unknown; source_id?: unknown } | null;
    const id = ENTERO(fila?.id);
    if (id !== null) out.push({ id, sourceId: TEXTO(fila?.source_id) });
  }
  return { ok: true, data: out };
}

/** Margen para la hora: el reloj de Chatwoot y el de Studio pueden no coincidir del todo. */
const MARGEN_BUSQUEDA_S = 300;

/** El segundo Unix de `created_at`, que Chatwoot da como número o como fecha ISO. */
function segundos(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : ms / 1000;
  }
  return null;
}

/**
 * Busca, en la conversación, el mensaje con ese `source_id`, para no reenviarlo después de un
 * intento incierto (E10-D34). Chatwoot da los mensajes de a una página, los más nuevos primero, y
 * `?before=<id>` trae la anterior. Si el equipo escribió mucho después del intento, el mensaje ya
 * no está en la primera página (hallazgo de la revisión independiente de la #424): se pagina hacia
 * atrás hasta encontrarlo, hasta que la página no traiga nada o hasta pasar la hora del mensaje de
 * Studio (`desde`, menos un margen), porque el de Chatwoot no puede ser anterior. Si se acaban las
 * páginas sin poder descartarlo, `busqueda_incompleta`: no se sabe, así que no se reenvía.
 */
export async function buscarMensajePorSourceId(
  cfg: CuentaChatwoot,
  conversacionId: number,
  sourceId: string,
  desde: Date,
  maxPaginas = 50,
): Promise<{ ok: true; data: number | null } | { ok: false; error: ChatwootError | "busqueda_incompleta" }> {
  const limite = desde.getTime() / 1000 - MARGEN_BUSQUEDA_S;
  let antes: number | null = null;
  for (let pagina = 0; pagina < maxPaginas; pagina += 1) {
    const r = await llamar(cfg, `${conversacionId}/messages${antes === null ? "" : `?before=${antes}`}`);
    if (!r.ok) return r;
    const payload = (r.data as { payload?: unknown } | null)?.payload;
    if (!Array.isArray(payload)) return { ok: false, error: "respuesta_invalida" };
    let minId: number | null = null;
    let minCreado: number | null = null;
    for (const m of payload) {
      const fila = m as { id?: unknown; source_id?: unknown; created_at?: unknown } | null;
      const id = ENTERO(fila?.id);
      if (id === null) continue;
      if (fila?.source_id === sourceId) return { ok: true, data: id };
      if (minId === null || id < minId) minId = id;
      const creado = segundos(fila?.created_at);
      if (creado !== null && (minCreado === null || creado < minCreado)) minCreado = creado;
    }
    // Sin más páginas: no está.
    if (minId === null) return { ok: true, data: null };
    // Lo más viejo de la página ya es anterior al mensaje de Studio: lo de atrás también.
    if (minCreado !== null && minCreado < limite) return { ok: true, data: null };
    // Chatwoot no avanzó con `before`: no hay cómo seguir buscando.
    if (antes !== null && minId >= antes) return { ok: false, error: "respuesta_invalida" };
    antes = minId;
  }
  return { ok: false, error: "busqueda_incompleta" };
}

/** El mensaje del cliente, `incoming` y público, con `source_id = dtd:<id del mensaje>`. */
export async function crearMensajeEntrante(
  cfg: CuentaChatwoot,
  conversacionId: number,
  datos: { texto: string; sourceId: string },
): Promise<ChatwootResult<number>> {
  const r = await llamar(cfg, `${conversacionId}/messages`, {
    method: "POST",
    body: { content: datos.texto, message_type: "incoming", private: false, source_id: datos.sourceId },
  });
  if (!r.ok) return r;
  const id = ENTERO((r.data as { id?: unknown } | null)?.id);
  return id !== null ? { ok: true, data: id } : { ok: false, error: "respuesta_invalida" };
}
