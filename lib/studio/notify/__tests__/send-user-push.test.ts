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
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { INVALID_PUSH_ENDPOINTS, SYNTHETIC_PUSH_KEYS, validPushSubscription } from "./push-subscription-fixture";

const sendNotification = vi.fn();

vi.mock("../vapid", () => ({
  ensureVapid: () => true,
  webpush: { sendNotification: (...a: unknown[]) => sendNotification(...a) },
}));

import { sendPushToUserDevices } from "../send-user-push";
import { sendBugPushToUser } from "../send-bug-push";

const KEYS = SYNTHETIC_PUSH_KEYS;

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
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("sendPushToUserDevices · fallback legacy (no-regresión bugs)", () => {
  it("user con SOLO el jsonb legacy (channel_push ON) recibe push", async () => {
    const { admin } = makeAdmin({
      userSubs: [],
      prefs: {
        channel_push: true,
        push_subscription: validPushSubscription("legacy"),
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
    ).toBe(validPushSubscription("legacy").endpoint);
  });

  it("legacy con channel_push OFF → no manda (respeta el opt-out)", async () => {
    const { admin } = makeAdmin({
      userSubs: [],
      prefs: {
        channel_push: false,
        push_subscription: validPushSubscription("legacy"),
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
        push_subscription: validPushSubscription("legacy"),
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
        { id: "s1", subscription: validPushSubscription("e1") },
        { id: "s2", subscription: validPushSubscription("e2") },
      ],
      // Si consultara el legacy, este endpoint aparecería — no debe.
      prefs: {
        channel_push: true,
        push_subscription: validPushSubscription("legacy"),
      },
    });
    const n = await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" });
    expect(n).toBe(2);
    const endpoints = sendNotification.mock.calls.map(
      (c) => (c[0] as { endpoint: string }).endpoint,
    );
    expect(endpoints.sort()).toEqual([validPushSubscription("e1").endpoint, validPushSubscription("e2").endpoint]);
    expect(endpoints).not.toContain(validPushSubscription("legacy").endpoint);
  });

  it("borra la sub muerta (410) de la tabla", async () => {
    sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    const { admin, rec } = makeAdmin({
      userSubs: [
        { id: "s1", subscription: validPushSubscription("dead") },
      ],
      prefs: null,
    });
    const n = await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" });
    expect(n).toBe(0);
    expect(rec.deletedIds).toEqual(["s1"]);
  });
});

describe("sendPushToUserDevices · destino persistido no confiable", () => {
  it.each(INVALID_PUSH_ENDPOINTS)("no envía ni elimina una fila con %s", async (_case, endpoint) => {
    const { admin, rec } = makeAdmin({ userSubs: [{ id: "invalid", subscription: { endpoint, keys: KEYS } }], prefs: null });
    expect(await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" })).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(rec.deletedIds).toEqual([]);
    expect(rec.lastUsedIds).toEqual([]);
    expect(rec.prefsUpdate).toBeNull();
    expect(console.warn).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(endpoint);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(KEYS.auth);
  });

  it.each(INVALID_PUSH_ENDPOINTS)("no envía ni limpia legacy con %s", async (_case, endpoint) => {
    const { admin, rec } = makeAdmin({ userSubs: [], prefs: { channel_push: true, push_subscription: { endpoint, keys: KEYS } } });
    expect(await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" })).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(rec.prefsUpdate).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("no usa legacy cuando la tabla contiene filas inválidas", async () => {
    const { admin, rec } = makeAdmin({
      userSubs: [{ id: "invalid", subscription: { endpoint: "https://localhost/private", keys: KEYS } }],
      prefs: { channel_push: true, push_subscription: validPushSubscription("legacy") },
    });
    expect(await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" })).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(rec.deletedIds).toEqual([]);
    expect(rec.lastUsedIds).toEqual([]);
  });

  it("sólo registra éxito del destino válido y conserva TTL24h con timeout10s", async () => {
    const { admin, rec } = makeAdmin({
      userSubs: [
        { id: "invalid", subscription: { endpoint: "https://localhost/private", keys: KEYS } },
        { id: "valid", subscription: validPushSubscription("valid") },
      ], prefs: null,
    });
    expect(await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" })).toBe(1);
    expect(rec.lastUsedIds).toEqual(["valid"]);
    expect(rec.deletedIds).toEqual([]);
    expect(sendNotification).toHaveBeenCalledExactlyOnceWith(
      validPushSubscription("valid"), expect.any(String), { TTL: 86400, timeout: 10000 },
    );
  });

  it.each([
    ["null", null], ["array", []],
    ["claves cortas", { ...validPushSubscription(), keys: { p256dh: "p", auth: "a" } }],
    ["expiración inválida", { ...validPushSubscription(), expirationTime: -1 }],
  ])("una fila persistida con %s no produce envío, borrado ni éxito", async (_case, subscription) => {
    const { admin, rec } = makeAdmin({ userSubs: [{ id: "invalid", subscription }], prefs: null });
    expect(await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" })).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(rec.deletedIds).toEqual([]);
    expect(rec.lastUsedIds).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it.each([410, 404])("legacy válido conserva limpieza sólo ante %i", async (statusCode) => {
    sendNotification.mockRejectedValueOnce({ statusCode });
    const { admin, rec } = makeAdmin({ userSubs: [], prefs: { channel_push: true, push_subscription: validPushSubscription("gone") } });
    expect(await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" })).toBe(0);
    expect(rec.prefsUpdate).toEqual({ push_subscription: null, channel_push: false });
    expect(rec.deletedIds).toEqual([]);
  });

  it.each([503, undefined])("fallo transitorio %s no borra ni marca éxito en tabla", async (statusCode) => {
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("synthetic-transient"), { statusCode }));
    const { admin, rec } = makeAdmin({ userSubs: [{ id: "valid", subscription: validPushSubscription("transient") }], prefs: null });
    expect(await sendPushToUserDevices(admin, "u1", { title: "T", body: "B" })).toBe(0);
    expect(rec.deletedIds).toEqual([]);
    expect(rec.lastUsedIds).toEqual([]);
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
