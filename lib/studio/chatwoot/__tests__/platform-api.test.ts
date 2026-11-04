// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { obtenerAgente, obtenerEnlaceSso } from "../platform-api";
import { chatwootConfig, type ChatwootConfig } from "../config";

const CFG: ChatwootConfig = { origin: "https://chat.ejemplo.test", token: "tok-prueba", accountId: 1 };
const SSO = "https://chat.ejemplo.test/app/login?email=agente.sintetica%40example.test&sso_auth_token=abc123";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("chatwootConfig (SDD-0585)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sin token, con token en blanco o sin cuenta → null (sin red)", () => {
    vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "");
    expect(chatwootConfig()).toBeNull();
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "   ");
    expect(chatwootConfig()).toBeNull();
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "tok");
    vi.stubEnv("CHATWOOT_ACCOUNT_ID", "uno");
    expect(chatwootConfig()).toBeNull();
  });

  it("con todo → origen del chat, token y cuenta", () => {
    vi.stubEnv("CHATWOOT_URL", "https://chat.ejemplo.test/");
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "tok");
    vi.stubEnv("CHATWOOT_ACCOUNT_ID", "7");
    expect(chatwootConfig()).toEqual({ origin: "https://chat.ejemplo.test", token: "tok", accountId: 7 });
  });
});

describe("obtenerEnlaceSso (SDD-0585)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("pide /users/{id}/login con el token en la cabecera y devuelve el enlace", async () => {
    fetchSpy.mockResolvedValue(json({ url: SSO }));
    const r = await obtenerEnlaceSso(42, CFG);
    expect(r).toEqual({ ok: true, data: SSO });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://chat.ejemplo.test/platform/api/v1/users/42/login");
    expect((init.headers as Record<string, string>).api_access_token).toBe("tok-prueba");
    expect(init.cache).toBe("no-store");
  });

  it("sin configuración no llama a la red", async () => {
    expect(await obtenerEnlaceSso(42, null)).toEqual({ ok: false, error: "sin_configurar" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    [401, "no_autorizado"],
    [403, "no_autorizado"],
    [404, "no_encontrado"],
    [500, "http_500"],
  ])("HTTP %i → %s", async (status, error) => {
    fetchSpy.mockResolvedValue(json({ error: "x" }, status));
    expect(await obtenerEnlaceSso(42, CFG)).toEqual({ ok: false, error });
  });

  it("red caída → red, sin lanzar", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    expect(await obtenerEnlaceSso(42, CFG)).toEqual({ ok: false, error: "red" });
  });

  it("respuesta que no es JSON o sin url → respuesta_invalida", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    expect(await obtenerEnlaceSso(42, CFG)).toEqual({ ok: false, error: "respuesta_invalida" });
    fetchSpy.mockResolvedValueOnce(json({}));
    expect(await obtenerEnlaceSso(42, CFG)).toEqual({ ok: false, error: "respuesta_invalida" });
  });

  it("un enlace de otro origen se rechaza (FRONTEND_URL mal puesto en el chat)", async () => {
    fetchSpy.mockResolvedValue(json({ url: SSO.replace("chat.ejemplo.test", "otro.ejemplo.test") }));
    expect(await obtenerEnlaceSso(42, CFG)).toEqual({ ok: false, error: "origen_invalido" });
  });
});

describe("obtenerAgente (SDD-0585)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("devuelve solo id, correo, nombre y cuentas: el access_token del agente no sale", async () => {
    fetchSpy.mockResolvedValue(
      json({
        id: 42,
        email: "agente.sintetica@example.test",
        name: "Agente Sintética",
        access_token: "SECRETO-DEL-AGENTE",
        pubsub_token: "SECRETO-PUBSUB",
        accounts: [{ id: 1, name: "DTD Cargo", role: "agent" }],
      }),
    );
    const r = await obtenerAgente(42, CFG);
    expect(r).toEqual({
      ok: true,
      data: { id: 42, email: "agente.sintetica@example.test", name: "Agente Sintética", accountIds: [1] },
    });
    expect(JSON.stringify(r)).not.toContain("SECRETO");
  });

  it("un id distinto en la respuesta → respuesta_invalida", async () => {
    fetchSpy.mockResolvedValue(json({ id: 7, email: "x@example.test", accounts: [] }));
    expect(await obtenerAgente(42, CFG)).toEqual({ ok: false, error: "respuesta_invalida" });
  });
});
