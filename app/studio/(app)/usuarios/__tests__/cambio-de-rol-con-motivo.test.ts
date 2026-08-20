/**
 * El motivo llega al RPC (SDD-0273 · Slice 1).
 *
 * QUÉ DEFIENDE, y por qué se puede romper en silencio. `changeUserRoleAction`
 * y `changeWarehouseScopeAction` llamaban a `executeD1Operation` SIN `reason`.
 * El RPC no falla por eso: guarda el cambio igual, con el motivo en null. O
 * sea, la auditoría registraba el qué sin el porqué y nadie se enteraba —
 * ningún test miraba el argumento.
 *
 * Estos tests miran el ARGUMENTO que recibe el adaptador, no que la acción
 * devuelva `ok`. Un test que sólo afirme `ok` pasa igual con el `reason`
 * borrado, que es exactamente el bug que había.
 *
 * `disableUserAction` ya leía el motivo desde antes; se prueba igual porque
 * ahora la UI sí se lo manda y el fallback enlatado deja de ser lo normal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT = "tn-1";
const TARGET = "user-target";
const ACTOR = "user-actor";
const MOTIVO = "pasa a llevar la conciliación con China";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const moduleEditDenialMock = vi.fn();
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: (...a: unknown[]) => moduleEditDenialMock(...a),
}));

const executeD1Mock = vi.fn();
vi.mock("@/lib/studio/audit/d1-access-config-adapters", () => ({
  executeD1Operation: (...a: unknown[]) => executeD1Mock(...a),
  // Copia fiel del helper real: <8 caracteres cae al fallback.
  d1Reason: (value: unknown, fallback: string) =>
    typeof value === "string" && value.trim().length >= 8
      ? value.trim().slice(0, 500)
      : fallback,
}));

const authLifecycleMock = vi.fn();
vi.mock("@/lib/studio/audit/auth-lifecycle-adapter", () => ({
  executeAuthLifecycle: (...a: unknown[]) => authLifecycleMock(...a),
}));

vi.mock("@/lib/studio/audit/external-effect-adapter", () => ({
  beginD5ExternalEffect: vi.fn(),
  finishD5ExternalEffect: vi.fn(),
}));
vi.mock("@/lib/studio/telegram/link-code", () => ({ generateTelegramLinkCode: () => "code" }));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: vi.fn() }));

let sessionUser: { id: string; email: string } | null = null;

function userClient() {
  return {
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: { tenant_id: TENANT } }) }),
    }),
  };
}
vi.mock("@/lib/db/server", () => ({ createClient: async () => userClient() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({ auth: { admin: {} } }),
}));

const { changeUserRoleAction, changeWarehouseScopeAction, disableUserAction } =
  await import("../actions");

function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionUser = { id: ACTOR, email: "sam@dtdcargo.com" };
  moduleEditDenialMock.mockResolvedValue(null);
  executeD1Mock.mockResolvedValue({ entity_id: TARGET });
  authLifecycleMock.mockResolvedValue({ ok: true, code: "confirmed", operationId: "op" });
});

describe("changeUserRoleAction · el motivo llega al RPC", () => {
  it("pasa el motivo que escribió quien confirmó", async () => {
    const res = await changeUserRoleAction(
      {},
      form({ target_user_id: TARGET, new_role: "accounting", reason: MOTIVO }),
    );

    expect(res.ok).toBe(true);
    expect(executeD1Mock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operationType: "membership.role_change",
        targetId: TARGET,
        input: { role: "accounting" },
        reason: MOTIVO,
      }),
    );
  });

  it("sin motivo cae al texto por defecto, nunca a null", async () => {
    await changeUserRoleAction({}, form({ target_user_id: TARGET, new_role: "accounting" }));

    const arg = executeD1Mock.mock.calls[0][1] as { reason?: string };
    expect(arg.reason).toBeTruthy();
    expect(arg.reason).toMatch(/ficha de usuario/i);
  });

  it("un motivo demasiado corto no se guarda como motivo", async () => {
    await changeUserRoleAction(
      {},
      form({ target_user_id: TARGET, new_role: "accounting", reason: "ok" }),
    );

    const arg = executeD1Mock.mock.calls[0][1] as { reason?: string };
    expect(arg.reason).not.toBe("ok");
  });

  it("un rol sin permiso sobre `users` no llega al RPC", async () => {
    moduleEditDenialMock.mockResolvedValue("No tienes permiso para realizar esta acción.");

    const res = await changeUserRoleAction(
      {},
      form({ target_user_id: TARGET, new_role: "accounting", reason: MOTIVO }),
    );

    expect(res.error).toMatch(/no tienes permiso/i);
    expect(executeD1Mock).not.toHaveBeenCalled();
  });
});

describe("changeWarehouseScopeAction · el motivo llega al RPC", () => {
  it("pasa el motivo junto con el alcance", async () => {
    const res = await changeWarehouseScopeAction(
      {},
      form({ target_user_id: TARGET, new_scope: "cn", reason: MOTIVO }),
    );

    expect(res.ok).toBe(true);
    expect(executeD1Mock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operationType: "membership.scope_change",
        input: { scope: "cn" },
        reason: MOTIVO,
      }),
    );
  });

  it("un alcance inventado no llega al RPC", async () => {
    const res = await changeWarehouseScopeAction(
      {},
      form({ target_user_id: TARGET, new_scope: "marte", reason: MOTIVO }),
    );

    expect(res.errorCode).toBe("invalid_input");
    expect(executeD1Mock).not.toHaveBeenCalled();
  });
});

describe("disableUserAction · el motivo deja de ser el enlatado", () => {
  it("manda a la auditoría el motivo escrito por el admin", async () => {
    await disableUserAction({}, form({ target_user_id: TARGET, reason: MOTIVO }));

    expect(authLifecycleMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ targetUserId: TARGET, disabled: true, reason: MOTIVO }),
    );
  });
});
