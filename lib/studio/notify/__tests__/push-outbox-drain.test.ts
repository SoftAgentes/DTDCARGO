/**
 * SDD-0146 Fase 5 · drainOperarioPushOutbox — branch 'user' + no-regresión operario.
 *
 * Criterios: (b) el drain procesa operarios EXACTAMENTE como antes (mark_sent en
 * éxito; mark_sent sin subs; bump en fallo transitorio con subs); (c) el branch
 * 'user' llama sendPushToUserDevices y marca sent; el 0-delivered sin destino
 * marca sent (no reintenta 5 veces) y con destino bumpea; el target DESCONOCIDO
 * marca sent con log (NO bumpea en loop infinito — el bug que se corrige).
 *
 * send-operario-push y send-user-push se mockean → controlamos delivered.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendPushToOperario = vi.fn();
const sendPushToUserDevices = vi.fn();

vi.mock("../send-operario-push", () => ({
  sendPushToOperario: (...a: unknown[]) => sendPushToOperario(...a),
}));
vi.mock("../send-user-push", () => ({
  sendPushToUserDevices: (...a: unknown[]) => sendPushToUserDevices(...a),
}));

import { drainOperarioPushOutbox } from "../operario-push-outbox";

type Ev = {
  id: string;
  target_type: string;
  target_id: string;
  payload: Record<string, unknown>;
  attempts: number;
};

interface AdminState {
  events: Ev[];
  /** count por tabla para el head-count de subs (operario / user). */
  operarioSubCount?: number;
  userSubCount?: number;
  userPrefs?: { channel_push: boolean; push_subscription: unknown } | null;
}

function makeAdmin(state: AdminState) {
  const rpc: Array<{ name: string; args: unknown }> = [];
  function from(table: string) {
    let headCount = false;
    const chain: Record<string, unknown> = {
      select(_cols: string, opts?: { head?: boolean }) {
        if (opts?.head) headCount = true;
        return chain;
      },
      is() {
        return chain;
      },
      lt() {
        return chain;
      },
      eq() {
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      maybeSingle() {
        return Promise.resolve({
          data: table === "user_notification_prefs" ? state.userPrefs ?? null : null,
          error: null,
        });
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        let result: unknown;
        if (table === "outbox_push_events") {
          result = { data: state.events, error: null };
        } else if (headCount && table === "operario_push_subscriptions") {
          result = { count: state.operarioSubCount ?? 0, error: null };
        } else if (headCount && table === "user_push_subscriptions") {
          result = { count: state.userSubCount ?? 0, error: null };
        } else {
          result = { data: null, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return chain;
  }
  const admin = {
    from,
    rpc: (name: string, args: unknown) => {
      rpc.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
  } as never;
  return { admin, rpc };
}

const ev = (over: Partial<Ev>): Ev => ({
  id: "e1",
  target_type: "operario",
  target_id: "op1",
  payload: { title: "T", body: "B" },
  attempts: 0,
  ...over,
});

beforeEach(() => {
  sendPushToOperario.mockReset();
  sendPushToUserDevices.mockReset();
});

describe("drain · operario (no-regresión)", () => {
  it("entrega OK → mark_push_sent, NO toca el path de user", async () => {
    sendPushToOperario.mockResolvedValue(1);
    const { admin, rpc } = makeAdmin({ events: [ev({})] });
    const r = await drainOperarioPushOutbox(admin);
    expect(r.delivered).toBe(1);
    expect(sendPushToUserDevices).not.toHaveBeenCalled();
    expect(rpc).toEqual([{ name: "mark_push_sent", args: { p_event_id: "e1" } }]);
  });

  it("0 entregas sin subs → mark_push_sent (no reintenta)", async () => {
    sendPushToOperario.mockResolvedValue(0);
    const { admin, rpc } = makeAdmin({ events: [ev({})], operarioSubCount: 0 });
    await drainOperarioPushOutbox(admin);
    expect(rpc).toEqual([{ name: "mark_push_sent", args: { p_event_id: "e1" } }]);
  });

  it("0 entregas CON subs (fallo transitorio) → bump_push_attempt", async () => {
    sendPushToOperario.mockResolvedValue(0);
    const { admin, rpc } = makeAdmin({ events: [ev({})], operarioSubCount: 2 });
    const r = await drainOperarioPushOutbox(admin);
    expect(r.failed).toBe(1);
    expect(rpc).toEqual([{ name: "bump_push_attempt", args: { p_event_id: "e1" } }]);
  });
});

describe("drain · user (SDD-0146)", () => {
  it("entrega OK → llama sendPushToUserDevices + mark_push_sent", async () => {
    sendPushToUserDevices.mockResolvedValue(1);
    const { admin, rpc } = makeAdmin({
      events: [ev({ id: "u-ev", target_type: "user", target_id: "u1" })],
    });
    const r = await drainOperarioPushOutbox(admin);
    expect(sendPushToUserDevices).toHaveBeenCalledTimes(1);
    expect(sendPushToOperario).not.toHaveBeenCalled();
    expect(r.delivered).toBe(1);
    expect(rpc).toEqual([{ name: "mark_push_sent", args: { p_event_id: "u-ev" } }]);
  });

  it("0 entregas sin subs (ni tabla ni legacy) → mark_push_sent (no reintenta)", async () => {
    sendPushToUserDevices.mockResolvedValue(0);
    const { admin, rpc } = makeAdmin({
      events: [ev({ id: "u-ev", target_type: "user", target_id: "u1" })],
      userSubCount: 0,
      userPrefs: null,
    });
    await drainOperarioPushOutbox(admin);
    expect(rpc).toEqual([{ name: "mark_push_sent", args: { p_event_id: "u-ev" } }]);
  });

  it("0 entregas CON sub en tabla → bump_push_attempt", async () => {
    sendPushToUserDevices.mockResolvedValue(0);
    const { admin, rpc } = makeAdmin({
      events: [ev({ id: "u-ev", target_type: "user", target_id: "u1" })],
      userSubCount: 1,
    });
    const r = await drainOperarioPushOutbox(admin);
    expect(r.failed).toBe(1);
    expect(rpc).toEqual([{ name: "bump_push_attempt", args: { p_event_id: "u-ev" } }]);
  });
});

describe("drain · target desconocido", () => {
  it("mark_push_sent (NUNCA bump — antes quemaba los 5 attempts en loop)", async () => {
    const { admin, rpc } = makeAdmin({
      events: [ev({ id: "x-ev", target_type: "client", target_id: "c1" })],
    });
    await drainOperarioPushOutbox(admin);
    expect(sendPushToOperario).not.toHaveBeenCalled();
    expect(sendPushToUserDevices).not.toHaveBeenCalled();
    expect(rpc).toEqual([{ name: "mark_push_sent", args: { p_event_id: "x-ev" } }]);
  });
});
