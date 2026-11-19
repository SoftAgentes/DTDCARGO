import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: mocks.sendEmail }));

import { emitirLinkAutoservicio } from "../autoservicio-link";

const CLIENTE = {
  id: "cli-1",
  tenant_id: "tenant-1",
  markbox: "DTD-1234",
  name: "Comercial Andina",
};

const admin = { rpc: mocks.rpc } as never;

describe("enlace de autoservicio (SDD-0672 entrega 2)", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: [{ link_id: "l-1", expires_at: "x" }], error: null });
    mocks.sendEmail.mockReset();
    mocks.sendEmail.mockResolvedValue({ ok: true, logId: "log-1", resendId: "r-1", queued: false });
  });

  it("⭐ la base guarda sólo el hash del token; el correo lleva el token, a la ruta de autoservicio", async () => {
    await expect(emitirLinkAutoservicio(admin, CLIENTE, "Cliente@Example.com ")).resolves.toEqual({
      estado: "enviado",
    });

    const [nombre, args] = mocks.rpc.mock.calls[0];
    expect(nombre).toBe("portal_registration_link_create_self");
    expect(args.p_client_id).toBe("cli-1");
    expect(args.p_email).toBe("cliente@example.com");
    expect(args.p_token_hash).toMatch(/^[0-9a-f]{64}$/);

    const [, tenant, input] = mocks.sendEmail.mock.calls[0];
    expect(tenant).toBe("tenant-1");
    const enlace = String(input.html).match(/\/registro\/activar\/([A-Za-z0-9_-]{43})/);
    expect(enlace).not.toBeNull();
    // El token del correo no es el hash que guardó la base.
    expect(enlace?.[1]).not.toBe(args.p_token_hash);
    // Nunca la ruta del equipo, que no acepta estos enlaces.
    expect(String(input.html)).not.toContain("/registro/link/");
  });

  it("⭐ el correo no lleva nombre ni Shipping Mark: la dirección la cargó el equipo", async () => {
    await emitirLinkAutoservicio(admin, CLIENTE, "cliente@example.com");
    const [, , input] = mocks.sendEmail.mock.calls[0];
    const todo = `${input.subject} ${input.html}`;
    expect(todo).not.toContain("DTD-1234");
    expect(todo).not.toContain("Comercial Andina");
  });

  it.each([
    ["PGRST202", "sin-migracion"],
    ["42883", "sin-migracion"],
    ["P0002", "no-aplica"],
    ["22023", "no-aplica"],
    ["55000", "no-aplica"],
    ["XX000", "error"],
  ])("la base responde %s → %s, y no sale ningún correo", async (code, estado) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "x" } });
    await expect(emitirLinkAutoservicio(admin, CLIENTE, "cliente@example.com")).resolves.toEqual({
      estado,
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, error: "blacklist" }],
    [{ ok: true, logId: "log-1", resendId: null, queued: true }],
  ])("un envío que no salió (%j) no se cuenta como enviado", async (resultado) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendEmail.mockResolvedValue(resultado);
    await expect(emitirLinkAutoservicio(admin, CLIENTE, "cliente@example.com")).resolves.toEqual({
      estado: "no-salio",
    });
  });

  it("nunca tira: un fallo inesperado es `error`", async () => {
    mocks.rpc.mockRejectedValue(new Error("red"));
    await expect(emitirLinkAutoservicio(admin, CLIENTE, "cliente@example.com")).resolves.toEqual({
      estado: "error",
    });
  });
});
