/**
 * SDD-0156 · drainClientNotifications — claim atómico + mapeo de outcomes
 * (email enviado · push encolado · sin destino → skipped · ya tomado → salta).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmail = vi.fn();
const enqueueUserPush = vi.fn();
const drainOperarioPushOutbox = vi.fn((..._a: unknown[]) => Promise.resolve({ processed: 0, delivered: 0, failed: 0 }));

vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({
  enqueueUserPush: (...a: unknown[]) => enqueueUserPush(...a),
  drainOperarioPushOutbox: (...a: unknown[]) => drainOperarioPushOutbox(...a),
}));

import { drainClientNotifications } from "../drain-client-notifications";

type Row = {
  id: string;
  tenant_id: string;
  shipment_id: string;
  client_markbox: string;
  rule_id: string;
  trigger_event: string;
  channel: string;
  payload: Record<string, unknown>;
  attempts: number;
};

interface Cfg {
  rows: Row[];
  client?: { id?: string; email?: string | null; name?: string | null } | null;
  clientUser?: { auth_user_id: string | null } | null;
  claim?: boolean; // false = otro worker lo tomó
}

function makeAdmin(cfg: Cfg) {
  const finalUpdates: Array<{ payload: Record<string, unknown> }> = [];
  function from(table: string) {
    let mode: "select" | "update" = "select";
    let payload: Record<string, unknown> | null = null;
    const builder: Record<string, unknown> = {
      select: () => builder,
      update: (p: Record<string, unknown>) => {
        mode = "update";
        payload = p;
        return builder;
      },
      eq: () => builder,
      is: () => builder,
      not: () => builder,
      lte: () => builder,
      lt: () => builder,
      order: () => builder,
      limit: () => Promise.resolve({ data: cfg.rows, error: null }),
      maybeSingle: () => {
        if (table === "clients") return Promise.resolve({ data: cfg.client ?? null, error: null });
        if (table === "client_users") return Promise.resolve({ data: cfg.clientUser ?? null, error: null });
        if (table === "client_notification_schedule" && mode === "update") {
          // claim
          return Promise.resolve({ data: cfg.claim === false ? null : { id: "claimed" }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        if (mode === "update" && payload) finalUpdates.push({ payload });
        return Promise.resolve({ error: null }).then(resolve, reject);
      },
    };
    return builder;
  }
  return { admin: { from } as never, finalUpdates };
}

function row(over: Partial<Row> = {}): Row {
  return {
    id: "sch-1",
    tenant_id: "t-1",
    shipment_id: "s-1",
    client_markbox: "DTD-1",
    rule_id: "r-1",
    trigger_event: "status:shipped",
    channel: "email",
    payload: { title: "T", body: "B", shipmentCode: "ENV-1", clientName: "Ana" },
    attempts: 0,
    ...over,
  };
}

beforeEach(() => {
  sendEmail.mockReset();
  enqueueUserPush.mockReset();
  drainOperarioPushOutbox.mockClear();
});

describe("drainClientNotifications", () => {
  it("email con destino → sent (delivered=1)", async () => {
    sendEmail.mockResolvedValue({ ok: true });
    const { admin, finalUpdates } = makeAdmin({
      rows: [row()],
      client: { email: "ana@example.com", name: "Ana" },
    });
    const res = await drainClientNotifications(admin);
    expect(res.delivered).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    // ya quedó 'sent' por el claim → no hay update final de outcome.
    expect(finalUpdates).toHaveLength(0);
  });

  it("email sin correo → skipped", async () => {
    const { admin, finalUpdates } = makeAdmin({
      rows: [row()],
      client: { email: null, name: null },
    });
    const res = await drainClientNotifications(admin);
    expect(res.skipped).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(finalUpdates[0].payload.status).toBe("skipped");
  });

  it("channel 'both' sin email pero con push → encola en outbox (delivered=1)", async () => {
    enqueueUserPush.mockResolvedValue("evt-1");
    const { admin } = makeAdmin({
      rows: [row({ channel: "both" })],
      client: { id: "c-1", email: null, name: null },
      clientUser: { auth_user_id: "u-1" },
    });
    const res = await drainClientNotifications(admin);
    expect(res.delivered).toBe(1);
    expect(enqueueUserPush).toHaveBeenCalledTimes(1);
    // empuja el push drain inline.
    expect(drainOperarioPushOutbox).toHaveBeenCalled();
  });

  it("ya tomado por otro worker (claim null) → se salta", async () => {
    const { admin } = makeAdmin({ rows: [row()], claim: false });
    const res = await drainClientNotifications(admin);
    expect(res.processed).toBe(1);
    expect(res.delivered).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sin filas vencidas → resultado vacío", async () => {
    const { admin } = makeAdmin({ rows: [] });
    const res = await drainClientNotifications(admin);
    expect(res).toEqual({ processed: 0, delivered: 0, skipped: 0, failed: 0 });
  });
});
