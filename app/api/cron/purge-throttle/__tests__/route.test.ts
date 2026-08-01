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
  reset() {
    this.deleteCalled = false;
    this.ltColumn = "";
    this.tables = [];
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
            return Promise.resolve({ error: null, count: table === "portal_registro_throttle" ? 7 : 3 });
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
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/purge-throttle", () => {
  it("sin Authorization → 403 y NO toca la DB", async () => {
    const res = await GET(req() as never);
    expect(res.status).toBe(403);
    expect(ops.deleteCalled).toBe(false);
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
    const res = await GET(req({ authorization: "Bearer s3cret" }) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; deleted: number };
    expect(json.ok).toBe(true);
    expect(json.deleted).toBe(10);
    expect(ops.deleteCalled).toBe(true);
    expect(ops.ltColumn).toBe("created_at");
    expect(ops.tables).toEqual(["portal_registro_throttle", "operario_pin_attempts"]);
  });
});
