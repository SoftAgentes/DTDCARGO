import { beforeEach, describe, expect, it } from "vitest";
import {
  getPortalActivation,
  getProfileCompleteness,
} from "../portal-queries";

type Membership = {
  client_id: string;
  tenant_id: string;
  clients: {
    id: string;
    tenant_id: string;
    markbox: string;
    name: string;
    email: null;
    phone: null;
    address: null;
    rif: null;
    doc_kind: null;
    city: null;
    state: null;
    deleted_at: string | null;
  };
};

type Operation = {
  table: string;
  filters: Array<[string, unknown]>;
};

let currentMembership: Membership | null;
let operations: Operation[];

function membership(clientTenant = "tenant-a"): Membership {
  return {
    client_id: "client-a",
    tenant_id: "tenant-a",
    clients: {
      id: "client-a",
      tenant_id: clientTenant,
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
  };
}

function database() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "portal-user" } }, error: null }),
    },
    rpc: async (name: string) => ({
      data: name === "get_portal_client_id"
        ? "legacy-client"
        : name === "get_portal_client_markbox" ? "DTD-LEGACY" : null,
      error: null,
    }),
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
        maybeSingle: async () => ({
          data: table === "client_users"
            ? currentMembership
            : table === "clients"
              ? { portal_approved_at: null, cedula_photo_path: null, address: null }
              : null,
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ count: 0, error: null }).then(resolve),
      };
      return chain;
    },
  };
}

function domainOperations() {
  return operations.filter((item) => item.table !== "client_users");
}

beforeEach(() => {
  currentMembership = membership();
  operations = [];
});

describe("SDD0392 · activación y completitud por principal", () => {
  it("principal incoherente corta ambos derivados antes del dominio", async () => {
    currentMembership = membership("tenant-b");
    await getPortalActivation(database() as never);
    await getProfileCompleteness(database() as never);
    expect(domainOperations()).toEqual([]);
  });

  it("activación fija tenant/cliente y tenant/Shipping Mark", async () => {
    await getPortalActivation(database() as never);
    const [client, shipments] = domainOperations();
    expect(client.filters).toEqual(expect.arrayContaining([
      ["id", "client-a"],
      ["tenant_id", "tenant-a"],
      ["deleted_at", null],
    ]));
    expect(shipments.filters).toEqual(expect.arrayContaining([
      ["tenant_id", "tenant-a"],
      ["client_markbox", "DTD-0001"],
      ["deleted_at", null],
    ]));
  });

  it("completitud fija tenant/cliente/Shipping Mark en sus dos lecturas", async () => {
    await getProfileCompleteness(database() as never);
    const [client, addresses] = domainOperations();
    expect(client.filters).toEqual(expect.arrayContaining([
      ["id", "client-a"],
      ["tenant_id", "tenant-a"],
      ["deleted_at", null],
    ]));
    expect(addresses.filters).toEqual(expect.arrayContaining([
      ["tenant_id", "tenant-a"],
      ["client_id", "client-a"],
      ["client_markbox", "DTD-0001"],
      ["deleted_at", null],
    ]));
  });
});
