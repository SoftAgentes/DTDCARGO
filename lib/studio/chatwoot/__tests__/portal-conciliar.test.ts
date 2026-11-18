// @vitest-environment node
/**
 * SDD-0586 (10.5, 1c-2) · el estado del hilo del portal (E10-D39) y la conciliación (E10-D40.5).
 *
 * La base y la API de Chatwoot son dobles. Qué se escribe, una sola vez, lo decide la migración
 * (sus contratos: la 0520 y la 0521). Acá se prueba qué hace el servidor:
 *   - `estadoAlPortal` pide el estado del hilo a la base, que lo lee del espejo, y nunca le pasa el
 *     estado del evento (el reproceso lo rellena con «open");
 *   - `conciliarPortal` pagina hacia atrás hasta pasar la marca de agua, escribe en orden ascendente
 *     lo que falte, marca el hilo solo si llegó, y un hilo que falla no frena los demás.
 * La conversación de Chatwoot es una lista de mensajes que el doble pagina como la API (de a 20,
 * los más nuevos primero, `?before=<id>`), y la base es idempotente por id, como la 0520.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  obtenerConversacion: vi.fn(),
  paginaMensajes: vi.fn(),
  buscarMensajePorSourceId: vi.fn(),
  crearNotaPrivada: vi.fn(),
}));
const flags = vi.hoisted(() => ({ chatwoot_portal: true }));
const push = vi.hoisted(() => ({ notifyClientReplyPush: vi.fn() }));

vi.mock("../router-api", async (original) => ({ ...(await original<typeof import("../router-api")>()), ...api }));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: vi.fn(async () => ({ ...flags })) }));
vi.mock("@/lib/studio/conversation-reply-push", () => push);

import type { ContextoChatwoot } from "../webhook-procesar";
import type { EventoChatwoot } from "../webhook-events";
import { estadoAlPortal } from "../portal-manejadores";
import { conciliarPortal, conciliarHilo } from "../portal-conciliar";
import { chatwootPortalConfig } from "../config";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const HILO = "60000000-0000-4000-8000-000000000001";
const HILO2 = "60000000-0000-4000-8000-000000000002";
const CLIENTE = "50000000-0000-4000-8000-0000000000cc";
const INBOX_PORTAL = 9;
const CONV = 9001;
const CONV2 = 9002;
const ENV = {
  CHATWOOT_URL: "https://chat.ejemplo.test",
  CHATWOOT_ROUTER_TOKEN: "tok-router-sintetico",
  CHATWOOT_ACCOUNT_ID: "1",
  CHATWOOT_TENANT_ID: T1,
  CHATWOOT_INBOX_PORTAL_ID: String(INBOX_PORTAL),
};

/** Una fila de `GET /conversations/{id}/messages`: una respuesta del agente, por defecto. */
const fila = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  content: `respuesta ${id}`,
  content_type: "text",
  message_type: 1,
  private: false,
  source_id: null,
  created_at: 1_793_000_000 + id,
  conversation_id: CONV,
  inbox_id: INBOX_PORTAL,
  sender_type: "User",
  sender_id: 7,
  sender: { id: 7, type: "user" },
  attachments: [],
  ...extra,
});

/** Chatwoot: las conversaciones y sus mensajes; pagina de a 20, los más nuevos primero. */
let chatwoot: Map<number, ReturnType<typeof fila>[]>;
function paginar(_cfg: unknown, conv: number, antes: number | null = null) {
  const todos = (chatwoot.get(conv) ?? []).filter((m) => antes === null || m.id < antes).sort((a, b) => b.id - a.id);
  return Promise.resolve({ ok: true as const, data: todos.slice(0, 20) });
}

/** La base: lo escrito por id (idempotente como la 0520), el orden y las marcas. */
interface Base {
  rpc: ReturnType<typeof vi.fn>;
  escritos: Set<number>;
  orden: number[];
  marcas: { conversacion: string; hasta: number | null }[];
  llamadas: string[];
}
function base(opciones: { pendientes?: unknown[]; porConciliar?: { error: { code: string } } } = {}): Base {
  const b: Base = { rpc: vi.fn(), escritos: new Set(), orden: [], marcas: [], llamadas: [] };
  b.rpc.mockImplementation(async (nombre: string, args: Record<string, unknown>) => {
    b.llamadas.push(nombre);
    if (nombre === "chatwoot_registrar_evento") return { data: [{ nuevo: false, aplicado: true, client_id: null }], error: null };
    if (nombre === "chatwoot_portal_estado_hilo") return { data: [{ resultado: "igual", estado: "abierto" }], error: null };
    if (nombre === "chatwoot_portal_por_conciliar") {
      if (opciones.porConciliar) return { data: null, error: opciones.porConciliar.error };
      return { data: opciones.pendientes ?? [], error: null };
    }
    if (nombre === "chatwoot_portal_respuesta") {
      const id = args.p_chatwoot_message_id as number;
      b.orden.push(id);
      if (b.escritos.has(id)) return { data: [{ resultado: "duplicado", cliente_id: null }], error: null };
      b.escritos.add(id);
      return { data: [{ resultado: "insertado", cliente_id: CLIENTE }], error: null };
    }
    if (nombre === "chatwoot_portal_marcar_conciliado") {
      b.marcas.push({ conversacion: args.p_conversation_id as string, hasta: args.p_hasta as number | null });
      return { data: true, error: null };
    }
    throw new Error(`rpc inesperada ${nombre}`);
  });
  return b;
}
const admin = (b: Base) => ({ rpc: b.rpc }) as unknown as Parameters<typeof conciliarPortal>[0];
const hilo = (extra: Partial<{ conversation_id: string; chatwoot_conversation_id: number; conciliado_hasta: number | null }> = {}) => ({
  conversation_id: HILO,
  chatwoot_conversation_id: CONV,
  conciliado_hasta: null,
  ...extra,
});
const conversacion = { id: CONV, inboxId: INBOX_PORTAL, estado: "open", noLeidos: 0, asignadoId: null, ultimaActividad: null, fuenteActualizada: 5, telefonoUltimos10: null };
const rango = (desde: number, hasta: number) => Array.from({ length: hasta - desde + 1 }, (_, i) => fila(desde + i));

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  flags.chatwoot_portal = true;
  chatwoot = new Map();
  api.obtenerConversacion.mockReset().mockResolvedValue({ ok: true, data: conversacion });
  api.paginaMensajes.mockReset().mockImplementation(paginar);
  api.buscarMensajePorSourceId.mockReset().mockResolvedValue({ ok: true, data: null });
  api.crearNotaPrivada.mockReset().mockResolvedValue({ ok: true, data: 1 });
  push.notifyClientReplyPush.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("estadoAlPortal · SDD-0586 1c-2", () => {
  const evento = (extra: Partial<EventoChatwoot["conversacion"]> = {}): EventoChatwoot => ({
    evento: "conversation_status_changed",
    clave: "conversation_status_changed:9001:resolved:5",
    accountId: 1,
    mensajeId: null,
    avisar: false,
    conversacion: { ...conversacion, estado: "resolved", ...extra },
  });
  const ctx = (b: Base, tenantId = T1) => ({ admin: admin(b), tenantId }) as unknown as ContextoChatwoot;
  const registro = { nuevo: true, aplicado: true, clientId: null };

  it("pide el estado a la base solo con el tenant y la conversación: nunca el estado del evento", async () => {
    const b = base();
    await estadoAlPortal(ctx(b), evento(), registro);
    expect(b.rpc).toHaveBeenCalledWith("chatwoot_portal_estado_hilo", { p_tenant_id: T1, p_chatwoot_conversation_id: CONV });
  });

  it("en el reproceso (sin bandeja y con el estado de relleno) igual le pregunta a la base", async () => {
    const b = base();
    await estadoAlPortal(ctx(b), evento({ inboxId: null, estado: "open" }), { nuevo: true, aplicado: false, clientId: null });
    expect(b.rpc).toHaveBeenCalledWith("chatwoot_portal_estado_hilo", { p_tenant_id: T1, p_chatwoot_conversation_id: CONV });
  });

  it("otra bandeja, otro tenant, el flag apagado o sin configuración: no hace nada", async () => {
    const b = base();
    await estadoAlPortal(ctx(b), evento({ inboxId: 3 }), registro);
    await estadoAlPortal(ctx(b, T2), evento(), registro);
    flags.chatwoot_portal = false;
    await estadoAlPortal(ctx(b), evento(), registro);
    flags.chatwoot_portal = true;
    vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "");
    await estadoAlPortal(ctx(b), evento(), registro);
    expect(b.rpc).not.toHaveBeenCalled();
  });

  it("sin la 0521 (PGRST202) no lanza; otro error de la base, sí (el evento se reintenta)", async () => {
    const b = base();
    b.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    await expect(estadoAlPortal(ctx(b), evento(), registro)).resolves.toBeUndefined();
    b.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    await expect(estadoAlPortal(ctx(b), evento(), registro)).rejects.toThrow(/chatwoot_portal_estado_hilo: XX000/);
  });
});

describe("conciliarPortal · SDD-0586 1c-2", () => {
  const cfg = () => chatwootPortalConfig()!;

  it("25 respuestas perdidas, con páginas de 20: entran las 25, en orden ascendente, y la marca sube a la más nueva", async () => {
    chatwoot.set(CONV, rango(1, 25));
    const b = base();
    const r = await conciliarHilo(admin(b), cfg(), hilo());
    expect(r).toEqual({ traidas: 25, completo: true });
    expect(b.orden).toEqual(rango(1, 25).map((m) => m.id));
    expect(b.marcas).toEqual([{ conversacion: HILO, hasta: 25 }]);
    expect(push.notifyClientReplyPush).toHaveBeenCalledTimes(25);
  });

  it("la pérdida salteada: con el 10 y el 12 perdidos y el 11 entregado, entran los dos en una corrida", async () => {
    chatwoot.set(CONV, rango(1, 12));
    const b = base();
    for (let id = 1; id <= 9; id += 1) b.escritos.add(id);
    b.escritos.add(11);
    const r = await conciliarHilo(admin(b), cfg(), hilo({ conciliado_hasta: 9 }));
    expect(r).toEqual({ traidas: 2, completo: true });
    expect([...b.escritos].sort((x, y) => x - y)).toEqual(rango(1, 12).map((m) => m.id));
    expect(b.marcas).toEqual([{ conversacion: HILO, hasta: 12 }]);
  });

  it("pasa la marca y no vuelve a escribir lo de antes de ella", async () => {
    chatwoot.set(CONV, rango(1, 30));
    const b = base();
    await conciliarHilo(admin(b), cfg(), hilo({ conciliado_hasta: 28 }));
    expect(b.orden).toEqual([29, 30]);
    expect(api.paginaMensajes).toHaveBeenCalledTimes(1);
  });

  it("si lo corta el tope de páginas: faltan_paginas, escribe lo que juntó y no mueve la marca", async () => {
    chatwoot.set(CONV, rango(1, 45));
    const b = base();
    const r = await conciliarHilo(admin(b), cfg(), hilo(), 2);
    expect(r.completo).toBe(false);
    expect(b.marcas).toEqual([]);
    expect(b.orden).toEqual(rango(6, 45).map((m) => m.id));
  });

  it("solo lleva las respuestas del equipo: ni entrantes, ni privadas, ni el eco nuestro", async () => {
    chatwoot.set(CONV, [
      fila(1, { message_type: 0, sender_type: "Contact", sender: { id: 3, type: "contact" } }),
      fila(2, { private: true }),
      fila(3, { source_id: "dtd:abc" }),
      fila(4),
    ]);
    const b = base();
    const r = await conciliarHilo(admin(b), cfg(), hilo());
    expect(b.orden).toEqual([4]);
    expect(r.traidas).toBe(1);
    expect(b.marcas).toEqual([{ conversacion: HILO, hasta: 4 }]);
  });

  it("antes de los mensajes corrige el espejo y el estado del hilo", async () => {
    chatwoot.set(CONV, rango(1, 2));
    const b = base();
    await conciliarHilo(admin(b), cfg(), hilo());
    expect(b.llamadas.slice(0, 2)).toEqual(["chatwoot_registrar_evento", "chatwoot_portal_estado_hilo"]);
    expect(b.rpc).toHaveBeenCalledWith("chatwoot_registrar_evento", expect.objectContaining({ p_event_key: null, p_conversation_id: CONV, p_status: "open" }));
  });

  it("un hilo que falla no frena los demás, y con Chatwoot caído no se marca", async () => {
    chatwoot.set(CONV2, rango(1, 3));
    api.obtenerConversacion.mockImplementation(async (_cfg: unknown, id: number) =>
      id === CONV ? { ok: false, error: "red" } : { ok: true, data: { ...conversacion, id } },
    );
    const b = base({
      pendientes: [hilo(), hilo({ conversation_id: HILO2, chatwoot_conversation_id: CONV2 })],
    });
    const r = await conciliarPortal(admin(b));
    expect(r).toEqual({ hilos: 2, traidas: 3, completos: 1, faltanPaginas: 0, fallidos: 1 });
    expect(b.marcas).toEqual([{ conversacion: HILO2, hasta: 3 }]);
  });

  it("con la página de mensajes caída no marca el hilo", async () => {
    api.paginaMensajes.mockResolvedValue({ ok: false, error: "red" });
    const b = base({ pendientes: [hilo()] });
    const r = await conciliarPortal(admin(b));
    expect(r.fallidos).toBe(1);
    expect(b.marcas).toEqual([]);
  });

  it("pide a la base los hilos del tenant configurado, con el tope de 20", async () => {
    const b = base({ pendientes: [] });
    await conciliarPortal(admin(b));
    expect(b.rpc).toHaveBeenCalledWith("chatwoot_portal_por_conciliar", { p_tenant_id: T1, p_limite: 20 });
  });

  it("con el flag apagado, sin configuración o sin la 0521, no concilia nada", async () => {
    const b = base();
    flags.chatwoot_portal = false;
    expect(await conciliarPortal(admin(b))).toMatchObject({ omitido: "apagado", hilos: 0 });
    flags.chatwoot_portal = true;
    vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "");
    expect(await conciliarPortal(admin(b))).toMatchObject({ omitido: "sin_configurar", hilos: 0 });
    expect(b.rpc).not.toHaveBeenCalled();
    vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", String(INBOX_PORTAL));
    const sinMigracion = base({ porConciliar: { error: { code: "PGRST202" } } });
    expect(await conciliarPortal(admin(sinMigracion))).toMatchObject({ omitido: "sin_migracion", hilos: 0 });
  });
});
