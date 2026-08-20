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
 * `disableUserAction` ya leía el motivo desde antes. Se prueba igual, pero
 * ojo con lo que el test afirma: fija el CONTRATO de que la acción sabe
 * recibirlo, no que alguna pantalla se lo mande. Hoy **ninguna UI le manda
 * motivo al suspender** —ni la tabla ni la ficha tienen input ni confirmación
 * para eso—, así que sigue cayendo al fallback de `d1Reason`. Ese hueco lo
 * cierra el slice que le ponga confirmación a suspender.
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
vi.mock("@/lib/studio/audit/d1-access-config-adapters", async (importOriginal) => ({
  // Sólo se stubea la llamada al RPC. `d1Reason`, su umbral y la clase de
  // error se toman de VERDAD: un doble que repitiera el mínimo a mano sería
  // más generoso que el servidor el día que ese número suba, y el test daría
  // verde con la UI aceptando motivos que el servidor tira a la basura.
  ...(await importOriginal<Record<string, unknown>>()),
  executeD1Operation: (...a: unknown[]) => executeD1Mock(...a),
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
    expect(arg.reason).toMatch(/sin motivo declarado/i);
  });

  it("el texto por defecto NO afirma de dónde vino el cambio", async () => {
    // Los <select> de la fila siguen vivos hasta el Slice 2 y no mandan
    // motivo: un fallback que dijera "desde la ficha" les escribiría una
    // procedencia falsa a todos esos cambios.
    await changeUserRoleAction({}, form({ target_user_id: TARGET, new_role: "accounting" }));

    const arg = executeD1Mock.mock.calls[0][1] as { reason?: string };
    expect(arg.reason).not.toMatch(/ficha|tabla|fila/i);
  });

  it("el umbral del motivo se mide contra el helper real, no contra un 8 copiado", async () => {
    const { D1_REASON_MIN_LENGTH } = await import(
      "@/lib/studio/audit/d1-access-config-adapters"
    );
    const justo = "x".repeat(D1_REASON_MIN_LENGTH);
    const corto = "x".repeat(D1_REASON_MIN_LENGTH - 1);

    await changeUserRoleAction(
      {},
      form({ target_user_id: TARGET, new_role: "accounting", reason: justo }),
    );
    expect((executeD1Mock.mock.calls[0][1] as { reason?: string }).reason).toBe(justo);

    executeD1Mock.mockClear();
    await changeUserRoleAction(
      {},
      form({ target_user_id: TARGET, new_role: "accounting", reason: corto }),
    );
    expect((executeD1Mock.mock.calls[0][1] as { reason?: string }).reason).not.toBe(corto);
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

describe("disableUserAction · sabe recibir el motivo (aunque nadie se lo mande aún)", () => {
  it("si le llega un motivo, viaja a la auditoría tal cual", async () => {
    await disableUserAction({}, form({ target_user_id: TARGET, reason: MOTIVO }));

    expect(authLifecycleMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ targetUserId: TARGET, disabled: true, reason: MOTIVO }),
    );
  });
});
