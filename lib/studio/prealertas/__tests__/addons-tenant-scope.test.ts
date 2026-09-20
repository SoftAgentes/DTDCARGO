// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mergePrealertaAddons } from "../addons";
import { listActivePrealertaAddons } from "../queries";

type Call = [string, ...unknown[]];

function database(calls: Call[]) {
  const chain = {
    select: (...args: unknown[]) => {
      calls.push(["select", ...args]);
      return chain;
    },
    eq: (column: string, value: unknown) => {
      calls.push(["eq", column, value]);
      return chain;
    },
    limit: async (count: number) => {
      calls.push(["limit", count]);
      return { data: [], error: null };
    },
  };
  return {
    from: (table: string) => {
      calls.push(["from", table]);
      return chain;
    },
  };
}

describe("SDD-0402 · catálogo de add-ons Portal con tenant del principal", () => {
  it("aplica el tenant antes del límite", async () => {
    const calls: Call[] = [];
    await listActivePrealertaAddons(database(calls) as never, {
      tenantId: "tenant-a",
    });
    expect(calls).toEqual([
      ["from", "prealerta_addons"],
      ["select", expect.any(String)],
      ["eq", "tenant_id", "tenant-a"],
      ["limit", 50],
    ]);
  });

  it("sin tenant conserva la consulta histórica de los otros callers", async () => {
    const calls: Call[] = [];
    await listActivePrealertaAddons(database(calls) as never);
    expect(calls.filter(([kind]) => kind === "eq")).toEqual([]);
  });

  it("un fallo de lectura conserva el respaldo de defaults activos", async () => {
    const failing = {
      from: () => {
        throw new Error("sin conexión");
      },
    };
    await expect(
      listActivePrealertaAddons(failing as never, { tenantId: "tenant-a" }),
    ).resolves.toEqual(mergePrealertaAddons([]).filter((a) => a.isActive));
  });
});
