/**
 * Tests del aviso al equipo de POST /api/public/estimacion.
 *
 * El aviso (notifyEstimadoLeadToAdmin) cierra la fuga del lead huérfano: el
 * estimado quedaba en `quotes` sin que nadie se enterara. Reglas cubiertas:
 *   - insert OK → se avisa UNA vez con el código EST- y los datos del prospecto.
 *   - el aviso es best-effort: si lanza o devuelve !ok, la respuesta al
 *     visitante sigue siendo 200 (el estimado ya está persistido).
 *   - throttle (429) o input inválido (400) → NO se avisa.
 *
 * Mismo fake de admin client que throttle.test.ts (sin red ni DB real).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

const THROTTLE = "portal_registro_throttle";

const ops = {
  throttleSelectCount: 0,
  quotesInsertError: null as unknown,
  reset() {
    this.throttleSelectCount = 0;
    this.quotesInsertError = null;
  },
};

function makeAdmin() {
  function resolveFor(table: string, op: string) {
    if (table === THROTTLE && op === "select") {
      return { count: ops.throttleSelectCount, error: null };
    }
    if (table === "tenants" && op === "select") {
      return { data: { id: "tenant-1" }, error: null };
    }
    if (table === "quotes" && op === "insert") {
      return { data: null, error: ops.quotesInsertError };
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
      insert: () => {
        setOp("insert");
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
    rpc: async () => ({ data: "EST-2026-0042", error: null }),
  };
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => makeAdmin(),
}));

const notifyMock = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
vi.mock("@/lib/studio/estimado-lead-notify", () => ({
  notifyEstimadoLeadToAdmin: (...args: unknown[]) => notifyMock(...args),
}));

import { POST } from "../route";

function makeReq(overrides: Record<string, unknown> = {}): NextRequest {
  const body = {
    calc: "lcl",
    prospectName: "Carlos Pérez",
    prospectWhatsapp: "+58 412 1234567",
    totalUsd: 800,
    cbm: 1.5,
    nota: "Mercancía lista en Yiwu",
    ...overrides,
  };
  return new Request("http://localhost/api/public/estimacion", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  ops.reset();
  notifyMock.mockClear();
  notifyMock.mockImplementation(async () => ({ ok: true }));
});

describe("POST /api/public/estimacion · aviso al equipo", () => {
  it("insert OK → avisa una vez con el código y los datos del prospecto", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    expect(notifyMock).toHaveBeenCalledTimes(1);
    const [, tenantId, payload] = notifyMock.mock.calls[0] as [
      unknown,
      string,
      Record<string, unknown>,
    ];
    expect(tenantId).toBe("tenant-1");
    expect(payload.estimateCode).toBe("EST-2026-0042");
    expect(payload.prospectName).toBe("Carlos Pérez");
    expect(payload.prospectWhatsapp).toBe("+58 412 1234567");
    expect(payload.totalUsd).toBe(800);
    expect(payload.nota).toBe("Mercancía lista en Yiwu");
  });

  it("el aviso lanza → la respuesta al visitante sigue siendo 200", async () => {
    notifyMock.mockImplementation(async () => {
      throw new Error("resend caído");
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("el aviso devuelve !ok → también 200 (best-effort)", async () => {
    notifyMock.mockImplementation(async () => ({ ok: false }));
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
  });

  it("throttle 429 → NO se avisa", async () => {
    ops.throttleSelectCount = 12; // == RL_LIMIT
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("input inválido 400 → NO se avisa", async () => {
    const res = await POST(makeReq({ totalUsd: 0 }));
    expect(res.status).toBe(400);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("insert falla 500 → NO se avisa (no hay estimado que atender)", async () => {
    ops.quotesInsertError = { message: "boom" };
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    expect(notifyMock).not.toHaveBeenCalled();
  });
});
