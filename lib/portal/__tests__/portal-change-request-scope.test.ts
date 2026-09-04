// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPortalChangeRequestSnapshot } from "../change-request-queries";

type Row = Record<string, unknown>;
const USER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_TENANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const profile: Row = {
  id: CLIENT, tenant_id: TENANT, markbox: "DTD-SYNTHETIC",
  name: "Cliente sintético", email: null, phone: null, address: null,
  rif: null, doc_kind: "empresa", city: null, state: null, deleted_at: null,
};
const membership: Row = {
  auth_user_id: USER, status: "active", client_id: CLIENT,
  tenant_id: TENANT, clients: profile,
};
function request(id: string, over: Row = {}): Row {
  return {
    id, tenant_id: TENANT, client_id: CLIENT, proposed_name: "Sintético",
    proposed_rif: null, proposed_phone: null, prev_name: "Anterior",
    prev_rif: null, prev_phone: null, status: "pending", source: "client",
    submitted_at: "2026-09-01T00:00:00Z", reviewed_at: null,
    reviewed_by: null, review_note: null, ...over,
  };
}

function fixture(options: { member?: Row | null; queryError?: boolean } = {}) {
  const touched: string[] = [];
  const rowsByTable: Record<string, Row[]> = {
    client_users: options.member === null ? [] : [options.member ?? membership],
    client_change_requests: [
      request("own-open"),
      request("wrong-tenant", { tenant_id: OTHER_TENANT }),
      request("admin-trace", { source: "admin" }),
      request("own-resolved", {
        status: "rejected", reviewed_at: "2026-09-02T00:00:00Z", review_note: "Sintética",
      }),
      request("newer-admin-trace", {
        source: "admin", status: "approved", reviewed_at: "2026-09-03T00:00:00Z",
      }),
    ],
  };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: USER } }, error: null }) },
    from(table: string) {
      touched.push(table);
      let rows = [...(rowsByTable[table] ?? [])];
      let maximum = Infinity;
      const result = () => ({
        data: rows.slice(0, maximum),
        error: options.queryError && table === "client_change_requests" ? new Error("synthetic") : null,
      });
      const builder = {
        select: () => builder,
        eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return builder; },
        in(key: string, values: unknown[]) { rows = rows.filter(row => values.includes(row[key])); return builder; },
        order(key: string, sort: { ascending: boolean }) {
          rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (sort.ascending ? 1 : -1));
          return builder;
        },
        limit(value: number) { maximum = value; return builder; },
        maybeSingle: async () => ({ ...result(), data: rows.length === 1 ? rows[0] : null }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { db, touched };
}

describe("SDD0382 · solicitudes de cambio del Portal", () => {
  it("excluye tenant incoherente y trazas administrativas aunque la RLS esté ampliada", async () => {
    const { db } = fixture();
    const snapshot = await getPortalChangeRequestSnapshot(db);
    expect(snapshot.open?.id).toBe("own-open");
    expect(snapshot.lastResolved?.id).toBe("own-resolved");
  });

  it("sin principal coherente no consulta solicitudes", async () => {
    const { db, touched } = fixture({
      member: { ...membership, tenant_id: OTHER_TENANT },
    });
    expect(await getPortalChangeRequestSnapshot(db)).toEqual({ open: null, lastResolved: null });
    expect(touched).not.toContain("client_change_requests");
  });

  it("un error de lectura degrada ambas señales a null", async () => {
    const { db } = fixture({ queryError: true });
    expect(await getPortalChangeRequestSnapshot(db)).toEqual({ open: null, lastResolved: null });
  });
});
