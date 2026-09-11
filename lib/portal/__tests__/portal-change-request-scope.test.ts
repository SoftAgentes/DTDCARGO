// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPortalChangeRequestSnapshot, listResolvedChangeRequests } from "../change-request-queries";
import { getPortalClientPrincipal } from "../portal-queries";

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

function fixture(options: {
  member?: Row | null;
  queryError?: boolean | "open" | "resolved";
  queryThrows?: boolean;
  requests?: Row[];
} = {}) {
  const touched: string[] = [];
  const rowsByTable: Record<string, Row[]> = {
    client_users: options.member === null ? [] : [options.member ?? membership],
    client_change_requests: options.requests ?? [
      request("own-open"),
      request("wrong-tenant", { tenant_id: OTHER_TENANT }),
      request("wrong-client", { client_id: "otro-cliente" }),
      request("admin-trace", { source: "admin" }),
      request("own-resolved", {
        status: "rejected", reviewed_at: "2026-09-02T00:00:00Z", review_note: "Sintética",
      }),
      request("newer-admin-trace", {
        source: "admin", status: "approved", reviewed_at: "2026-09-03T00:00:00Z",
      }),
      request("newer-wrong-tenant", {
        tenant_id: OTHER_TENANT, status: "approved", reviewed_at: "2026-09-04T00:00:00Z",
      }),
      request("newer-wrong-client", {
        client_id: "otro-cliente", status: "approved", reviewed_at: "2026-09-04T00:00:00Z",
      }),
      request("older-own-resolved", {
        status: "approved", reviewed_at: "2026-09-01T00:00:00Z",
      }),
      request("newer-unknown-status", {
        status: "unknown", reviewed_at: "2026-09-05T00:00:00Z",
      }),
    ],
  };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: USER } }, error: null }) },
    from(table: string) {
      touched.push(table);
      if (options.queryThrows && table === "client_change_requests") {
        throw new Error("synthetic request transport");
      }
      let rows = [...(rowsByTable[table] ?? [])];
      let maximum = Infinity;
      let signal: "open" | "resolved" | null = null;
      const result = () => ({
        data: rows.slice(0, maximum),
        error: table === "client_change_requests" &&
          (options.queryError === true || options.queryError === signal)
          ? new Error("synthetic") : null,
      });
      const builder = {
        select: () => builder,
        eq(key: string, value: unknown) {
          if (key === "status" && value === "pending") signal = "open";
          rows = rows.filter(row => row[key] === value);
          return builder;
        },
        in(key: string, values: unknown[]) {
          if (key === "status") signal = "resolved";
          rows = rows.filter(row => values.includes(row[key]));
          return builder;
        },
        order(key: string, sort: { ascending: boolean }) {
          rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (sort.ascending ? 1 : -1));
          return builder;
        },
        limit(value: number) { maximum = value; return builder; },
        maybeSingle: async () => {
          const reply = result();
          return { ...reply, data: reply.data.length === 1 ? reply.data[0] : null };
        },
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { db, touched };
}

describe("SDD0382 · solicitudes de cambio del Portal", () => {
  it("excluye otro cliente/tenant, trazas administrativas y estados ajenos aunque la RLS esté ampliada", async () => {
    const { db } = fixture();
    const snapshot = await getPortalChangeRequestSnapshot(db);
    expect(snapshot.open?.id).toBe("own-open");
    expect(snapshot.lastResolved?.id).toBe("own-resolved");
    expect(snapshot.lastResolved).toMatchObject({
      tenantId: TENANT, clientId: CLIENT, source: "client",
      status: "rejected", reviewNote: "Sintética",
    });
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

  it.each(["open", "resolved"] as const)("un error de %s conserva la otra señal válida", async queryError => {
    const { db } = fixture({ queryError });
    const snapshot = await getPortalChangeRequestSnapshot(db);
    expect(snapshot.open?.id ?? null).toBe(queryError === "open" ? null : "own-open");
    expect(snapshot.lastResolved?.id ?? null).toBe(queryError === "resolved" ? null : "own-resolved");
  });

  it("un fallo de transporte no entrega solicitudes", async () => {
    const { db } = fixture({ queryThrows: true });
    await expect(getPortalChangeRequestSnapshot(db)).resolves.toEqual({ open: null, lastResolved: null });
  });

  it.each([
    { label: "sin vínculo", member: null },
    { label: "vínculo inactivo", member: { ...membership, status: "inactive" } },
    { label: "cliente retirado", member: { ...membership, clients: { ...profile, deleted_at: "2026-09-03T00:00:00Z" } } },
  ])("$label corta antes de consultar solicitudes", async ({ member }) => {
    const { db, touched } = fixture({ member });
    expect(await getPortalChangeRequestSnapshot(db)).toEqual({ open: null, lastResolved: null });
    expect(touched).not.toContain("client_change_requests");
  });

  it("reutiliza el principal resuelto por la página sin relajar el ámbito", async () => {
    const { db, touched } = fixture();
    const principal = await getPortalClientPrincipal(db);
    expect(principal).not.toBeNull();
    if (!principal) throw new Error("El fixture debe resolver un principal válido");
    const snapshot = await getPortalChangeRequestSnapshot(db, principal);
    expect(snapshot.open?.id).toBe("own-open");
    expect(snapshot.lastResolved?.id).toBe("own-resolved");
    expect(touched.filter(table => table === "client_users")).toHaveLength(1);
  });

  it("un cliente sin solicitudes recibe las dos señales vacías", async () => {
    const { db } = fixture({ requests: [] });
    expect(await getPortalChangeRequestSnapshot(db)).toEqual({ open: null, lastResolved: null });
  });

  it("la lectura genérica del historial Studio conserva trazas administrativas", async () => {
    const { db, touched } = fixture({ requests: [
      request("own-resolved", { status: "rejected", reviewed_at: "2026-09-02T00:00:00Z" }),
      request("admin-trace", { source: "admin", status: "approved", reviewed_at: "2026-09-03T00:00:00Z" }),
    ] });
    const rows = await listResolvedChangeRequests(db, CLIENT);
    expect(rows.map(row => [row.id, row.source])).toEqual([
      ["admin-trace", "admin"], ["own-resolved", "client"],
    ]);
    expect(touched).not.toContain("client_users");
  });
});
