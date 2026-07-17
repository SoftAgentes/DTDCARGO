/**
 * SDD-0156 · scheduleClientNotifications — resolución de regla (override>default),
 * cálculo de scheduled_for (offset con signo), skips (none / ancla ETA / sin
 * markbox) e idempotencia (23505).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// El drain inline se mockea para no ejecutarlo.
const drainMock = vi.fn((..._a: unknown[]) => Promise.resolve({ processed: 0, delivered: 0, skipped: 0, failed: 0 }));
vi.mock("../drain-client-notifications", () => ({
  drainClientNotifications: (...a: unknown[]) => drainMock(...a),
}));

import { scheduleClientNotifications } from "../schedule-client-notifications";

type Rule = {
  id: string;
  client_id: string | null;
  channel: string;
  anchor: string;
  offset_minutes: number;
  template_key?: string | null;
  custom_title?: string | null;
  custom_body?: string | null;
};

interface Cfg {
  client?: { id: string } | null;
  rules?: Rule[];
  insertError?: { code?: string } | null;
}

function makeAdmin(cfg: Cfg) {
  const inserts: Record<string, unknown>[] = [];
  function from(table: string) {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      or: () => Promise.resolve({ data: cfg.rules ?? [], error: null }),
      maybeSingle: () =>
        Promise.resolve({
          data: table === "clients" ? cfg.client ?? null : null,
          error: null,
        }),
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        return Promise.resolve({ error: cfg.insertError ?? null });
      },
    };
    return builder;
  }
  return { admin: { from } as never, inserts };
}

const EV = {
  shipmentId: "s-1",
  shipmentCode: "ENV-1",
  clientMarkbox: "DTD-1",
  clientName: "Ana",
  event: "status:shipped",
  eventTime: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => drainMock.mockClear());

describe("scheduleClientNotifications", () => {
  it("sin markbox → no hace nada", async () => {
    const { admin, inserts } = makeAdmin({});
    const res = await scheduleClientNotifications(admin, "t-1", {
      ...EV,
      clientMarkbox: null,
    });
    expect(res).toEqual({ scheduled: 0, skipped: 0 });
    expect(inserts).toHaveLength(0);
  });

  it("default del tenant (event, offset 0) → programa al instante", async () => {
    const { admin, inserts } = makeAdmin({
      client: { id: "c-1" },
      rules: [{ id: "r-def", client_id: null, channel: "email", anchor: "event", offset_minutes: 0 }],
    });
    const res = await scheduleClientNotifications(admin, "t-1", EV);
    expect(res.scheduled).toBe(1);
    expect(inserts[0].scheduled_for).toBe("2026-01-01T00:00:00.000Z");
    expect(inserts[0].channel).toBe("email");
    expect(inserts[0].rule_id).toBe("r-def");
  });

  it("el override del cliente gana al default y aplica su offset (+2 días)", async () => {
    const { admin, inserts } = makeAdmin({
      client: { id: "c-1" },
      rules: [
        { id: "r-def", client_id: null, channel: "email", anchor: "event", offset_minutes: 0 },
        { id: "r-ovr", client_id: "c-1", channel: "both", anchor: "event", offset_minutes: 2880 },
      ],
    });
    const res = await scheduleClientNotifications(admin, "t-1", EV);
    expect(res.scheduled).toBe(1);
    expect(inserts[0].rule_id).toBe("r-ovr");
    expect(inserts[0].channel).toBe("both");
    // +2 días desde 2026-01-01T00:00Z
    expect(inserts[0].scheduled_for).toBe("2026-01-03T00:00:00.000Z");
  });

  it("offset negativo → resta del ancla", async () => {
    const { admin, inserts } = makeAdmin({
      client: { id: "c-1" },
      rules: [{ id: "r", client_id: null, channel: "push", anchor: "event", offset_minutes: -60 }],
    });
    await scheduleClientNotifications(admin, "t-1", EV);
    expect(inserts[0].scheduled_for).toBe("2025-12-31T23:00:00.000Z");
  });

  it("channel 'none' → skip, no programa", async () => {
    const { admin, inserts } = makeAdmin({
      client: { id: "c-1" },
      rules: [{ id: "r", client_id: null, channel: "none", anchor: "event", offset_minutes: 0 }],
    });
    const res = await scheduleClientNotifications(admin, "t-1", EV);
    expect(res).toEqual({ scheduled: 0, skipped: 1 });
    expect(inserts).toHaveLength(0);
  });

  it("ancla ETA (Slice D) → skip (aún no resoluble)", async () => {
    const { admin, inserts } = makeAdmin({
      client: { id: "c-1" },
      rules: [{ id: "r", client_id: null, channel: "email", anchor: "eta", offset_minutes: 7200 }],
    });
    const res = await scheduleClientNotifications(admin, "t-1", EV);
    expect(res.scheduled).toBe(0);
    expect(res.skipped).toBe(1);
    expect(inserts).toHaveLength(0);
  });

  it("sin reglas para el evento → no hace nada", async () => {
    const { admin, inserts } = makeAdmin({ client: { id: "c-1" }, rules: [] });
    const res = await scheduleClientNotifications(admin, "t-1", EV);
    expect(res).toEqual({ scheduled: 0, skipped: 0 });
    expect(inserts).toHaveLength(0);
  });

  it("idempotente: 23505 al insertar → skipped, no rompe", async () => {
    const { admin } = makeAdmin({
      client: { id: "c-1" },
      rules: [{ id: "r", client_id: null, channel: "email", anchor: "event", offset_minutes: 0 }],
      insertError: { code: "23505" },
    });
    const res = await scheduleClientNotifications(admin, "t-1", EV);
    expect(res).toEqual({ scheduled: 0, skipped: 1 });
  });
});
