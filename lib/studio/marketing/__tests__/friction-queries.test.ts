/**
 * Tests de friction-queries (SDD-0119 Slice 1) con un stub de SupabaseClient.
 *
 * Cubre criterios de aceptación:
 *  - listFrictionReports devuelve las filas del tenant.
 *  - Ordena abiertos/en revisión antes que resueltos, y dentro de cada grupo
 *    por created_at descendente (más reciente arriba).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listFrictionReports } from "../friction-queries";
import type { FrictionReport } from "../friction-types";

function makeClient(rows: FrictionReport[]): SupabaseClient {
  return {
    from() {
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      for (const m of ["eq", "order", "limit", "select"]) {
        chain[m] = () => passthrough();
      }
      chain.then = (resolve: (v: Record<string, unknown>) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve);
      return chain;
    },
  } as unknown as SupabaseClient;
}

function report(overrides: Partial<FrictionReport>): FrictionReport {
  return {
    id: "r1",
    tenant_id: "t1",
    reporter_user_id: "u1",
    title: "título",
    description: "descripción",
    status: "open",
    resolved_at: null,
    resolved_by: null,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
    ...overrides,
  };
}

describe("listFrictionReports", () => {
  it("devuelve [] sin reportes", async () => {
    const client = makeClient([]);
    const res = await listFrictionReports(client, "t1");
    expect(res).toEqual([]);
  });

  it("devuelve las filas del tenant", async () => {
    const rows = [
      report({ id: "r1", title: "uno" }),
      report({ id: "r2", title: "dos" }),
    ];
    const client = makeClient(rows);
    const res = await listFrictionReports(client, "t1");
    expect(res).toHaveLength(2);
    expect(res.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
  });

  it("ordena abiertos/en revisión antes que resueltos", async () => {
    const rows = [
      report({
        id: "resolved-old",
        status: "resolved",
        created_at: "2026-07-05T10:00:00Z",
      }),
      report({
        id: "open-early",
        status: "open",
        created_at: "2026-07-01T10:00:00Z",
      }),
      report({
        id: "triaged-mid",
        status: "triaged",
        created_at: "2026-07-03T10:00:00Z",
      }),
    ];
    const client = makeClient(rows);
    const res = await listFrictionReports(client, "t1");
    // Resuelto va al final aunque sea el más reciente; entre los pendientes,
    // el más reciente (triaged 07-03) va antes que el más viejo (open 07-01).
    expect(res.map((r) => r.id)).toEqual([
      "triaged-mid",
      "open-early",
      "resolved-old",
    ]);
  });
});
