import { beforeEach, describe, expect, it } from "vitest";
import { listMyInvoiceReports } from "../payment-report-queries";
import {
  listMyRecentActivity,
  listMyShipmentEvents,
} from "../shipment-events-queries";

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

function expectEventScope(operation: Operation) {
  expect(operation.filters).toEqual(expect.arrayContaining([
    ["tenant_id", "tenant-a"],
    ["shipments.tenant_id", "tenant-a"],
    ["shipments.client_markbox", "DTD-0001"],
  ]));
}

beforeEach(() => {
  currentMembership = membership();
  operations = [];
});

describe("SDD0390 · lecturas Portal por principal y tenant", () => {
  it("principal incoherente corta pagos y eventos antes del dominio", async () => {
    currentMembership = membership("tenant-b");
    await expect(listMyInvoiceReports(database() as never, "INV-1")).resolves.toBeNull();
    await expect(listMyShipmentEvents(database() as never, "ship-1")).resolves.toEqual([]);
    await expect(listMyRecentActivity(database() as never)).resolves.toEqual([]);
    expect(domainOperations()).toEqual([]);
  });

  it("reportes fijan tenant + Shipping Mark del principal", async () => {
    await listMyInvoiceReports(database() as never, "INV-1");
    const report = domainOperations()[0];
    expect(report.filters).toEqual(expect.arrayContaining([
      ["tenant_id", "tenant-a"],
      ["client_markbox", "DTD-0001"],
      ["invoice_code", "INV-1"],
    ]));
  });

  it("hitos fijan tenant del evento/envío + Shipping Mark", async () => {
    await listMyShipmentEvents(database() as never, "ship-1");
    expectEventScope(domainOperations()[0]);
  });

  it("actividad reciente fija el mismo scope canónico", async () => {
    await listMyRecentActivity(database() as never, 4);
    expectEventScope(domainOperations()[0]);
  });
});
