import { describe, expect, it } from "vitest";
import { parsePushSubscription, PUSH_SOCKET_TIMEOUT_MS } from "../push-subscription";
import { INVALID_PUSH_ENDPOINTS, SYNTHETIC_PUSH_KEYS, validPushSubscription } from "./push-subscription-fixture";

describe("parsePushSubscription · dominio y forma canónica", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/synthetic-google",
    "https://updates.push.services.mozilla.com/wpush/v2/synthetic-firefox",
    "https://web.push.apple.com/synthetic-safari",
    "https://wns2.notify.windows.com/synthetic-edge",
    "https://a.b.push.apple.com/synthetic-nested",
    "https://fcm.googleapis.com:443/fcm/send/synthetic-default-port",
  ])("acepta proveedor documentado: %s", (endpoint) => {
    const input = { ...validPushSubscription(), endpoint };
    expect(parsePushSubscription(input)).toEqual(input);
  });

  it.each(INVALID_PUSH_ENDPOINTS)("rechaza %s", (_case, endpoint) => {
    expect(parsePushSubscription({ ...validPushSubscription(), endpoint })).toBeNull();
  });

  it.each([
    "https://push.apple.com/synthetic",
    "https://notify.windows.com/synthetic",
    "https://fcm.googleapis.com./synthetic",
    "https://updates.push.services.mozilla.com.example.invalid/synthetic",
    "https://x.notify.windows.com.example.invalid/synthetic",
    "https://fcm.googleapis.com@localhost/synthetic",
    "https://localhost/?next=https://fcm.googleapis.com/synthetic",
    "https://fcm.googleapis.com\\@localhost/synthetic",
    "//fcm.googleapis.com/synthetic",
    "https://2130706433/synthetic",
  ])("no acepta otras variantes de autoridad: %s", (endpoint) => {
    expect(parsePushSubscription({ ...validPushSubscription(), endpoint })).toBeNull();
  });

  it.each([null, undefined, [], 123, true, "subscription", {}, new Date()])(
    "rechaza unknown sin estructura y sin lanzar (%j)",
    (input) => expect(parsePushSubscription(input)).toBeNull(),
  );

  it("elimina campos adicionales incluso si el body ajeno es grande", () => {
    const valid = validPushSubscription();
    const input = {
      ...valid, expirationTime: null, extra: "x".repeat(100000),
      user_id: "attacker", keys: { ...valid.keys, additional: "do-not-store" },
    };
    expect(parsePushSubscription(input)).toEqual({ ...valid, expirationTime: null });
    expect(input.keys.additional).toBe("do-not-store");
  });

  it("acepta 4096 caracteres de endpoint y rechaza 4097", () => {
    const prefix = "https://fcm.googleapis.com/";
    const endpoint = prefix + "a".repeat(4096 - prefix.length);
    expect(parsePushSubscription({ ...validPushSubscription(), endpoint })).not.toBeNull();
    expect(parsePushSubscription({ ...validPushSubscription(), endpoint: endpoint + "a" })).toBeNull();
  });

  it.each([undefined, null, 0, 1, 1770000000000])("expirationTime válido %s", (expirationTime) => {
    const parsed = parsePushSubscription({ ...validPushSubscription(), expirationTime });
    expect(parsed).not.toBeNull();
    expect(parsed?.expirationTime).toBe(expirationTime);
  });

  it.each([-1, NaN, Infinity, -Infinity, "100", true, {}, []])("expirationTime inválido %j", (expirationTime) => {
    expect(parsePushSubscription({ ...validPushSubscription(), expirationTime })).toBeNull();
  });

  it("expone timeout de socket 10000ms, no un supuesto deadline total", () => {
    expect(PUSH_SOCKET_TIMEOUT_MS).toBe(10000);
  });
});

describe("parsePushSubscription · claves públicas y auth sintéticos", () => {
  it("fixture contiene punto P256 no comprimido de65bytes y auth16bytes", () => {
    expect(Buffer.from(SYNTHETIC_PUSH_KEYS.p256dh, "base64url")).toHaveLength(65);
    expect(Buffer.from(SYNTHETIC_PUSH_KEYS.p256dh, "base64url")[0]).toBe(4);
    expect(Buffer.from(SYNTHETIC_PUSH_KEYS.auth, "base64url")).toHaveLength(16);
  });

  it("acepta padding exactamente correcto sin alterar los bytes", () => {
    const parsed = parsePushSubscription({ ...validPushSubscription(), keys: {
      p256dh: SYNTHETIC_PUSH_KEYS.p256dh + "=", auth: SYNTHETIC_PUSH_KEYS.auth + "==",
    } });
    expect(parsed).not.toBeNull();
    expect(Buffer.from(parsed!.keys.auth, "base64url")).toEqual(Buffer.from(SYNTHETIC_PUSH_KEYS.auth, "base64url"));
    expect(Buffer.from(parsed!.keys.p256dh, "base64url")).toEqual(Buffer.from(SYNTHETIC_PUSH_KEYS.p256dh, "base64url"));
  });

  it.each([
    ["auth corto", { ...SYNTHETIC_PUSH_KEYS, auth: "a" }],
    ["auth padding incompleto", { ...SYNTHETIC_PUSH_KEYS, auth: SYNTHETIC_PUSH_KEYS.auth + "=" }],
    ["auth padding excesivo", { ...SYNTHETIC_PUSH_KEYS, auth: SYNTHETIC_PUSH_KEYS.auth + "===" }],
    ["auth bits no canónicos", { ...SYNTHETIC_PUSH_KEYS, auth: SYNTHETIC_PUSH_KEYS.auth.slice(0, -1) + "x" }],
    ["auth caracteres ajenos", { ...SYNTHETIC_PUSH_KEYS, auth: "*".repeat(22) }],
    ["auth tipo numérico", { ...SYNTHETIC_PUSH_KEYS, auth: 123 }],
    ["p256dh comprimido", { ...SYNTHETIC_PUSH_KEYS, p256dh: Buffer.from("02" + "11".repeat(32), "hex").toString("base64url") }],
    ["p256dh prefijo incorrecto", { ...SYNTHETIC_PUSH_KEYS, p256dh: Buffer.from("03" + "11".repeat(64), "hex").toString("base64url") }],
    ["p256dh longitud incorrecta", { ...SYNTHETIC_PUSH_KEYS, p256dh: Buffer.alloc(64, 4).toString("base64url") }],
    ["p256dh padding excesivo", { ...SYNTHETIC_PUSH_KEYS, p256dh: SYNTHETIC_PUSH_KEYS.p256dh + "==" }],
    ["p256dh espacio", { ...SYNTHETIC_PUSH_KEYS, p256dh: SYNTHETIC_PUSH_KEYS.p256dh + " " }],
    ["objeto keys null", null], ["objeto keys array", []],
  ])("rechaza %s", (_case, keys) => {
    expect(parsePushSubscription({ ...validPushSubscription(), keys })).toBeNull();
  });
});
