/**
 * Tests del throttle por IP de POST /api/public/estimacion.
 *
 * El endpoint es público y manda avisos (email/Telegram) con service_role. Sin
 * límite, un script podía hacer POST en loop y spamear al equipo. Este test cubre
 * las 3 ramas del throttle (reusa portal_registro_throttle con namespace "est:"
 * en la columna ip):
 *   - >= LIMIT intentos recientes → 429 SIN mandar avisos ni registrar el intento.
 *   - < LIMIT → registra el intento y PROCEDE (aviso al equipo + ok; ya no crea EST-).
 *   - error de lectura del throttle → fail-OPEN (no bloquea un lead legítimo).
 *
 * El admin client (createAdminClient) se mockea — sin red ni DB real. El fake
 * registra cada (table, op) + el count que devuelve el SELECT del throttle.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

const THROTTLE = "portal_registro_throttle";

const ops = {
  calls: new Set<string>(), // `${table}:${op}`
  throttleSelectCount: 0,
  throttleSelectError: null as unknown,
  rpcNames: [] as string[],
  reset() {
    this.calls.clear();
    this.throttleSelectCount = 0;
    this.throttleSelectError = null;
    this.rpcNames = [];
  },
};

function makeAdmin() {
  function resolveFor(table: string, op: string) {
    ops.calls.add(`${table}:${op}`);
    if (table === THROTTLE && op === "select") {
      return { count: ops.throttleSelectCount, error: ops.throttleSelectError };
    }
    if (table === "tenants" && op === "select") {
      return { data: { id: "tenant-1" }, error: null };
    }
    return { data: null, error: null };
  }
  function builder(table: string) {
    const state = { table, op: "select" };
    let opSet = false;
    const setOp = (o: string) => {
      if (!opSet) {
        state.op = o;
        opSet = true;
      }
    };
    const resolve = () => Promise.resolve(resolveFor(state.table, state.op));
    const chain: Record<string, unknown> = {
      select: () => {
        setOp("select");
        return chain;
      },
      insert: (p: unknown) => {
        setOp("insert");
        void p;
        return chain;
      },
      eq: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => resolve(),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        resolve().then(res, rej),
    };
    return chain;
  }
  return {
    from: (table: string) => builder(table),
    rpc: async (name: string) => {
      ops.rpcNames.push(name);
      return { data: "EST-2026-0001", error: null };
    },
  };
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => makeAdmin(),
}));

import { POST } from "../route";

function makeReq(overrides: Record<string, unknown> = {}): NextRequest {
  const body = {
    calc: "lcl",
    prospectName: "Carlos Pérez",
    prospectWhatsapp: "+58 412 1234567",
    totalUsd: 800,
    ...overrides,
  };
  return new Request("http://localhost/api/public/estimacion", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => ops.reset());

describe("POST /api/public/estimacion · throttle por IP", () => {
  it("en el límite (>= LIMIT) → 429 sin trabajo pesado ni writes", async () => {
    ops.throttleSelectCount = 12; // == RL_LIMIT

    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/demasiados estimados/i);

    // Consultó el throttle pero NO registró el intento ni hizo trabajo pesado.
    expect(ops.calls.has(`${THROTTLE}:select`)).toBe(true);
    expect(ops.calls.has(`${THROTTLE}:insert`)).toBe(false);
    expect(ops.rpcNames).toHaveLength(0); // no llamó next_estimate_code
    expect(ops.calls.has("quotes:insert")).toBe(false);
  });

  it("por encima del límite → también 429", async () => {
    ops.throttleSelectCount = 50;
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    expect(ops.calls.has("quotes:insert")).toBe(false);
  });

  it("por debajo del límite → registra el intento y PROCEDE", async () => {
    ops.throttleSelectCount = 3; // < RL_LIMIT

    const res = await POST(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    // Registró el intento del throttle, pero ya NO crea EST- en el ERP.
    expect(ops.calls.has(`${THROTTLE}:insert`)).toBe(true);
    expect(ops.rpcNames).not.toContain("next_estimate_code");
    expect(ops.calls.has("quotes:insert")).toBe(false);
  });

  it("error de lectura del throttle → fail-OPEN (no bloquea)", async () => {
    ops.throttleSelectError = { message: "boom" };
    ops.throttleSelectCount = 999; // aunque el count sea alto, con error no bloquea

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(ops.calls.has(`${THROTTLE}:insert`)).toBe(true);
  });

  it("input inválido → 400 ANTES del throttle (no toca la tabla)", async () => {
    const res = await POST(makeReq({ totalUsd: 0 }));
    expect(res.status).toBe(400);
    expect(ops.calls.has(`${THROTTLE}:select`)).toBe(false);
  });
});
