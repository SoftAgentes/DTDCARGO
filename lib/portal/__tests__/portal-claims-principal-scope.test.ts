import { beforeEach, describe, expect, it } from "vitest";
import { listMyClaims } from "../portal-claims";

type Operation = { table: string; filters: Array<[string, unknown]> };
let incoherent = false;
let operations: Operation[] = [];

function database() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "portal-user" } }, error: null }),
    },
    rpc: async () => ({ data: "DTD-LEGACY", error: null }),
    from(table: string) {
      const operation = { table, filters: [] as Array<[string, unknown]> };
      operations.push(operation);
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          operation.filters.push([column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          operation.filters.push([column, value]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data: table === "client_users" ? {
            client_id: "client-a",
            tenant_id: "tenant-a",
            clients: {
              id: "client-a",
              tenant_id: incoherent ? "tenant-b" : "tenant-a",
              markbox: "DTD-0001",
              name: "Cliente sintético",
              email: null,
              phone: null,
              address: null,
              rif: null,
              doc_kind: null,
              city: null,
              state: null,
              deleted_at: null,
            },
          } : null,
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return chain;
    },
  };
}

function domainOperations() {
  return operations.filter((item) => item.table !== "client_users");
}

beforeEach(() => {
  incoherent = false;
  operations = [];
});

describe("SDD0393 · reclamos Portal por principal y tenant", () => {
  it("principal incoherente corta antes del dominio", async () => {
    incoherent = true;
    await expect(listMyClaims(database() as never)).resolves.toEqual([]);
    expect(domainOperations()).toEqual([]);
  });

  it("lista fija tenant + Shipping Mark del principal", async () => {
    await listMyClaims(database() as never);
    expect(domainOperations()[0].filters).toEqual(expect.arrayContaining([
      ["tenant_id", "tenant-a"],
      ["client_markbox", "DTD-0001"],
      ["deleted_at", null],
    ]));
  });
});
