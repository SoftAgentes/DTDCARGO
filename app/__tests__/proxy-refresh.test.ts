// @vitest-environment node

/**
 * SDD-0302: ejecuta el proxy real y el matcher de Next instalado.
 * Sólo el límite Auth es sintético: no demuestra refresh JWT ni sesión alojada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import type { CookieOptions } from "@supabase/ssr";

type CookieValue = { name: string; value: string; options: CookieOptions };
type CookieBridge = {
  getAll(): Array<{ name: string; value: string }>;
  setAll(values: CookieValue[]): void;
};

const authBoundary = vi.hoisted(() => ({
  getUser: vi.fn(),
  cookies: null as CookieBridge | null,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: CookieBridge }) => {
    authBoundary.cookies = options.cookies;
    return { auth: { getUser: authBoundary.getUser } };
  },
}));

import { config, proxy } from "../../proxy";

const refreshRoutes = [
  "/portal", "/portal/envios/TEST-1", "/m/erp", "/m/erp/bitacora",
  "/m/emp", "/m/emp/nomina", "/entrar", "/registro",
];

beforeEach(() => {
  vi.clearAllMocks();
  authBoundary.cookies = null;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://auth-fixture.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-test-key");
  // Una salida de red accidental hace fallar el test: nunca usa un proyecto real.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Red no permitida en este fixture"); }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("SDD-0302: puente de cookies en rutas sin redirección", () => {
  it.each(refreshRoutes)("%s conserva cookies hacia servidor y navegador", async (path) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(true);
    const request = new NextRequest(`https://app-fixture.invalid${path}`, {
      headers: { cookie: "session-fixture=old; preference=keep" },
    });
    authBoundary.getUser.mockImplementationOnce(async () => {
      expect(authBoundary.cookies?.getAll()).toContainEqual({ name: "session-fixture", value: "old" });
      authBoundary.cookies!.setAll([
        { name: "session-fixture", value: "fresh", options: { path: "/", secure: true, httpOnly: true, sameSite: "lax" } },
        { name: "session-fixture.1", value: "chunk", options: { path: "/", secure: true, sameSite: "lax" } },
      ]);
      return { data: { user: { id: "synthetic-user" } } };
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    const csp = response.headers.get("content-security-policy");
    const nonce = csp?.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(
      response.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(csp);
    expect(request.cookies.get("session-fixture")?.value).toBe("fresh");
    expect(request.cookies.get("session-fixture.1")?.value).toBe("chunk");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("session-fixture=fresh");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("preference=keep");
    expect(response.cookies.get("session-fixture")).toMatchObject({
      value: "fresh", path: "/", secure: true, httpOnly: true, sameSite: "lax",
    });
    expect(response.cookies.get("session-fixture.1")?.value).toBe("chunk");
    expect(authBoundary.getUser).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(refreshRoutes)("%s deja el gating al consumidor cuando no hay sesión", async (path) => {
    authBoundary.getUser.mockResolvedValueOnce({ data: { user: null } });
    const response = await proxy(new NextRequest(`https://app-fixture.invalid${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.getAll()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    "/m/cn", "/m/cn/recepciones", "/m/ve", "/", "/tarifas", "/contacto",
    "/marca", "/marca/doc/Logo%20Oficial.html", "/norte.html",
  ])(
    "%s permanece fuera del matcher",
    (url) => expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false),
  );

  it("emite un nonce distinto para cada request", async () => {
    authBoundary.getUser.mockResolvedValue({ data: { user: null } });

    const first = await proxy(
      new NextRequest("https://app-fixture.invalid/portal"),
    );
    const second = await proxy(
      new NextRequest("https://app-fixture.invalid/portal"),
    );
    const nonceOf = (response: Response) =>
      response.headers
        .get("content-security-policy")
        ?.match(/'nonce-([^']+)'/)?.[1];

    expect(nonceOf(first)).toBeTruthy();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
  });

  it("protege también la respuesta que redirige al login del Studio", async () => {
    authBoundary.getUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await proxy(
      new NextRequest("https://app-fixture.invalid/studio/clientes"),
    );
    const csp = response.headers.get("content-security-policy");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app-fixture.invalid/studio/login",
    );
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
