/**
 * Gate de EDICIÓN de `sendReplyAction` (SDD-0497).
 *
 * Era la única de las cinco acciones de `conversaciones/actions.ts` sin
 * `moduleEditDenial`, y la que más lejos llega: inserta un mensaje SALIENTE al
 * cliente, firmado con el nombre del agente, y le dispara un push al portal.
 * `requireModuleView("conversaciones")` protege la página; esta action es un
 * endpoint invocable directo. La policy `"conversation_messages by tenant"`
 * (0106:141-145) es FOR ALL con `with check (tenant_id = get_user_tenant_id())`,
 * sin predicado de rol, así que el INSERT no lo frenaba nadie.
 *
 * El caso que da nombre a la tarea es `support`: está en la matriz de
 * `conversaciones` pero es read-only V1 (`canEditModule` lo rechaza siempre), y
 * sin embargo escribía al cliente. Un rol read-only que escribe hacia AFUERA no
 * es un detalle de permisos.
 *
 * Se usan el guard y la matriz REALES; sólo se reemplazan los bordes.
 *
 * SDD-0586 (10.5, 1c-1): con `chatwoot_portal` encendido y la bandeja del portal configurada,
 * un hilo del portal se responde desde la Bandeja de Chatwoot: la acción lo rechaza en el
 * servidor, sin insertar ni avisar. Si no se puede leer el flag, también (fail-closed), y solo
 * en el portal. Con el flag apagado o sin configuración, todo como antes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";

// Un uuid: `chatwootPortalConfig()` exige que CHATWOOT_TENANT_ID lo sea.
const TENANT = "10000000-0000-4000-8000-000000000001";
const CONV = "conv-1";
const DENIAL = "No tienes permiso para realizar esta acción.";

const insertOutboundMessageMock = vi.fn();
vi.mock("@/lib/studio/conversaciones/messages-queries", () => ({
  insertOutboundMessage: (...a: unknown[]) => insertOutboundMessageMock(...a),
}));

const notifyClientReplyPushMock = vi.fn();
vi.mock("@/lib/studio/conversation-reply-push", () => ({
  notifyClientReplyPush: (...a: unknown[]) => notifyClientReplyPushMock(...a),
}));

vi.mock("@/lib/studio/conversaciones/monthly-digest", () => ({
  runConversationDigestsForTenant: vi.fn(),
}));

const createAdminClientMock = vi.fn(() => ({ client: "service_role" }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => createAdminClientMock() }));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (u: string) => revalidatePathMock(u) }));

let overrides: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => overrides,
}));

// ── Cliente de la sesión ──────────────────────────────────────
let sessionUser: { id: string } | null = null;
let role: StudioUserRole | null = null;
/** Tablas leídas: acá se ve si el gate quedó antes o después del hilo. */
const sessionReads: string[] = [];

type Query = {
  select: () => Query;
  eq: (col: string, val: unknown) => Query;
  is: () => Query;
  limit: () => Query;
  maybeSingle: () => Promise<{ data: unknown; error: { code: string } | null }>;
};

/** SDD-0586 1c-1: la fila del flag `chatwoot_portal` del tenant, o un error al leerla. */
let flagPortal: { enabled: boolean } | null | "error" = null;
/** Los filtros con que se leyó `feature_flags`: un doble que no filtra daría verde sin mirar el tenant. */
const filtrosFlag: [string, unknown][] = [];

const CONVERSACION = {
  id: CONV,
  client_id: "cli-1",
  channel: "portal",
  external_ref: null,
};
let canal = "portal";
const PERFIL = { first_name: "Ana", last_name: "Pérez" };

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
          : table === "user_profiles"
            ? PERFIL
            : table === "conversations"
              ? { ...CONVERSACION, channel: canal }
              : table === "feature_flags"
                ? flagPortal === "error"
                  ? null
                  : flagPortal
                : null;
      const query: Query = {
        select: () => query,
        eq: (col, val) => {
          if (table === "feature_flags") filtrosFlag.push([col, val]);
          return query;
        },
        is: () => query,
        limit: () => query,
        maybeSingle: async () =>
          table === "feature_flags" && flagPortal === "error"
            ? { data: null, error: { code: "XX000" } }
            : { data: row, error: null },
      };
      return query;
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => sessionClient() }));

const { sendReplyAction } = await import("../actions");

function form(body = "Tu paquete sale el martes.") {
  const fd = new FormData();
  fd.set("conversation_id", CONV);
  fd.set("body", body);
  return fd;
}

function expectNadaEnviado() {
  expect(sessionReads).not.toContain("conversations");
  expect(insertOutboundMessageMock).not.toHaveBeenCalled();
  expect(notifyClientReplyPushMock).not.toHaveBeenCalled();
  expect(createAdminClientMock).not.toHaveBeenCalled();
  expect(revalidatePathMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionReads.length = 0;
  overrides = {};
  sessionUser = { id: "user-1" };
  role = "commercial";
  insertOutboundMessageMock.mockResolvedValue({ ok: true });
  notifyClientReplyPushMock.mockResolvedValue(undefined);
  flagPortal = null;
  filtrosFlag.length = 0;
  canal = "portal";
});

afterEach(() => vi.unstubAllEnvs());

/** `conversaciones` la ven commercial, operations y support (+admin). */
const ROLES_SIN_CONVERSACIONES = STUDIO_USER_ROLES.filter(
  (r) => !["admin", "commercial", "operations", "support"].includes(r),
);

describe("sendReplyAction · lado negativo", () => {
  it.each(ROLES_SIN_CONVERSACIONES)(
    "rol %s: no le escribe al cliente ni lee el hilo",
    async (r) => {
      role = r;

      const res = await sendReplyAction({}, form());

      expect(res).toEqual({ error: DENIAL });
      expectNadaEnviado();
    },
  );

  it("support ve el módulo pero es read-only: no le escribe al cliente", async () => {
    role = "support";

    const res = await sendReplyAction({}, form());

    expect(res).toEqual({ error: DENIAL });
    expectNadaEnviado();
  });

  it("un override no vuelve editor a support: read-only V1 es inmutable", async () => {
    role = "support";
    overrides = { "support:conversaciones": { view: true, edit: true } };

    const res = await sendReplyAction({}, form());

    expect(res).toEqual({ error: DENIAL });
    expectNadaEnviado();
  });

  it("sin sesión tampoco escribe", async () => {
    sessionUser = null;
    role = null;

    const res = await sendReplyAction({}, form());

    expect(res).toEqual({ error: DENIAL });
    expectNadaEnviado();
  });

  it("un cuerpo vacío se rechaza ANTES del gate, por validación", async () => {
    const fd = new FormData();
    fd.set("conversation_id", CONV);
    fd.set("body", "");

    const res = await sendReplyAction({}, fd);

    expect(res.fieldErrors).toBeTruthy();
    expect(res.error).toBeUndefined();
    expectNadaEnviado();
  });
});

describe("sendReplyAction · lado positivo", () => {
  it("commercial responde: inserta el saliente y avisa al portal", async () => {
    const res = await sendReplyAction({}, form());

    expect(res).toEqual({ ok: true });
    expect(insertOutboundMessageMock).toHaveBeenCalledTimes(1);
    expect(insertOutboundMessageMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        conversationId: CONV,
        authorName: "Ana Pérez",
        authorUserId: "user-1",
      }),
    );
    expect(notifyClientReplyPushMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/conversaciones");
  });

  it("operations también", async () => {
    role = "operations";

    expect(await sendReplyAction({}, form())).toEqual({ ok: true });
  });

  it("el gate corre ANTES de resolver el tenant y de leer el hilo", async () => {
    role = "accounting";

    await sendReplyAction({}, form());

    expect(sessionReads).toEqual(["user_tenants"]);
  });
});

describe("SDD-0586 1c-1 · un hilo del portal se responde desde la Bandeja", () => {
  const SOLO_LECTURA = "Este hilo del portal se responde desde la Bandeja de Chatwoot.";
  const configurar = () => {
    vi.stubEnv("CHATWOOT_ROUTER_TOKEN", "tok-router-sintetico");
    vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
    vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "9");
    vi.stubEnv("CHATWOOT_TENANT_ID", TENANT);
  };
  const nadaEscrito = () => {
    expect(insertOutboundMessageMock).not.toHaveBeenCalled();
    expect(notifyClientReplyPushMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  };

  it("con el flag encendido y la bandeja configurada: rechaza sin insertar ni avisar", async () => {
    configurar();
    flagPortal = { enabled: true };

    expect(await sendReplyAction({}, form())).toEqual({ error: SOLO_LECTURA });
    nadaEscrito();
    // La fila del flag es la del tenant de la sesión.
    expect(filtrosFlag).toEqual(expect.arrayContaining([["tenant_id", TENANT], ["key", "chatwoot_portal"]]));
  });

  it("si no se puede leer el flag, el hilo del portal también se traba (fail-closed)", async () => {
    configurar();
    flagPortal = "error";

    const res = await sendReplyAction({}, form());

    expect(res.error).toMatch(/No se pudo comprobar/);
    nadaEscrito();
  });

  it("con el flag apagado responde como antes", async () => {
    configurar();
    flagPortal = { enabled: false };

    expect(await sendReplyAction({}, form())).toEqual({ ok: true });
    expect(insertOutboundMessageMock).toHaveBeenCalledTimes(1);
  });

  it("sin la fila del flag responde como antes (apagado)", async () => {
    configurar();
    flagPortal = null;

    expect(await sendReplyAction({}, form())).toEqual({ ok: true });
  });

  it("sin la bandeja del portal configurada responde como antes, aunque el flag esté encendido: Studio es la única vía", async () => {
    configurar();
    vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "");
    flagPortal = { enabled: true };

    expect(await sendReplyAction({}, form())).toEqual({ ok: true });
    expect(sessionReads).not.toContain("feature_flags");
  });

  it("con la configuración de otro tenant responde como antes", async () => {
    configurar();
    vi.stubEnv("CHATWOOT_TENANT_ID", "10000000-0000-4000-8000-000000000002");
    flagPortal = { enabled: true };

    expect(await sendReplyAction({}, form())).toEqual({ ok: true });
  });

  it("un hilo de otro canal responde como antes, aunque el flag esté encendido o no se pueda leer", async () => {
    configurar();
    canal = "email";
    flagPortal = { enabled: true };
    expect(await sendReplyAction({}, form())).toEqual({ ok: true });
    flagPortal = "error";
    expect(await sendReplyAction({}, form())).toEqual({ ok: true });
    expect(sessionReads).not.toContain("feature_flags");
  });

  it("el gate de rol sigue primero: support no llega ni a mirar el flag", async () => {
    configurar();
    flagPortal = { enabled: true };
    role = "support";

    expect(await sendReplyAction({}, form())).toEqual({ error: DENIAL });
    expect(sessionReads).not.toContain("feature_flags");
  });
});
