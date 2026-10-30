// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { asignarEquipo, enviarMensaje, leerEtiquetas, obtenerConversacion, ponerEtiquetas } from "../router-api";
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
