/**
 * Tests de `updateMemberProfileAction` (SDD-0250 · ficha de usuario).
 *
 * Esta action deja que un admin edite el perfil de OTRA persona. Es la primera
 * del módulo que escribe sobre datos ajenos, así que se prueba por el lado
 * negativo antes que por el feliz:
 *   1. rol sin permiso sobre `users` → denegación y NO se escribe nada,
 *   2. sin sesión → ni se consulta el gate,
 *   3. alguien de OTRO tenant → rechazo. El admin client NO filtra por RLS, así
 *      que este chequeo explícito es lo único que lo impide,
 *   4. campos demasiado largos → fieldErrors y ningún UPDATE,
 *   5. happy path: escribe sobre el user_id correcto.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT = "tn-1";
const TARGET = "user-target";
const ACTOR = "user-actor";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const moduleEditDenialMock = vi.fn();
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: (...a: unknown[]) => moduleEditDenialMock(...a),
}));

vi.mock("@/lib/studio/audit/external-effect-adapter", () => ({
  beginD5ExternalEffect: vi.fn(),
  finishD5ExternalEffect: vi.fn(),
}));
vi.mock("@/lib/studio/audit/d1-access-config-adapters", () => ({
  executeD1Operation: vi.fn(),
  d1Reason: (v: unknown, fallback: string) => (v as string) ?? fallback,
}));
vi.mock("@/lib/studio/audit/auth-lifecycle-adapter", () => ({
  executeAuthLifecycle: vi.fn(),
}));
vi.mock("@/lib/studio/telegram/link-code", () => ({
  generateTelegramLinkCode: () => "code",
}));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: vi.fn() }));

let sessionUser: { id: string; email: string } | null = null;
let membershipRow: { user_id: string } | null = null;

/** Captura del UPDATE: qué se escribió y sobre quién. */
const updateMock = vi.fn();
const eqMock = vi.fn();

function userClient() {
  return {
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: { tenant_id: TENANT } }) }),
    }),
  };
}

function adminClient() {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: membershipRow }) }),
        }),
      }),
      update: (row: unknown) => {
        updateMock(table, row);
        return {
          eq: (col: string, val: string) => {
            eqMock(col, val);
            return Promise.resolve({ error: null });
          },
        };
      },
    }),
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => userClient() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => adminClient() }));

const { updateMemberProfileAction } = await import("../actions");

function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const VALIDO = {
  target_user_id: TARGET,
  first_name: "Yolimar",
  last_name: "Moreno",
  position_label: "Analista contable",
  phone: "+58 412 1234567",
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionUser = { id: ACTOR, email: "sam@dtdcargo.com" };
  membershipRow = { user_id: TARGET };
  moduleEditDenialMock.mockResolvedValue(null);
});

describe("updateMemberProfileAction · lado negativo", () => {
  it("un rol sin permiso sobre `users` no escribe nada", async () => {
    moduleEditDenialMock.mockResolvedValue(
      "No tienes permiso para realizar esta acción.",
    );

    const res = await updateMemberProfileAction({}, form(VALIDO));

    expect(res.error).toMatch(/no tienes permiso/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sin sesión no llega ni al gate", async () => {
    sessionUser = null;

    const res = await updateMemberProfileAction({}, form(VALIDO));

    expect(res.errorCode).toBe("user_signin_required");
    expect(moduleEditDenialMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("alguien de OTRO tenant es rechazado y no se le toca el perfil", async () => {
    membershipRow = null;

    const res = await updateMemberProfileAction({}, form(VALIDO));

    expect(res.error).toMatch(/no es miembro/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("un cargo demasiado largo no llega a la base", async () => {
    const res = await updateMemberProfileAction(
      {},
      form({ ...VALIDO, position_label: "x".repeat(81) }),
    );

    expect(res.fieldErrors?.position_label).toBeTruthy();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sin target no hace nada", async () => {
    const res = await updateMemberProfileAction({}, form({ first_name: "X" }));

    expect(res.errorCode).toBe("invalid_input");
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("updateMemberProfileAction · happy path", () => {
  it("guarda el cargo sobre el user_id correcto", async () => {
    const res = await updateMemberProfileAction({}, form(VALIDO));

    expect(res.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      "user_profiles",
      expect.objectContaining({
        first_name: "Yolimar",
        last_name: "Moreno",
        position_label: "Analista contable",
        phone: "+58 412 1234567",
      }),
    );
    // Que escriba sobre la persona correcta y no sobre quien está logueado.
    expect(eqMock).toHaveBeenCalledWith("user_id", TARGET);
  });

  it("un campo vacío se guarda como null, no como cadena vacía", async () => {
    await updateMemberProfileAction({}, form({ ...VALIDO, phone: "" }));

    expect(updateMock).toHaveBeenCalledWith(
      "user_profiles",
      expect.objectContaining({ phone: null }),
    );
  });
});
