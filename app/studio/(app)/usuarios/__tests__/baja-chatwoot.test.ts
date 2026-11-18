/**
 * SDD-0585 · paso 2.5 · Usuarios avisa a Chatwoot DESPUÉS de desactivar o de
 * cambiar el rol, y solo si eso salió bien. Lo que se defiende:
 *  - la baja en Chatwoot no corre si Usuarios falló o se negó;
 *  - un fallo de Chatwoot no cambia el resultado de Usuarios (la baja ya
 *    ocurrió; el cron diario reintenta).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const TARGET = "user-target";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const moduleEditDenialMock = vi.fn();
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: (...a: unknown[]) => moduleEditDenialMock(...a) }));
const executeD1Mock = vi.fn();
vi.mock("@/lib/studio/audit/d1-access-config-adapters", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  executeD1Operation: (...a: unknown[]) => executeD1Mock(...a),
}));
const authLifecycleMock = vi.fn();
vi.mock("@/lib/studio/audit/auth-lifecycle-adapter", () => ({ executeAuthLifecycle: (...a: unknown[]) => authLifecycleMock(...a) }));
vi.mock("@/lib/studio/audit/external-effect-adapter", () => ({ beginD5ExternalEffect: vi.fn(), finishD5ExternalEffect: vi.fn() }));
vi.mock("@/lib/studio/telegram/link-code", () => ({ generateTelegramLinkCode: () => "code" }));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: vi.fn() }));
const sincronizarMock = vi.fn();
vi.mock("@/lib/studio/chatwoot/agentes-usuario", () => ({ sincronizarAgenteDeUsuario: (...a: unknown[]) => sincronizarMock(...a) }));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "actor", email: "sam@dtdcargo.com" } } }) } }),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ auth: { admin: {} } }) }));

const { changeUserRoleAction, disableUserAction } = await import("../actions");

const form = (campos: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  moduleEditDenialMock.mockResolvedValue(null);
  executeD1Mock.mockResolvedValue({ entity_id: TARGET });
  authLifecycleMock.mockResolvedValue({ ok: true, code: "confirmed", operationId: "op" });
  sincronizarMock.mockResolvedValue(undefined);
});

describe("Usuarios → baja en Chatwoot (SDD-0585, 2.5)", () => {
  it("desactivar con éxito: revisa a ESE usuario en Chatwoot", async () => {
    expect((await disableUserAction({}, form({ target_user_id: TARGET }))).ok).toBe(true);
    expect(sincronizarMock).toHaveBeenCalledWith(TARGET);
  });

  it("desactivar que falla o se niega: no toca Chatwoot", async () => {
    authLifecycleMock.mockResolvedValueOnce({ ok: false, code: "auth_retryable" });
    await disableUserAction({}, form({ target_user_id: TARGET }));
    moduleEditDenialMock.mockResolvedValueOnce("No tienes permiso.");
    await disableUserAction({}, form({ target_user_id: TARGET }));
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it("cambiar el rol con éxito: revisa a ese usuario; si falla, no", async () => {
    await changeUserRoleAction({}, form({ target_user_id: TARGET, new_role: "accounting" }));
    expect(sincronizarMock).toHaveBeenCalledWith(TARGET);
    sincronizarMock.mockClear();
    executeD1Mock.mockRejectedValueOnce(new Error("lockout"));
    await changeUserRoleAction({}, form({ target_user_id: TARGET, new_role: "accounting" }));
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it("si Chatwoot lanza, Usuarios responde igual ok", async () => {
    sincronizarMock.mockRejectedValueOnce(new Error("red"));
    expect((await disableUserAction({}, form({ target_user_id: TARGET }))).ok).toBe(true);
  });
});
