import { beforeEach, describe, expect, it, vi } from "vitest";
import { INVALID_PUSH_ENDPOINTS, SYNTHETIC_PUSH_KEYS, validPushSubscription } from "@/lib/studio/notify/__tests__/push-subscription-fixture";

const state = vi.hoisted(() => ({
  user: { id: "session-user" } as { id: string } | null,
  operario: { operario_id: "session-operario", tenant_id: "tenant-operario" } as { operario_id: string; tenant_id: string } | null,
  tenant: "tenant-session" as string | null,
  portalTenant: "tenant-portal" as string | null,
  writes: [] as Array<{ table: string; op: string; payload?: unknown; options?: unknown; filters: Array<[string, unknown]> }>,
}));

function database() {
  return {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from(table: string) {
      let write: (typeof state.writes)[number] | undefined;
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => { write?.filters.push([column, value]); return chain; },
        is: () => chain,
        in: (column: string, value: unknown) => { write?.filters.push([column, value]); return chain; },
        limit: () => chain,
        maybeSingle: async () => ({ data: { tenant_id: table === "client_users" ? state.portalTenant : state.tenant }, error: null }),
        delete: () => {
          write = { table, op: "delete", filters: [] }; state.writes.push(write); return chain;
        },
        insert: async (payload: unknown) => {
          state.writes.push({ table, op: "insert", payload, filters: [] }); return { error: null };
        },
        upsert: async (payload: unknown, options?: unknown) => {
          state.writes.push({ table, op: "upsert", payload, options, filters: [] }); return { error: null };
        },
        then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve, reject),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => database() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => database() }));
vi.mock("@/lib/auth/operario-session", () => ({ getCurrentOperario: async () => state.operario }));

import { POST as portalPOST } from "@/app/api/portal/push/subscribe/route";
import { POST as studioPOST } from "@/app/api/studio/push/subscribe/route";
import { POST as mobilePOST } from "@/app/api/m/push/subscribe/route";
import { POST as resubscribePOST } from "@/app/api/m/push/resubscribe/route";

function request(body: unknown) {
  return { json: async () => body, headers: { get: () => "synthetic-agent" } } as never;
}

const routes = [
  { name: "Portal crudo", post: portalPOST, wrap: (subscription: unknown) => subscription, status: 422 },
  { name: "Portal envuelto", post: portalPOST, wrap: (subscription: unknown) => ({ subscription }), status: 422 },
  { name: "Studio envuelto", post: studioPOST, wrap: (subscription: unknown) => ({ subscription }), status: 400 },
  { name: "Móvil crudo", post: mobilePOST, wrap: (subscription: unknown) => subscription, status: 422 },
  { name: "Resubscribe envuelto", post: resubscribePOST, wrap: (subscription: unknown) => ({ subscription }), status: 422 },
];

const invalidStructures: Array<[string, unknown]> = [
  ["null", null], ["array", []], ["número", 4], ["string", "invalid"],
  ["vacío", {}], ["endpoint número", { ...validPushSubscription(), endpoint: 123 }],
  ["keys null", { ...validPushSubscription(), keys: null }],
  ["keys array", { ...validPushSubscription(), keys: [] }],
  ["p256dh tipo inválido", { ...validPushSubscription(), keys: { ...SYNTHETIC_PUSH_KEYS, p256dh: 123 } }],
  ["p256dh corto", { ...validPushSubscription(), keys: { ...SYNTHETIC_PUSH_KEYS, p256dh: "p" } }],
  ["auth corto", { ...validPushSubscription(), keys: { ...SYNTHETIC_PUSH_KEYS, auth: "a" } }],
  ["expiration negativa", { ...validPushSubscription(), expirationTime: -1 }],
  ["expiration string", { ...validPushSubscription(), expirationTime: "100" }],
];

beforeEach(() => {
  state.user = { id: "session-user" };
  state.operario = { operario_id: "session-operario", tenant_id: "tenant-operario" };
  state.tenant = "tenant-session";
  state.portalTenant = "tenant-portal";
  state.writes.length = 0;
});

describe.each(routes)("$name · valida antes de cualquier escritura", ({ post, wrap, status }) => {
  it.each(INVALID_PUSH_ENDPOINTS)("rechaza %s sin guardar ni borrar endpoints", async (_case, endpoint) => {
    const response = await post(request(wrap({ ...validPushSubscription(), endpoint })));
    expect(response.status).toBe(status);
    expect(state.writes).toEqual([]);
  });

  it.each(invalidStructures)("rechaza estructura %s sin excepción ni mutación", async (_case, value) => {
    const response = await post(request(wrap(value)));
    expect(response.status).toBe(status);
    expect(state.writes).toEqual([]);
  });

  it("acepta una suscripción válida y no persiste extras del payload", async () => {
    const subscription = validPushSubscription("route");
    const response = await post(request(wrap({
      ...subscription, expirationTime: null, attacker_blob: "x".repeat(20000),
      user_id: "attacker", tenant_id: "foreign", keys: { ...subscription.keys, unexpected: "secret" },
    })));
    expect(response.status).toBe(200);
    const stored = state.writes.find((write) => write.op === "insert" || write.op === "upsert")?.payload as Record<string, unknown>;
    expect(stored).toBeDefined();
    expect(JSON.stringify(stored)).not.toContain("attacker");
    expect(JSON.stringify(stored)).not.toContain("unexpected");
    if (stored.subscription) {
      expect(stored.subscription).toEqual({ ...subscription, expirationTime: null });
    } else {
      expect(stored.endpoint).toBe(subscription.endpoint);
      expect(stored.p256dh).toBe(subscription.keys.p256dh);
      expect(stored.auth).toBe(subscription.keys.auth);
    }
  });
});

describe("Push POST · identidad y compatibilidad", () => {
  it.each([
    ["Portal", portalPOST], ["Studio", studioPOST],
    ["Móvil", mobilePOST], ["Resubscribe", resubscribePOST],
  ] as const)("%s tolera JSON null con respuesta4xx y ninguna mutación", async (_name, post) => {
    const response = await post(request(null));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(state.writes).toEqual([]);
  });

  it("Portal obtiene user y tenant de sesión y conserva upsert por endpoint", async () => {
    await portalPOST(request({ ...validPushSubscription(), user_id: "attacker", tenant_id: "foreign" }));
    expect(state.writes).toEqual([expect.objectContaining({
      table: "user_push_subscriptions", op: "upsert", options: { onConflict: "endpoint" },
      payload: expect.objectContaining({ user_id: "session-user", tenant_id: "tenant-portal" }),
    })]);
  });

  it("Studio conserva rebind antes de insertar y activa channel_push de la sesión", async () => {
    const subscription = validPushSubscription("studio");
    await studioPOST(request({ subscription, user_id: "attacker", tenant_id: "foreign" }));
    expect(state.writes.map((write) => [write.table, write.op])).toEqual([
      ["user_push_subscriptions", "delete"], ["user_push_subscriptions", "insert"], ["user_notification_prefs", "upsert"],
    ]);
    expect(state.writes[0].filters).toContainEqual(["endpoint", subscription.endpoint]);
    expect(state.writes[1].payload).toEqual(expect.objectContaining({ user_id: "session-user", tenant_id: "tenant-session" }));
    expect(state.writes[2].payload).toEqual(expect.objectContaining({ user_id: "session-user", channel_push: true }));
  });

  it("Móvil conserva identidad PIN y reinicia failure_count al suscribir", async () => {
    await mobilePOST(request({ ...validPushSubscription(), operario_id: "attacker", tenant_id: "foreign" }));
    expect(state.writes[0]).toEqual(expect.objectContaining({ table: "operario_push_subscriptions", op: "upsert",
      payload: expect.objectContaining({ operario_id: "session-operario", tenant_id: "tenant-operario", failure_count: 0 }),
    }));
  });

  it.each(["operario", "staff"])("Resubscribe conserva rotación e identidad de %s", async (kind) => {
    if (kind === "staff") state.operario = null;
    const subscription = validPushSubscription("new");
    const oldEndpoint = validPushSubscription("old").endpoint;
    const response = await resubscribePOST(request({ subscription, old_endpoint: oldEndpoint, user_id: "attacker", operario_id: "attacker" }));
    expect(response.status).toBe(200);
    expect(state.writes[0].op).toBe("delete");
    expect(JSON.stringify(state.writes[0].filters)).toContain(oldEndpoint);
    expect(state.writes[1].payload).toEqual(expect.objectContaining(kind === "staff"
      ? { user_id: "session-user", tenant_id: "tenant-session" }
      : { operario_id: "session-operario", tenant_id: "tenant-operario" }));
  });

  it.each(routes)("$name rechaza sesión ausente sin mutación", async ({ post, wrap }) => {
    state.user = null; state.operario = null;
    const response = await post(request(wrap(validPushSubscription())));
    expect(response.status).toBe(401);
    expect(state.writes).toEqual([]);
  });

  it.each([
    ["Portal", portalPOST], ["Studio", studioPOST], ["Resubscribe", resubscribePOST],
  ] as const)("%s no escribe sin vínculo/tenant activo", async (_name, post) => {
    state.operario = null; state.tenant = null; state.portalTenant = null;
    const response = await post(request({ subscription: validPushSubscription() }));
    expect(response.status).toBe(403);
    expect(state.writes).toEqual([]);
  });
});
