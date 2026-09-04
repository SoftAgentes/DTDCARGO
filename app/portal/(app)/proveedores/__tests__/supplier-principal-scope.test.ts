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
  payload?: Record<string, unknown>;
};

const state = vi.hoisted(() => ({
  principal: null as Principal | null,
  operations: [] as Operation[],
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
        return { data: "DTD-0001", error: null };
      }
      if (name === "get_portal_client_tenant") {
        return { data: "legacy-tenant", error: null };
      }
      if (name === "next_supplier_seq") return { data: 7, error: null };
      return { data: null, error: null };
    },
    from(table: string) {
      let operation: Operation | null = null;
      const begin = (op: Operation["op"], payload?: Record<string, unknown>) => {
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
        insert: (payload: Record<string, unknown>) => {
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
        limit: () => chain,
        single: async () => ({ data: { id: "supplier-new" }, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: [], count: 0, error: null }).then(resolve),
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
  getPrealertaByCode: vi.fn(),
  listActivePrealertaAddons: async () => [],
}));
vi.mock("@/lib/studio/workflow/workflow-rule-engine", () => ({
  fireWorkflowEvent: async () => {},
}));

const {
  createSupplierAction,
  updateSupplierAction,
  deleteSupplierAction,
} = await import("../actions");

function supplierForm(extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("name", "Proveedor sintético");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
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
});

describe("SDD0388 · proveedores Portal por principal y tenant", () => {
  it("principal inválido corta antes de consultar o editar el dominio", async () => {
    state.principal = null;
    const form = supplierForm({ supplierId: "supplier-a" });
    const result = await updateSupplierAction({}, form);
    expect(result.ok).toBeUndefined();
    expect(state.operations).toEqual([]);
  });

  it("alta fija tenant y Shipping Mark al buscar duplicados", async () => {
    await createSupplierAction({}, supplierForm());
    expectPrincipalScope(operation("suppliers_cn", "select"));
  });

  it("alta persiste sólo tenant y Shipping Mark del principal", async () => {
    const form = supplierForm({ tenantId: "tenant-forjado", markbox: "DTD-9999" });
    const result = await createSupplierAction({}, form);
    expect(result).toEqual({ ok: true, supplierId: "supplier-new" });
    expect(operation("suppliers_cn", "insert").payload).toMatchObject({
      tenant_id: "tenant-a",
      client_markbox: "DTD-0001",
      supplier_seq: 7,
    });
  });

  it("edición fija tenant, Shipping Mark, id y proveedor vivo", async () => {
    await updateSupplierAction({}, supplierForm({ supplierId: "supplier-a" }));
    const update = operation("suppliers_cn", "update");
    expectPrincipalScope(update);
    expect(update.filters).toEqual(expect.arrayContaining([
      ["id", "supplier-a"],
      ["deleted_at", null],
    ]));
  });

  it("borrado revisa compras y proveedor dentro del mismo principal", async () => {
    const form = new FormData();
    form.set("supplierId", "supplier-a");
    const result = await deleteSupplierAction({}, form);
    expect(result).toEqual({ ok: true });
    expectPrincipalScope(operation("prealertas", "select"));
    const update = operation("suppliers_cn", "update");
    expectPrincipalScope(update);
    expect(update.filters).toEqual(expect.arrayContaining([
      ["id", "supplier-a"],
      ["deleted_at", null],
    ]));
  });
});
