import { beforeEach, describe, expect, it, vi } from "vitest";

type Principal = {
  userId: string;
  tenantId: string;
  client: {
    id: string;
    markbox: string;
    name: string;
    email: null;
    phone: null;
    address: null;
    docKind: null;
    rif: null;
    city: null;
    state: null;
  };
};

type Operation = {
  table: string;
  op: "select" | "insert" | "update";
  filters: Array<[string, unknown]>;
  payload?: Record<string, unknown> | Record<string, unknown>[];
};

const state = vi.hoisted(() => ({
  principal: null as Principal | null,
  operations: [] as Operation[],
  prealertaCalls: [] as unknown[][],
  addonCalls: [] as unknown[][],
}));

function principal(): Principal {
  return {
    userId: "portal-user",
    tenantId: "tenant-a",
    client: {
      id: "client-a",
      markbox: "DTD-0001",
      name: "Cliente sintético",
      email: null,
      phone: null,
      address: null,
      docKind: null,
      rif: null,
      city: null,
      state: null,
    },
  };
}

function database() {
  return {
    rpc: async (name: string) => {
      if (name === "get_portal_client_markbox") {
        return { data: "DTD-LEGACY", error: null };
      }
      if (name === "get_portal_client_tenant") {
        return { data: "legacy-tenant", error: null };
      }
      if (name === "next_order_seq") return { data: 3, error: null };
      return { data: null, error: null };
    },
    from(table: string) {
      let operation: Operation | null = null;
      const begin = (
        op: Operation["op"],
        payload?: Record<string, unknown> | Record<string, unknown>[],
      ) => {
        operation = { table, op, filters: [], payload };
        state.operations.push(operation);
        return operation;
      };
      const current = () => operation ?? begin("select");
      const chain = {
        select: () => {
          if (!operation) begin("select");
          return chain;
        },
        insert: (payload: Record<string, unknown> | Record<string, unknown>[]) => {
          begin("insert", payload);
          return chain;
        },
        update: (payload: Record<string, unknown>) => {
          begin("update", payload);
          return chain;
        },
        eq: (column: string, value: unknown) => {
          current().filters.push([column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          current().filters.push([column, value]);
          return chain;
        },
        maybeSingle: async () => {
          if (table === "suppliers_cn") {
            return { data: { supplier_seq: 2 }, error: null };
          }
          return { data: null, error: null };
        },
        single: async () => {
          if (table === "prealertas") {
            return { data: { id: "pre-new", share_token: "share-new" }, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return chain;
    },
  };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => database() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => { throw new Error("sin admin en este slice"); },
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => state.principal,
}));
vi.mock("@/lib/studio/prealertas/queries", () => ({
  getPrealertaByCode: async (...args: unknown[]) => {
    state.prealertaCalls.push(args);
    return {
      id: "pre-existing",
      code: "DTD-0001-2-3",
      supplier_id: "supplier-a",
      status: "anunciada",
      share_token: "share-existing",
    };
  },
  listActivePrealertaAddons: async (...args: unknown[]) => {
    state.addonCalls.push(args);
    return [{ code: "verificacion" }];
  },
}));
vi.mock("@/lib/studio/workflow/workflow-rule-engine", () => ({
  fireWorkflowEvent: async () => {},
}));

const {
  createPrealertaAction,
  requestPrealertaServiceAction,
  updatePrealertaDetalleAction,
} = await import("../actions");

function createForm(): FormData {
  const form = new FormData();
  form.set("wizard", "true");
  form.set("supplierId", "supplier-a");
  form.set("tenantId", "tenant-forjado");
  form.set("markbox", "DTD-9999");
  return form;
}

function operation(table: string, op: Operation["op"]): Operation {
  const found = state.operations.find((item) => item.table === table && item.op === op);
  expect(found).toBeTruthy();
  return found!;
}

function expectPrincipalScope(item: Operation) {
  expect(item.filters).toEqual(expect.arrayContaining([
    ["tenant_id", "tenant-a"],
    ["client_markbox", "DTD-0001"],
  ]));
}

beforeEach(() => {
  state.principal = principal();
  state.operations.length = 0;
  state.prealertaCalls.length = 0;
  state.addonCalls.length = 0;
});

describe("SDD0389 · compras Portal por principal y tenant", () => {
  it("principal inválido corta antes de resolver una compra o sus add-ons", async () => {
    state.principal = null;
    const form = new FormData();
    form.set("prealertaCode", "DTD-0001-2-3");
    form.set("addonCode", "verificacion");
    form.set("consent", "true");
    const result = await requestPrealertaServiceAction({}, form);
    expect(result.ok).toBeUndefined();
    expect(state.prealertaCalls).toEqual([]);
    expect(state.addonCalls).toEqual([]);
    expect(state.operations).toEqual([]);
  });

  it("alta fija el principal en proveedor, compra y catálogo de extras", async () => {
    const result = await createPrealertaAction({}, createForm());
    expect(result).toMatchObject({ ok: true, shareToken: "share-new" });
    expectPrincipalScope(operation("suppliers_cn", "select"));
    expect(operation("prealertas", "insert").payload).toMatchObject({
      tenant_id: "tenant-a",
      client_markbox: "DTD-0001",
      supplier_id: "supplier-a",
    });
    expect(state.addonCalls[0]?.[1]).toEqual({ tenantId: "tenant-a" });
  });

  it("solicitud de servicio fija tenant y Shipping Mark de punta a punta", async () => {
    const form = new FormData();
    form.set("prealertaCode", "DTD-0001-2-3");
    form.set("addonCode", "verificacion");
    form.set("consent", "true");
    const result = await requestPrealertaServiceAction({}, form);
    expect(result).toEqual({ ok: true, requestedCount: 1 });
    expect(state.prealertaCalls[0]?.[2]).toEqual({
      markbox: "DTD-0001",
      tenantId: "tenant-a",
    });
    expect(state.addonCalls[0]?.[1]).toEqual({ tenantId: "tenant-a" });
    expect(operation("prealerta_service_requests", "insert").payload).toMatchObject({
      tenant_id: "tenant-a",
      client_markbox: "DTD-0001",
      prealerta_id: "pre-existing",
    });
  });

  it("detalle resuelve la compra y actualiza con ambos scopes", async () => {
    const form = new FormData();
    form.set("prealertaCode", "DTD-0001-2-3");
    form.set("boxes", "2");
    const result = await updatePrealertaDetalleAction({}, form);
    expect(result).toMatchObject({ ok: true, prealertaCode: "DTD-0001-2-3" });
    expect(state.prealertaCalls[0]?.[2]).toEqual({
      markbox: "DTD-0001",
      tenantId: "tenant-a",
    });
    const update = operation("prealertas", "update");
    expectPrincipalScope(update);
    expect(update.filters).toEqual(expect.arrayContaining([
      ["id", "pre-existing"],
      ["deleted_at", null],
    ]));
  });
});
