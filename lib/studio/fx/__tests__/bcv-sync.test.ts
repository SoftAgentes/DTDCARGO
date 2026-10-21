// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBcvServiceClient, parseBcvDryRun, parseBcvTenantScope, syncBcvRates } from "../bcv-sync";
import { type BcvObservation } from "../bcv-types";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const NOW = "2026-10-21T07:00:00.123Z";
const OLD = "2026-10-21T06:00:00.123456+00:00";
const observation = (rate = "883.39630000", day = "2026-10-21"): BcvObservation => ({
  quote: { currency: "VES", source: "bcv", unit: "VES/USD", rate, validOn: day },
  retrievedAt: NOW, sha256: "a".repeat(64), bytes: 1234,
});
type Stored = { id: string; tenant_id: string; currency: string; source: string; valid_on: string;
  rate: string; set_at: string; set_by: null; note?: string };
const row = (tenant = A, rate = "880.00000000", timestamp = OLD): Stored => ({
  id: tenant === A ? "10000000-0000-4000-8000-00000000000a" : "10000000-0000-4000-8000-00000000000b",
  tenant_id: tenant, currency: "VES", source: "bcv", valid_on: "2026-10-21", rate, set_at: timestamp, set_by: null,
});
type Call = { method: string; url: URL; body?: Record<string, unknown> };
const tableResponse = (data: unknown, count: number, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json", "content-range": `*/${count}` },
});

/** SDK real; el único doble es el transporte. HTTP/DB reales se miden aparte. */
function database(seed: Stored[] = [], scope = [A]) {
  const state = new Map(seed.map(r => [r.tenant_id, { ...r }]));
  const calls: Call[] = [];
  let capCalls = 0;
  let getCalls = 0;
  let intercept: ((call: Call) => Response | Promise<Response> | undefined) | undefined;
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    const call = { method, url, body }; calls.push(call);
    const intercepted = intercept?.(call);
    if (intercepted !== undefined) return intercepted;
    if (url.pathname.endsWith("/tenants")) return tableResponse(scope.map(id => ({ id })), scope.length);
    if (url.pathname.endsWith("/rpc/bcv_rates_write_capability")) {
      capCalls++; return new Response('{"version":1,"ready":true}', { headers: { "content-type": "application/json" } });
    }
    if (!url.pathname.endsWith("/fx_rates")) throw new Error("Unexpected fixture endpoint");
    if (method === "GET") {
      getCalls++;
      const ids = (url.searchParams.get("tenant_id") ?? "").slice(4, -1).split(",");
      const selected = [...state.values()].filter(r => ids.includes(r.tenant_id)).map(({ note: _note, ...r }) => r);
      return tableResponse(selected, selected.length);
    }
    if (!body) throw new Error("Fixture requires a JSON body");
    if (method === "POST") {
      const tenant = String(body.tenant_id);
      if (state.has(tenant)) return new Response('{"code":"23505","message":"synthetic unique"}', { status: 409 });
      const stored = { ...row(tenant), ...body } as Stored;
      state.set(tenant, stored);
      const { note: _note, ...selected } = stored;
      return tableResponse([selected], 1, 201);
    }
    if (method === "PATCH") {
      const observed = [...state.values()].find(r => url.searchParams.get("id") === `eq.${r.id}`);
      if (!observed || ["tenant_id", "currency", "source", "valid_on", "rate", "set_at"].some(key =>
        url.searchParams.get(key) !== `eq.${observed[key as keyof Stored]}`)) return tableResponse([], 0);
      const stored = { ...observed, ...body } as Stored; state.set(stored.tenant_id, stored);
      const { note: _note, ...selected } = stored;
      return tableResponse([selected], 1);
    }
    throw new Error("Unexpected fixture method");
  });
  const factory = vi.fn((signal: AbortSignal) => createBcvServiceClient({ signal, url: "http://127.0.0.1:65430",
    serviceKey: "synthetic-fixture-key", fetch }));
  const obtain = vi.fn(async () => observation());
  const run = (extra: Partial<Parameters<typeof syncBcvRates>[0]> = {}) => syncBcvRates({
    enabled: true, dryRun: false, scope: scope.join(","), now: () => new Date(NOW), createClient: factory, obtain, ...extra,
  });
  return { state, calls, fetch, factory, obtain, run,
    get capCalls() { return capCalls; }, get getCalls() { return getCalls; },
    setIntercept(fn: typeof intercept) { intercept = fn; },
    writes: () => calls.filter(c => c.method !== "GET"),
  };
}
afterEach(() => vi.useRealTimers());

describe("B7/B8/B16 · gates y ensayo inmutable", () => {
  it("normalOFF no crea cliente ni obtiene fuente aun con scope inválido", async () => {
    const db = database();
    expect(await db.run({ enabled: false, scope: undefined })).toMatchObject({ status: "DISABLED" });
    expect(db.factory).not.toHaveBeenCalled(); expect(db.obtain).not.toHaveBeenCalled(); expect(db.calls).toHaveLength(0);
  });
  it.each([undefined, "", A + "," + A.toUpperCase(), "invalid", Array(26).fill(A).join(",")])("scope inválido %s cierra antes de IO", async scope => {
    const db = database();
    expect(await db.run({ scope })).toMatchObject({ status: "REJECTED", reason: "INVALID_SCOPE" });
    expect(db.factory).not.toHaveBeenCalled(); expect(db.obtain).not.toHaveBeenCalled();
  });
  it.each([true, false])("ensayo con flag %s usa GET y no persiste", async enabled => {
    const db = database();
    expect(await db.run({ enabled, dryRun: true })).toMatchObject({ status: "CANDIDATE", counts: { inserted: 0, corrected: 0, notAttempted: 1 } });
    expect(db.calls.map(c => c.url.pathname.split("/").at(-1))).toEqual(["tenants", "fx_rates", "bcv_rates_write_capability"]);
    expect(db.calls.every(c => c.method === "GET")).toBe(true); expect(db.obtain).toHaveBeenCalledTimes(1);
  });
  it.each(["dryRun=", "dryRun=0", "dryRun=true", "dryRun=false", "dryRun=01", "dryRun=1&dryRun=1", "tenant=x", "token=x"])("query %s no cae a modo normal", query => {
    expect(() => parseBcvDryRun(new URLSearchParams(query))).toThrow();
  });
  it("solo ausente o1 exacto y scope casefold único", () => {
    expect(parseBcvDryRun(new URLSearchParams())).toBe(false);
    expect(parseBcvDryRun(new URLSearchParams("dryRun=1"))).toBe(true);
    expect(parseBcvTenantScope(` ${A} , ${B} `)).toEqual([A, B]);
  });
  it.each([false, true])("sin capability también se bloquea fetch de ensayo=%s", async dryRun => {
    const db = database();
    db.setIntercept(c => c.url.pathname.includes("/rpc/") ? new Response("[]", { status: 404 }) : undefined);
    expect(await db.run({ dryRun })).toMatchObject({ reason: "SQL_CONTRACT_UNAVAILABLE", counts: { notAttempted: 1 } });
    expect(db.obtain).not.toHaveBeenCalled(); expect(db.writes()).toHaveLength(0);
  });
  it.each([
    () => tableResponse(null, 0),
    () => tableResponse([row(), row()], 2),
    () => tableResponse([{ ...row(), tenant_id: C }], 1),
    () => tableResponse([{ ...row(), rate: 880 }], 1),
    () => tableResponse([row()], 2),
    () => new Response("[]", { status: 404 }),
    () => new Response("", { status: 404 }),
    () => new Response('{"code":"PGRST205"}', { status: 404 }),
    () => new Response("[truncated", { headers: { "content-type": "application/json" } }),
  ])("snapshot inválido no es ausencia", async response => {
    const db = database();
    db.setIntercept(c => c.url.pathname.endsWith("/fx_rates") ? response() : undefined);
    expect(await db.run()).toMatchObject({ status: "REJECTED", reason: "SNAPSHOT_UNAVAILABLE" });
    expect(db.obtain).not.toHaveBeenCalled(); expect(db.writes()).toHaveLength(0);
  });
  it("200[]count0 genuino sí permite alta;503 no se reintenta", async () => {
    const db = database();
    expect(await db.run()).toMatchObject({ counts: { inserted: 1 } });
    const fail = database(); fail.setIntercept(() => new Response("unavailable", { status: 503 }));
    expect(await fail.run()).toMatchObject({ reason: "SCOPE_UNAVAILABLE" });
    expect(fail.calls).toHaveLength(1);
  });
});

describe("B9–B15 · persistencia textual, CAS y certeza", () => {
  it("alta string exacta y repetición equivalente sin churn", async () => {
    const db = database();
    const first = await db.run();
    expect(first).toMatchObject({ status: "COMPLETED", counts: { inserted: 1, notAttempted: 0 } });
    expect(db.writes()[0].body?.rate).toBe("883.39630000");
    const saved = { ...db.state.get(A)! };
    db.obtain.mockResolvedValue(observation("883.3963"));
    expect(await db.run()).toMatchObject({ counts: { unchanged: 1, inserted: 0, corrected: 0 } });
    expect(db.state.get(A)).toEqual(saved); expect(db.writes()).toHaveLength(1);
    expect(JSON.stringify(first)).not.toContain(A);
  });
  it("corrección preserva token microsegundos en todos los predicados CAS", async () => {
    const db = database([row()]);
    expect(await db.run()).toMatchObject({ counts: { corrected: 1 } });
    const patch = db.writes()[0];
    expect(patch.method).toBe("PATCH");
    expect(Object.fromEntries(["id", "tenant_id", "currency", "source", "valid_on", "rate", "set_at"].map(k => [k, patch.url.searchParams.get(k)]))).toEqual({
      id: `eq.${row().id}`, tenant_id: `eq.${A}`, currency: "eq.VES", source: "eq.bcv", valid_on: "eq.2026-10-21", rate: "eq.880.00000000", set_at: `eq.${OLD}`,
    });
    expect(patch.body).toMatchObject({ rate: "883.39630000", set_at: NOW, set_by: null });
  });
  it("UNCHANGED relee y detecta corrección entre snapshot y fetch", async () => {
    const db = database([row(A, "883.39630000")]);
    db.obtain.mockImplementation(async () => { db.state.set(A, row(A, "884", "2026-10-21T06:30:00.000001Z")); return observation(); });
    expect(await db.run()).toMatchObject({ status: "PARTIAL", counts: { conflicts: 1, unchanged: 0 } });
    expect(db.getCalls).toBe(2); expect(db.writes()).toHaveLength(0);
  });
  it("CAS perdedor solo reconcilia/conflicto, nunca segundo PATCH", async () => {
    const db = database([row()]);
    db.obtain.mockImplementation(async () => { db.state.set(A, row(A, "885", "2026-10-21T06:30:00.000001Z")); return observation(); });
    expect(await db.run()).toMatchObject({ counts: { conflicts: 1, corrected: 0 } });
    expect(db.state.get(A)?.rate).toBe("885"); expect(db.writes()).toHaveLength(1);
  });
  it("unique validado solo relee, sin upsert ni atribuir autoría", async () => {
    const db = database();
    db.obtain.mockImplementation(async () => { db.state.set(A, row(A, "883.3963")); return observation(); });
    expect(await db.run()).toMatchObject({ counts: { reconciled: 1, inserted: 0 } });
    expect(db.writes()).toHaveLength(1);
    expect(db.writes()[0].url.searchParams.has("on_conflict")).toBe(false);
  });
  it("ACK perdido tras efecto solo reconcilia por lectura", async () => {
    const db = database();
    db.setIntercept(c => {
      if (c.method !== "POST") return undefined;
      db.state.set(A, { ...row(A), ...c.body } as Stored);
      return Promise.reject(new TypeError("synthetic lost ACK"));
    });
    expect(await db.run()).toMatchObject({ counts: { reconciled: 1, inserted: 0, unknown: 0 } });
    expect(db.writes()).toHaveLength(1);
  });
  it("sin certeza detiene lo restante y cuenta todos los tenants", async () => {
    const db = database([], [A, B]); let sent = false;
    db.setIntercept(c => {
      if (c.method === "POST") { sent = true; return Promise.reject(new TypeError("synthetic lost ACK")); }
      if (sent && c.url.pathname.endsWith("/fx_rates")) return new Response("unavailable", { status: 503 });
      return undefined;
    });
    expect(await db.run()).toMatchObject({ status: "PARTIAL", reason: "WRITE_UNKNOWN",
      counts: { scope: 2, unknown: 1, notAttempted: 1, deferred: 1 } });
    expect(db.writes()).toHaveLength(1);
  });
  it("capability falla entre tenants y conserva confirmado anterior", async () => {
    const db = database([], [A, B]);
    db.setIntercept(c => c.url.pathname.includes("/rpc/") && db.state.has(A)
      ? new Response('{"version":1,"ready":false}', { headers: { "content-type": "application/json" } }) : undefined);
    expect(await db.run()).toMatchObject({ status: "PARTIAL", reason: "SQL_CONTRACT_UNAVAILABLE",
      counts: { inserted: 1, notAttempted: 1, deferred: 1 } });
    expect(db.writes()).toHaveLength(1);
  });
  it("cambio de día detiene antes de DML sin refecha", async () => {
    const db = database([], [A, B]); let current = new Date("2026-10-22T03:59:59Z");
    db.obtain.mockImplementation(async () => { current = new Date("2026-10-22T04:00:00Z"); return observation(); });
    expect(await db.run({ now: () => current })).toMatchObject({ reason: "DAY_CHANGED", today: "2026-10-21", counts: { notAttempted: 2 } });
    expect(db.writes()).toHaveLength(0);
  });
  it.each(["2026-10-20", "2026-10-22", "2026-10-25"])("fecha %s no se copia a hoy", async day => {
    const db = database(); db.obtain.mockResolvedValue(observation("883.39630000", day));
    expect(await db.run()).toMatchObject({ status: "WAITING", counts: { notAttempted: 1 } });
    expect(db.writes()).toHaveLength(0);
  });
});
