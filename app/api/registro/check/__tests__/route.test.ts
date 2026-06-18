/**
 * Tests del endpoint de chequeo en vivo de documento (/api/registro/check).
 *
 * Garantías que cubre:
 *   - Documento válido que YA existe → { exists: true }.
 *   - Documento válido que NO existe → { exists: false }.
 *   - Documento INVÁLIDO → { exists: false } SIN tocar `clients` (no consulta).
 *   - PRIVACIDAD: la respuesta es EXACTAMENTE { exists } — nunca markbox/name/email.
 *   - Throttle por IP: count >= LIMIT → 429 y NO consulta `clients` (no enumera).
 *
 * El admin client (createAdminClient) se mockea — sin red ni DB real. El fake
 * registra cada (table, op) para poder afirmar "no consultó clients".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const THROTTLE = "portal_registro_throttle";

const ops = {
  calls: new Set<string>(),
  throttleCount: 0,
  dupExists: false,
  reset() {
    this.calls.clear();
    this.throttleCount = 0;
    this.dupExists = false;
  },
};

function makeAdmin() {
  function resolveFor(table: string, op: string): { data?: unknown; error?: unknown; count?: number } {
    ops.calls.add(`${table}:${op}`);
    if (table === THROTTLE && op === "select") return { count: ops.throttleCount, error: null };
    if (table === "tenants" && op === "select") return { data: { id: "tenant-1" }, error: null };
    if (table === "clients" && op === "select") {
      return { data: ops.dupExists ? { id: "client-1" } : null, error: null };
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
      is: () => chain,
      ilike: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => resolve(),
      maybeSingle: () => resolve(),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        resolve().then(res, rej),
    };
    return chain;
  }

  return { from: (table: string) => builder(table) };
}

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => makeAdmin() }));

import { POST } from "../route";

function makeReq(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/registro/check", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => ops.reset());

describe("POST /api/registro/check", () => {
  it("documento válido que existe → { exists: true } y SOLO esa clave (cero PII)", async () => {
    ops.dupExists = true;
    const res = await POST(makeReq({ kind: "persona", document: "V-12345678" }) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.exists).toBe(true);
    // Privacidad: la respuesta no filtra NINGÚN dato del titular.
    expect(Object.keys(json)).toEqual(["exists"]);
    expect(json.markbox).toBeUndefined();
    expect(json.name).toBeUndefined();
    expect(json.email).toBeUndefined();
  });

  it("documento válido que no existe → { exists: false }", async () => {
    ops.dupExists = false;
    const res = await POST(makeReq({ kind: "persona", document: "V-12345678" }) as never);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.exists).toBe(false);
    expect(ops.calls.has("clients:select")).toBe(true);
  });

  it("empresa: normaliza el RIF y consulta", async () => {
    ops.dupExists = true;
    const res = await POST(makeReq({ kind: "empresa", document: "J-12345678-9" }) as never);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.exists).toBe(true);
    expect(ops.calls.has("clients:select")).toBe(true);
  });

  it("documento inválido → { exists: false } SIN consultar clients", async () => {
    const res = await POST(makeReq({ kind: "persona", document: "no-es-cedula" }) as never);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.exists).toBe(false);
    expect(ops.calls.has("clients:select")).toBe(false);
  });

  it("body inválido (no-JSON) → 400", async () => {
    const bad = new Request("http://localhost/api/registro/check", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
      body: "{ roto",
    });
    const res = await POST(bad as never);
    expect(res.status).toBe(400);
  });

  it("throttle: count >= LIMIT → 429, exists:false y NO consulta clients (no enumera)", async () => {
    ops.throttleCount = 20; // == RL_LIMIT
    ops.dupExists = true; // aunque existiera, no debe llegar a consultarlo
    const res = await POST(makeReq({ kind: "persona", document: "V-12345678" }) as never);
    expect(res.status).toBe(429);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.exists).toBe(false);
    expect(ops.calls.has("clients:select")).toBe(false);
  });
});
