// @vitest-environment node
/**
 * Tests del cron de purga del throttle (/api/cron/purge-throttle).
 *
 * Cubre: sin/mal Authorization → 403 SIN tocar la DB; con el Bearer correcto →
 * ejecuta el DELETE con `count: "exact"`, filtrado por created_at, y devuelve el
 * count borrado. `public_verify_throttle` (SDD-0455): corte propio de 60 min,
 * atado a la ventana que cuenta /verificar, y su fallo después de las otras dos
 * purgas.
 *
 * El admin client se mockea (sin DB real) y registra cada delete().lt().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VERIFY_WINDOW_MINUTES } from "@/lib/public/verify-throttle";

const DELETED: Record<string, number> = {
  portal_registro_throttle: 7,
  operario_pin_attempts: 3,
  public_verify_throttle: 5,
  client_profile_blocked_attempts: 2,
};

const ops = {
  calls: [] as { table: string; count: string | undefined; column: string; value: string }[],
  failTable: null as string | null,
  reset() {
    this.calls = [];
    this.failTable = null;
  },
};

function makeAdmin() {
  return {
    from: (table: string) => ({
      delete: (options?: { count?: string }) => ({
        lt: (column: string, value: string) => {
          ops.calls.push({ table, count: options?.count, column, value });
          if (ops.failTable === table) {
            return Promise.resolve({ error: { message: "boom" }, count: null });
          }
          return Promise.resolve({ error: null, count: DELETED[table] ?? 0 });
        },
      }),
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

function cutoffOf(table: string): string | undefined {
  return ops.calls.find((c) => c.table === table)?.value;
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
    expect(ops.calls).toEqual([]);
  });

  it("Authorization incorrecto → 403", async () => {
    const res = await GET(req({ authorization: "Bearer otro" }) as never);
    expect(res.status).toBe(403);
    expect(ops.calls).toEqual([]);
  });

  it("sin CRON_SECRET configurado → 403 (no autoriza por defecto)", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req({ authorization: "Bearer s3cret" }) as never);
    expect(res.status).toBe(403);
    expect(ops.calls).toEqual([]);
  });

  it("Bearer correcto → borra filas viejas (filtra por created_at) y devuelve count", async () => {
    const res = await GET(req({ authorization: "Bearer s3cret" }) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      deleted: number;
      deletedByTable: Record<string, number>;
    };
    expect(json.ok).toBe(true);
    expect(json.deleted).toBe(17);
    expect(json.deletedByTable).toEqual(DELETED);
    expect(ops.calls.map((c) => c.table)).toEqual([
      "portal_registro_throttle",
      "operario_pin_attempts",
      "public_verify_throttle",
      "client_profile_blocked_attempts",
    ]);
    // Sin `count: "exact"`, PostgREST no devuelve el conteo y `deleted` mentiría en 0.
    expect(ops.calls.every((c) => c.count === "exact")).toBe(true);
    expect(ops.calls.every((c) => c.column === "created_at")).toBe(true);
  });
});

describe("retención de public_verify_throttle (SDD-0455)", () => {
  const NOW = new Date("2026-09-11T04:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("corta a 60 min y conserva las 48 h de los otros throttles", async () => {
    const res = await GET(req({ authorization: "Bearer s3cret" }) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      cutoff: string;
      cutoffByTable: Record<string, string>;
    };
    const expected = {
      portal_registro_throttle: "2026-09-09T04:00:00.000Z",
      operario_pin_attempts: "2026-09-09T04:00:00.000Z",
      public_verify_throttle: "2026-09-11T03:00:00.000Z",
      client_profile_blocked_attempts: "2026-06-13T04:00:00.000Z",
    };
    expect(Object.fromEntries(ops.calls.map((c) => [c.table, c.value]))).toEqual(expected);
    expect(json.cutoffByTable).toEqual(expected);
    expect(json.cutoff).toBe("2026-09-09T04:00:00.000Z");
  });

  it("el corte no alcanza la ventana que cuenta /verificar: al menos 2 × VERIFY_WINDOW_MINUTES", async () => {
    await GET(req({ authorization: "Bearer s3cret" }) as never);
    const cutoff = Date.parse(cutoffOf("public_verify_throttle") ?? "");
    const windowMs = VERIFY_WINDOW_MINUTES * 60 * 1000;
    // Si la ventana crece, este guard falla y obliga a revisar la retención
    // declarada en la spec y en docs/legal/privacidad antes de cambiarla.
    expect(cutoff).toBeLessThanOrEqual(NOW.getTime() - 2 * windowMs);
  });

  it("si falla public_verify_throttle → 500 genérico, con las otras purgas ya hechas", async () => {
    ops.failTable = "public_verify_throttle";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await GET(req({ authorization: "Bearer s3cret" }) as never);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("No se pudo purgar el throttle de verificación.");
      expect(ops.calls.map((c) => c.table)).toEqual([
        "portal_registro_throttle",
        "operario_pin_attempts",
        "public_verify_throttle",
      ]);
      expect(consoleError).toHaveBeenCalledWith(
        "[purge-verify-throttle] No se pudo purgar el throttle de verificación.",
        "boom",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("retención de los intentos bloqueados del perfil (SDD-0487)", () => {
  it("corta a 90 días, la decisión de Sam", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-19T12:00:00.000Z"));
    try {
      await GET(req({ authorization: "Bearer s3cret" }) as never);
      expect(cutoffOf("client_profile_blocked_attempts")).toBe("2026-06-21T12:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("si falla → 500 genérico, después de las otras tres purgas", async () => {
    ops.failTable = "client_profile_blocked_attempts";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await GET(req({ authorization: "Bearer s3cret" }) as never);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("No se pudo purgar los intentos bloqueados del perfil.");
      expect(ops.calls.map((c) => c.table)).toEqual([
        "portal_registro_throttle",
        "operario_pin_attempts",
        "public_verify_throttle",
        "client_profile_blocked_attempts",
      ]);
    } finally {
      consoleError.mockRestore();
    }
  });
});
