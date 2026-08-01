import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminAvailable: true,
  throttleCount: 0,
  throttleError: null as { message: string } | null,
  insertError: null as { message: string } | null,
  clientUser: { id: "client-user-1" } as { id: string } | null,
  clientUserError: null as { message: string } | null,
  inserted: [] as Array<{ ip: string }>,
  signInWithOtp: vi.fn(),
}));

vi.mock("@/lib/http/request-ip", () => ({
  getRequestIp: async () => "203.0.113.7",
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { signInWithOtp: mocks.signInWithOtp },
  }),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    if (!mocks.adminAvailable) throw new Error("admin unavailable");
    return {
      from(table: string) {
        if (table === "portal_registro_throttle") {
          const chain: Record<string, unknown> = {
            select: () => chain,
            eq: () => chain,
            gte: async () => ({
              count: mocks.throttleCount,
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

describe("magic link del portal · anti-enumeración", () => {
  beforeEach(() => {
    mocks.adminAvailable = true;
    mocks.throttleCount = 0;
    mocks.throttleError = null;
    mocks.insertError = null;
    mocks.clientUser = { id: "client-user-1" };
    mocks.clientUserError = null;
    mocks.inserted.length = 0;
    mocks.signInWithOtp.mockReset();
    mocks.signInWithOtp.mockResolvedValue({ error: null });
  });

  it("envía a una cuenta habilitada sin permitir creación de usuarios", async () => {
    await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual({
      sent: true,
      email: "cliente@example.com",
    });
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "cliente@example.com",
      options: {
        emailRedirectTo: "https://dtdcargo.com/portal/callback",
        shouldCreateUser: false,
      },
    });
    expect(mocks.inserted[0]?.ip).toMatch(/^portal-login:[a-f0-9]{64}$/);
    expect(mocks.inserted[0]?.ip).not.toContain("203.0.113.7");
  });

  it("responde igual para una cuenta inexistente y no llama al proveedor", async () => {
    mocks.clientUser = null;
    await expect(requestMagicLink({}, form("nadie@example.com"))).resolves.toEqual({
      sent: true,
      email: "nadie@example.com",
    });
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("responde igual cuando el origen está limitado", async () => {
    mocks.throttleCount = 8;
    await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual({
      sent: true,
      email: "cliente@example.com",
    });
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("preserva el login de usuarios existentes si falta el cliente admin", async () => {
    mocks.adminAvailable = false;
    await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual({
      sent: true,
      email: "cliente@example.com",
    });
    expect(mocks.signInWithOtp).toHaveBeenCalledOnce();
  });

  it("mantiene respuesta genérica si Supabase Auth falla", async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { message: "provider down" } });
    await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual({
      sent: true,
      email: "cliente@example.com",
    });
  });

  it("conserva el error local para un formato inválido", async () => {
    await expect(requestMagicLink({}, form("no-es-email"))).resolves.toEqual({
      error: "Ingresa un email válido.",
    });
  });
});
