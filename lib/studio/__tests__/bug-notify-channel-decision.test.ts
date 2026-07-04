/**
 * Tests SDD-0036 Fase 5 · gating de canales de notificación de bugs.
 *
 * Cubre la lógica PURA `computeChannelDecision(prefs, type)` que decide qué
 * canales disparar para un destinatario+evento:
 *  - defaults de la DB cuando el user no tiene fila de prefs (in-app+email ON,
 *    push+telegram OFF, todos los eventos ON);
 *  - `channel_X` apaga su canal;
 *  - el flag `notify_on_<evento>` apaga TODOS los canales de ese evento;
 *  - mapeo evento→flag (state_change / new_reply / resolved / critical_alert);
 *  - FIX de consentimiento de Telegram: con prefs null (o channel_telegram OFF)
 *    NO se manda Telegram aunque el user haya linkeado su cuenta.
 */

import { describe, it, expect } from "vitest";
import {
  computeChannelDecision,
  stateChangeNotifType,
} from "@/lib/studio/bug-email-notify";
import type { UserNotificationPrefs } from "@/lib/studio/bug-types";

function prefs(
  overrides: Partial<UserNotificationPrefs> = {},
): UserNotificationPrefs {
  return {
    user_id: "u1",
    channel_inapp: true,
    channel_push: true,
    channel_email: true,
    channel_telegram: true,
    telegram_chat_id: "123",
    push_subscription: null,
    notify_on_state_change: true,
    notify_on_admin_reply: true,
    notify_on_resolved: true,
    notify_on_critical: true,
    sound_enabled: true,
    updated_at: "2026-07-04T00:00:00Z",
    ...overrides,
  };
}

describe("computeChannelDecision · defaults (sin fila de prefs)", () => {
  it("null prefs → in-app+email ON, push+telegram OFF", () => {
    const d = computeChannelDecision(null, "state_change");
    expect(d).toEqual({
      inapp: true,
      email: true,
      push: false,
      telegram: false,
    });
  });

  it("null prefs para cualquier evento mantiene push+telegram OFF", () => {
    for (const type of [
      "new_reply",
      "resolved",
      "critical_alert",
    ] as const) {
      const d = computeChannelDecision(null, type);
      expect(d.push).toBe(false);
      expect(d.telegram).toBe(false);
      expect(d.inapp).toBe(true);
      expect(d.email).toBe(true);
    }
  });
});

describe("computeChannelDecision · gate por canal", () => {
  it("todos los canales ON + evento ON → los 4 disparan", () => {
    expect(computeChannelDecision(prefs(), "state_change")).toEqual({
      inapp: true,
      email: true,
      push: true,
      telegram: true,
    });
  });

  it("channel_email OFF apaga solo email", () => {
    const d = computeChannelDecision(prefs({ channel_email: false }), "state_change");
    expect(d.email).toBe(false);
    expect(d.inapp).toBe(true);
    expect(d.push).toBe(true);
    expect(d.telegram).toBe(true);
  });

  it("channel_inapp OFF apaga solo la campanita", () => {
    const d = computeChannelDecision(prefs({ channel_inapp: false }), "new_reply");
    expect(d.inapp).toBe(false);
    expect(d.email).toBe(true);
  });
});

describe("computeChannelDecision · gate por evento (notify_on_*)", () => {
  it("notify_on_state_change OFF apaga TODOS los canales de ese evento", () => {
    const d = computeChannelDecision(
      prefs({ notify_on_state_change: false }),
      "state_change",
    );
    expect(d).toEqual({
      inapp: false,
      email: false,
      push: false,
      telegram: false,
    });
  });

  it("apagar un evento no afecta a otro", () => {
    const p = prefs({ notify_on_state_change: false });
    // new_reply usa notify_on_admin_reply (que sigue ON) → dispara.
    const reply = computeChannelDecision(p, "new_reply");
    expect(reply.inapp).toBe(true);
    expect(reply.email).toBe(true);
  });

  it("mapeo evento→flag: resolved usa notify_on_resolved", () => {
    const p = prefs({ notify_on_resolved: false });
    expect(computeChannelDecision(p, "resolved").inapp).toBe(false);
    expect(computeChannelDecision(p, "state_change").inapp).toBe(true);
  });

  it("mapeo evento→flag: new_reply usa notify_on_admin_reply", () => {
    const p = prefs({ notify_on_admin_reply: false });
    expect(computeChannelDecision(p, "new_reply").email).toBe(false);
    expect(computeChannelDecision(p, "resolved").email).toBe(true);
  });

  it("mapeo evento→flag: critical_alert usa notify_on_critical", () => {
    const p = prefs({ notify_on_critical: false });
    expect(computeChannelDecision(p, "critical_alert").push).toBe(false);
    expect(computeChannelDecision(p, "state_change").push).toBe(true);
  });
});

describe("stateChangeNotifType · mapeo estado→tipo (pitfall es/en)", () => {
  it("estado 'resuelto' (ES) → tipo 'resolved' (EN)", () => {
    expect(stateChangeNotifType("resuelto")).toBe("resolved");
  });

  it("otros estados → 'state_change'", () => {
    for (const s of [
      "nuevo",
      "triaje",
      "espera",
      "progreso",
      "descartado",
    ] as const) {
      expect(stateChangeNotifType(s)).toBe("state_change");
    }
  });
});

describe("computeChannelDecision · consentimiento de Telegram (P1.5)", () => {
  it("sin prefs NO manda Telegram (default OFF) aunque el evento aplique", () => {
    expect(computeChannelDecision(null, "critical_alert").telegram).toBe(false);
  });

  it("channel_telegram OFF NO manda aunque esté linkeado (chat_id presente)", () => {
    const d = computeChannelDecision(
      prefs({ channel_telegram: false }),
      "new_reply",
    );
    expect(d.telegram).toBe(false);
  });

  it("channel_telegram ON + evento ON → manda Telegram", () => {
    const d = computeChannelDecision(
      prefs({ channel_telegram: true }),
      "new_reply",
    );
    expect(d.telegram).toBe(true);
  });
});
