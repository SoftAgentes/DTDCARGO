// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listDeletedComments } from "../lifecycle-queries";

function makeClient(rows: unknown[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "not", "order", "limit", "or"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return {
    client: {
      from: vi.fn(() => chain),
    } as unknown as SupabaseClient,
    calls,
  };
}

describe("listDeletedComments", () => {
  it("usa orden keyset, resuelve autor y conserva metadata legacy nula", async () => {
    const { client, calls } = makeClient([
      {
        id: "10000000-0000-4000-8000-000000000001",
        tenant_id: "t1",
        entity_type: "shipment",
        entity_id: "s1",
        entity_code: "DTDU-1",
        author_id: "u1",
        body: "Contenido",
        parent_id: null,
        edited_at: null,
        created_at: "2026-07-01T00:00:00Z",
        deleted_at: "2026-07-20T00:00:00Z",
        deleted_by: null,
        deletion_mode: null,
        deletion_reason: null,
        lifecycle_correlation_id: null,
        last_lifecycle_operation_id: null,
        lifecycle_contract_version: null,
      },
    ]);

    const page = await listDeletedComments(
      client,
      "shipment",
      "s1",
      [{ id: "u1", name: "Ana Pérez", avatar: "AP", role: "Admin" }],
      {
        deletedAt: "2026-07-21T00:00:00Z",
        id: "20000000-0000-4000-8000-000000000002",
      },
      Date.parse("2026-07-23T00:00:00Z"),
    );

    expect(page.comments[0]).toMatchObject({
      author: { name: "Ana Pérez" },
      deleted_by: null,
      lifecycleState: "deleted_restorable",
    });
    expect(calls.filter(([method]) => method === "order")).toEqual([
      ["order", "deleted_at", { ascending: false }],
      ["order", "id", { ascending: false }],
    ]);
    expect(calls.some(([method]) => method === "or")).toBe(true);
  });
});
