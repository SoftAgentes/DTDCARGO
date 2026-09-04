import { beforeEach, describe, expect, it } from "vitest";
import {
  getMyInvoice,
  getMyShipment,
  getNextArrival,
  listMyDocuments,
  listMyInvoices,
  listMyShipments,
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
      data: name === "get_portal_client_markbox" ? "DTD-LEGACY" : null,
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
        neq: (column: string, value: unknown) => {
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
          data: table === "client_users" ? currentMembership : null,
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

function expectPrincipalScope(operation: Operation) {
  expect(operation.filters).toEqual(expect.arrayContaining([
    ["tenant_id", "tenant-a"],
    ["client_markbox", "DTD-0001"],
  ]));
}

beforeEach(() => {
  currentMembership = membership();
  operations = [];
});

describe("SDD0391 · lecturas núcleo Portal por principal y tenant", () => {
  it("principal incoherente corta las seis lecturas antes del dominio", async () => {
    currentMembership = membership("tenant-b");
    const db = database() as never;
    await listMyShipments(db);
    await getMyShipment(db, "SHIP-1");
    await listMyInvoices(db);
    await getMyInvoice(db, "INV-1");
    await listMyDocuments(db);
    await getNextArrival(db);
    expect(domainOperations()).toEqual([]);
  });

  it("lista y detalle de envíos fijan el scope canónico", async () => {
    await listMyShipments(database() as never);
    await getMyShipment(database() as never, "SHIP-1");
    const domain = domainOperations();
    expectPrincipalScope(domain[0]);
    expectPrincipalScope(domain[1]);
    expect(domain[1].filters).toContainEqual(["code", "SHIP-1"]);
  });

  it("lista y detalle de facturas fijan el scope canónico", async () => {
    await listMyInvoices(database() as never);
    await getMyInvoice(database() as never, "INV-1");
    const domain = domainOperations();
    expectPrincipalScope(domain[0]);
    expectPrincipalScope(domain[1]);
    expect(domain[1].filters).toContainEqual(["invoice_code", "INV-1"]);
  });

  it("documentos fijan tenant + Shipping Mark del principal", async () => {
    await listMyDocuments(database() as never);
    expectPrincipalScope(domainOperations()[0]);
  });

  it("próximo arribo fija tenant + Shipping Mark del principal", async () => {
    await getNextArrival(database() as never);
    expectPrincipalScope(domainOperations()[0]);
  });
});
