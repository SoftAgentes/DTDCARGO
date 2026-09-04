import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { listPrealertaDocumentPresence } from "../queries";

type Call = { method: string; args: unknown[] };

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: Call[] = [];
  let page = 0;
  const chain = {
    select(...args: unknown[]) {
      calls.push({ method: "select", args });
      return this;
    },
    in(...args: unknown[]) {
      calls.push({ method: "in", args });
      return this;
    },
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return this;
    },
    is(...args: unknown[]) {
      calls.push({ method: "is", args });
      return this;
    },
    order(...args: unknown[]) {
      calls.push({ method: "order", args });
      return this;
    },
    range(...args: unknown[]) {
      calls.push({ method: "range", args });
      const data = page === 0 ? rows : [];
      page += 1;
      return Promise.resolve({ data, error: null });
    },
  };
  const client = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("listPrealertaDocumentPresence", () => {
  it("resuelve varias compras con un solo lote y sólo columnas de presencia", async () => {
    const { client, calls } = fakeClient([
      { id: "d1", prealerta_id: "p1", doc_type: "packing" },
      { id: "d2", prealerta_id: "p2", doc_type: "foto" },
    ]);

    const result = await listPrealertaDocumentPresence(client, {
      prealertaIds: ["p1", "p2", "p1"],
      tenantId: "tenant-1",
      markbox: "DTD-0001",
    });

    expect(result).toEqual([
      { prealerta_id: "p1", doc_type: "packing" },
      { prealerta_id: "p2", doc_type: "foto" },
    ]);
    expect(calls.filter((call) => call.method === "from")).toHaveLength(2);
    expect(calls.find((call) => call.method === "select")?.args[0]).toBe(
      "id, prealerta_id, doc_type",
    );
    expect(calls.find((call) => call.method === "in")?.args).toEqual([
      "prealerta_id",
      ["p1", "p2"],
    ]);
    expect(calls.find((call) => call.method === "eq")?.args).toEqual([
      "client_markbox",
      "DTD-0001",
    ]);
    expect(calls.some((call) => call.method === "eq"
      && call.args[0] === "tenant_id" && call.args[1] === "tenant-1")).toBe(true);
  });

  it("sin ids no toca Supabase", async () => {
    const { client, calls } = fakeClient([]);
    await expect(
      listPrealertaDocumentPresence(client, {
        prealertaIds: [],
        markbox: "DTD-0001",
      }),
    ).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });

  it("un error de PostgREST degrada a lista vacía", async () => {
    const chain = {
      select() { return this; },
      in() { return this; },
      eq() { return this; },
      is() { return this; },
      order() { return this; },
      range() { return Promise.resolve({ data: null, error: { message: "boom" } }); },
    };
    const client = { from: () => chain } as unknown as SupabaseClient;

    await expect(
      listPrealertaDocumentPresence(client, {
        prealertaIds: ["p1"],
        markbox: "DTD-0001",
      }),
    ).resolves.toEqual([]);
  });

  it("el contexto de envíos consume el query en lote y la página no vuelve al map async", () => {
    const contextSource = readFileSync(
      resolve(
        process.cwd(),
        "lib/portal/shipments-hub-private-context.ts",
      ),
      "utf8",
    );
    const pageSource = readFileSync(
      resolve(process.cwd(), "app/portal/(app)/envios/page.tsx"),
      "utf8",
    );

    expect(contextSource).toContain("listPrealertaDocumentPresence(db");
    expect(pageSource).not.toMatch(/prealertasVivas\.map\(async/);
  });
});
