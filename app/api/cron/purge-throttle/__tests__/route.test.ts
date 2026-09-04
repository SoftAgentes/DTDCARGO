/**
 * Tests del cron de purga del throttle (/api/cron/purge-throttle).
 *
 * Cubre: sin/mal Authorization → 403 SIN tocar la DB; con el Bearer correcto →
 * ejecuta el DELETE filtrado por created_at y devuelve el count borrado.
 *
 * El admin client se mockea (sin DB real) y registra que se llamó delete().lt().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ops = {
  deleteCalled: false,
  ltColumn: "",
  tables: [] as string[],
  failureTable: null as string | null,
  reset() {
    this.deleteCalled = false;
    this.ltColumn = "";
    this.tables = [];
    this.failureTable = null;
  },
};

function makeAdmin() {
  return {
    from: (table: string) => ({
      delete: () => {
        ops.deleteCalled = true;
        ops.tables.push(table);
        return {
          lt: (col: string) => {
            ops.ltColumn = col;
            if (ops.failureTable === table) {
              return Promise.resolve({
                error: {
                  code: "PGRST500",
                  message:
                    "owner@example.com Bearer s3cret storage/T1/private.jpg",
                },
                count: null,
              });
            }
            return Promise.resolve({
              error: null,
              count: table === "portal_registro_throttle" ? 7 : 3,
            });
          },
        };
      },
    }),
  };
}

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => makeAdmin() }));

import { GET } from "../route";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/purge-throttle", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  ops.reset();
  process.env.CRON_SECRET = "s3cret";
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/purge-throttle", () => {
  it("sin Authorization → 403 y NO toca la DB", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const res = await GET(req({ "x-request-id": "deny-001" }) as never);
    expect(res.status).toBe(403);
    expect(res.headers.get("x-request-id")).toBe("deny-001");
    expect(ops.deleteCalled).toBe(false);
    expect(JSON.parse(warn.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "cron.authorization_denied",
      component: "cron.purge-throttle",
      requestId: "deny-001",
    });
  });

  it("Authorization incorrecto → 403", async () => {
    const res = await GET(req({ authorization: "Bearer otro" }) as never);
    expect(res.status).toBe(403);
    expect(ops.deleteCalled).toBe(false);
  });

  it("sin CRON_SECRET configurado → 403 (no autoriza por defecto)", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req({ authorization: "Bearer s3cret" }) as never);
    expect(res.status).toBe(403);
    expect(ops.deleteCalled).toBe(false);
  });

  it("Bearer correcto → borra filas viejas (filtra por created_at) y devuelve count", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await GET(
      req({ authorization: "Bearer s3cret", "x-request-id": "run-001" }) as never,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("run-001");
    const json = (await res.json()) as { ok: boolean; deleted: number };
    expect(json.ok).toBe(true);
    expect(json.deleted).toBe(10);
    expect(ops.deleteCalled).toBe(true);
    expect(ops.ltColumn).toBe("created_at");
    expect(ops.tables).toEqual([
      "portal_registro_throttle",
      "operario_pin_attempts",
    ]);
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "cron.completed",
      component: "cron.purge-throttle",
      requestId: "run-001",
      deleted: 10,
    });
  });

  it("un error DB queda correlacionado sin filtrar mensaje, correo ni secret al log", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    ops.failureTable = "portal_registro_throttle";

    const res = await GET(
      req({ authorization: "Bearer s3cret", "x-request-id": "fail-001" }) as
        never,
    );

    expect(res.status).toBe(500);
    expect(res.headers.get("x-request-id")).toBe("fail-001");
    expect(JSON.stringify(await res.json())).not.toContain("owner@example.com");
    const line = errorSpy.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toMatchObject({
      event: "cron.delete_failed",
      component: "cron.purge-throttle",
      requestId: "fail-001",
      stage: "portal_throttle",
      error: { name: "Object", code: "PGRST500" },
    });
    expect(line).not.toContain("owner@example.com");
    expect(line).not.toContain("s3cret");
    expect(line).not.toContain("storage/T1/private.jpg");
  });
});
