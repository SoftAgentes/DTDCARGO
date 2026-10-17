// @vitest-environment node
/**
 * SDD-0499 · el rebind del Studio SE CONSERVA, pero hay que demostrarlo.
 *
 * Decisión: el puesto compartido entre personal de almacén es real, y quitar el
 * rebind dejaría al segundo turno sin poder activar el push en su propia
 * máquina. Lo que faltaba era la comprobación — el endpoint llega en el cuerpo,
 * así que conocerlo bastaba para quedarse con la sub de un compañero.
 *
 * `subscribe-boundary.test.ts` cubre la entrada y la identidad con el endpoint
 * LIBRE; este archivo cubre el endpoint OCUPADO, que es donde vive la decisión.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { makePushDouble, type PushDouble } from "@/lib/studio/notify/__tests__/push-tables-double";
import { SYNTHETIC_PUSH_KEYS } from "@/lib/studio/notify/__tests__/push-subscription-fixture";

const PUESTO_EP = "https://fcm.googleapis.com/fcm/send/synthetic-puesto-compartido";
const AUTH_OTRO = Buffer.from("0f0e0d0c0b0a09080706050403020100", "hex").toString("base64url");

let db: PushDouble;

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => db.client }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u-segundo-turno" } } }) },
    from: () => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: { tenant_id: "t-1" }, error: null }),
        upsert: async () => ({ error: null }),
      };
      return chain;
    },
  }),
}));

const { POST } = await import("../subscribe/route");

const req = (body: unknown) =>
  ({ json: async () => body, headers: { get: () => "agente" } }) as never;

describe("POST /api/studio/push/subscribe · rebind con posesión", () => {
  beforeEach(() => {
    db = makePushDouble({
      user_push_subscriptions: [
        {
          endpoint: PUESTO_EP,
          user_id: "u-primer-turno",
          tenant_id: "t-1",
          subscription: { endpoint: PUESTO_EP, keys: { ...SYNTHETIC_PUSH_KEYS } },
        },
      ],
    });
  });

  it("el MISMO puesto (mismas claves) sí re-vincula al de la sesión", async () => {
    const res = await POST(
      req({ subscription: { endpoint: PUESTO_EP, keys: { ...SYNTHETIC_PUSH_KEYS } } }),
    );
    expect(res.status).toBe(200);
    expect(db.tablas.user_push_subscriptions).toHaveLength(1);
    expect(db.tablas.user_push_subscriptions[0].user_id).toBe("u-segundo-turno");
  });

  it("otro que sólo conoce el endpoint → 409 y la sub no cambia de dueño", async () => {
    const res = await POST(
      req({
        subscription: {
          endpoint: PUESTO_EP,
          keys: { p256dh: SYNTHETIC_PUSH_KEYS.p256dh, auth: AUTH_OTRO },
        },
      }),
    );
    expect(res.status).toBe(409);
    expect(db.tablas.user_push_subscriptions).toHaveLength(1);
    expect(db.tablas.user_push_subscriptions[0].user_id).toBe("u-primer-turno");
  });
});
