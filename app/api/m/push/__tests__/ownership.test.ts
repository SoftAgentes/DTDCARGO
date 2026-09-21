// @vitest-environment node
/**
 * SDD-0499 · nadie apaga las notificaciones de otro conociendo su endpoint.
 *
 * Dos defectos distintos de la misma familia, en `m/push/subscribe` y
 * `m/push/resubscribe`:
 *
 *   1. `delete().eq("endpoint", old_endpoint)` con el admin client, sin acotar a
 *      quién llama. El hermano `m/push/unsubscribe:33` ya lo hacía bien.
 *   2. `upsert(onConflict:"endpoint")`, que re-asigna la fila del otro al que
 *      llama. Documentado como deliberado ("móvil compartido"), pero que fuera
 *      el mismo móvil no se comprobaba.
 *
 * La aserción es el estado de la tabla: la fila de la víctima tiene que seguir
 * ahí, con su dueño intacto.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { makePushDouble, type PushDouble } from "@/lib/studio/notify/__tests__/push-tables-double";
import {
  SYNTHETIC_PUSH_KEYS,
  validPushSubscription,
} from "@/lib/studio/notify/__tests__/push-subscription-fixture";

const VICTIMA_EP = "https://fcm.googleapis.com/fcm/send/synthetic-victima";
const AUTH_OTRO = Buffer.from("0f0e0d0c0b0a09080706050403020100", "hex").toString("base64url");

let db: PushDouble;
/** Operario de la sesión, o null para caer a la rama de user staff. */
let operario: { tenant_id: string; operario_id: string } | null = null;
let userStaff: string | null = null;

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => db.client }));
vi.mock("@/lib/auth/operario-session", () => ({
  getCurrentOperario: async () => operario,
}));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: userStaff ? { id: userStaff } : null } }) },
    from: () => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: { tenant_id: "t-1" }, error: null }),
      };
      return chain;
    },
  }),
}));

const { POST: SUBSCRIBE } = await import("../subscribe/route");
const { POST: RESUBSCRIBE } = await import("../resubscribe/route");

function req(body: unknown) {
  return { json: async () => body, headers: { get: () => "agente-de-prueba" } } as never;
}

/** Sub que el atacante presenta: el endpoint de la víctima, claves propias. */
const subRobada = {
  endpoint: VICTIMA_EP,
  keys: { p256dh: SYNTHETIC_PUSH_KEYS.p256dh, auth: AUTH_OTRO },
};
/** La misma que ya tiene la víctima: es lo que presenta un móvil compartido. */
const subCompartida = { endpoint: VICTIMA_EP, keys: { ...SYNTHETIC_PUSH_KEYS } };

describe("POST /api/m/push/subscribe · el móvil compartido hay que demostrarlo", () => {
  beforeEach(() => {
    operario = { tenant_id: "t-1", operario_id: "op-atacante" };
    userStaff = null;
    db = makePushDouble({
      operario_push_subscriptions: [
        { endpoint: VICTIMA_EP, operario_id: "op-victima", auth: SYNTHETIC_PUSH_KEYS.auth },
      ],
      user_push_subscriptions: [],
    });
  });

  it("otro operario sin las claves → 409 y la sub sigue siendo de la víctima", async () => {
    const res = await SUBSCRIBE(req(subRobada));
    expect(res.status).toBe(409);
    expect(db.tablas.operario_push_subscriptions).toHaveLength(1);
    expect(db.tablas.operario_push_subscriptions[0].operario_id).toBe("op-victima");
  });

  it("el mismo móvil (mismas claves) sí re-asigna", async () => {
    const res = await SUBSCRIBE(req(subCompartida));
    expect(res.status).toBe(200);
    expect(db.tablas.operario_push_subscriptions[0].operario_id).toBe("op-atacante");
  });
});

describe("POST /api/m/push/resubscribe · operario", () => {
  beforeEach(() => {
    operario = { tenant_id: "t-1", operario_id: "op-atacante" };
    userStaff = null;
    db = makePushDouble({
      operario_push_subscriptions: [
        { endpoint: VICTIMA_EP, operario_id: "op-victima", auth: SYNTHETIC_PUSH_KEYS.auth },
      ],
      user_push_subscriptions: [],
    });
  });

  it("old_endpoint ajeno NO borra la sub de la víctima", async () => {
    const res = await RESUBSCRIBE(
      req({ old_endpoint: VICTIMA_EP, subscription: validPushSubscription("propia") }),
    );
    expect(res.status).toBe(200);
    const filas = db.tablas.operario_push_subscriptions;
    expect(filas.some((f) => f.endpoint === VICTIMA_EP && f.operario_id === "op-victima")).toBe(
      true,
    );
    // Y la suya sí quedó registrada.
    expect(filas.some((f) => f.operario_id === "op-atacante")).toBe(true);
  });

  it("reclamar el endpoint ajeno sin las claves → 409", async () => {
    const res = await RESUBSCRIBE(req({ subscription: subRobada }));
    expect(res.status).toBe(409);
    expect(db.tablas.operario_push_subscriptions[0].operario_id).toBe("op-victima");
  });
});

describe("POST /api/m/push/resubscribe · user staff", () => {
  beforeEach(() => {
    operario = null;
    userStaff = "u-atacante";
    db = makePushDouble({
      operario_push_subscriptions: [],
      user_push_subscriptions: [
        {
          endpoint: VICTIMA_EP,
          user_id: "u-victima",
          subscription: { endpoint: VICTIMA_EP, keys: { ...SYNTHETIC_PUSH_KEYS } },
        },
      ],
    });
  });

  it("old_endpoint ajeno NO borra la sub de la víctima", async () => {
    const res = await RESUBSCRIBE(
      req({ old_endpoint: VICTIMA_EP, subscription: validPushSubscription("propia") }),
    );
    expect(res.status).toBe(200);
    const filas = db.tablas.user_push_subscriptions;
    expect(filas.some((f) => f.endpoint === VICTIMA_EP && f.user_id === "u-victima")).toBe(true);
    expect(filas.some((f) => f.user_id === "u-atacante")).toBe(true);
  });

  it("reclamar el endpoint ajeno sin las claves → 409", async () => {
    const res = await RESUBSCRIBE(req({ subscription: subRobada }));
    expect(res.status).toBe(409);
    expect(db.tablas.user_push_subscriptions).toHaveLength(1);
    expect(db.tablas.user_push_subscriptions[0].user_id).toBe("u-victima");
  });

  it("su PROPIO old_endpoint sí se borra (el acotado no rompe el caso legítimo)", async () => {
    db.tablas.user_push_subscriptions.push({
      endpoint: "https://fcm.googleapis.com/fcm/send/synthetic-vieja",
      user_id: "u-atacante",
      subscription: { keys: { ...SYNTHETIC_PUSH_KEYS } },
    });
    const res = await RESUBSCRIBE(
      req({
        old_endpoint: "https://fcm.googleapis.com/fcm/send/synthetic-vieja",
        subscription: validPushSubscription("nueva"),
      }),
    );
    expect(res.status).toBe(200);
    const endpoints = db.tablas.user_push_subscriptions.map((f) => String(f.endpoint));
    expect(endpoints.some((e) => e.endsWith("synthetic-vieja"))).toBe(false);
    expect(endpoints.some((e) => e.endsWith("synthetic-nueva"))).toBe(true);
  });
});
