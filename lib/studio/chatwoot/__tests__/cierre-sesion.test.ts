// @vitest-environment node
/**
 * SDD-0585 · paso 2.7 · cierre forzado de las sesiones de un agente dado de
 * baja («Quiero cierre forzado», Sam, 2026-10-30). Las rutas y su orden salen
 * de Chatwoot 4.19.1 (evidencia C):
 *   1. GET  platform/…/users/{id}          → access_token del agente
 *   2. GET  platform/…/users/{id}/login    → enlace SSO (email + sso_auth_token)
 *   3. POST /auth/sign_in                  → sesión de Studio, la más nueva
 *   4. PATCH platform/…/users/{id}         → clave nueva: queda solo esa sesión
 *   5. GET  /api/v1/profile/sessions       → la lista; DELETE …/sessions/{id} cada una
 *   6. GET  /api/v1/profile/sessions       → vacía
 *   7. POST /api/v1/profile/reset_access_token, y GET users/{id} → token nuevo
 * El doble de fetch responde por método y ruta, y anota el orden.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cerrarSesionesAgente } from "../cierre-sesion";

const CFG = { origin: "https://chat.ejemplo.test", token: "tok-plataforma", accountId: 1 };
const ID = 7;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Ruta = (init: RequestInit) => Response | Promise<Response>;
let rutas: Record<string, Ruta>;
let llamadas: { clave: string; init: RequestInit }[];
let tokenActual: string;
let sesiones: number[];

beforeEach(() => {
  llamadas = [];
  tokenActual = "tok-agente-viejo";
  sesiones = [41, 42];
  rutas = {
    [`GET /platform/api/v1/users/${ID}`]: () => json({ id: ID, email: "ana@example.test", access_token: tokenActual }),
    [`GET /platform/api/v1/users/${ID}/login`]: () =>
      json({ url: "https://chat.ejemplo.test/app/login?email=ana%40example.test&sso_auth_token=sso-uno" }),
    "POST /auth/sign_in": () => {
      sesiones.push(43);
      return json({ data: { id: ID } });
    },
    [`PATCH /platform/api/v1/users/${ID}`]: () => {
      // remove_tokens_after_password_reset: sobrevive solo la más nueva (43).
      sesiones = sesiones.filter((s) => s === 43);
      return json({ id: ID });
    },
    "GET /api/v1/profile/sessions": () => json(sesiones.map((id) => ({ id, current: false }))),
    "DELETE /api/v1/profile/sessions/43": () => {
      sesiones = sesiones.filter((s) => s !== 43);
      return new Response(null, { status: 200 });
    },
    "POST /api/v1/profile/reset_access_token": () => {
      tokenActual = "tok-agente-nuevo";
      return json({ id: ID });
    },
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const clave = `${init?.method ?? "GET"} ${url.pathname}`;
    llamadas.push({ clave, init: init ?? {} });
    const ruta = rutas[clave];
    return ruta ? ruta(init ?? {}) : new Response("no", { status: 404 });
  });
});
afterEach(() => vi.restoreAllMocks());

const cabeceras = (i: number) => llamadas[i].init.headers as Record<string, string>;

describe("cerrarSesionesAgente (2.7)", () => {
  it("camino feliz: el orden exacto y ninguna sesión al final", async () => {
    const r = await cerrarSesionesAgente(ID, CFG);
    expect(r).toEqual({ ok: true, data: { sesionesCerradas: 1 } });
    expect(llamadas.map((l) => l.clave)).toEqual([
      `GET /platform/api/v1/users/${ID}`,
      `GET /platform/api/v1/users/${ID}/login`,
      "POST /auth/sign_in",
      `PATCH /platform/api/v1/users/${ID}`,
      "GET /api/v1/profile/sessions",
      "DELETE /api/v1/profile/sessions/43",
      "GET /api/v1/profile/sessions",
      "POST /api/v1/profile/reset_access_token",
      `GET /platform/api/v1/users/${ID}`,
    ]);
    expect(sesiones).toEqual([]);
  });

  it("la entrada usa el correo y el token del enlace SSO, sin token de API", async () => {
    await cerrarSesionesAgente(ID, CFG);
    const entrada = llamadas.find((l) => l.clave === "POST /auth/sign_in")!;
    expect(JSON.parse(String(entrada.init.body))).toEqual({ email: "ana@example.test", sso_auth_token: "sso-uno" });
    expect((entrada.init.headers as Record<string, string>).api_access_token).toBeUndefined();
  });

  it("la clave nueva cumple las reglas de Chatwoot y no se repite", async () => {
    await cerrarSesionesAgente(ID, CFG);
    const clave = JSON.parse(String(llamadas[3].init.body)).password as string;
    expect(clave).toHaveLength(32);
    expect(clave).toMatch(/[A-Z]/);
    expect(clave).toMatch(/[a-z]/);
    expect(clave).toMatch(/[0-9]/);
    expect(clave).toMatch(/[^A-Za-z0-9]/);
  });

  it("las sesiones se listan y borran con el token VIEJO del agente y SIN cabecera client (ninguna es «la actual»)", async () => {
    await cerrarSesionesAgente(ID, CFG);
    for (const i of [4, 5, 6, 7]) {
      expect(cabeceras(i).api_access_token).toBe("tok-agente-viejo");
      expect(cabeceras(i).client).toBeUndefined();
    }
    // La Platform API va con el token de la Platform App.
    expect(cabeceras(0).api_access_token).toBe("tok-plataforma");
  });

  it("si la clave no deja una sola sesión, borra todas las que haya", async () => {
    rutas[`PATCH /platform/api/v1/users/${ID}`] = () => json({ id: ID });
    rutas["DELETE /api/v1/profile/sessions/41"] = () => ((sesiones = sesiones.filter((s) => s !== 41)), new Response(null));
    rutas["DELETE /api/v1/profile/sessions/42"] = () => ((sesiones = sesiones.filter((s) => s !== 42)), new Response(null));
    const r = await cerrarSesionesAgente(ID, CFG);
    expect(r).toEqual({ ok: true, data: { sesionesCerradas: 3 } });
  });

  it("una sesión que ya no estaba (404 al borrarla) no es un fallo", async () => {
    sesiones = [];
    rutas["POST /auth/sign_in"] = () => json({});
    rutas["GET /api/v1/profile/sessions"] = (() => {
      let primera = true;
      return () => {
        const r = json(primera ? [{ id: 99 }] : []);
        primera = false;
        return r;
      };
    })();
    expect((await cerrarSesionesAgente(ID, CFG)).ok).toBe(true);
  });

  it("si queda alguna sesión viva al final: falla en «quedan_sesiones» y NO rota el token", async () => {
    rutas["DELETE /api/v1/profile/sessions/43"] = () => new Response(null, { status: 200 });
    const r = await cerrarSesionesAgente(ID, CFG);
    expect(r).toEqual({ ok: false, paso: "quedan_sesiones", error: "respuesta_invalida" });
    expect(llamadas.some((l) => l.clave === "POST /api/v1/profile/reset_access_token")).toBe(false);
  });

  it("si el token no cambió tras rotarlo: falla en «rotacion»", async () => {
    rutas["POST /api/v1/profile/reset_access_token"] = () => json({ id: ID });
    expect(await cerrarSesionesAgente(ID, CFG)).toEqual({ ok: false, paso: "rotacion", error: "respuesta_invalida" });
  });

  it.each([
    ["token", `GET /platform/api/v1/users/${ID}`, 404, "no_encontrado"],
    ["enlace", `GET /platform/api/v1/users/${ID}/login`, 401, "no_autorizado"],
    ["entrada", "POST /auth/sign_in", 429, "http_429"],
    ["clave", `PATCH /platform/api/v1/users/${ID}`, 422, "http_422"],
    ["sesiones", "GET /api/v1/profile/sessions", 403, "no_autorizado"],
    ["sesiones", "DELETE /api/v1/profile/sessions/43", 500, "http_500"],
    ["rotacion", "POST /api/v1/profile/reset_access_token", 500, "http_500"],
  ])("falla en «%s» si %s responde %i, y para ahí", async (paso, ruta, status, error) => {
    rutas[ruta] = () => new Response("x", { status });
    const r = await cerrarSesionesAgente(ID, CFG);
    expect(r).toEqual({ ok: false, paso, error });
    const i = llamadas.findIndex((l) => l.clave === ruta);
    expect(llamadas).toHaveLength(i + 1);
  });

  it("un enlace sin sso_auth_token no se usa (lo rechaza validarEnlaceSso)", async () => {
    rutas[`GET /platform/api/v1/users/${ID}/login`] = () => json({ url: "https://chat.ejemplo.test/app/login?email=ana%40example.test" });
    expect(await cerrarSesionesAgente(ID, CFG)).toEqual({ ok: false, paso: "enlace", error: "origen_invalido" });
    expect(llamadas.some((l) => l.clave === "POST /auth/sign_in")).toBe(false);
  });

  it("red caída: «red», sin lanzar", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError("fetch failed"));
    expect(await cerrarSesionesAgente(ID, CFG)).toEqual({ ok: false, paso: "token", error: "red" });
  });

  it("nada del cierre se escribe en los logs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await cerrarSesionesAgente(ID, CFG);
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
