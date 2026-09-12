/**
 * Guard admin de `sendTestTemplateAction` (SDD-0453).
 *
 * Mailing es admin-only duro (SDD-0085): `mailing` está en ADMIN_ONLY_MODULES
 * y en LOCKED_MODULES. Pero una Server Action se puede invocar como endpoint
 * sin pasar por el layout ni por la page, así que el gate de vista no alcanza.
 * Esta era la única de las 15 actions del módulo sin `moduleEditDenial`: un
 * miembro no-admin podía mandarse un correo de prueba vía service_role.
 *
 * Se usan el guard y la matriz REALES (`rbac-guard.ts` + `rbac.ts`); sólo se
 * reemplazan los bordes: sesión, admin client, envío y overrides por rol. Así
 * también se pone rojo si el guard pregunta por otro módulo o si queda después
 * de leer la plantilla.
 *
 * UN CAMBIO DE PERMISOS SE PRUEBA POR EL LADO NEGATIVO: lo que importa es que
 * a un rol sin permiso no se le lea la plantilla ni se le envíe nada.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildSampleVars } from "@/lib/studio/mail-sample-vars";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";

const TENANT = "tn-1";
const TEMPLATE_ID = "tpl-1";
const TEMPLATE = { slug: "welcome_client", variables: ["client_name", "markbox"] };
const DENIAL = "No tienes permiso para realizar esta acción.";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePathMock(...a),
}));

const sendEmailMock = vi.fn();
vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: (...a: unknown[]) => sendEmailMock(...a),
}));

// Overrides por rol (SDD-0252). Mailing es LOCKED: ninguno puede abrirlo.
let overrides: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => overrides,
}));

// ── Cliente de la sesión ──────────────────────────────────────
let sessionUser: { id: string; email: string } | null = null;
let role: StudioUserRole | null = null;
/** Tablas leídas con la sesión, en orden: acá se ve si llegó a la plantilla. */
const sessionReads: string[] = [];

type Query = {
  select: () => Query;
  eq: () => Query;
  is: () => Query;
  limit: () => Query;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
};

function sessionClient() {
  return {
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    from(table: string) {
      sessionReads.push(table);
      const row =
        table === "user_tenants"
          ? role
            ? { tenant_id: TENANT, role }
            : null
          : table === "mail_templates"
            ? TEMPLATE
            : null;
      const query: Query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return query;
    },
  };
}

// ── Admin client (service_role): sólo lo usa el envío ─────────
const adminClient = { client: "service_role" };
const createAdminClientMock = vi.fn(() => adminClient);

vi.mock("@/lib/db/server", () => ({ createClient: async () => sessionClient() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

const { sendTestTemplateAction } = await import("../actions");

function form() {
  const fd = new FormData();
  fd.set("template_id", TEMPLATE_ID);
  return fd;
}

function expectNothingSent() {
  expect(sessionReads).not.toContain("mail_templates");
  expect(createAdminClientMock).not.toHaveBeenCalled();
  expect(sendEmailMock).not.toHaveBeenCalled();
  expect(revalidatePathMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionReads.length = 0;
  overrides = {};
  sessionUser = { id: "user-1", email: "admin@dtdcargo.com" };
  role = "admin";
  sendEmailMock.mockResolvedValue({
    ok: true,
    logId: "log-1",
    resendId: "re-1",
    queued: false,
  });
});

const NON_ADMIN_ROLES = STUDIO_USER_ROLES.filter((r) => r !== "admin");

describe("sendTestTemplateAction · lado negativo", () => {
  it.each(NON_ADMIN_ROLES)(
    "rol %s: se deniega sin leer la plantilla ni enviar",
    async (r) => {
      role = r;

      const res = await sendTestTemplateAction({}, form());

      expect(res).toEqual({ error: DENIAL });
      expectNothingSent();
    },
  );

  it("un override por rol no abre Mailing: el módulo es LOCKED", async () => {
    role = "marketing";
    overrides = { "marketing:mailing": { view: true, edit: true } };

    const res = await sendTestTemplateAction({}, form());

    expect(res).toEqual({ error: DENIAL });
    expectNothingSent();
  });

  it("sin sesión tampoco hay envío", async () => {
    sessionUser = null;
    role = null;

    const res = await sendTestTemplateAction({}, form());

    expect(res.ok).toBeUndefined();
    expect(res.error).toBeTruthy();
    expectNothingSent();
  });
});

describe("sendTestTemplateAction · admin", () => {
  it("conserva el envío: a su correo, con sample vars y metadata", async () => {
    const res = await sendTestTemplateAction({}, form());

    expect(res).toEqual({ ok: true, message: "Email de prueba enviado." });
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(adminClient, TENANT, {
      templateSlug: TEMPLATE.slug,
      to: "admin@dtdcargo.com",
      vars: buildSampleVars(TEMPLATE.slug, TEMPLATE.variables),
      metadata: { source: "sendTestTemplateAction", template_id: TEMPLATE_ID },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/mailing");
  });
});
