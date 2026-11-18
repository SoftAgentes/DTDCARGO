// @vitest-environment node
/**
 * SDD-0602 · La baja de un correo no termina en `0.0.0.0`. La baja se ejecutaba,
 * pero el navegador caía en una página rota en vez de la confirmación, y quien se
 * dio de baja no se enteraba. Medido en producción el 2026-11-04.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signUnsubscribeToken } from "../unsubscribe-token";

const SECRET = "test-unsubscribe-secret";
const h = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain = {
        update: (values: unknown) => (h.update(values), chain),
        eq: () => chain,
        then: (ok: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(ok),
      };
      return chain;
    },
  }),
}));

import { GET as porQuery } from "@/app/api/email/unsubscribe/route";
import { GET as porRuta } from "@/app/api/email/unsubscribe/[token]/route";

const CONTENEDOR = "https://0.0.0.0:3000";

const destinoPorRuta = async (token: string) => {
  const res = await porRuta(new NextRequest(`${CONTENEDOR}/api/email/unsubscribe/${encodeURIComponent(token)}`), {
    params: Promise.resolve({ token }),
  });
  expect(res.status).toBe(303);
  return res.headers.get("location");
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", SECRET);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("baja de correo con req.url en 0.0.0.0:3000", () => {
  it("token válido → se da de baja y confirma, sin host en el Location", async () => {
    const token = signUnsubscribeToken({ email: "interno@dtdcargo.test", tenantId: "t-1", audience: "newsletter" }, SECRET);
    expect(await destinoPorRuta(token)).toBe("/email/baja?estado=actualidad");
    expect(h.update).toHaveBeenCalledTimes(1);
  });

  it("token inválido por ruta → aviso", async () => {
    expect(await destinoPorRuta("token-invalido")).toBe("/email/baja?estado=invalido");
    expect(h.update).not.toHaveBeenCalled();
  });

  it("token inválido por query, de los correos anteriores → aviso", async () => {
    const res = await porQuery(new NextRequest(`${CONTENEDOR}/api/email/unsubscribe?token=token-invalido`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/email/baja?estado=invalido");
  });

  it("sin secreto → aviso de error", async () => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await destinoPorRuta("token-invalido")).toBe("/email/baja?estado=error");
  });
});
