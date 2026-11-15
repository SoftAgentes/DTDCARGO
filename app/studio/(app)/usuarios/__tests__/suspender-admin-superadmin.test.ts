/**
 * SDD-0633 · Suspender o reactivar a OTRO administrador avisa antes, y en claro,
 * cuando no eres superadministrador.
 *
 * QUÉ DEFIENDE. La base (0355) lo niega recién en la confirmación, después de
 * banear en Auth, y la compensación lo deshace: el aviso era «Auth cambió, pero
 * la confirmación falló…». Ahora:
 *   1. si el destino es admin, no eres tú y la base dice que no eres superadmin,
 *      sale «No eres superadministrador…» y Auth no se toca;
 *   2. si no se pudo comprobar, se dice eso y Auth tampoco se toca;
 *   3. el superadmin, un destino que no es admin o uno mismo siguen el flujo de
 *      siempre (la base sigue siendo el freno).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SUPERADMIN_CHECK_FAILED } from "@/lib/studio/platform-admin";

const ACTOR = "actor";
const OTRO_ADMIN = "otro-admin";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const moduleEditDenialMock = vi.fn();
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: (...a: unknown[]) => moduleEditDenialMock(...a) }));
const authLifecycleMock = vi.fn();
vi.mock("@/lib/studio/audit/auth-lifecycle-adapter", () => ({ executeAuthLifecycle: (...a: unknown[]) => authLifecycleMock(...a) }));
vi.mock("@/lib/studio/audit/external-effect-adapter", () => ({ beginD5ExternalEffect: vi.fn(), finishD5ExternalEffect: vi.fn() }));
vi.mock("@/lib/studio/telegram/link-code", () => ({ generateTelegramLinkCode: () => "code" }));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/studio/chatwoot/agentes-usuario", () => ({ sincronizarAgenteDeUsuario: vi.fn().mockResolvedValue(undefined) }));
const rpc = vi.fn();
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc,
    auth: { getUser: async () => ({ data: { user: { id: ACTOR } } }) },
  }),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ auth: { admin: {} } }) }));

const { disableUserAction, enableUserAction } = await import("../actions");

const form = (campos: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  moduleEditDenialMock.mockResolvedValue(null);
  authLifecycleMock.mockResolvedValue({ ok: true, code: "confirmed", operationId: "op" });
});

describe.each([
  ["suspender", disableUserAction],
  ["reactivar", enableUserAction],
] as const)("%s a otro administrador", (_nombre, accion) => {
  it("sin ser superadmin: aviso claro y Auth no se toca", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const r = await accion({}, form({ target_user_id: OTRO_ADMIN, target_role: "admin" }));
    expect(r.error).toMatch(/^No eres superadministrador\. Suspender o reactivar a otro administrador/);
    expect(rpc).toHaveBeenCalledWith("is_platform_admin");
    expect(authLifecycleMock).not.toHaveBeenCalled();
  });

  it("si no se pudo comprobar: lo dice, y Auth no se toca", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    const r = await accion({}, form({ target_user_id: OTRO_ADMIN, target_role: "admin" }));
    expect(r.error).toBe(SUPERADMIN_CHECK_FAILED);
    expect(authLifecycleMock).not.toHaveBeenCalled();
  });

  it("el superadmin sigue el flujo de siempre", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await accion({}, form({ target_user_id: OTRO_ADMIN, target_role: "admin" }))).ok).toBe(true);
    expect(authLifecycleMock).toHaveBeenCalledTimes(1);
  });

  it("un destino que no es admin no pregunta por el superadmin", async () => {
    expect((await accion({}, form({ target_user_id: OTRO_ADMIN, target_role: "accounting" }))).ok).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    expect(authLifecycleMock).toHaveBeenCalledTimes(1);
  });

  it("sobre uno mismo no pregunta por el superadmin (lo frena el anti-lockout de la base)", async () => {
    await accion({}, form({ target_user_id: ACTOR, target_role: "admin" }));
    expect(rpc).not.toHaveBeenCalled();
    expect(authLifecycleMock).toHaveBeenCalledTimes(1);
  });
});
