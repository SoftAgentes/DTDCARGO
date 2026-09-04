import { describe, expect, it } from "vitest";
import {
  getPrealertaByCode,
  listActivePrealertaAddons,
  listPrealertaDocuments,
  listPrealertas,
  listSuppliers,
} from "../queries";

function database(filters: Array<[string, unknown]>) {
  return {
    from: () => {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          filters.push([column, value]);
          return chain;
        },
        order: () => chain,
        range: async () => ({ data: [], error: null }),
        limit: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return chain;
    },
  };
}

describe("SDD0389 · helpers Portal de compras con tenant explícito", () => {
  it("getPrealertaByCode aplica tenant además de código y Shipping Mark", async () => {
    const filters: Array<[string, unknown]> = [];
    await getPrealertaByCode(database(filters) as never, "COMPRA-1", {
      markbox: "DTD-0001",
      tenantId: "tenant-a",
    });
    expect(filters).toEqual(expect.arrayContaining([
      ["code", "COMPRA-1"],
      ["client_markbox", "DTD-0001"],
      ["tenant_id", "tenant-a"],
      ["deleted_at", null],
    ]));
  });

  it("listActivePrealertaAddons aplica tenant antes del límite", async () => {
    const filters: Array<[string, unknown]> = [];
    await listActivePrealertaAddons(database(filters) as never, {
      tenantId: "tenant-a",
    });
    expect(filters).toContainEqual(["tenant_id", "tenant-a"]);
  });

  it.each([
    ["compras", listPrealertas],
    ["proveedores", listSuppliers],
  ] as const)("lista de %s aplica tenant + Shipping Mark", async (_label, query) => {
    const filters: Array<[string, unknown]> = [];
    await query(database(filters) as never, {
      tenantId: "tenant-a",
      markbox: "DTD-0001",
    });
    expect(filters).toEqual(expect.arrayContaining([
      ["tenant_id", "tenant-a"],
      ["client_markbox", "DTD-0001"],
    ]));
  });

  it("adjuntos aplican tenant + compra + Shipping Mark antes de firmarse", async () => {
    const filters: Array<[string, unknown]> = [];
    await listPrealertaDocuments(database(filters) as never, {
      tenantId: "tenant-a",
      prealertaId: "purchase-a",
      markbox: "DTD-0001",
    });
    expect(filters).toEqual(expect.arrayContaining([
      ["tenant_id", "tenant-a"],
      ["prealerta_id", "purchase-a"],
      ["client_markbox", "DTD-0001"],
    ]));
  });
});
