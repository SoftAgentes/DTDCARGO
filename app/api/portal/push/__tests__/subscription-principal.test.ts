import { beforeEach, describe, expect, it, vi } from "vitest";
import { validPushSubscription } from "@/lib/studio/notify/__tests__/push-subscription-fixture";

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

const state = vi.hoisted(() => ({
  userId: "portal-user" as string | null,
  authError: false,
  sessionThrows: false,
  adminThrows: false,
  adminConstructions: 0,
  membership: null as Membership | null,
  writes: [] as Array<{
    op: "upsert" | "delete";
    payload?: Record<string, unknown>;
    filters: Array<[string, unknown]>;
  }>,
}));

function coherent(overrides: Partial<Membership["clients"]> = {}): Membership {
  return {
    client_id: "client-a",
    tenant_id: "tenant-a",
    clients: {
      id: "client-a",
      tenant_id: "tenant-a",
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
      ...overrides,
    },
  };
}

function sessionDatabase() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: state.userId ? { id: state.userId } : null },
        error: state.authError ? { message: "synthetic auth failure" } : null,
      }),
    },
    from() {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: state.membership, error: null }),
      };
      return chain;
    },
  };
}

function adminDatabase() {
  return {
    from() {
      let write: (typeof state.writes)[number] | undefined;
      const chain = {
        delete: () => {
          write = { op: "delete", filters: [] };
          state.writes.push(write);
          return chain;
        },
        eq: (column: string, value: unknown) => {
          write?.filters.push([column, value]);
          return chain;
        },
        upsert: async (payload: Record<string, unknown>) => {
          state.writes.push({ op: "upsert", payload, filters: [] });
          return { error: null };
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    if (state.sessionThrows) throw new Error("synthetic session transport");
    return sessionDatabase();
  },
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    state.adminConstructions += 1;
    if (state.adminThrows) throw new Error("synthetic admin transport");
    return adminDatabase();
  },
}));

import { POST as subscribe } from "../subscribe/route";
import { POST as unsubscribe } from "../unsubscribe/route";

function request(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => "synthetic-agent" },
  } as never;
}

beforeEach(() => {
  state.userId = "portal-user";
  state.authError = false;
  state.sessionThrows = false;
  state.adminThrows = false;
  state.adminConstructions = 0;
  state.membership = coherent();
  state.writes.length = 0;
});

describe("SDD0386 · Web Push Portal por principal coherente", () => {
  it.each([
    ["tenant cruzado", () => coherent({ tenant_id: "tenant-b" })],
    ["cliente retirado", () => coherent({ deleted_at: "2026-09-03T00:00:00Z" })],
  ])("subscribe bloquea %s antes de elevar", async (_label, membership) => {
    state.membership = membership();
    const response = await subscribe(request(validPushSubscription("blocked")));
    expect(response.status).toBe(403);
    expect(state.adminConstructions).toBe(0);
    expect(state.writes).toEqual([]);
  });

  it("unsubscribe exige el mismo principal Portal coherente", async () => {
    state.membership = coherent({ tenant_id: "tenant-b" });
    const response = await unsubscribe(request({ endpoint: validPushSubscription("old").endpoint }));
    expect(response.status).toBe(403);
    expect(state.adminConstructions).toBe(0);
    expect(state.writes).toEqual([]);
  });

  it.each(["auth-error", "session-transport"])("%s falla controlado sin elevar", async (mode) => {
    state.authError = mode === "auth-error";
    state.sessionThrows = mode === "session-transport";
    const response = await subscribe(request(validPushSubscription(mode)));
    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(response.status).toBeLessThan(500);
    expect(state.adminConstructions).toBe(0);
    expect(state.writes).toEqual([]);
  });

  it("alta válida deriva user y tenant sólo del principal", async () => {
    const sub = validPushSubscription("valid");
    const response = await subscribe(request({
      ...sub,
      user_id: "attacker",
      tenant_id: "foreign",
    }));
    expect(response.status).toBe(200);
    expect(state.writes).toEqual([
      expect.objectContaining({
        op: "upsert",
        payload: expect.objectContaining({
          tenant_id: "tenant-a",
          user_id: "portal-user",
          endpoint: sub.endpoint,
        }),
      }),
    ]);
  });

  it("baja válida conserva endpoint + usuario y no confía en ids del body", async () => {
    const endpoint = validPushSubscription("old").endpoint;
    const response = await unsubscribe(request({ endpoint, user_id: "attacker" }));
    expect(response.status).toBe(200);
    expect(state.writes).toEqual([
      { op: "delete", filters: [["endpoint", endpoint], ["user_id", "portal-user"]] },
    ]);
  });

  it.each([
    ["subscribe", subscribe, validPushSubscription("admin-error")],
    ["unsubscribe", unsubscribe, { endpoint: validPushSubscription("old").endpoint }],
  ])("%s contiene fallo al construir admin", async (_name, route, body) => {
    state.adminThrows = true;
    const response = await route(request(body));
    expect(response.status).toBe(500);
    expect(state.writes).toEqual([]);
  });
});
