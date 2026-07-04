/**
 * SDD-0146 Fase 5 · /api/studio/push/subscribe — identidad SOLO de la sesión.
 *
 * Criterio de aceptación: un POST con un user_id AJENO en el body → la sub queda
 * del user de la SESIÓN (el body jamás decide la identidad). Se mockean los
 * clientes de DB; se inspecciona el payload que se inserta en user_push_subscriptions.
 */
import { describe, it, expect, vi } from "vitest";

const insertedRows: Array<Record<string, unknown>> = [];

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "session-user" } } }),
    },
    from(table: string) {
      if (table === "user_tenants") {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({ data: { tenant_id: "t-session" }, error: null }),
        };
        return chain;
      }
      // user_notification_prefs.upsert(...)
      return { upsert: async () => ({ error: null }) };
    },
  }),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from() {
      const chain: Record<string, unknown> = {
        delete: () => chain,
        eq: async () => ({ error: null }),
        insert: async (payload: Record<string, unknown>) => {
          insertedRows.push(payload);
          return { error: null };
        },
      };
      return chain;
    },
  }),
}));

import { POST } from "../subscribe/route";

function makeReq(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => "test-agent" },
  } as never;
}

describe("POST /api/studio/push/subscribe · identidad de la sesión", () => {
  it("ignora el user_id del body: la sub queda del user de la sesión", async () => {
    insertedRows.length = 0;
    const res = await POST(
      makeReq({
        user_id: "attacker-user",
        subscription: {
          endpoint: "https://push/x",
          keys: { p256dh: "p", auth: "a" },
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].user_id).toBe("session-user");
    expect(insertedRows[0].user_id).not.toBe("attacker-user");
    // tenant_id también server-side (nunca del body).
    expect(insertedRows[0].tenant_id).toBe("t-session");
  });

  it("subscription inválida → 400 (sin insertar)", async () => {
    insertedRows.length = 0;
    const res = await POST(makeReq({ subscription: { endpoint: 123 } }));
    expect(res.status).toBe(400);
    expect(insertedRows).toHaveLength(0);
  });
});
