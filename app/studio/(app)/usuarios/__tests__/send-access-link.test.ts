/**
 * Tests de `sendAccessLinkAction` (SDD-0250).
 *
 * UN CAMBIO DE PERMISOS SE PRUEBA POR EL LADO NEGATIVO. Un test que sólo
 * verifica el happy path deja pasar exactamente el bug que importa: que un rol
 * que NO debe reponer accesos, pueda.
 *
 * Lo que defiende:
 *   1. rol sin permiso sobre `users` → denegación, y NO se genera ningún enlace
 *      (no se guarda ningun token),
 *   2. sin sesión → ni siquiera se consulta el gate,
 *   3. un miembro de OTRO tenant → rechazo (el admin client no filtra por RLS,
 *      así que el chequeo tiene que ser explícito),
 *   4. un miembro desactivado → rechazo con motivo (el enlace no lo dejaría
 *      entrar: la RLS lo corta por `disabled_at`),
 *   5. happy path: el token se guarda en nuestra tabla y el enlace lo lleva EN
 *      LA RUTA (nunca en la query) · y dos envios NO se anulan entre si.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT = "tn-1";
const TARGET = "user-target";
const ACTOR = "user-actor";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ── Gate de rol ───────────────────────────────────────────────
const moduleEditDenialMock = vi.fn();
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: (...a: unknown[]) => moduleEditDenialMock(...a),
}));

// ── Carril D5 de efectos externos ─────────────────────────────
const beginD5Mock = vi.fn();
const finishD5Mock = vi.fn();
vi.mock("@/lib/studio/audit/external-effect-adapter", () => ({
  beginD5ExternalEffect: (...a: unknown[]) => beginD5Mock(...a),
  finishD5ExternalEffect: (...a: unknown[]) => finishD5Mock(...a),
}));

// ── D1 (lo usan las otras actions del archivo; acá sólo tiene que existir) ──
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

// ── Correo ────────────────────────────────────────────────────
const sendEmailMock = vi.fn();
vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: (...a: unknown[]) => sendEmailMock(...a),
}));

// ── Clientes Supabase ─────────────────────────────────────────
let sessionUser: { id: string; email: string } | null = null;
let membershipRow: { disabled_at: string | null } | null = null;

/** Insert de `studio_access_tokens` (migr 0354). Guarda la fila para poder
 *  afirmar QUÉ se guardó, que es donde vive el contrato del arreglo. */
const insertTokenMock = vi.fn();

/** Client del usuario logueado: resuelve tenant y perfiles. */
function userClient() {
  return {
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "tenants"
              ? { data: { display_name: "DTD Cargo" } }
              : { data: { first_name: "Sam", last_name: null } },
        }),
        maybeSingle: async () => ({ data: { tenant_id: TENANT } }),
      }),
    }),
  };
}

/** Admin client: membership del target + insert del token + Auth admin. */
function adminClient() {
  return {
    from: (table: string) => ({
      insert: (row: unknown) => insertTokenMock(table, row),
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: membershipRow }) }),
          maybeSingle: async () => ({ data: { first_name: "Jose", last_name: "Mendez" } }),
        }),
      }),
    }),
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { id: TARGET, email: "sistemaqb@gmail.com" } },
        }),
      },
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => userClient() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => adminClient() }));

const { sendAccessLinkAction } = await import("../actions");

function form(targetUserId: string | null) {
  const fd = new FormData();
  if (targetUserId) fd.set("target_user_id", targetUserId);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionUser = { id: ACTOR, email: "sam@dtdcargo.com" };
  membershipRow = { disabled_at: null };
  moduleEditDenialMock.mockResolvedValue(null);
  beginD5Mock.mockResolvedValue("op-1");
  finishD5Mock.mockResolvedValue(undefined);
  sendEmailMock.mockResolvedValue({ ok: true });
  insertTokenMock.mockResolvedValue({ error: null });
});

describe("sendAccessLinkAction · lado negativo", () => {
  it("un rol sin permiso sobre `users` no genera ningún enlace", async () => {
    moduleEditDenialMock.mockResolvedValue(
      "No tienes permiso para realizar esta acción.",
    );

    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.error).toBe("No tienes permiso para realizar esta acción.");
    expect(res.accessLink).toBeUndefined();
    // Lo que de verdad importa: el efecto ni se intentó.
    expect(insertTokenMock).not.toHaveBeenCalled();
    expect(beginD5Mock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sin sesión no llega ni al gate", async () => {
    sessionUser = null;

    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.errorCode).toBe("user_signin_required");
    expect(moduleEditDenialMock).not.toHaveBeenCalled();
    expect(insertTokenMock).not.toHaveBeenCalled();
  });

  it("sin target no hace nada", async () => {
    const res = await sendAccessLinkAction({}, form(null));

    expect(res.errorCode).toBe("invalid_input");
    expect(insertTokenMock).not.toHaveBeenCalled();
  });

  it("alguien que no es miembro de este tenant es rechazado", async () => {
    membershipRow = null;

    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.error).toMatch(/no es miembro/i);
    expect(insertTokenMock).not.toHaveBeenCalled();
  });

  it("un miembro desactivado es rechazado con motivo", async () => {
    membershipRow = { disabled_at: "2026-07-20T16:12:19Z" };

    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.error).toMatch(/desactivado/i);
    expect(insertTokenMock).not.toHaveBeenCalled();
  });
});

describe("sendAccessLinkAction · happy path", () => {
  it("guarda un token propio y devuelve el enlace con el token EN LA RUTA", async () => {
    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.ok).toBe(true);

    // ⚠️ EL CONTRATO DEL ARREGLO. El enlace NO puede llevar el token en la
    // query: `?token=…` se pierde al copiar/pegar y, sobre todo, la versión
    // vieja lo canjeaba en el GET y el escáner de correo de Gmail lo consumía
    // antes de que la persona hiciera clic. Si alguien vuelve a meterlo en la
    // query, este test se pone rojo.
    expect(res.accessLink).toMatch(/\/acceso\/[a-f0-9]{48}$/);
    expect(res.accessLink).not.toContain("?");
    expect(res.accessLink).not.toContain("token_hash");

    // Y el token quedó guardado en NUESTRA tabla, con su dueño y su vencimiento.
    expect(insertTokenMock).toHaveBeenCalledWith(
      "studio_access_tokens",
      expect.objectContaining({
        tenant_id: TENANT,
        user_id: TARGET,
        created_by: ACTOR,
        token: expect.stringMatching(/^[a-f0-9]{48}$/),
        expires_at: expect.any(String),
      }),
    );

    expect(beginD5Mock).toHaveBeenCalledWith(
      expect.anything(),
      "studio.access_link",
      TARGET,
    );
    expect(finishD5Mock).toHaveBeenCalledWith(expect.anything(), "op-1", {
      ok: true,
    });
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.anything(),
      TENANT,
      expect.objectContaining({ templateSlug: "studio_access_link" }),
    );
  });

  it("dos envíos generan tokens DISTINTOS y ninguno anula al otro", async () => {
    await sendAccessLinkAction({}, form(TARGET));
    await sendAccessLinkAction({}, form(TARGET));

    const primero = insertTokenMock.mock.calls[0][1] as { token: string };
    const segundo = insertTokenMock.mock.calls[1][1] as { token: string };
    expect(primero.token).not.toBe(segundo.token);

    // Con el token de Supabase, generar uno nuevo mataba el anterior en
    // silencio: el founder mandó dos enlaces y el primero quedó muerto sin
    // aviso. Acá no se revoca nada — no debe haber ningún update de por medio.
    const updates = insertTokenMock.mock.calls.filter(
      ([, row]) => (row as Record<string, unknown>).revoked_at != null,
    );
    expect(updates).toHaveLength(0);
  });

  it("si el token no se puede guardar, el efecto D5 se cierra como fallido", async () => {
    insertTokenMock.mockResolvedValue({ error: { message: "boom" } });

    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.error).toMatch(/enlace de acceso/i);
    expect(res.accessLink).toBeUndefined();
    expect(finishD5Mock).toHaveBeenCalledWith(expect.anything(), "op-1", {
      ok: false,
      errorCode: "token_insert_failed",
    });
  });
});
