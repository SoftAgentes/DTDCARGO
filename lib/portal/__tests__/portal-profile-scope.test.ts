// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPortalClient } from "../portal-queries";

type Row = Record<string, unknown>;
const USER = "11111111-1111-4111-8111-111111111111";
const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const CLIENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function client(id: string, tenantId: string, deletedAt: string | null = null): Row {
  return {
    id,
    tenant_id: tenantId,
    markbox: id === CLIENT_A ? "DTD-A" : "DTD-B",
    name: id === CLIENT_A ? "Cliente sintético A" : "Cliente sintético B",
    email: null,
    phone: null,
    address: null,
    rif: null,
    doc_kind: "empresa",
    city: null,
    state: null,
    deleted_at: deletedAt,
  };
}

function fixture(options: {
  membership?: Row | null;
  authUser?: string | null;
  clientRow?: Row;
  throwsAt?: "auth" | "membership";
}) {
  const row = options.clientRow ?? client(CLIENT_A, TENANT_A);
  const membership = options.membership === undefined
    ? { auth_user_id: USER, status: "active", client_id: CLIENT_A, tenant_id: TENANT_A, clients: row }
    : options.membership;
  const touched: string[] = [];
  const db = {
    auth: { getUser: async () => {
      if (options.throwsAt === "auth") throw new Error("synthetic auth transport");
      return {
        data: { user: options.authUser === null ? null : { id: options.authUser ?? USER } },
        error: null,
      };
    } },
    rpc: async (name: string) => ({
      data: name === "get_portal_client_id" && membership
        ? membership.client_id as string
        : null,
      error: null,
    }),
    from(table: string) {
      touched.push(table);
      if (options.throwsAt === "membership") throw new Error("synthetic query transport");
      let rows: Row[] = table === "client_users"
        ? (membership ? [membership] : [])
        : table === "clients" ? [row] : [];
      const result = () => ({ data: rows.length === 1 ? rows[0] : null, error: null });
      const builder = {
        select: () => builder,
        eq(key: string, value: unknown) {
          rows = rows.filter(candidate => candidate[key] === value);
          return builder;
        },
        maybeSingle: async () => result(),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { db, touched };
}

describe("SDD0382 · principal del perfil Portal", () => {
  it("rechaza un vínculo activo cuyo tenant no coincide con el cliente", async () => {
    const foreign = client(CLIENT_B, TENANT_B);
    const { db } = fixture({
      clientRow: foreign,
      membership: {
        auth_user_id: USER,
        status: "active",
        client_id: CLIENT_B,
        tenant_id: TENANT_A,
        clients: foreign,
      },
    });
    expect(await getPortalClient(db)).toBeNull();
  });

  it("rechaza un cliente retirado aunque otro rol amplíe la RLS", async () => {
    const retired = client(CLIENT_A, TENANT_A, "2026-09-03T00:00:00Z");
    const { db } = fixture({
      clientRow: retired,
      membership: {
        auth_user_id: USER,
        status: "active",
        client_id: CLIENT_A,
        tenant_id: TENANT_A,
        clients: retired,
      },
    });
    expect(await getPortalClient(db)).toBeNull();
  });

  it("no confía en una RPC de identidad cuando la sesión está ausente", async () => {
    const { db } = fixture({ authUser: null });
    expect(await getPortalClient(db)).toBeNull();
  });

  it.each(["auth", "membership"] as const)(
    "falla cerrado si %s lanza una excepción de transporte",
    async throwsAt => {
      const { db } = fixture({ throwsAt });
      await expect(getPortalClient(db)).resolves.toBeNull();
    },
  );
});
