// @vitest-environment node
/**
 * SDD-0499 · un cliente del portal no apaga las notificaciones de otro.
 *
 * Éste es el sitio que estaba VIVO sin necesitar un segundo tenant: el
 * `upsert(onConflict:"endpoint")` re-asignaba la fila al que llamaba, y el
 * endpoint viene en el cuerpo del request. El comentario lo justificaba con
 * "otro user en el mismo browser", pero que fuera el mismo navegador no se
 * comprobaba en ningún lado, así que cruzaba CLIENTES dentro del mismo tenant.
 *
 * El rebind se conserva —hay teléfonos compartidos de verdad— exigiendo que el
 * que reclama presente el `keys.auth` de esa suscripción.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { makePushDouble, type PushDouble } from "@/lib/studio/notify/__tests__/push-tables-double";
import { SYNTHETIC_PUSH_KEYS } from "@/lib/studio/notify/__tests__/push-subscription-fixture";

const VICTIMA_EP = "https://fcm.googleapis.com/fcm/send/synthetic-cliente-victima";
const AUTH_OTRO = Buffer.from("0f0e0d0c0b0a09080706050403020100", "hex").toString("base64url");

let db: PushDouble;

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => db.client }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "cliente-atacante" } } }) },
    from: () => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: { tenant_id: "t-unico" }, error: null }),
      };
      return chain;
    },
  }),
}));

const { POST } = await import("../subscribe/route");

const req = (body: unknown) =>
  ({ json: async () => body, headers: { get: () => "agente" } }) as never;

describe("POST /api/portal/push/subscribe · rebind con posesión", () => {
  beforeEach(() => {
    db = makePushDouble({
      user_push_subscriptions: [
        {
          endpoint: VICTIMA_EP,
          user_id: "cliente-victima",
          tenant_id: "t-unico",
          subscription: { endpoint: VICTIMA_EP, keys: { ...SYNTHETIC_PUSH_KEYS } },
        },
      ],
    });
  });

  it("otro cliente del MISMO tenant sin las claves → 409 y la sub no cambia de dueño", async () => {
    const res = await POST(
      req({
        endpoint: VICTIMA_EP,
        keys: { p256dh: SYNTHETIC_PUSH_KEYS.p256dh, auth: AUTH_OTRO },
      }),
    );
    expect(res.status).toBe(409);
    expect(db.tablas.user_push_subscriptions).toHaveLength(1);
    expect(db.tablas.user_push_subscriptions[0].user_id).toBe("cliente-victima");
  });

  it("el mismo navegador (mismas claves) sí re-asigna", async () => {
    const res = await POST(req({ endpoint: VICTIMA_EP, keys: { ...SYNTHETIC_PUSH_KEYS } }));
    expect(res.status).toBe(200);
    expect(db.tablas.user_push_subscriptions[0].user_id).toBe("cliente-atacante");
  });

  it("endpoint propio nuevo → se guarda sin estorbar al de la víctima", async () => {
    const propio = "https://fcm.googleapis.com/fcm/send/synthetic-propio";
    const res = await POST(req({ endpoint: propio, keys: { ...SYNTHETIC_PUSH_KEYS } }));
    expect(res.status).toBe(200);
    expect(db.tablas.user_push_subscriptions).toHaveLength(2);
    expect(
      db.tablas.user_push_subscriptions.find((f) => f.endpoint === VICTIMA_EP)?.user_id,
    ).toBe("cliente-victima");
  });
});
