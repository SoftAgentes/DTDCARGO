import { describe, expect, it } from "vitest";
import {
  clearDefaultForClient,
  insertClientDeliveryAddress,
  setDefaultDeliveryAddress,
  updateClientDeliveryAddress,
} from "../client-address-queries";

type Operation = {
  op: "insert" | "update";
  payload: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

function database(operations: Operation[]) {
  return {
    from: () => {
      let current: Operation | null = null;
      const chain = {
        insert: (payload: Record<string, unknown>) => {
          current = { op: "insert", payload, filters: [] };
          operations.push(current);
          return chain;
        },
        update: (payload: Record<string, unknown>) => {
          current = { op: "update", payload, filters: [] };
          operations.push(current);
          return chain;
        },
        select: () => chain,
        eq: (column: string, value: unknown) => {
          current?.filters.push([column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          current?.filters.push([column, value]);
          return chain;
        },
        single: async () => ({
          data: {
            id: "address-a",
            client_id: "client-a",
            label: null,
            line: "Av. Principal",
            city: null,
            city_slug: null,
            state: null,
            reference: null,
            is_default: false,
          },
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      };
      return chain;
    },
  };
}

const portalScope = { tenantId: "tenant-a", markbox: "DTD-0001" };
const input = {
  label: null,
  line: "Av. Principal",
  city: null,
  citySlug: null,
  state: null,
  reference: null,
  isDefault: false,
};

function expectScope(operation: Operation, withClient = true) {
  expect(operation.filters).toEqual(expect.arrayContaining([
    ["tenant_id", "tenant-a"],
    ["client_markbox", "DTD-0001"],
    ...(withClient ? [["client_id", "client-a"] as [string, unknown]] : []),
  ]));
}

describe("SDD0394 · helpers de dirección con scope Portal opcional", () => {
  it("clear fija tenant, cliente y Shipping Mark", async () => {
    const operations: Operation[] = [];
    await clearDefaultForClient(database(operations) as never, "client-a", portalScope);
    expectScope(operations[0]);
  });

  it("insert transporta tenant y Shipping Mark canónicos", async () => {
    const operations: Operation[] = [];
    await insertClientDeliveryAddress(
      database(operations) as never, "client-a", input, portalScope,
    );
    expect(operations[0].payload).toMatchObject({
      tenant_id: "tenant-a",
      client_markbox: "DTD-0001",
      client_id: "client-a",
    });
  });

  it("update fija tenant, cliente, Shipping Mark e id", async () => {
    const operations: Operation[] = [];
    await updateClientDeliveryAddress(
      database(operations) as never,
      "address-a",
      input,
      { ...portalScope, clientId: "client-a" },
    );
    expectScope(operations[0]);
    expect(operations[0].filters).toContainEqual(["id", "address-a"]);
  });

  it("setDefault aplica scope al clear y al destino", async () => {
    const operations: Operation[] = [];
    await setDefaultDeliveryAddress(
      database(operations) as never, "client-a", "address-a", portalScope,
    );
    expectScope(operations[0]);
    expectScope(operations[1]);
    expect(operations[1].filters).toContainEqual(["id", "address-a"]);
  });
});
