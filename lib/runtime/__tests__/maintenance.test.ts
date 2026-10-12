// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COOKIE_BYPASS,
  mantenimientoActivo,
  respuestaDeMantenimiento,
  tokenDeBypass,
} from "../maintenance";

// SDD-0505: con MAINTENANCE_MODE nada puede escribir mientras dura la copia final
// del corte. Estas pruebas fijan qué se corta, cómo responde y la puerta de
// revisión (bypass).

const ON = { MAINTENANCE_MODE: "1", MAINTENANCE_BYPASS_SECRET: "clave-de-prueba" };
const req = (url: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(new URL(url, "https://dtdcargo.com"), init);

describe("mantenimientoActivo", () => {
  it.each(["1", "true", "on", "si", "sí", " TRUE "])("«%s» lo enciende", (v) => {
    expect(mantenimientoActivo({ MAINTENANCE_MODE: v })).toBe(true);
  });
  it.each(["", "0", "false", "off", "no"])("«%s» lo deja apagado", (v) => {
    expect(mantenimientoActivo({ MAINTENANCE_MODE: v })).toBe(false);
  });
});

describe("respuestaDeMantenimiento", () => {
  it("apagado: no corta nada, ni siquiera escrituras", async () => {
    const env = {};
    expect(await respuestaDeMantenimiento(req("/studio/resumen"), env)).toBeNull();
    expect(await respuestaDeMantenimiento(req("/api/cron/push-drain"), env)).toBeNull();
    expect(await respuestaDeMantenimiento(req("/p/abc/upload", { method: "POST" }), env)).toBeNull();
  });

  it("pantalla: 503 con la página en español, Retry-After y sin caché", async () => {
    const r = (await respuestaDeMantenimiento(req("/studio/resumen"), ON))!;
    expect(r.status).toBe(503);
    expect(r.headers.get("retry-after")).toBe("300");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-type")).toContain("text/html");
    const html = await r.text();
    expect(html).toContain("Estamos haciendo una mejora");
    expect(html).toContain('lang="es"');
  });

  it("API: 503 en JSON (los webhooks reintentan solos)", async () => {
    const r = (await respuestaDeMantenimiento(req("/api/cron/push-drain"), ON))!;
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ error: "mantenimiento" });
  });

  it("escritura fuera de /api (POST): 503 en JSON", async () => {
    const r = (await respuestaDeMantenimiento(req("/p/abc/upload", { method: "POST" }), ON))!;
    expect(r.status).toBe(503);
    expect(r.headers.get("content-type")).toContain("application/json");
  });

  it("server action (header Next-Action) desde una página: 503 en JSON", async () => {
    const r = (await respuestaDeMantenimiento(req("/portal/envios", { method: "POST", headers: { "next-action": "abc123" } }), ON))!;
    expect(r.status).toBe(503);
    expect(r.headers.get("content-type")).toContain("application/json");
  });

  describe("puerta de revisión (bypass)", () => {
    it("con la clave correcta: redirige al Studio y deja una cookie con el hash, no la clave", async () => {
      const r = (await respuestaDeMantenimiento(req("/mantenimiento/entrar?clave=clave-de-prueba"), ON))!;
      expect([302, 307]).toContain(r.status);
      expect(new URL(r.headers.get("location")!).pathname).toBe("/studio");
      const cookie = r.cookies.get(COOKIE_BYPASS)!;
      expect(cookie.value).toBe(await tokenDeBypass("clave-de-prueba"));
      expect(cookie.value).not.toContain("clave-de-prueba");
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.secure).toBe(true);
    });

    it("con la cookie se navega y se escribe normal", async () => {
      const token = await tokenDeBypass("clave-de-prueba");
      const conCookie = (url: string, method = "GET") => {
        const r = req(url, { method });
        r.cookies.set(COOKIE_BYPASS, token);
        return r;
      };
      expect(await respuestaDeMantenimiento(conCookie("/studio/resumen"), ON)).toBeNull();
      expect(await respuestaDeMantenimiento(conCookie("/api/x", "POST"), ON)).toBeNull();
    });

    it("clave equivocada o cookie falsa: sigue cortado", async () => {
      expect((await respuestaDeMantenimiento(req("/mantenimiento/entrar?clave=otra"), ON))!.status).toBe(503);
      const r = req("/studio/resumen");
      r.cookies.set(COOKIE_BYPASS, "a".repeat(64));
      expect((await respuestaDeMantenimiento(r, ON))!.status).toBe(503);
    });

    it("sin MAINTENANCE_BYPASS_SECRET no hay puerta: ninguna clave entra", async () => {
      const env = { MAINTENANCE_MODE: "1" };
      expect((await respuestaDeMantenimiento(req("/mantenimiento/entrar?clave="), env))!.status).toBe(503);
      expect((await respuestaDeMantenimiento(req("/mantenimiento/entrar?clave=x"), env))!.status).toBe(503);
    });

    it("`ir` solo acepta rutas internas: nada de redirect abierto", async () => {
      const destino = async (ir: string) =>
        new URL((await respuestaDeMantenimiento(req(`/mantenimiento/entrar?clave=clave-de-prueba&ir=${encodeURIComponent(ir)}`), ON))!.headers.get("location")!);
      expect((await destino("/portal")).pathname).toBe("/portal");
      for (const malo of ["//evil.example", "https://evil.example", "\\\\evil.example", "evil"]) {
        const u = await destino(malo);
        expect(u.host).toBe("dtdcargo.com");
        expect(u.pathname).toBe("/studio");
      }
    });
  });
});

describe("proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("@supabase/ssr");
  });

  async function proxyConSupabaseVigilado() {
    const createServerClient = vi.fn(() => {
      throw new Error("el proxy llamó a Supabase");
    });
    vi.doMock("@supabase/ssr", () => ({ createServerClient }));
    const { proxy } = await import("../../../proxy");
    return { proxy, createServerClient };
  }

  it("en mantenimiento responde 503 sin llamar a Supabase", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "1");
    const { proxy, createServerClient } = await proxyConSupabaseVigilado();
    const r = await proxy(req("/studio/resumen"));
    expect(r.status).toBe(503);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("sin mantenimiento, la API y las rutas de PIN pasan sin pagar el getUser()", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "");
    const { proxy, createServerClient } = await proxyConSupabaseVigilado();
    for (const url of ["/api/cron/push-drain", "/m/cn", "/m/ve/recepcion", "/p/abc/packlist", "/marca/doc/x.html"]) {
      const r = await proxy(req(url));
      expect(r.status, url).toBe(200);
    }
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("control: las rutas con sesión SÍ llaman a Supabase (el refresco sigue)", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "");
    const { proxy, createServerClient } = await proxyConSupabaseVigilado();
    await expect(proxy(req("/studio/resumen"))).rejects.toThrow("el proxy llamó a Supabase");
    expect(createServerClient).toHaveBeenCalledTimes(1);
  });
});
