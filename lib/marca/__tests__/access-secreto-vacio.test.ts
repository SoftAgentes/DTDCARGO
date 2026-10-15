// @vitest-environment node
/**
 * SDD-0523 — `MARCA_ACCESS_SECRET` vacía no puede sellar la cookie de `/marca`.
 *
 * Con `??`, una variable definida y vacía dejaba la clave en `""`: el `!secret`
 * la descartaba y `/marca` quedaba cerrada aunque hubiera service role. Con sólo
 * espacios, `"  "` pasaba como clave y cualquiera podía fabricar la cookie
 * `dtd_marca` (o la interna) y entrar sin el código.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openToken, sealToken, type SealOptions } from "@/lib/shared/signed-token";

const { jar, rpcMock, getUserMock } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  rpcMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));
vi.mock("@/lib/auth/session", () => ({ getUser: getUserMock }));
vi.mock("@/lib/http/request-ip", () => ({ getRequestIp: async () => "203.0.113.7" }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: { id: "tenant-1" }, error: null }),
      };
      return chain;
    },
    rpc: (name: string, args: Record<string, unknown>) => ({
      maybeSingle: async () => rpcMock(name, args),
    }),
  }),
}));

import {
  MARCA_COOKIE,
  MARCA_COOKIE_INTERNA,
  attemptKeyFor,
  hasBrandAccess,
  hasBrandInternalAccess,
  submitBrandCode,
} from "../access";

/** Contrato criptográfico de las cookies (`lib/marca/access.ts`); no cambia. */
const SEAL: SealOptions = { version: "m1", aad: "dtd-marca-access-v1" };
const SEAL_INTERNO: SealOptions = { version: "i1", aad: "dtd-marca-interno-v1" };

const DEDICADO = "secreto-dedicado-de-marca";
const SERVICE_ROLE = "service-role-de-prueba";

function stubSecrets(dedicated: string | undefined, serviceRole: string | undefined) {
  vi.stubEnv("MARCA_ACCESS_SECRET", dedicated);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRole);
}

function sesion() {
  return { t: "tenant-1", exp: Math.floor(Date.now() / 1000) + 3600 };
}

function cookieSelladaCon(secret: string) {
  jar.set(MARCA_COOKIE, sealToken(sesion(), secret, SEAL));
}

beforeEach(() => {
  jar.clear();
  rpcMock.mockReset();
  getUserMock.mockReset();
  getUserMock.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cookie de /marca con MARCA_ACCESS_SECRET vacía", () => {
  it.each([
    ["vacía", ""],
    ["con espacios", "  \t "],
  ])("sin service role, una cookie sellada con el valor de la variable no abre (%s)", async (_n, dedicated) => {
    stubSecrets(dedicated, undefined);
    cookieSelladaCon(dedicated);
    expect(await hasBrandAccess()).toBe(false);
  });

  it.each([
    ["vacía", ""],
    ["con espacios", "   "],
    ["sin definir", undefined],
  ])("cae al service role (%s)", async (_n, dedicated) => {
    stubSecrets(dedicated, SERVICE_ROLE);

    cookieSelladaCon(dedicated ?? "");
    expect(await hasBrandAccess()).toBe(false);

    cookieSelladaCon(SERVICE_ROLE);
    expect(await hasBrandAccess()).toBe(true);
  });

  it("con el dedicado definido, lo usa y no el service role", async () => {
    stubSecrets(DEDICADO, SERVICE_ROLE);

    cookieSelladaCon(SERVICE_ROLE);
    expect(await hasBrandAccess()).toBe(false);

    cookieSelladaCon(DEDICADO);
    expect(await hasBrandAccess()).toBe(true);
  });

  it.each([
    ["vacías", "", ""],
    ["con espacios", "  ", " "],
  ])("la capa interna tampoco abre con cookies selladas con esas claves (%s)", async (_n, dedicated, serviceRole) => {
    stubSecrets(dedicated, serviceRole);
    cookieSelladaCon(dedicated);
    jar.set(MARCA_COOKIE_INTERNA, sealToken(sesion(), dedicated, SEAL_INTERNO));
    expect(await hasBrandInternalAccess()).toBe(false);
  });
});

describe("código de /marca con MARCA_ACCESS_SECRET vacía", () => {
  it.each([
    ["las dos vacías", "", ""],
    ["las dos con espacios", " ", "\n"],
    ["las dos sin definir", undefined, undefined],
  ])("sin ningún secreto no consulta ni sella nada (%s)", async (_n, dedicated, serviceRole) => {
    stubSecrets(dedicated, serviceRole);

    expect(await submitBrandCode("123456")).toEqual({ status: "unavailable" });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(jar.size).toBe(0);
  });

  it("con la dedicada vacía, sala la huella y sella la cookie con el service role", async () => {
    stubSecrets("", SERVICE_ROLE);
    rpcMock.mockResolvedValue({
      data: { ok: true, locked_until: null, attempts_left: 3, session_days: 30 },
      error: null,
    });

    expect(await submitBrandCode("123456")).toEqual({ status: "ok", sessionDays: 30 });
    expect(rpcMock).toHaveBeenCalledWith(
      "verify_brand_access_code",
      expect.objectContaining({ p_attempt_key: attemptKeyFor("203.0.113.7", SERVICE_ROLE) }),
    );

    const cookie = jar.get(MARCA_COOKIE);
    expect(openToken(cookie, SERVICE_ROLE, SEAL)).toMatchObject({ t: "tenant-1" });
    expect(openToken(cookie, "", SEAL)).toBeNull();
  });
});
