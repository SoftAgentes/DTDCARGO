/**
 * SDD-0636 · Política de roles: invitar a un administrador lo hace solo el
 * superadministrador, y la pantalla dice por qué no se pudo.
 *
 * QUÉ DEFIENDE:
 *   1. con rol admin, si la base contesta que no eres superadmin, sale el aviso
 *      y no se llama a audit_d1_execute;
 *   2. si no se pudo preguntar (403 o red), no corta: decide la base, y si la
 *      base niega con el mensaje de la 0545 sale el mismo aviso;
 *   3. otro 42501 (no eres admin activo del equipo) no acusa de no ser
 *      superadmin;
 *   4. el superadmin invita admins, y los demás roles no preguntan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const moduleEditDenialMock = vi.fn();
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: (...a: unknown[]) => moduleEditDenialMock(...a) }));
vi.mock("@/lib/studio/audit/auth-lifecycle-adapter", () => ({ executeAuthLifecycle: vi.fn() }));
vi.mock("@/lib/studio/audit/external-effect-adapter", () => ({ beginD5ExternalEffect: vi.fn(), finishD5ExternalEffect: vi.fn() }));
vi.mock("@/lib/studio/telegram/link-code", () => ({ generateTelegramLinkCode: () => "code" }));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/studio/chatwoot/agentes-usuario", () => ({ sincronizarAgenteDeUsuario: vi.fn() }));
const rpc = vi.fn();
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc,
    // El guard de miembros y el correo son best-effort: sin tabla, siguen.
    from: () => {
      throw new Error("sin tabla en el doble");
    },
    auth: { getUser: async () => ({ data: { user: { id: "actor", email: "actor@prueba.test" } } }) },
  }),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    throw new Error("sin admin client en el doble");
  },
}));

const { inviteUserAction } = await import("../actions");

const MSG_0545 = "Solo el superadministrador puede crear o reactivar administradores";
const DENIAL = /^No eres superadministrador\. Invitar a un administrador lo hace solo el superadministrador/;

const form = (role: string) => {
  const fd = new FormData();
  fd.set("email", "nueva@prueba.test");
  fd.set("role", role);
  return fd;
};

/** Responde por RPC: is_platform_admin y audit_d1_execute. */
function base(opts: {
  superadmin: { data: unknown; error: unknown } | Error;
  d1?: { data: unknown; error: unknown };
}) {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === "is_platform_admin") {
      if (opts.superadmin instanceof Error) throw opts.superadmin;
      return opts.superadmin;
    }
    if (fn === "audit_d1_execute") {
      return opts.d1 ?? { data: { entity_id: "inv-1", invitation_id: "inv-1", token: "tok" }, error: null };
    }
    throw new Error(`rpc sin doble: ${fn}`);
  });
}
const llamadas = (fn: string) => rpc.mock.calls.filter(([nombre]) => nombre === fn).length;

beforeEach(() => {
  vi.clearAllMocks();
  moduleEditDenialMock.mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("inviteUserAction con rol admin", () => {
  it("la base dice que no eres superadmin: aviso claro y no se invita", async () => {
    base({ superadmin: { data: false, error: null } });
    const r = await inviteUserAction({}, form("admin"));
    expect(r.error).toMatch(DENIAL);
    expect(r.ok).toBeUndefined();
    expect(llamadas("audit_d1_execute")).toBe(0);
  });

  it("no se pudo preguntar (403): no corta, y si la base niega con la 0545 sale el mismo aviso", async () => {
    base({
      superadmin: { data: null, error: { code: "42501", message: "permission denied" } },
      d1: { data: null, error: { code: "42501", message: MSG_0545 } },
    });
    const r = await inviteUserAction({}, form("admin"));
    expect(llamadas("audit_d1_execute")).toBe(1);
    expect(r.error).toMatch(DENIAL);
  });

  it("no se pudo preguntar (red): no corta, decide la base", async () => {
    base({ superadmin: new Error("red") });
    const r = await inviteUserAction({}, form("admin"));
    expect(llamadas("audit_d1_execute")).toBe(1);
    expect(r.ok).toBe(true);
  });

  it("otro 42501 (no eres admin activo del equipo): no acusa de no ser superadmin", async () => {
    base({
      superadmin: { data: true, error: null },
      d1: { data: null, error: { code: "42501", message: "permission_denied" } },
    });
    const r = await inviteUserAction({}, form("admin"));
    expect(r.error).toBe(
      "No tienes permiso para invitar en este equipo. Si eres su administrador, vuelve a iniciar sesión.",
    );
    expect(r.error).not.toMatch(/superadministrador/);
  });

  it("el superadmin invita un admin", async () => {
    base({ superadmin: { data: true, error: null } });
    const r = await inviteUserAction({}, form("admin"));
    expect(r.ok).toBe(true);
    expect(r.invitationLink).toMatch(/tok/);
    const [, args] = rpc.mock.calls.find(([nombre]) => nombre === "audit_d1_execute")!;
    expect(args).toMatchObject({
      p_operation_type: "membership.invite",
      p_input: { email: "nueva@prueba.test", role: "admin" },
    });
  });
});

describe("inviteUserAction con otros roles", () => {
  it("un admin del equipo invita un comercial sin preguntar por el superadmin", async () => {
    base({ superadmin: { data: false, error: null } });
    const r = await inviteUserAction({}, form("commercial"));
    expect(r.ok).toBe(true);
    expect(llamadas("is_platform_admin")).toBe(0);
    expect(llamadas("audit_d1_execute")).toBe(1);
  });

  it("los demás errores conservan su forma", async () => {
    base({
      superadmin: { data: false, error: null },
      d1: { data: null, error: { code: "XX000", message: "otra cosa" } },
    });
    const r = await inviteUserAction({}, form("commercial"));
    expect(r.error).toBe("No se pudo crear la invitación: query_failed");
  });
});
