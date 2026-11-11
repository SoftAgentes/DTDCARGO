// @vitest-environment node
/**
 * SDD-0585 · paso 2.7 · miembros de bandejas y equipos (API de cuenta de
 * Chatwoot 4.19.1, con el token del usuario de servicio):
 *   GET  /api/v1/accounts/{a}/inbox_members/{inbox}  → { payload: [agente] }
 *   PATCH /api/v1/accounts/{a}/inbox_members         { inbox_id, user_ids }
 *   GET  /api/v1/accounts/{a}/teams/{t}/team_members → [agente]
 *   PATCH /api/v1/accounts/{a}/teams/{t}/team_members { user_ids }
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fijarMiembrosBandeja, fijarMiembrosEquipo, leerMiembrosBandeja, leerMiembrosEquipo } from "../miembros-api";

const CFG = { origin: "https://chat.ejemplo.test", token: "tok-plataforma", accountId: 1 };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

const llamada = (i = 0) => {
  const [url, init] = fetchSpy.mock.calls[i] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : null };
};

describe("bandejas", () => {
  it("lee solo los ids, con el token de servicio (no el de la Platform App)", async () => {
    fetchSpy.mockResolvedValueOnce(
      json({ payload: [{ id: 3, name: "Sintética", email: "a@example.test" }, { id: "x" }, { id: 8 }] }),
    );
    const r = await leerMiembrosBandeja(CFG, "tok-servicio", 10);
    expect(r).toEqual({ ok: true, data: [3, 8] });
    expect(llamada().url).toBe("https://chat.ejemplo.test/api/v1/accounts/1/inbox_members/10");
    expect(llamada().init.method).toBe("GET");
    expect(llamada().headers.api_access_token).toBe("tok-servicio");
    expect(llamada().init.redirect).toBe("error");
  });

  it("fija la lista completa con PATCH", async () => {
    fetchSpy.mockResolvedValueOnce(json({ payload: [] }));
    expect(await fijarMiembrosBandeja(CFG, "tok-servicio", 10, [3, 8])).toEqual({ ok: true, data: null });
    expect(llamada().url).toBe("https://chat.ejemplo.test/api/v1/accounts/1/inbox_members");
    expect(llamada().init.method).toBe("PATCH");
    expect(llamada().body).toEqual({ inbox_id: 10, user_ids: [3, 8] });
  });

  it("forma rara, 401, 404 y red", async () => {
    fetchSpy.mockResolvedValueOnce(json([]));
    expect(await leerMiembrosBandeja(CFG, "t", 10)).toEqual({ ok: false, error: "respuesta_invalida" });
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 401 }));
    expect(await leerMiembrosBandeja(CFG, "t", 10)).toEqual({ ok: false, error: "no_autorizado" });
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 404 }));
    expect(await fijarMiembrosBandeja(CFG, "t", 10, [])).toEqual({ ok: false, error: "no_encontrado" });
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await leerMiembrosBandeja(CFG, "t", 10)).toEqual({ ok: false, error: "red" });
  });
});

describe("equipos", () => {
  it("lee un arreglo de agentes y fija con PATCH en la ruta del equipo", async () => {
    fetchSpy.mockResolvedValueOnce(json([{ id: 7 }, { id: 0 }]));
    expect(await leerMiembrosEquipo(CFG, "tok-servicio", 40)).toEqual({ ok: true, data: [7] });
    expect(llamada().url).toBe("https://chat.ejemplo.test/api/v1/accounts/1/teams/40/team_members");
    fetchSpy.mockResolvedValueOnce(json([]));
    expect(await fijarMiembrosEquipo(CFG, "tok-servicio", 40, [])).toEqual({ ok: true, data: null });
    expect(llamada(1).init.method).toBe("PATCH");
    expect(llamada(1).body).toEqual({ user_ids: [] });
  });

  it("cuerpo que no es JSON: respuesta_invalida; 500: http_500", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    expect(await leerMiembrosEquipo(CFG, "t", 40)).toEqual({ ok: false, error: "respuesta_invalida" });
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect(await fijarMiembrosEquipo(CFG, "t", 40, [1])).toEqual({ ok: false, error: "http_500" });
  });
});
