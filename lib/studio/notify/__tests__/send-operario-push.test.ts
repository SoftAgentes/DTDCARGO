/**
 * sendPushToOperario · qué mata una subscription y qué no.
 *
 * EL BUG QUE CIERRA: 3 fallos TRANSITORIOS acumulados (red caída, 500 del push
 * service, timeout) borraban la subscription del operario. Quedaba sordo para
 * siempre y la única salida era desinstalar y reinstalar la PWA — algo que nadie
 * sabe que hay que hacer, porque no hay señal de que dejó de recibir. Un corte
 * de red en la oficina de Yiwu podía dejar sordo a todo el turno.
 *
 * Ahora SOLO 410/404 borra: son los códigos con los que el push service dice
 * "esta subscription ya no existe". Todo lo demás cuenta y sigue.
 *
 * `webpush` se mockea → controlamos el statusCode de cada envío sin red.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { INVALID_PUSH_ENDPOINTS, SYNTHETIC_PUSH_KEYS, validPushSubscription } from "./push-subscription-fixture";

const sendNotification = vi.fn();

vi.mock("../vapid", () => ({
  ensureVapid: () => true,
  webpush: { sendNotification: (...a: unknown[]) => sendNotification(...a) },
}));

import { sendPushToOperario } from "../send-operario-push";

type Sub = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

/** Registra qué ids se borraron y cuáles se actualizaron. */
function makeAdmin(subs: Sub[]) {
  const deleted: string[] = [];
  const updated: Array<{ ids: string[]; patch: Record<string, unknown> }> = [];

  const admin = {
    from(table: string) {
      if (table !== "operario_push_subscriptions") throw new Error(`tabla inesperada: ${table}`);
      return {
        select: () => ({ eq: async () => ({ data: subs, error: null }) }),
        delete: () => ({
          in: async (_col: string, ids: string[]) => {
            deleted.push(...ids);
            return { error: null };
          },
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: async (_c: string, id: string) => {
            updated.push({ ids: [id], patch });
            return { error: null };
          },
          in: async (_c: string, ids: string[]) => {
            updated.push({ ids, patch });
            return { error: null };
          },
        }),
      };
    },
  };

  return { admin: admin as never, deleted, updated };
}

const sub = (over: Partial<Sub> = {}): Sub => ({
  id: "sub-1",
  endpoint: validPushSubscription("operario").endpoint,
  p256dh: SYNTHETIC_PUSH_KEYS.p256dh,
  auth: SYNTHETIC_PUSH_KEYS.auth,
  failure_count: 0,
  ...over,
});

const payload = { title: "Caja lista", body: "Pasá por el hub" };

beforeEach(() => {
  sendNotification.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("sendPushToOperario · qué borra una subscription", () => {
  it.each([410, 404])("borra con %i — el push service dice que ya no existe", async (code) => {
    sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: code }));
    const { admin, deleted } = makeAdmin([sub()]);

    const delivered = await sendPushToOperario(admin, "op-1", payload);

    expect(delivered).toBe(0);
    expect(deleted).toEqual(["sub-1"]);
  });

  it("⭐ NO borra por un fallo transitorio, aunque ya venga con fallos acumulados", async () => {
    // failure_count 2 + este fallo = 3, que era exactamente el umbral que antes
    // la mataba. Un 500 del push service no es una subscription muerta.
    sendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    const { admin, deleted, updated } = makeAdmin([sub({ failure_count: 2 })]);

    const delivered = await sendPushToOperario(admin, "op-1", payload);

    expect(delivered).toBe(0);
    expect(deleted).toEqual([]); // ← el corazón del fix
    // Se cuenta para poder diagnosticar, pero no mata.
    expect(updated).toContainEqual({ ids: ["sub-1"], patch: { failure_count: 3 } });
  });

  it("tampoco borra por un fallo de red sin statusCode", async () => {
    sendNotification.mockRejectedValue(new Error("ECONNRESET"));
    const { admin, deleted } = makeAdmin([sub({ failure_count: 9 })]);

    await sendPushToOperario(admin, "op-1", payload);

    expect(deleted).toEqual([]);
  });

  it("entrega bien y resetea el contador de la que funcionó", async () => {
    sendNotification.mockResolvedValue({});
    const { admin, deleted, updated } = makeAdmin([sub({ failure_count: 4 })]);

    const delivered = await sendPushToOperario(admin, "op-1", payload);

    expect(delivered).toBe(1);
    expect(deleted).toEqual([]);
    expect(updated.some((u) => u.patch.failure_count === 0)).toBe(true);
  });

  it("con varias subscriptions, la muerta se va y la transitoria se queda", async () => {
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 503 }));

    const { admin, deleted } = makeAdmin([
      sub({ id: "muerta" }),
      sub({ id: "transitoria", failure_count: 2 }),
    ]);

    await sendPushToOperario(admin, "op-1", payload);

    expect(deleted).toEqual(["muerta"]);
  });
});

describe("sendPushToOperario · validación antes del envío", () => {
  it("una fila con claves inválidas no se envía, borra, incrementa ni marca exitosa", async () => {
    sendNotification.mockResolvedValue({});
    const { admin, deleted, updated } = makeAdmin([sub({ p256dh: "p", auth: "a", failure_count: 7 })]);
    expect(await sendPushToOperario(admin, "op-1", payload)).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(deleted).toEqual([]);
    expect(updated).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it.each(INVALID_PUSH_ENDPOINTS)("conserva sin enviar ni marcar éxito la fila con %s", async (_case, endpoint) => {
    sendNotification.mockResolvedValue({});
    const { admin, deleted, updated } = makeAdmin([sub({ endpoint })]);
    expect(await sendPushToOperario(admin, "op-1", payload)).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(deleted).toEqual([]);
    expect(updated).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(endpoint);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(SYNTHETIC_PUSH_KEYS.auth);
  });

  it("mezcla válida/inválida: sólo entrega y marca la válida, mantiene TTL12h y timeout10s", async () => {
    sendNotification.mockResolvedValue({});
    const { admin, deleted, updated } = makeAdmin([
      sub({ id: "invalid", endpoint: "https://localhost/private" }),
      sub({ id: "valid" }),
    ]);
    expect(await sendPushToOperario(admin, "op-1", payload)).toBe(1);
    expect(deleted).toEqual([]);
    expect(updated).toHaveLength(1);
    expect(updated[0].ids).toEqual(["valid"]);
    expect(sendNotification).toHaveBeenCalledExactlyOnceWith(
      validPushSubscription("operario"), expect.any(String), { TTL: 43200, timeout: 10000 },
    );
  });
});
