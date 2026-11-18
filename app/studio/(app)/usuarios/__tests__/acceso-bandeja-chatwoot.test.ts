/**
 * SDD-0675 · Conceder o revocar el acceso adicional de Bandeja avisa a Chatwoot
 * DESPUÉS de guardarlo, igual que el cambio de rol (SDD-0585, 2.5):
 *  - solo con `bandeja`; otro módulo no toca Chatwoot;
 *  - solo si la RPC guardó; si la base lo rechaza, no;
 *  - un fallo de Chatwoot no cambia lo guardado, pero el admin recibe el aviso
 *    «Chatwoot quedó pendiente hasta el próximo ciclo».
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const TARGET = "a0000000-0000-4000-8000-0000000000c1";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  tenantAdminGate: async () => ({ ok: true, tenantId: "t1", userId: "actor" }),
  getStudioAccess: vi.fn(),
  moduleEditDenial: vi.fn(),
  moduleViewDenial: vi.fn(),
}));
vi.mock("@/lib/studio/audit/external-effect-adapter", () => ({ beginD5ExternalEffect: vi.fn(), finishD5ExternalEffect: vi.fn() }));
vi.mock("@/lib/studio/telegram/link-code", () => ({ generateTelegramLinkCode: () => "code" }));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: vi.fn() }));
const sincronizarMock = vi.fn();
vi.mock("@/lib/studio/chatwoot/agentes-usuario", () => ({ sincronizarAgenteDeUsuario: (...a: unknown[]) => sincronizarMock(...a) }));

const rpcMock = vi.fn();
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ rpc: (...a: unknown[]) => rpcMock(...a) }) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ auth: { admin: {} } }) }));

const { grantUserModuleAction, revokeUserModuleGrantAction } = await import("../actions");

const conceder = (moduleId: string) =>
  grantUserModuleAction({
    targetUserId: TARGET,
    moduleId,
    canEdit: false,
    reason: "Atiende chats de leads y clientes",
    expiresOn: null,
    confirmSensitive: false,
  } as Parameters<typeof grantUserModuleAction>[0]);
const revocar = (moduleId: string) =>
  revokeUserModuleGrantAction({ targetUserId: TARGET, moduleId, reason: "Ya no atiende chats" });

beforeEach(() => {
  vi.clearAllMocks();
  rpcMock.mockResolvedValue({ data: true, error: null });
  sincronizarMock.mockResolvedValue(true);
});

describe("Usuarios → Chatwoot al conceder o revocar la Bandeja (SDD-0675)", () => {
  it("conceder bandeja: guarda por la RPC y revisa a ESA persona en Chatwoot", async () => {
    expect(await conceder("bandeja")).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith("studio_grant_user_module", expect.objectContaining({ p_module_id: "bandeja" }));
    expect(sincronizarMock).toHaveBeenCalledTimes(1);
    expect(sincronizarMock).toHaveBeenCalledWith(TARGET);
  });

  it("revocar bandeja: revisa a esa persona (el ciclo la saca de Chatwoot)", async () => {
    expect(await revocar("bandeja")).toEqual({ ok: true });
    expect(sincronizarMock).toHaveBeenCalledWith(TARGET);
  });

  it("otro módulo no toca Chatwoot", async () => {
    await conceder("kommo");
    await revocar("kommo");
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it("si la base rechaza (por ejemplo, sin la 0565), no toca Chatwoot", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "22023", message: "Ese módulo todavía no se puede conceder" } });
    expect((await conceder("bandeja")).error).toBeTruthy();
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  const AVISO = "Guardado; Chatwoot quedó pendiente hasta el próximo ciclo.";

  it("si Chatwoot lanza al conceder, guarda igual y avisa al admin", async () => {
    sincronizarMock.mockRejectedValueOnce(new Error("red"));
    expect(await conceder("bandeja")).toEqual({ ok: true, aviso: AVISO });
  });

  it("si Chatwoot queda pendiente al revocar, guarda igual y avisa al admin", async () => {
    sincronizarMock.mockResolvedValueOnce(false);
    expect(await revocar("bandeja")).toEqual({ ok: true, aviso: AVISO });
    expect(rpcMock).toHaveBeenCalledWith("studio_revoke_user_module_grant", expect.objectContaining({ p_module_id: "bandeja" }));
  });

  it("si Chatwoot lanza al revocar, también avisa", async () => {
    sincronizarMock.mockRejectedValueOnce(new Error("red"));
    expect(await revocar("bandeja")).toEqual({ ok: true, aviso: AVISO });
  });

  it("con Chatwoot al día no hay aviso", async () => {
    expect(await revocar("bandeja")).toEqual({ ok: true });
    expect(await conceder("bandeja")).toEqual({ ok: true });
  });
});
