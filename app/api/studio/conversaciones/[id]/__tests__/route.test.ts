// @vitest-environment node
/**
 * SDD-0586 (10.5, 1c-1) · GET /api/studio/conversaciones/[id]: el número de la conversación en
 * Chatwoot de un hilo del portal, para «Responder en la Bandeja →».
 *
 * Se lee con service_role (`chatwoot_portal_hilos` no tiene permisos para authenticated) SOLO
 * después de comprobar con la sesión que el hilo es visible para el tenant, y filtrado por el hilo
 * y por ese tenant. Los dobles registran cada filtro: uno que no filtra daría verde sin mirarlos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const TENANT = "10000000-0000-4000-8000-000000000001";

const m = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  denial: null as string | null,
  conv: null as Record<string, unknown> | null,
  hilo: null as { chatwoot_conversation_id: number } | null | "error",
  adminLlamadas: 0,
  filtrosAdmin: [] as [string, unknown][],
  tablasAdmin: [] as string[],
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: m.user } }) },
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        is: () => q,
        maybeSingle: async () => ({ data: m.conv, error: null }),
      };
      return q;
    },
  }),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.adminLlamadas += 1;
    return {
      from: (tabla: string) => {
        m.tablasAdmin.push(tabla);
        const q = {
          select: () => q,
          eq: (col: string, val: unknown) => {
            m.filtrosAdmin.push([col, val]);
            return q;
          },
          maybeSingle: async () => (m.hilo === "error" ? { data: null, error: { code: "XX000" } } : { data: m.hilo, error: null }),
        };
        return q;
      },
    };
  },
}));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleViewDenial: async () => m.denial }));
vi.mock("@/lib/studio/conversaciones/messages-queries", () => ({ listMessages: async () => [] }));
vi.mock("@/lib/studio/conversaciones/conversations-queries", () => ({
  getClientContext: async () => null,
  listClientConversationDigests: async () => [],
}));

const { GET } = await import("../route");

const pedir = (id = "conv-1") => GET(new Request(`https://dtdcargo.test/api/studio/conversaciones/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  m.user = { id: "user-1" };
  m.denial = null;
  m.conv = { id: "conv-1", client_id: "cli-1", channel: "portal", tenant_id: TENANT };
  m.hilo = { chatwoot_conversation_id: 9001 };
  m.adminLlamadas = 0;
  m.filtrosAdmin.length = 0;
  m.tablasAdmin.length = 0;
});

describe("GET /api/studio/conversaciones/[id] · SDD-0586 1c-1", () => {
  it("un hilo del portal trae el número de su conversación en Chatwoot, leído por el hilo y su tenant", async () => {
    const r = await pedir();
    expect(r.status).toBe(200);
    expect((await r.json()).bandeja).toBe(9001);
    expect(m.tablasAdmin).toEqual(["chatwoot_portal_hilos"]);
    expect(m.filtrosAdmin).toEqual(expect.arrayContaining([["conversation_id", "conv-1"], ["tenant_id", TENANT]]));
  });

  it("sin vínculo todavía, o si no se pudo leer, bandeja es null (el aviso va sin enlace)", async () => {
    m.hilo = null;
    expect((await (await pedir()).json()).bandeja).toBeNull();
    m.hilo = "error";
    expect((await (await pedir()).json()).bandeja).toBeNull();
  });

  it("un hilo de otro canal no lee nada con service_role", async () => {
    m.conv = { id: "conv-1", client_id: "cli-1", channel: "email", tenant_id: TENANT };
    const r = await pedir();
    expect((await r.json()).bandeja).toBeNull();
    expect(m.adminLlamadas).toBe(0);
  });

  it("un hilo que la sesión no ve (otro tenant): 404 y nada con service_role", async () => {
    m.conv = null;
    expect((await pedir()).status).toBe(404);
    expect(m.adminLlamadas).toBe(0);
  });

  it("sin sesión o sin el módulo: no llega a service_role", async () => {
    m.user = null;
    expect((await pedir()).status).toBe(401);
    m.user = { id: "user-1" };
    m.denial = "No tienes permiso.";
    expect((await pedir()).status).toBe(403);
    expect(m.adminLlamadas).toBe(0);
  });
});
