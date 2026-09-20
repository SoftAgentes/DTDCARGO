// @vitest-environment node
/**
 * Tests del ruteo de alertas de Telegram (SDD-0271).
 *
 * El caso que importa —y el que da nombre a esta spec— es el último de
 * `dispatchTelegramAlert`: DOS cuentas admin con el MISMO `telegram_chat_id`
 * (la situación real de producción) tienen que producir UN solo mensaje.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTelegramMock = vi.fn();
vi.mock("@/lib/studio/telegram/send-message", () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMock(...args),
}));

import {
  dedupeChatIds,
  resolveCategoryChatIds,
  resolveAdminChatIds,
  dispatchTelegramAlert,
} from "../alert-routing";
import { makeFakeSupabase, type FakeDb } from "./fake-db";

const TENANT = "tenant-1";

/** Los dos admins comparten chat: es exactamente el caso de producción. */
function dbConDosAdminsMismoChat(extra: Partial<FakeDb> = {}): FakeDb {
  return {
    user_tenants: [
      { user_id: "sam-gmail", tenant_id: TENANT, role: "admin", disabled_at: null },
      { user_id: "sam-vzla", tenant_id: TENANT, role: "admin", disabled_at: null },
      { user_id: "jose", tenant_id: TENANT, role: "admin", disabled_at: null },
      { user_id: "yolimar", tenant_id: TENANT, role: "accounting", disabled_at: null },
    ],
    user_profiles: [
      { user_id: "sam-gmail", telegram_chat_id: "6512220774" },
      { user_id: "sam-vzla", telegram_chat_id: "6512220774" },
      { user_id: "jose", telegram_chat_id: null },
      { user_id: "yolimar", telegram_chat_id: "999" },
    ],
    telegram_destinations: [],
    telegram_alert_routes: [],
    ...extra,
  };
}

beforeEach(() => {
  sendTelegramMock.mockReset();
  sendTelegramMock.mockResolvedValue({ ok: true, messageId: 1 });
});

describe("dedupeChatIds", () => {
  it("colapsa repetidos entre grupos y preserva el orden de aparición", () => {
    expect(dedupeChatIds(["a", "b"], ["b", "c"], ["a"])).toEqual(["a", "b", "c"]);
  });

  it("descarta null, undefined y strings vacíos o de puro espacio", () => {
    expect(dedupeChatIds([null, undefined, "", "   ", "a"])).toEqual(["a"]);
  });

  it("normaliza los espacios de los bordes antes de comparar", () => {
    expect(dedupeChatIds([" a ", "a"])).toEqual(["a"]);
  });
});

describe("resolveCategoryChatIds", () => {
  it("devuelve los chats de los destinos ruteados a esa categoría", async () => {
    const db = dbConDosAdminsMismoChat({
      telegram_destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: "111", active: true },
        { id: "d2", tenant_id: TENANT, chat_id: "222", active: true },
      ],
      telegram_alert_routes: [
        { tenant_id: TENANT, category: "registro", destination_id: "d1" },
        { tenant_id: TENANT, category: "bugs", destination_id: "d2" },
      ],
    });

    const chats = await resolveCategoryChatIds(
      makeFakeSupabase(db),
      TENANT,
      "registro",
    );
    expect(chats).toEqual(["111"]);
  });

  it("IGNORA un destino todavía sin enlazar (chat_id null)", async () => {
    const db = dbConDosAdminsMismoChat({
      telegram_destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: null, active: true },
      ],
      telegram_alert_routes: [
        { tenant_id: TENANT, category: "registro", destination_id: "d1" },
      ],
    });

    expect(
      await resolveCategoryChatIds(makeFakeSupabase(db), TENANT, "registro"),
    ).toEqual([]);
  });

  it("IGNORA un destino apagado", async () => {
    const db = dbConDosAdminsMismoChat({
      telegram_destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: "111", active: false },
      ],
      telegram_alert_routes: [
        { tenant_id: TENANT, category: "registro", destination_id: "d1" },
      ],
    });

    expect(
      await resolveCategoryChatIds(makeFakeSupabase(db), TENANT, "registro"),
    ).toEqual([]);
  });

  it("no cruza categorías: pedir `bugs` no trae la ruta de `registro`", async () => {
    const db = dbConDosAdminsMismoChat({
      telegram_destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: "111", active: true },
      ],
      telegram_alert_routes: [
        { tenant_id: TENANT, category: "registro", destination_id: "d1" },
      ],
    });

    expect(
      await resolveCategoryChatIds(makeFakeSupabase(db), TENANT, "bugs"),
    ).toEqual([]);
  });
});

describe("resolveAdminChatIds", () => {
  it("sólo admins, sólo con chat, sin repetir el chat compartido", async () => {
    const chats = await resolveAdminChatIds(
      makeFakeSupabase(dbConDosAdminsMismoChat()),
      TENANT,
    );
    // "999" es de contabilidad → fuera. Los dos admins comparten "6512220774".
    expect(chats).toEqual(["6512220774"]);
  });
});

describe("dispatchTelegramAlert", () => {
  it("manda a los chats de la categoría, uno por chat", async () => {
    const db = dbConDosAdminsMismoChat({
      telegram_destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: "111", active: true },
        { id: "d2", tenant_id: TENANT, chat_id: "222", active: true },
      ],
      telegram_alert_routes: [
        { tenant_id: TENANT, category: "reportes", destination_id: "d1" },
        { tenant_id: TENANT, category: "reportes", destination_id: "d2" },
      ],
    });

    const res = await dispatchTelegramAlert(
      makeFakeSupabase(db),
      TENANT,
      "reportes",
      "brief",
    );

    expect(res.usedFallback).toBe(false);
    expect(res.sent).toBe(2);
    expect(sendTelegramMock.mock.calls.map((c) => c[0])).toEqual(["111", "222"]);
  });

  it("una categoría ruteada NO llega a los admins que no son su destino", async () => {
    const db = dbConDosAdminsMismoChat({
      telegram_destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: "111", active: true },
      ],
      telegram_alert_routes: [
        { tenant_id: TENANT, category: "registro", destination_id: "d1" },
      ],
    });

    await dispatchTelegramAlert(makeFakeSupabase(db), TENANT, "registro", "alta");

    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMock.mock.calls[0][0]).toBe("111");
  });

  it("sin rutas cae al broadcast de admins (el comportamiento previo)", async () => {
    const res = await dispatchTelegramAlert(
      makeFakeSupabase(dbConDosAdminsMismoChat()),
      TENANT,
      "registro",
      "alta",
    );

    expect(res.usedFallback).toBe(true);
    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
  });

  it("con la ruta puesta pero el destino SIN enlazar, igual cae al respaldo — no se pierde el aviso", async () => {
    const db = dbConDosAdminsMismoChat({
      telegram_destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: null, active: true },
      ],
      telegram_alert_routes: [
        { tenant_id: TENANT, category: "registro", destination_id: "d1" },
      ],
    });

    const res = await dispatchTelegramAlert(
      makeFakeSupabase(db),
      TENANT,
      "registro",
      "alta",
    );

    expect(res.usedFallback).toBe(true);
    expect(res.sent).toBe(1);
  });

  it("`fallback: none` no manda nada cuando no hay rutas", async () => {
    const res = await dispatchTelegramAlert(
      makeFakeSupabase(dbConDosAdminsMismoChat()),
      TENANT,
      "registro",
      "alta",
      { fallback: "none" },
    );

    expect(res.sent).toBe(0);
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("`fallback` con usuarios explícitos usa esos y no todos los admins", async () => {
    const db = dbConDosAdminsMismoChat();
    db.user_profiles.push({ user_id: "otro", telegram_chat_id: "777" });

    await dispatchTelegramAlert(
      makeFakeSupabase(db),
      TENANT,
      "bugs",
      "bug",
      { fallback: ["otro"] },
    );

    expect(sendTelegramMock.mock.calls.map((c) => c[0])).toEqual(["777"]);
  });

  it("`alsoUserIds` suma al destinatario per-usuario", async () => {
    const db = dbConDosAdminsMismoChat({
      telegram_destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: "111", active: true },
      ],
      telegram_alert_routes: [
        { tenant_id: TENANT, category: "conversaciones", destination_id: "d1" },
      ],
    });
    db.user_profiles.push({ user_id: "asesor", telegram_chat_id: "555" });

    await dispatchTelegramAlert(
      makeFakeSupabase(db),
      TENANT,
      "conversaciones",
      "mensaje",
      { alsoUserIds: ["asesor"] },
    );

    expect(sendTelegramMock.mock.calls.map((c) => c[0])).toEqual(["111", "555"]);
  });

  it("si el asesor ES el chat de la categoría, recibe UNA vez, no dos", async () => {
    const db = dbConDosAdminsMismoChat({
      telegram_destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: "6512220774", active: true },
      ],
      telegram_alert_routes: [
        { tenant_id: TENANT, category: "conversaciones", destination_id: "d1" },
      ],
    });

    await dispatchTelegramAlert(
      makeFakeSupabase(db),
      TENANT,
      "conversaciones",
      "mensaje",
      { alsoUserIds: ["sam-gmail"] },
    );

    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
  });

  // ── El bug que da nombre a SDD-0271 ───────────────────────────────────────
  it("DOS admins con el MISMO chat producen UN solo mensaje", async () => {
    const res = await dispatchTelegramAlert(
      makeFakeSupabase(dbConDosAdminsMismoChat()),
      TENANT,
      "registro",
      "Nuevo cliente · DTD-5452",
    );

    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    expect(res.chatIds).toEqual(["6512220774"]);
  });

  it("un fallo de un chat no impide el envío al siguiente", async () => {
    sendTelegramMock.mockResolvedValueOnce({ ok: false, error: "chat not found" });
    const db = dbConDosAdminsMismoChat({
      telegram_destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: "111", active: true },
        { id: "d2", tenant_id: TENANT, chat_id: "222", active: true },
      ],
      telegram_alert_routes: [
        { tenant_id: TENANT, category: "equipo", destination_id: "d1" },
        { tenant_id: TENANT, category: "equipo", destination_id: "d2" },
      ],
    });

    const res = await dispatchTelegramAlert(
      makeFakeSupabase(db),
      TENANT,
      "equipo",
      "aviso",
    );

    expect(res.sent).toBe(1);
    expect(res.failed).toBe(1);
    expect(sendTelegramMock).toHaveBeenCalledTimes(2);
  });
});
