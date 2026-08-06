/**
 * Tests de `sendAccessLinkAction` (SDD-0250).
 *
 * UN CAMBIO DE PERMISOS SE PRUEBA POR EL LADO NEGATIVO. Un test que sólo
 * verifica el happy path deja pasar exactamente el bug que importa: que un rol
 * que NO debe reponer accesos, pueda.
 *
 * Lo que defiende:
 *   1. rol sin permiso sobre `users` → denegación, y NO se genera ningún enlace
 *      (la llamada al admin client de Auth ni ocurre),
 *   2. sin sesión → ni siquiera se consulta el gate,
 *   3. un miembro de OTRO tenant → rechazo (el admin client no filtra por RLS,
 *      así que el chequeo tiene que ser explícito),
 *   4. un miembro desactivado → rechazo con motivo (el enlace no lo dejaría
 *      entrar: la RLS lo corta por `disabled_at`),
 *   5. happy path: el enlace apunta a NUESTRA ruta de canje con el token_hash,
 *      y el efecto D5 se abre y se cierra como OK.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT = "tn-1";
const TARGET = "user-target";
const ACTOR = "user-actor";
const TOKEN_HASH = "hashed-token-abc";

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

const generateLinkMock = vi.fn();

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

/** Admin client: membership del target + Auth admin. */
function adminClient() {
  return {
    from: () => ({
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
        generateLink: (...a: unknown[]) => generateLinkMock(...a),
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
  generateLinkMock.mockResolvedValue({
    data: { properties: { hashed_token: TOKEN_HASH } },
    error: null,
  });
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
    expect(generateLinkMock).not.toHaveBeenCalled();
    expect(beginD5Mock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sin sesión no llega ni al gate", async () => {
    sessionUser = null;

    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.errorCode).toBe("user_signin_required");
    expect(moduleEditDenialMock).not.toHaveBeenCalled();
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  it("sin target no hace nada", async () => {
    const res = await sendAccessLinkAction({}, form(null));

    expect(res.errorCode).toBe("invalid_input");
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  it("alguien que no es miembro de este tenant es rechazado", async () => {
    membershipRow = null;

    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.error).toMatch(/no es miembro/i);
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  it("un miembro desactivado es rechazado con motivo", async () => {
    membershipRow = { disabled_at: "2026-07-20T16:12:19Z" };

    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.error).toMatch(/desactivado/i);
    expect(generateLinkMock).not.toHaveBeenCalled();
  });
});

describe("sendAccessLinkAction · happy path", () => {
  it("devuelve el enlace contra nuestra ruta de canje y cierra el efecto D5", async () => {
    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.ok).toBe(true);
    expect(res.accessLink).toContain("/studio/reset/confirmar");
    expect(res.accessLink).toContain(`token_hash=${TOKEN_HASH}`);
    expect(res.accessLink).toContain("type=recovery");

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

  it("si Supabase no devuelve token, el efecto D5 se cierra como fallido", async () => {
    generateLinkMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    const res = await sendAccessLinkAction({}, form(TARGET));

    expect(res.error).toMatch(/enlace de acceso/i);
    expect(res.accessLink).toBeUndefined();
    expect(finishD5Mock).toHaveBeenCalledWith(expect.anything(), "op-1", {
      ok: false,
      errorCode: "generate_link_failed",
    });
  });
});
