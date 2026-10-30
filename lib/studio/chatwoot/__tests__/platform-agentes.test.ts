// @vitest-environment node
/**
 * SDD-0585 · paso 2.5 · altas y bajas de agentes por la Platform API de
 * Chatwoot 4.19.1 (`config/routes.rb`, namespace :platform):
 *   - `GET /platform/api/v1/accounts/{id}/account_users` → los AccountUser
 *     (`user_id`, `role`: agent | administrator). Sin correos.
 *   - `POST …/account_users` { user_id, role } (find_or_initialize + update).
 *   - `DELETE …/account_users` { user_id } → 200 sin cuerpo.
 *   - `POST /platform/api/v1/users` { name, email, password } → el usuario
 *     (reusa uno existente por correo y lo hace permisible a la app).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { agregarACuenta, crearAgente, listarMiembrosCuenta, quitarDeCuenta } from "../platform-api";
import { chatwootServicioUserId, type ChatwootConfig } from "../config";

const CFG: ChatwootConfig = { origin: "https://chat.ejemplo.test", token: "tok-plataforma", accountId: 1 };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
});
afterEach(() => {
  fetchSpy.mockRestore();
  vi.unstubAllEnvs();
});

const llamada = (i = 0) => {
  const [url, init] = fetchSpy.mock.calls[i] as [string, RequestInit];
  return { url, init, body: init.body ? JSON.parse(String(init.body)) : null };
};

describe("listarMiembrosCuenta (2.5)", () => {
  it("lee los AccountUser de la cuenta y devuelve solo id y rol", async () => {
    fetchSpy.mockResolvedValueOnce(
      json([
        { id: 10, account_id: 1, user_id: 1, role: "administrator", inviter_id: null },
        { id: 11, account_id: 1, user_id: 3, role: "administrator" },
        { id: 12, account_id: 1, user_id: 7, role: "agent" },
        { id: 13, account_id: 1, user_id: "x", role: "agent" },
      ]),
    );
    const r = await listarMiembrosCuenta(CFG);
    const { url, init } = llamada();
    expect(url).toBe("https://chat.ejemplo.test/platform/api/v1/accounts/1/account_users");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).api_access_token).toBe("tok-plataforma");
    expect(r).toEqual({
      ok: true,
      data: [
        { userId: 1, rol: "administrator" },
        { userId: 3, rol: "administrator" },
        { userId: 7, rol: "agent" },
      ],
    });
  });

  it("forma rara → respuesta_invalida; 401 → no_autorizado", async () => {
    fetchSpy.mockResolvedValueOnce(json({ hola: 1 }));
    expect(await listarMiembrosCuenta(CFG)).toEqual({ ok: false, error: "respuesta_invalida" });
    fetchSpy.mockResolvedValueOnce(json({}, 401));
    expect(await listarMiembrosCuenta(CFG)).toEqual({ ok: false, error: "no_autorizado" });
  });
});

describe("quitarDeCuenta y agregarACuenta (2.5)", () => {
  it("quitar: DELETE con el user_id en el cuerpo; 200 sin cuerpo es ok", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    expect(await quitarDeCuenta(7, CFG)).toEqual({ ok: true, data: null });
    const { url, init, body } = llamada();
    expect(url).toBe("https://chat.ejemplo.test/platform/api/v1/accounts/1/account_users");
    expect(init.method).toBe("DELETE");
    expect(body).toEqual({ user_id: 7 });
  });

  it("agregar: POST con user_id y rol agente", async () => {
    fetchSpy.mockResolvedValueOnce(json({ id: 14, account_id: 1, user_id: 7, role: "agent" }));
    expect(await agregarACuenta(7, CFG)).toEqual({ ok: true, data: null });
    const { init, body } = llamada();
    expect(init.method).toBe("POST");
    expect(body).toEqual({ user_id: 7, role: "agent" });
  });

  it("un error del servidor se devuelve, no se lanza", async () => {
    fetchSpy.mockResolvedValueOnce(json({}, 500));
    expect(await quitarDeCuenta(7, CFG)).toEqual({ ok: false, error: "http_500" });
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await agregarACuenta(7, CFG)).toEqual({ ok: false, error: "red" });
  });
});

describe("crearAgente (2.5)", () => {
  it("POST con nombre, correo y una clave aleatoria fuerte; devuelve solo el id", async () => {
    fetchSpy.mockResolvedValueOnce(json({ id: 9, email: "ana@example.test", access_token: "tok-de-ana" }));
    const r = await crearAgente({ nombre: "Ana Sintética", correo: "ana@example.test" }, CFG);
    expect(r).toEqual({ ok: true, data: 9 });
    expect(JSON.stringify(r)).not.toContain("tok-de-ana");
    const { url, init, body } = llamada();
    expect(url).toBe("https://chat.ejemplo.test/platform/api/v1/users");
    expect(init.method).toBe("POST");
    expect(body.name).toBe("Ana Sintética");
    expect(body.email).toBe("ana@example.test");
    // Chatwoot exige mayúscula, minúscula, número y signo (`password_complexity`).
    expect(body.password).toMatch(/[A-Z]/);
    expect(body.password).toMatch(/[a-z]/);
    expect(body.password).toMatch(/[0-9]/);
    expect(body.password).toMatch(/[^A-Za-z0-9]/);
    expect(body.password.length).toBeGreaterThanOrEqual(24);
  });

  it("la complejidad no depende del azar: con el azar en ceros igual trae los cuatro tipos", async () => {
    const azar = vi.spyOn(crypto, "getRandomValues").mockImplementation((arr) => arr);
    fetchSpy.mockResolvedValueOnce(json({ id: 9 }));
    await crearAgente({ nombre: "A", correo: "a@example.test" }, CFG);
    const clave = llamada().body.password as string;
    for (const tipo of [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/]) expect(clave).toMatch(tipo);
    azar.mockRestore();
  });

  it("cada alta lleva una clave distinta", async () => {
    fetchSpy.mockResolvedValue(json({ id: 9 }));
    await crearAgente({ nombre: "A", correo: "a@example.test" }, CFG);
    await crearAgente({ nombre: "A", correo: "a@example.test" }, CFG);
    expect(llamada(0).body.password).not.toBe(llamada(1).body.password);
  });

  it("sin id en la respuesta → respuesta_invalida", async () => {
    fetchSpy.mockResolvedValueOnce(json({ email: "a@example.test" }));
    expect(await crearAgente({ nombre: "A", correo: "a@example.test" }, CFG)).toEqual({ ok: false, error: "respuesta_invalida" });
  });

  it("sin configuración no llama a la red", async () => {
    expect(await crearAgente({ nombre: "A", correo: "a@example.test" }, null)).toEqual({ ok: false, error: "sin_configurar" });
    expect(await listarMiembrosCuenta(null)).toEqual({ ok: false, error: "sin_configurar" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("chatwootServicioUserId (2.5)", () => {
  it("lee CHATWOOT_SERVICE_USER_ID; vacío o inválido → null", () => {
    vi.stubEnv("CHATWOOT_SERVICE_USER_ID", "1");
    expect(chatwootServicioUserId()).toBe(1);
    vi.stubEnv("CHATWOOT_SERVICE_USER_ID", "");
    expect(chatwootServicioUserId()).toBeNull();
    vi.stubEnv("CHATWOOT_SERVICE_USER_ID", "uno");
    expect(chatwootServicioUserId()).toBeNull();
  });
});
