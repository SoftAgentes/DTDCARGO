/**
 * SDD-0146 Fase 5 · sendPushToUserDevices + sendBugPushToUser (multi-dispositivo).
 *
 * NO-REGRESIÓN de bugs (criterio de aceptación): un user que SOLO tiene el jsonb
 * legacy (sin filas en user_push_subscriptions) sigue recibiendo el push igual que
 * hoy — gateado por channel_push como el viejo sendBugPushToUser. Además: manda a
 * TODOS los dispositivos de la tabla, borra las subs muertas (410/404), y respeta
 * el gate legacy (channel_push=false → no manda).
 *
 * `../vapid` se mockea (ensureVapid true + webpush.sendNotification) → sin red.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendNotification = vi.fn();

vi.mock("../vapid", () => ({
  ensureVapid: () => true,
  webpush: { sendNotification: (...a: unknown[]) => sendNotification(...a) },
}));

import { sendPushToUserDevices } from "../send-user-push";
import { sendBugPushToUser } from "../send-bug-push";

const KEYS = { p256dh: "p", auth: "a" };

interface AdminState {
  userSubs: Array<{ id: string; subscription: unknown }>;
  prefs: { channel_push: boolean; push_subscription: unknown } | null;
}

function makeAdmin(state: AdminState) {
  const rec = {
    deletedIds: [] as string[],
    lastUsedIds: [] as string[],
    prefsUpdate: null as Record<string, unknown> | null,
  };
  function from(table: string) {
    let op: "select" | "delete" | "update" | null = null;
    let payload: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {
      select() {
        op = "select";
        return chain;
      },
      delete() {
        op = "delete";
        return chain;
      },
      update(p: Record<string, unknown>) {
        op = "update";
        payload = p;
        return chain;
      },
      eq() {
        return chain;
      },
      in(_col: string, ids: string[]) {
        if (op === "delete") rec.deletedIds.push(...ids);
        if (op === "update") rec.lastUsedIds.push(...ids);
        return Promise.resolve({ error: null });
      },
      maybeSingle() {
        return Promise.resolve({
          data: table === "user_notification_prefs" ? state.prefs : null,
          error: null,
        });
      },
      then(
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown,
      ) {
        let result: unknown;
        if (op === "select" && table === "user_push_subscriptions") {
          result = { data: state.userSubs, error: null };
        } else if (op === "update" && table === "user_notification_prefs") {
          rec.prefsUpdate = payload;
          result = { error: null };
        } else {
          result = { data: null, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return chain;
  }
  return { admin: { from } as never, rec };
}

beforeEach(() => {
  sendNotification.mockReset();
  sendNotification.mockResolvedValue(undefined);
});

describe("sendPushToUserDevices · fallback legacy (no-regresión bugs)", () => {
  it("user con SOLO el jsonb legacy (channel_push ON) recibe push", async () => {
    const { admin } = makeAdmin({
      userSubs: [],
      prefs: {
        channel_push: true,
        push_subscription: { endpoint: "https://push/legacy", keys: KEYS },
      },
    });
    const n = await sendPushToUserDevices(admin, "u1", {
      title: "T",
      body: "B",
    });
    expect(n).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(
      (sendNotification.mock.calls[0][0] as { endpoint: string }).endpoint,
    ).toBe("https://push/legacy");
  });

  it("legacy con channel_push OFF → no manda (respeta el opt-out)", async () => {
    const { admin } = makeAdmin({
      userSubs: [],
      prefs: {
        channel_push: false,
        push_subscription: { endpoint: "https://push/legacy", keys: KEYS },
      },
    });
    const n = await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" });
    expect(n).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sendBugPushToUser(true) para un user legacy-only (wrapper compat)", async () => {
    const { admin } = makeAdmin({
      userSubs: [],
      prefs: {
        channel_push: true,
        push_subscription: { endpoint: "https://push/legacy", keys: KEYS },
      },
    });
    const ok = await sendBugPushToUser(admin, "u1", { title: "T", body: "B" });
    expect(ok).toBe(true);
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});

describe("sendPushToUserDevices · multi-dispositivo (tabla)", () => {
  it("manda a TODAS las filas de la tabla y NO consulta el legacy", async () => {
    const { admin } = makeAdmin({
      userSubs: [
        { id: "s1", subscription: { endpoint: "https://push/e1", keys: KEYS } },
        { id: "s2", subscription: { endpoint: "https://push/e2", keys: KEYS } },
      ],
      // Si consultara el legacy, este endpoint aparecería — no debe.
      prefs: {
        channel_push: true,
        push_subscription: { endpoint: "https://push/legacy", keys: KEYS },
      },
    });
    const n = await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" });
    expect(n).toBe(2);
    const endpoints = sendNotification.mock.calls.map(
      (c) => (c[0] as { endpoint: string }).endpoint,
    );
    expect(endpoints.sort()).toEqual(["https://push/e1", "https://push/e2"]);
    expect(endpoints).not.toContain("https://push/legacy");
  });

  it("borra la sub muerta (410) de la tabla", async () => {
    sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    const { admin, rec } = makeAdmin({
      userSubs: [
        { id: "s1", subscription: { endpoint: "https://push/dead", keys: KEYS } },
      ],
      prefs: null,
    });
    const n = await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" });
    expect(n).toBe(0);
    expect(rec.deletedIds).toEqual(["s1"]);
  });
});

describe("sendPushToUserDevices · sin destino", () => {
  it("sin filas ni legacy → 0 (sin enviar)", async () => {
    const { admin } = makeAdmin({ userSubs: [], prefs: null });
    const n = await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" });
    expect(n).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
