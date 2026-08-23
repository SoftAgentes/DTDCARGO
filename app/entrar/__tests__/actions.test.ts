import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminAvailable: true,
  /** Toques ya registrados por clave de cerrojo (prefijo + hash). */
  throttleCounts: {} as Record<string, number>,
  throttleError: null as { message: string } | null,
  insertError: null as { message: string } | null,
  clientUser: { id: "client-user-1", tenant_id: "tenant-1" } as {
    id: string;
    tenant_id: string;
  } | null,
  clientUserError: null as { message: string } | null,
  inserted: [] as Array<{ ip: string }>,
  signInWithOtp: vi.fn(),
  mintPortalMagicToken: vi.fn(),
  sendPortalMagicLinkEmail: vi.fn(),
}));

vi.mock("@/lib/http/request-ip", () => ({
  getRequestIp: async () => "203.0.113.7",
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { signInWithOtp: mocks.signInWithOtp },
  }),
}));

// `portalOpenUrl` queda REAL a propósito: así el test mide la URL que de verdad
// viaja en el correo, no una que el propio test inventó.
vi.mock("@/lib/studio/portal/magic-link", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/studio/portal/magic-link")>();
  return { ...real, mintPortalMagicToken: mocks.mintPortalMagicToken };
});

vi.mock("@/lib/studio/portal/magic-link-email", () => ({
  sendPortalMagicLinkEmail: mocks.sendPortalMagicLinkEmail,
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    if (!mocks.adminAvailable) throw new Error("admin unavailable");
    return {
      from(table: string) {
        if (table === "portal_registro_throttle") {
          let key = "";
          const chain: Record<string, unknown> = {
            select: () => chain,
            eq: (_col: string, value: string) => {
              key = value;
              return chain;
            },
            gte: async () => ({
              count: mocks.throttleCounts[key.split(":")[0]] ?? 0,
              error: mocks.throttleError,
            }),
            insert: async (payload: { ip: string }) => {
              mocks.inserted.push(payload);
              return { error: mocks.insertError };
            },
          };
          return chain;
        }
        const chain: Record<string, unknown> = {
          select: () => chain,
          ilike: () => chain,
          in: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({
            data: mocks.clientUser,
            error: mocks.clientUserError,
          }),
        };
        return chain;
      },
    };
  },
}));

import { requestMagicLink } from "../actions";

function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

const OK = { sent: true, email: "cliente@example.com" };

describe("enlace de acceso al portal", () => {
  beforeEach(() => {
    mocks.adminAvailable = true;
    mocks.throttleCounts = {};
    mocks.throttleError = null;
    mocks.insertError = null;
    mocks.clientUser = { id: "client-user-1", tenant_id: "tenant-1" };
    mocks.clientUserError = null;
    mocks.inserted.length = 0;
    mocks.signInWithOtp.mockReset();
    mocks.signInWithOtp.mockResolvedValue({ error: null });
    mocks.mintPortalMagicToken.mockReset();
    mocks.mintPortalMagicToken.mockResolvedValue("hash-abc");
    mocks.sendPortalMagicLinkEmail.mockReset();
    mocks.sendPortalMagicLinkEmail.mockResolvedValue({
      ok: true,
      log_id: "log-1",
      queued: false,
    });
  });

  describe("camino nuevo · token_hash (SDD-0278)", () => {
    it("manda el enlace por nuestro pipeline y NO por Auth", async () => {
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.sendPortalMagicLinkEmail).toHaveBeenCalledOnce();
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });

    it("el enlace apunta al intersticial, NO al callback", async () => {
      await requestMagicLink({}, form("cliente@example.com"));
      const [, tenantId, input] = mocks.sendPortalMagicLinkEmail.mock.calls[0];
      expect(tenantId).toBe("tenant-1");
      expect(input.url).toBe(
        "https://dtdcargo.com/abrir?token_hash=hash-abc&type=magiclink",
      );
      // Si esto vuelve a apuntar al callback, el escáner de correo quema el token
      // en GET y el cliente recibe un enlace muerto (SDD-0253, mismo bug).
      expect(input.url).not.toContain("/portal/callback");
    });
  });

  describe("plan B · el camino viejo sigue cubriendo", () => {
    it("cae a Auth si no se pudo acuñar el token", async () => {
      mocks.mintPortalMagicToken.mockResolvedValue(null);
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.signInWithOtp).toHaveBeenCalledOnce();
    });

    it("cae a Auth si el envío falla (por ejemplo, blacklist por rebote)", async () => {
      mocks.sendPortalMagicLinkEmail.mockResolvedValue({
        ok: false,
        error: "email en blacklist",
      });
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.signInWithOtp).toHaveBeenCalledOnce();
    });

    it("cae a Auth si el correo quedó en `queued` — un log NO es una entrega", async () => {
      mocks.sendPortalMagicLinkEmail.mockResolvedValue({
        ok: true,
        log_id: "log-1",
        queued: true,
      });
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.signInWithOtp).toHaveBeenCalledOnce();
    });

    it("preserva la entrada si falta el cliente admin", async () => {
      mocks.adminAvailable = false;
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.signInWithOtp).toHaveBeenCalledOnce();
    });
  });

  describe("anti-enumeración y cerrojos", () => {
    it("responde igual para una cuenta inexistente y no manda nada", async () => {
      mocks.clientUser = null;
      await expect(requestMagicLink({}, form("nadie@example.com"))).resolves.toEqual({
        sent: true,
        email: "nadie@example.com",
      });
      expect(mocks.sendPortalMagicLinkEmail).not.toHaveBeenCalled();
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });

    it("responde igual cuando el origen está limitado", async () => {
      mocks.throttleCounts["portal-login"] = 8;
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.sendPortalMagicLinkEmail).not.toHaveBeenCalled();
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });

    it("frena por EMAIL aunque el origen cambie de red", async () => {
      mocks.throttleCounts["portal-login-mail"] = 5;
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.sendPortalMagicLinkEmail).not.toHaveBeenCalled();
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });

    it("los dos cerrojos guardan hash, nunca el dato crudo", async () => {
      await requestMagicLink({}, form("cliente@example.com"));
      expect(mocks.inserted[0]?.ip).toMatch(/^portal-login:[a-f0-9]{64}$/);
      expect(mocks.inserted[1]?.ip).toMatch(/^portal-login-mail:[a-f0-9]{64}$/);
      const crudo = mocks.inserted.map((r) => r.ip).join(" ");
      expect(crudo).not.toContain("203.0.113.7");
      expect(crudo).not.toContain("cliente@example.com");
    });

    it("conserva el error local para un formato inválido", async () => {
      await expect(requestMagicLink({}, form("no-es-email"))).resolves.toEqual({
        error: "Ingresa un email válido.",
      });
    });
  });
});
