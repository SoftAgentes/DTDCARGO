import { beforeEach, describe, expect, it, vi } from "vitest";

type Operation = {
  table: string;
  op: "select" | "insert" | "update";
  payload?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

const state = vi.hoisted(() => ({
  principal: null as null | {
    userId: string;
    tenantId: string;
    client: { id: string; markbox: string; name: string };
  },
  operations: [] as Operation[],
  adminBuilds: 0,
  notifications: [] as unknown[][],
}));

function adminDatabase() {
  return {
    rpc: async () => ({ data: "EST-2026-0001", error: null }),
    from(table: string) {
      let operation: Operation | null = null;
      const begin = (op: Operation["op"], payload?: Record<string, unknown>) => {
        operation = { table, op, payload, filters: [] };
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
        maybeSingle: async () => ({
          data: table === "clients"
            ? { tenant_id: "legacy-tenant" }
            : {
                id: "quote-a",
                tenant_id: "legacy-tenant",
                quote_code: "EST-2026-0001",
                source: "web",
                status: "draft",
                service: "consolidado_lcl",
                origin: "China",
                destination: "Venezuela",
                nota: null,
                converted_to_shipment_id: null,
              },
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: operation?.op === "update" ? [{ id: "quote-a" }] : null,
            error: null,
          }).then(resolve),
      };
      return chain;
    },
  };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    state.adminBuilds += 1;
    return adminDatabase();
  },
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClient: async () => ({
    id: "client-a", markbox: "DTD-LEGACY", name: "Cliente legado",
  }),
  getPortalClientPrincipal: async () => state.principal,
}));
vi.mock("@/lib/studio/cotizacion-request-notify", () => ({
  notifyCotizacionRequestToAdmin: async (...args: unknown[]) => {
    state.notifications.push(args);
  },
}));

const { requestCotizacionAction } = await import(
  "@/app/portal/(app)/cotizaciones/actions"
);
const { advanceEstimateToCotizacionAction } = await import(
  "@/app/portal/(app)/estimados/actions"
);

function requestForm() {
  const form = new FormData();
  form.set("service", "consolidado_lcl");
  form.set("description", "Carga sintética");
  return form;
}

function operation(op: Operation["op"]) {
  const found = state.operations.find((item) => item.table === "quotes" && item.op === op);
  expect(found).toBeTruthy();
  return found!;
}

beforeEach(() => {
  state.principal = {
    userId: "portal-user",
    tenantId: "tenant-a",
    client: { id: "client-a", markbox: "DTD-0001", name: "Cliente canónico" },
  };
  state.operations.length = 0;
  state.notifications.length = 0;
  state.adminBuilds = 0;
});

describe("SDD0395 · cotizaciones Portal antes de elevar", () => {
  it("principal inválido corta antes de construir admin", async () => {
    state.principal = null;
    const result = await requestCotizacionAction({}, requestForm());
    expect(result.ok).toBeUndefined();
    expect(state.adminBuilds).toBe(0);
    expect(state.operations).toEqual([]);
  });

  it("solicitud usa tenant + Shipping Mark del principal sin releer clients", async () => {
    const result = await requestCotizacionAction({}, requestForm());
    expect(result).toEqual({ ok: true, createdCode: "EST-2026-0001" });
    expect(state.operations.some((item) => item.table === "clients")).toBe(false);
    expect(operation("insert").payload).toMatchObject({
      tenant_id: "tenant-a",
      client_markbox: "DTD-0001",
      client_name: "Cliente canónico",
    });
    expect(state.notifications[0]?.[1]).toBe("tenant-a");
  });

  it("avance fija tenant + Shipping Mark en lectura, update y aviso", async () => {
    const form = new FormData();
    form.set("code", "EST-2026-0001");
    await expect(advanceEstimateToCotizacionAction({}, form)).rejects.toThrow(
      "REDIRECT:/portal/cotizaciones",
    );
    const read = operation("select");
    const update = operation("update");
    for (const item of [read, update]) {
      expect(item.filters).toEqual(expect.arrayContaining([
        ["tenant_id", "tenant-a"],
        ["client_markbox", "DTD-0001"],
      ]));
    }
    expect(state.notifications[0]?.[1]).toBe("tenant-a");
  });
});
