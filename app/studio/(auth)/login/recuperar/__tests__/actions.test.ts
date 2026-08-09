import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminAvailable: true,
  throttleCount: 0,
  throttleError: null as { message: string } | null,
  insertThrottleError: null as { message: string } | null,
  authUsers: [{ id: "user-1", email: "sam@dtdcargo.com" }] as
    | { id: string; email: string }[]
    | null,
  membership: { tenant_id: "tenant-1" } as { tenant_id: string } | null,
  tokenInsertError: null as { message: string } | null,
  insertedTokens: [] as Array<Record<string, unknown>>,
  insertedThrottle: [] as Array<{ ip: string }>,
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/http/request-ip", () => ({
  getRequestIp: async () => "203.0.113.7",
}));

vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    if (!mocks.adminAvailable) throw new Error("admin unavailable");
    return {
      auth: {
        admin: {
          listUsers: async () => ({ data: { users: mocks.authUsers ?? [] } }),
        },
      },
      from(table: string) {
        if (table === "portal_registro_throttle") {
          const chain: Record<string, unknown> = {
            select: () => chain,
            eq: () => chain,
            gte: async () => ({ count: mocks.throttleCount, error: mocks.throttleError }),
            insert: async (payload: { ip: string }) => {
              mocks.insertedThrottle.push(payload);
              return { error: mocks.insertThrottleError };
            },
          };
          return chain;
        }
        if (table === "user_tenants") {
          const chain: Record<string, unknown> = {
            select: () => chain,
            eq: () => chain,
            is: () => chain,
            limit: () => chain,
            maybeSingle: async () => ({ data: mocks.membership, error: null }),
          };
          return chain;
        }
        if (table === "studio_access_tokens") {
          const chain: Record<string, unknown> = {
            insert: async (payload: Record<string, unknown>) => {
              mocks.insertedTokens.push(payload);
              return { error: mocks.tokenInsertError };
            },
          };
          return chain;
        }
        throw new Error(`tabla no mockeada: ${table}`);
      },
    };
  },
}));

import { requestStudioRecoveryAction } from "../actions";

function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("recuperar acceso al Studio · self-service (SDD-0252) · anti-enumeración", () => {
  beforeEach(() => {
    mocks.adminAvailable = true;
    mocks.throttleCount = 0;
    mocks.throttleError = null;
    mocks.insertThrottleError = null;
    mocks.authUsers = [{ id: "user-1", email: "sam@dtdcargo.com" }];
    mocks.membership = { tenant_id: "tenant-1" };
    mocks.tokenInsertError = null;
    mocks.insertedTokens.length = 0;
    mocks.insertedThrottle.length = 0;
    mocks.sendEmail.mockReset();
    mocks.sendEmail.mockResolvedValue({ ok: true });
  });

  it("genera un enlace y manda el correo para una cuenta activa", async () => {
    await expect(
      requestStudioRecoveryAction({}, form("sam@dtdcargo.com")),
    ).resolves.toEqual({ sent: true });
    expect(mocks.insertedTokens).toHaveLength(1);
    expect(mocks.insertedTokens[0]).toMatchObject({
      tenant_id: "tenant-1",
      user_id: "user-1",
      created_by: "user-1",
    });
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });

  it("responde igual para un email que no existe — no manda correo", async () => {
    mocks.authUsers = [];
    await expect(
      requestStudioRecoveryAction({}, form("nadie@dtdcargo.com")),
    ).resolves.toEqual({ sent: true });
    expect(mocks.insertedTokens).toHaveLength(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("responde igual para un usuario desactivado (sin membership activa) — no manda correo", async () => {
    mocks.membership = null;
    await expect(
      requestStudioRecoveryAction({}, form("sam@dtdcargo.com")),
    ).resolves.toEqual({ sent: true });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("responde igual cuando el origen está limitado — no manda correo", async () => {
    mocks.throttleCount = 5;
    await expect(
      requestStudioRecoveryAction({}, form("sam@dtdcargo.com")),
    ).resolves.toEqual({ sent: true });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("el throttle usa el prefijo studio-recuperar: y hashea la IP (no la guarda en claro)", async () => {
    await requestStudioRecoveryAction({}, form("sam@dtdcargo.com"));
    expect(mocks.insertedThrottle[0]?.ip).toMatch(/^studio-recuperar:[a-f0-9]{64}$/);
    expect(mocks.insertedThrottle[0]?.ip).not.toContain("203.0.113.7");
  });

  it("conserva el error local para un formato inválido", async () => {
    await expect(
      requestStudioRecoveryAction({}, form("no-es-email")),
    ).resolves.toEqual({ error: "Ingresa un email válido." });
  });

  it("mantiene respuesta genérica si falla el insert del token", async () => {
    mocks.tokenInsertError = { message: "boom" };
    await expect(
      requestStudioRecoveryAction({}, form("sam@dtdcargo.com")),
    ).resolves.toEqual({ sent: true });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("mantiene respuesta genérica si el admin client no está disponible", async () => {
    mocks.adminAvailable = false;
    await expect(
      requestStudioRecoveryAction({}, form("sam@dtdcargo.com")),
    ).resolves.toEqual({ sent: true });
  });
});
