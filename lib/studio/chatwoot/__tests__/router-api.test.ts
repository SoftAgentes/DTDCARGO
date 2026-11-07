// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  asignarEquipo,
  buscarContactoPortal,
  crearContactoPortal,
  crearConversacionPortal,
  crearMensajeEntrante,
  enviarMensaje,
  envioIncierto,
  leerEtiquetas,
  listarConversacionesContacto,
  listarMensajes,
  obtenerConversacion,
  ponerEtiquetas,
} from "../router-api";
import type { ChatwootRouterConfig } from "../config";
import { TELEFONO_SINTETICO, TEXTO_SINTETICO, conversacionSintetica } from "./webhook-fixtures";

const CFG: ChatwootRouterConfig = {
  origin: "https://chat.ejemplo.test",
  token: "tok-router",
  accountId: 1,
  inboxLeadsId: 3,
  teamClientesId: 21,
  teamLeadsId: 22,
  numeroClientes: "584125550999",
};
const BASE = "https://chat.ejemplo.test/api/v1/accounts/1/conversations";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

const llamada = (i = 0) => {
  const [url, init] = fetchSpy.mock.calls[i] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
};

describe("envioIncierto (SDD-0586, revisión de Codex)", () => {
  it("red, 5xx y 408 son inciertos; los demás 4xx son rechazos", () => {
    for (const e of ["red", "http_500", "http_502", "http_504", "http_408"] as const) expect(envioIncierto(e)).toBe(true);
    for (const e of ["no_autorizado", "no_encontrado", "http_400", "http_422", "http_429", "respuesta_invalida"] as const) {
      expect(envioIncierto(e)).toBe(false);
    }
  });
});

describe("router-api (SDD-0586)", () => {
  it("obtenerConversacion pide con el token del enrutador y devuelve solo lo mínimo", async () => {
    fetchSpy.mockResolvedValueOnce(json(conversacionSintetica({ labels: ["vip"] })));
    const r = await obtenerConversacion(CFG, 12);
    const { url, init, headers } = llamada();
    expect(url).toBe(`${BASE}/12`);
    expect(init.method).toBe("GET");
    expect(headers.api_access_token).toBe("tok-router");
    expect(init.redirect).toBe("error");
    expect(r.ok && r.data.inboxId).toBe(3);
    expect(JSON.stringify(r)).not.toContain(TEXTO_SINTETICO);
    expect(JSON.stringify(r)).not.toContain(TELEFONO_SINTETICO);
  });

  it("etiquetas: lee el payload y escribe la lista entera", async () => {
    fetchSpy.mockResolvedValueOnce(json({ payload: ["vip", 7] })).mockResolvedValueOnce(json({ payload: ["vip", "cliente"] }));
    expect(await leerEtiquetas(CFG, 12)).toEqual({ ok: true, data: ["vip"] });
    expect(await ponerEtiquetas(CFG, 12, ["vip", "cliente"])).toEqual({ ok: true, data: null });
    expect(llamada(1)).toMatchObject({ url: `${BASE}/12/labels`, body: { labels: ["vip", "cliente"] } });
    expect(llamada(1).init.method).toBe("POST");
  });

  it("asigna el equipo por team_id", async () => {
    fetchSpy.mockResolvedValueOnce(json({ id: 21 }));
    expect(await asignarEquipo(CFG, 12, 21)).toEqual({ ok: true, data: null });
    expect(llamada()).toMatchObject({ url: `${BASE}/12/assignments`, body: { team_id: 21 } });
  });

  it("el mensaje sale público y saliente", async () => {
    fetchSpy.mockResolvedValueOnce(json({ id: 900 }));
    expect(await enviarMensaje(CFG, 12, "hola")).toEqual({ ok: true, data: null });
    expect(llamada()).toMatchObject({
      url: `${BASE}/12/messages`,
      body: { content: "hola", message_type: "outgoing", private: false },
    });
  });

  it("errores: 401 no_autorizado, 404 no_encontrado, 500 http_500, caída red; forma rara respuesta_invalida", async () => {
    fetchSpy
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json({}, 500))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(json({ payload: "x" }))
      .mockResolvedValueOnce(json({ id: "no" }));
    expect(await enviarMensaje(CFG, 12, "x")).toEqual({ ok: false, error: "no_autorizado" });
    expect(await enviarMensaje(CFG, 12, "x")).toEqual({ ok: false, error: "no_encontrado" });
    expect(await enviarMensaje(CFG, 12, "x")).toEqual({ ok: false, error: "http_500" });
    expect(await enviarMensaje(CFG, 12, "x")).toEqual({ ok: false, error: "red" });
    expect(await leerEtiquetas(CFG, 12)).toEqual({ ok: false, error: "respuesta_invalida" });
    expect(await obtenerConversacion(CFG, 12)).toEqual({ ok: false, error: "respuesta_invalida" });
  });
});

describe("router-api · la ida del portal (SDD-0586, 10.5)", () => {
  const CUENTA = { origin: "https://chat.ejemplo.test", token: "tok-router", accountId: 1 };
  const RAIZ = "https://chat.ejemplo.test/api/v1/accounts/1";

  it("crearContactoPortal manda solo la bandeja, el nombre y el identificador, y lee contacto y source_id", async () => {
    fetchSpy.mockResolvedValueOnce(
      json({ payload: { contact: { id: 41, name: "Cliente" }, contact_inbox: { source_id: "src-41", inbox: { id: 9 } } } }),
    );
    const r = await crearContactoPortal(CUENTA, { inboxId: 9, nombre: "Cliente A", identificador: "dtd-portal:abc" });
    expect(r).toEqual({ ok: true, data: { contactoId: 41, sourceId: "src-41" } });
    const { url, init, body } = llamada();
    expect(url).toBe(`${RAIZ}/contacts`);
    expect(init.method).toBe("POST");
    expect(body).toEqual({ inbox_id: 9, name: "Cliente A", identifier: "dtd-portal:abc" });
  });

  it("crearContactoPortal: un 422 se informa tal cual, para buscar por identificador", async () => {
    fetchSpy.mockResolvedValueOnce(json({ message: "Identifier has already been taken" }, 422));
    expect(await crearContactoPortal(CUENTA, { inboxId: 9, nombre: "A", identificador: "dtd-portal:abc" })).toEqual({
      ok: false,
      error: "http_422",
    });
  });

  it("buscarContactoPortal exige el identificador exacto y el source_id de esa bandeja", async () => {
    fetchSpy.mockResolvedValueOnce(
      json({
        payload: [
          { id: 40, identifier: "dtd-portal:abc-otro", contact_inboxes: [{ source_id: "s40", inbox: { id: 9 } }] },
          { id: 41, identifier: "dtd-portal:abc", contact_inboxes: [{ source_id: "s-wa", inbox: { id: 3 } }, { source_id: "s41", inbox: { id: 9 } }] },
        ],
      }),
    );
    expect(await buscarContactoPortal(CUENTA, "dtd-portal:abc", 9)).toEqual({ ok: true, data: { contactoId: 41, sourceId: "s41" } });
    expect(llamada().url).toBe(`${RAIZ}/contacts/search?q=dtd-portal%3Aabc&include_contact_inboxes=true`);
  });

  it("buscarContactoPortal sin coincidencia exacta da null", async () => {
    fetchSpy.mockResolvedValueOnce(json({ payload: [{ id: 40, identifier: "dtd-portal:abc-otro", contact_inboxes: [] }] }));
    expect(await buscarContactoPortal(CUENTA, "dtd-portal:abc", 9)).toEqual({ ok: true, data: null });
  });

  it("conversaciones del contacto: id y bandeja", async () => {
    fetchSpy.mockResolvedValueOnce(json({ payload: [{ id: 9001, inbox_id: 9 }, { id: 12, inbox_id: 3 }, { id: "x" }] }));
    expect(await listarConversacionesContacto(CUENTA, 41)).toEqual({
      ok: true,
      data: [
        { id: 9001, inboxId: 9 },
        { id: 12, inboxId: 3 },
      ],
    });
    expect(llamada().url).toBe(`${RAIZ}/contacts/41/conversations`);
  });

  it("crearConversacionPortal manda source_id, bandeja y contacto, abierta", async () => {
    fetchSpy.mockResolvedValueOnce(json({ id: 9001, inbox_id: 9 }));
    expect(await crearConversacionPortal(CUENTA, { inboxId: 9, contactoId: 41, sourceId: "s41" })).toEqual({ ok: true, data: 9001 });
    expect(llamada()).toMatchObject({
      url: `${RAIZ}/conversations`,
      body: { source_id: "s41", inbox_id: 9, contact_id: 41, status: "open" },
    });
    expect(Object.keys(llamada().body).sort()).toEqual(["contact_id", "inbox_id", "source_id", "status"]);
  });

  it("el mensaje del portal entra como incoming, público y con su source_id", async () => {
    fetchSpy.mockResolvedValueOnce(json({ id: 5001 }));
    expect(await crearMensajeEntrante(CUENTA, 9001, { texto: "hola", sourceId: "dtd:m1" })).toEqual({ ok: true, data: 5001 });
    expect(llamada()).toMatchObject({
      url: `${RAIZ}/conversations/9001/messages`,
      body: { content: "hola", message_type: "incoming", private: false, source_id: "dtd:m1" },
    });
    expect(Object.keys(llamada().body).sort()).toEqual(["content", "message_type", "private", "source_id"]);
  });

  it("listarMensajes devuelve id y source_id, sin el texto", async () => {
    fetchSpy.mockResolvedValueOnce(
      json({ meta: {}, payload: [{ id: 5001, source_id: "dtd:m1", content: TEXTO_SINTETICO }, { id: 5002, source_id: null }] }),
    );
    const r = await listarMensajes(CUENTA, 9001);
    expect(r).toEqual({
      ok: true,
      data: [
        { id: 5001, sourceId: "dtd:m1" },
        { id: 5002, sourceId: null },
      ],
    });
    expect(JSON.stringify(r)).not.toContain(TEXTO_SINTETICO);
    expect(llamada().url).toBe(`${RAIZ}/conversations/9001/messages`);
  });

  it("formas raras dan respuesta_invalida", async () => {
    fetchSpy
      .mockResolvedValueOnce(json({ payload: { contact: { id: 41 } } }))
      .mockResolvedValueOnce(json({ id: "no" }))
      .mockResolvedValueOnce(json({ id: 0 }))
      .mockResolvedValueOnce(json({ payload: "x" }));
    expect(await crearContactoPortal(CUENTA, { inboxId: 9, nombre: "A", identificador: "i" })).toEqual({ ok: false, error: "respuesta_invalida" });
    expect(await crearConversacionPortal(CUENTA, { inboxId: 9, contactoId: 41, sourceId: "s" })).toEqual({ ok: false, error: "respuesta_invalida" });
    expect(await crearMensajeEntrante(CUENTA, 1, { texto: "x", sourceId: "dtd:x" })).toEqual({ ok: false, error: "respuesta_invalida" });
    expect(await listarMensajes(CUENTA, 1)).toEqual({ ok: false, error: "respuesta_invalida" });
  });
});
