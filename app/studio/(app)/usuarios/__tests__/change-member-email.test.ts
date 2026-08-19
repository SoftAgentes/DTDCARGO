/**
 * Tests de `changeMemberEmailAction` (SDD-0272 · migr 0387).
 *
 * Esta action reescribe la IDENTIDAD DE LOGIN de otra persona y, al hacerlo,
 * anula lo que el buzón anterior todavía podía canjear. Los dos lados pueden
 * fallar en silencio, así que se prueban por separado:
 *
 *   1. gate, sesión y tenant → nada se toca (mismo criterio que 0250),
 *   2. correo inválido → ni se llama a Auth,
 *   3. correo IGUAL al actual → NO se revoca nada. Es la prueba de fondo del
 *      lado destructivo: si alguien "simplifica" el early-return, guardar el
 *      formulario sin editarlo le cortaría los enlaces vigentes a la persona,
 *   4. Auth rechaza el cambio → NO se revocó nada (el orden importa: revocar
 *      primero dejaría a la persona sin acceso y con el correo viejo),
 *   5. happy path → `email_confirm: true`, tokens revocados por `user_id` e
 *      invitaciones revocadas por el correo ANTERIOR (no el nuevo).
 *
 * El punto 5 mira el ARGUMENTO de cada revocación, no que "se llamó algo": una
 * revocación dirigida al correo nuevo dejaría viva la invitación del viejo, que
 * es justo el agujero que esta spec existe para cerrar.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT = "tn-1";
const TARGET = "user-target";
const ACTOR = "user-actor";
const EMAIL_VIEJO = "pasantedtd@gmail.com";
const EMAIL_NUEVO = "pasantecontabilidaddtd@gmail.com";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const moduleEditDenialMock = vi.fn();
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: (...a: unknown[]) => moduleEditDenialMock(...a),
}));

const beginD5Mock = vi.fn();
const finishD5Mock = vi.fn();
vi.mock("@/lib/studio/audit/external-effect-adapter", () => ({
  beginD5ExternalEffect: (...a: unknown[]) => beginD5Mock(...a),
  finishD5ExternalEffect: (...a: unknown[]) => finishD5Mock(...a),
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
let emailActual: string | null = EMAIL_VIEJO;
let authUpdateError: { message: string } | null = null;

const updateUserByIdMock = vi.fn();

/** Una escritura capturada: tabla, payload y los filtros que la acotaron. */
interface EscrituraCapturada {
  tabla: string;
  payload: Record<string, unknown>;
  filtros: Array<[string, string, unknown]>;
}
let escrituras: EscrituraCapturada[] = [];

function userClient() {
  return {
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: { tenant_id: TENANT } }) }),
    }),
  };
}

/**
 * Cadena `.eq().is()...` que además es awaitable en cualquier punto — la forma
 * real de PostgREST. Cada eslabón anota su filtro en la escritura capturada.
 */
function cadena(escritura: EscrituraCapturada) {
  const self: Record<string, unknown> = {
    eq: (col: string, val: unknown) => {
      escritura.filtros.push(["eq", col, val]);
      return self;
    },
    is: (col: string, val: unknown) => {
      escritura.filtros.push(["is", col, val]);
      return self;
    },
    then: (resolve: (v: { error: null }) => unknown) => resolve({ error: null }),
  };
  return self;
}

function adminClient() {
  return {
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: emailActual ? { email: emailActual } : null },
        }),
        updateUserById: async (id: string, attrs: Record<string, unknown>) => {
          updateUserByIdMock(id, attrs);
          return { error: authUpdateError };
        },
      },
    },
    from: (tabla: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: membershipRow }) }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        const escritura: EscrituraCapturada = { tabla, payload, filtros: [] };
        escrituras.push(escritura);
        return cadena(escritura);
      },
    }),
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => userClient() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => adminClient() }));

const { changeMemberEmailAction } = await import("../actions");

function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const VALIDO = { target_user_id: TARGET, new_email: EMAIL_NUEVO };

const escrituraDe = (tabla: string) => escrituras.find((e) => e.tabla === tabla);

beforeEach(() => {
  vi.clearAllMocks();
  escrituras = [];
  sessionUser = { id: ACTOR, email: "sam@dtdcargo.com" };
  membershipRow = { user_id: TARGET };
  emailActual = EMAIL_VIEJO;
  authUpdateError = null;
  moduleEditDenialMock.mockResolvedValue(null);
  beginD5Mock.mockResolvedValue("op-1");
  finishD5Mock.mockResolvedValue(undefined);
});

describe("changeMemberEmailAction · lado negativo", () => {
  it("un rol sin permiso sobre `users` no toca Auth ni revoca nada", async () => {
    moduleEditDenialMock.mockResolvedValue(
      "No tienes permiso para realizar esta acción.",
    );

    const res = await changeMemberEmailAction({}, form(VALIDO));

    expect(res.error).toMatch(/no tienes permiso/i);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
    expect(escrituras).toHaveLength(0);
  });

  it("sin sesión no llega ni al gate", async () => {
    sessionUser = null;

    const res = await changeMemberEmailAction({}, form(VALIDO));

    expect(res.errorCode).toBe("user_signin_required");
    expect(moduleEditDenialMock).not.toHaveBeenCalled();
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("alguien de OTRO tenant es rechazado", async () => {
    membershipRow = null;

    const res = await changeMemberEmailAction({}, form(VALIDO));

    expect(res.error).toMatch(/no es miembro/i);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
    expect(escrituras).toHaveLength(0);
  });

  it("un correo inválido no llega a Auth", async () => {
    const res = await changeMemberEmailAction(
      {},
      form({ ...VALIDO, new_email: "esto-no-es-un-correo" }),
    );

    expect(res.fieldErrors?.new_email).toBeTruthy();
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("sin target no hace nada", async () => {
    const res = await changeMemberEmailAction({}, form({ new_email: EMAIL_NUEVO }));

    expect(res.errorCode).toBe("invalid_input");
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });
});

describe("changeMemberEmailAction · no revoca de gratis", () => {
  it("guardar el MISMO correo no revoca enlaces ni invitaciones", async () => {
    const res = await changeMemberEmailAction(
      {},
      form({ ...VALIDO, new_email: EMAIL_VIEJO }),
    );

    expect(res.ok).toBe(true);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
    expect(escrituras).toHaveLength(0);
    // Ni siquiera abre una operación de auditoría: no pasó nada que auditar.
    expect(beginD5Mock).not.toHaveBeenCalled();
  });

  it("el mismo correo con otra caja/espacios tampoco cuenta como cambio", async () => {
    const res = await changeMemberEmailAction(
      {},
      form({ ...VALIDO, new_email: `  ${EMAIL_VIEJO.toUpperCase()}  ` }),
    );

    expect(res.ok).toBe(true);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
    expect(escrituras).toHaveLength(0);
  });

  it("si Auth rechaza el cambio, NO se revocó nada", async () => {
    authUpdateError = { message: "A user with this email already exists" };

    const res = await changeMemberEmailAction({}, form(VALIDO));

    expect(res.error).toMatch(/ya pertenece a otra cuenta/i);
    expect(escrituras).toHaveLength(0);
    expect(finishD5Mock).toHaveBeenCalledWith(
      expect.anything(),
      "op-1",
      expect.objectContaining({ ok: false }),
    );
  });
});

describe("changeMemberEmailAction · happy path", () => {
  it("cambia el correo con email_confirm y sobre el user_id correcto", async () => {
    const res = await changeMemberEmailAction({}, form(VALIDO));

    expect(res.ok).toBe(true);
    expect(updateUserByIdMock).toHaveBeenCalledWith(
      TARGET,
      expect.objectContaining({ email: EMAIL_NUEVO, email_confirm: true }),
    );
  });

  it("revoca los enlaces de acceso vigentes de esa persona", async () => {
    await changeMemberEmailAction({}, form(VALIDO));

    const esc = escrituraDe("studio_access_tokens");
    expect(esc).toBeDefined();
    expect(esc!.payload.revoked_at).toBeTruthy();
    expect(esc!.filtros).toContainEqual(["eq", "user_id", TARGET]);
    // Sólo los que todavía servían: no se pisa un `used_at` ya sellado.
    expect(esc!.filtros).toContainEqual(["is", "used_at", null]);
    expect(esc!.filtros).toContainEqual(["is", "revoked_at", null]);
  });

  it("revoca las invitaciones del correo ANTERIOR, no las del nuevo", async () => {
    await changeMemberEmailAction({}, form(VALIDO));

    const esc = escrituraDe("user_invitations");
    expect(esc).toBeDefined();
    expect(esc!.payload.revoked_at).toBeTruthy();
    expect(esc!.payload.revoked_by).toBe(ACTOR);
    expect(esc!.filtros).toContainEqual(["eq", "email", EMAIL_VIEJO]);
    expect(esc!.filtros).not.toContainEqual(["eq", "email", EMAIL_NUEVO]);
    expect(esc!.filtros).toContainEqual(["eq", "tenant_id", TENANT]);
    expect(esc!.filtros).toContainEqual(["is", "accepted_at", null]);
  });

  it("deja el rastro D5 cerrado en éxito", async () => {
    await changeMemberEmailAction({}, form(VALIDO));

    expect(beginD5Mock).toHaveBeenCalledWith(
      expect.anything(),
      "studio.email_change",
      TARGET,
    );
    expect(finishD5Mock).toHaveBeenCalledWith(expect.anything(), "op-1", {
      ok: true,
    });
  });

  it("normaliza el correo nuevo a minúsculas", async () => {
    await changeMemberEmailAction(
      {},
      form({ ...VALIDO, new_email: "  PasanteContabilidadDTD@Gmail.com " }),
    );

    expect(updateUserByIdMock).toHaveBeenCalledWith(
      TARGET,
      expect.objectContaining({ email: EMAIL_NUEVO }),
    );
  });
});
