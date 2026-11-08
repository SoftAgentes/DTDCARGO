// @vitest-environment node
/**
 * SDD-0586 (10.5, 1c-1) · `setStatusAction` con un hilo del portal.
 *
 * Con `chatwoot_portal` encendido y la bandeja del portal configurada, el estado de un hilo del
 * portal lo decide Chatwoot (E10-D39, en la 1c-2): desde Studio no se cambia. La acción lo rechaza
 * en el servidor, sin escribir. Si no se puede leer el flag, también (fail-closed), y solo en el
 * portal. Con el flag apagado, sin configuración o en otro canal, todo como antes.
 *
 * Se usan el guard y la matriz REALES; sólo se reemplazan los bordes. El doble de la sesión
 * registra los filtros de cada lectura y cada UPDATE: uno que no filtra daría verde sin mirar el
 * tenant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioUserRole } from "@/lib/studio/user-types";

const TENANT = "10000000-0000-4000-8000-000000000001";
const CONV = "conv-1";
const DENIAL = "No tienes permiso para realizar esta acción.";
const SOLO_LECTURA = "Este hilo del portal se responde desde la Bandeja de Chatwoot.";

vi.mock("@/lib/studio/conversaciones/messages-queries", () => ({ insertOutboundMessage: vi.fn() }));
vi.mock("@/lib/studio/conversation-reply-push", () => ({ notifyClientReplyPush: vi.fn() }));
vi.mock("@/lib/studio/conversaciones/monthly-digest", () => ({ runConversationDigestsForTenant: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (u: string) => revalidatePathMock(u) }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({ getRoleModuleOverrides: async () => ({}) }));

let role: StudioUserRole | null = "commercial";
let canal = "portal";
let flagPortal: { enabled: boolean } | null | "error" = null;
let hiloFalla = false;
const lecturas: { tabla: string; filtros: [string, unknown][] }[] = [];
const updates: { tabla: string; valores: unknown; filtros: [string, unknown][] }[] = [];

function sessionClient() {
  return {
    auth: { getUser: async () => ({ data: { user: role ? { id: "user-1" } : null } }) },
    from(tabla: string) {
      const filtros: [string, unknown][] = [];
      let update: { valores: unknown } | null = null;
      const fila = () =>
        tabla === "user_tenants"
          ? role
            ? { tenant_id: TENANT, role }
            : null
          : tabla === "conversations"
            ? { id: CONV, channel: canal }
            : tabla === "feature_flags"
              ? flagPortal === "error"
                ? null
                : flagPortal
              : null;
      const q = {
        select: () => q,
        update: (valores: unknown) => {
          update = { valores };
          return q;
        },
        eq: (col: string, val: unknown) => {
          filtros.push([col, val]);
          return q;
        },
        is: () => q,
        limit: () => q,
        maybeSingle: async () => {
          lecturas.push({ tabla, filtros });
          if (tabla === "feature_flags" && flagPortal === "error") return { data: null, error: { code: "XX000" } };
          if (tabla === "conversations" && hiloFalla) return { data: null, error: { code: "XX000" } };
          return { data: fila(), error: null };
        },
        then: (r: (v: unknown) => void) => {
          if (update) updates.push({ tabla, valores: update.valores, filtros });
          return r({ data: null, error: null });
        },
      };
      return q;
    },
  };
}
vi.mock("@/lib/db/server", () => ({ createClient: async () => sessionClient() }));

const { setStatusAction } = await import("../actions");

const form = (status = "resuelto") => {
  const fd = new FormData();
  fd.set("conversation_id", CONV);
  fd.set("status", status);
  return fd;
};
const configurar = () => {
  vi.stubEnv("CHATWOOT_ROUTER_TOKEN", "tok-router-sintetico");
  vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
  vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "9");
  vi.stubEnv("CHATWOOT_TENANT_ID", TENANT);
};

beforeEach(() => {
  vi.clearAllMocks();
  role = "commercial";
  canal = "portal";
  flagPortal = null;
  hiloFalla = false;
  lecturas.length = 0;
  updates.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

describe("setStatusAction · SDD-0586 1c-1", () => {
  it("con el flag encendido y la bandeja configurada: no cambia el estado de un hilo del portal", async () => {
    configurar();
    flagPortal = { enabled: true };

    expect(await setStatusAction({}, form())).toEqual({ error: SOLO_LECTURA });
    expect(updates).toEqual([]);
    expect(revalidatePathMock).not.toHaveBeenCalled();
    const flag = lecturas.find((l) => l.tabla === "feature_flags");
    expect(flag?.filtros).toEqual(expect.arrayContaining([["tenant_id", TENANT], ["key", "chatwoot_portal"]]));
  });

  it("si no se puede leer el flag, el hilo del portal también se traba (fail-closed)", async () => {
    configurar();
    flagPortal = "error";

    const res = await setStatusAction({}, form());

    expect(res.error).toMatch(/No se pudo comprobar/);
    expect(updates).toEqual([]);
  });

  it("con el flag apagado cambia el estado como antes", async () => {
    configurar();
    flagPortal = { enabled: false };

    expect(await setStatusAction({}, form())).toEqual({ ok: true });
    expect(updates).toEqual([{ tabla: "conversations", valores: { status: "resuelto" }, filtros: [["id", CONV]] }]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/conversaciones");
  });

  // SDD-0586 1c-2 (decisión del DG, opción b): solo el flag decide, aunque falte la configuración.
  it("sin la bandeja del portal configurada y con el flag encendido, tampoco cambia el estado (fail-closed)", async () => {
    configurar();
    vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "");
    flagPortal = { enabled: true };

    expect(await setStatusAction({}, form())).toEqual({ error: SOLO_LECTURA });
    expect(updates).toEqual([]);
  });

  it("un hilo de otro canal cambia de estado como antes, aunque el flag esté encendido o no se pueda leer", async () => {
    configurar();
    canal = "email";
    flagPortal = { enabled: true };
    expect(await setStatusAction({}, form())).toEqual({ ok: true });
    flagPortal = "error";
    expect(await setStatusAction({}, form())).toEqual({ ok: true });
    expect(lecturas.some((l) => l.tabla === "feature_flags")).toBe(false);
  });

  it("el hilo se lee con la sesión y por su id, antes de escribir", async () => {
    configurar();
    flagPortal = { enabled: true };

    await setStatusAction({}, form());

    const hilo = lecturas.find((l) => l.tabla === "conversations");
    expect(hilo?.filtros).toEqual(expect.arrayContaining([["id", CONV]]));
  });

  it("si no se puede leer el hilo, no escribe (no se sabe si es del portal)", async () => {
    configurar();
    flagPortal = { enabled: true };
    hiloFalla = true;

    expect(await setStatusAction({}, form())).toEqual({ error: "No se pudo leer la conversación. Vuelve a intentar." });
    expect(updates).toEqual([]);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("el gate de rol sigue primero: un rol sin el módulo no lee el hilo ni el flag", async () => {
    configurar();
    flagPortal = { enabled: true };
    role = "accounting";

    expect(await setStatusAction({}, form())).toEqual({ error: DENIAL });
    expect(lecturas.some((l) => l.tabla === "conversations" || l.tabla === "feature_flags")).toBe(false);
    expect(updates).toEqual([]);
  });

  it("un estado inválido se rechaza por validación, antes de todo", async () => {
    const res = await setStatusAction({}, form("cualquiera"));

    expect(res.fieldErrors).toBeTruthy();
    expect(updates).toEqual([]);
  });
});
