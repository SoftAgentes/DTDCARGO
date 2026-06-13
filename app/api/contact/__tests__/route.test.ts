/**
 * Tests de POST /api/contact — captación del lead del formulario de contacto.
 *
 * Cubre las capas ANTES y DURANTE el trabajo pesado:
 *   - honeypot lleno → 200 ok benigno SIN admin / throttle / notify / email.
 *   - campos faltantes o email inválido → 400 ANTES de tocar admin/throttle/notify.
 *   - throttle por IP (reusa portal_registro_throttle con namespace "contact:"):
 *       · >= LIMIT → 429 sin notify ni email ni insert del intento.
 *       · < LIMIT → registra el intento, avisa al equipo (notify) y confirma al
 *         cliente (email).
 *       · error de lectura → fail-OPEN (no bloquea un contacto legítimo).
 *
 * createAdminClient, notifyContactLeadToAdmin (aviso al equipo: email a info@ +
 * admins + Telegram) y sendEmail (confirmación al cliente) se mockean — sin red
 * ni DB real.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

const THROTTLE = "portal_registro_throttle";

const ops = {
  calls: new Set<string>(), // `${table}:${op}`
  throttleSelectCount: 0,
  throttleSelectError: null as unknown,
  reset() {
    this.calls.clear();
    this.throttleSelectCount = 0;
    this.throttleSelectError = null;
  },
};

const sentEmails: Array<{ to: string; subject: string }> = [];
let notifyCalls = 0;

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
  return { from: (table: string) => builder(table) };
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => makeAdmin(),
}));

// Aviso al equipo (email info@ + admins + Telegram) → mockeado: solo contamos
// que se llamó (su lógica interna se cubre vía new-client-notify, que reusa).
vi.mock("@/lib/studio/contact-lead-notify", () => ({
  notifyContactLeadToAdmin: async () => {
    notifyCalls += 1;
    return { ok: true };
  },
}));

// Confirmación al cliente.
vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: async (
    _admin: unknown,
    _tenantId: string,
    input: { to: string; subject: string },
  ) => {
    sentEmails.push({ to: input.to, subject: input.subject });
    return { ok: true, logId: "log-1", resendId: "r-1", queued: false };
  },
}));

import { POST } from "../route";

function makeReq(overrides: Record<string, unknown> = {}): NextRequest {
  const body = {
    topic: "cotizar",
    nombre: "Carlos Pérez",
    email: "carlos@empresa.com",
    whatsapp: "+58 412 1234567",
    mensaje: "Quiero importar 3 cajas desde Yiwu.",
    ...overrides,
  };
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  ops.reset();
  sentEmails.length = 0;
  notifyCalls = 0;
});

describe("POST /api/contact", () => {
  it("honeypot lleno → 200 ok benigno SIN admin/throttle/notify/email", async () => {
    const res = await POST(makeReq({ empresa_web: "http://spam.example" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(notifyCalls).toBe(0);
    expect(sentEmails).toHaveLength(0);
    expect(ops.calls.has(`${THROTTLE}:select`)).toBe(false);
    expect(ops.calls.has("tenants:select")).toBe(false);
  });

  it("faltan campos obligatorios → 400 sin throttle/notify/email", async () => {
    const res = await POST(makeReq({ whatsapp: "" }));
    expect(res.status).toBe(400);
    expect(notifyCalls).toBe(0);
    expect(sentEmails).toHaveLength(0);
    expect(ops.calls.has(`${THROTTLE}:select`)).toBe(false);
  });

  it("email inválido → 400", async () => {
    const res = await POST(makeReq({ email: "no-es-email" }));
    expect(res.status).toBe(400);
    expect(notifyCalls).toBe(0);
    expect(sentEmails).toHaveLength(0);
  });

  it("en el límite (>= LIMIT) → 429 sin notify/email ni insert del intento", async () => {
    ops.throttleSelectCount = 8; // == RL_LIMIT
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    expect(notifyCalls).toBe(0);
    expect(sentEmails).toHaveLength(0);
    expect(ops.calls.has(`${THROTTLE}:select`)).toBe(true);
    expect(ops.calls.has(`${THROTTLE}:insert`)).toBe(false);
  });

  it("por debajo del límite → registra el intento, avisa al equipo y confirma al cliente", async () => {
    ops.throttleSelectCount = 1;
    const res = await POST(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(ops.calls.has(`${THROTTLE}:insert`)).toBe(true);
    expect(notifyCalls).toBe(1); // aviso al equipo
    expect(sentEmails).toHaveLength(1); // confirmación al cliente
    expect(sentEmails[0].to).toBe("carlos@empresa.com");
  });

  it("error de lectura del throttle → fail-OPEN (avisa + confirma igual)", async () => {
    ops.throttleSelectError = { message: "boom" };
    ops.throttleSelectCount = 999;
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(notifyCalls).toBe(1);
    expect(sentEmails).toHaveLength(1);
  });
});
