// @vitest-environment node
/**
 * Tests del cron de retención de vínculos revocados (/api/cron/portal-revoked-retention).
 *
 * Cubre: sin/mal Authorization o sin CRON_SECRET → 403 SIN tocar la DB; el
 * interruptor PORTAL_REVOKED_RETENTION_ENABLED ("true" exacto) decide dry-run o
 * borrado real, y `?dryRun=1` lo fuerza; la RPC recibe el tope 200; un error o
 * una respuesta con otra forma → 500 genérico sin filtrar el detalle; la
 * respuesta sólo lleva conteos. El plazo, los holds y los eventos viven en la
 * RPC y los cubre supabase/tests/0460_retencion_vinculo_portal_revocado.test.sql.
 *
 * El admin client se mockea (sin DB real) y registra cada rpc().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

type RpcCall = { fn: string; args: Record<string, unknown> };

const ops = {
  calls: [] as RpcCall[],
  error: null as { message: string } | null,
  data: undefined as unknown,
  reset() {
    this.calls = [];
    this.error = null;
    this.data = undefined;
  },
};

function resultFor(dryRun: boolean) {
  return {
    dry_run: dryRun,
    retention_days: 30,
    cutoff: "2026-08-19T05:00:00+00:00",
    limit: 200,
    eligible: 3,
    held: 1,
    erased: dryRun ? 0 : 3,
    remaining: dryRun ? 3 : 0,
  };
}

function makeAdmin() {
  return {
    rpc: (fn: string, args: Record<string, unknown>) => {
      ops.calls.push({ fn, args });
      if (ops.error) return Promise.resolve({ data: null, error: ops.error });
      const data = ops.data !== undefined ? ops.data : resultFor(args.p_dry_run === true);
      return Promise.resolve({ data, error: null });
    },
  };
}

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => makeAdmin() }));

import { GET, POST } from "../route";

function req(headers: Record<string, string> = {}, query = ""): Request {
  return new Request(`http://localhost/api/cron/portal-revoked-retention${query}`, {
    method: "GET",
    headers,
  });
}

const AUTH = { authorization: "Bearer s3cret" };

beforeEach(() => {
  ops.reset();
  process.env.CRON_SECRET = "s3cret";
  delete process.env.PORTAL_REVOKED_RETENTION_ENABLED;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.PORTAL_REVOKED_RETENTION_ENABLED;
  vi.restoreAllMocks();
});

describe("GET /api/cron/portal-revoked-retention", () => {
  it("sin Authorization → 403 y NO toca la DB", async () => {
    const res = await GET(req() as never);
    expect(res.status).toBe(403);
    expect(ops.calls).toEqual([]);
  });

  it("Authorization incorrecto → 403 y NO toca la DB", async () => {
    const res = await GET(req({ authorization: "Bearer otro" }) as never);
    expect(res.status).toBe(403);
    expect(ops.calls).toEqual([]);
  });

  it("sin CRON_SECRET configurado → 403 aunque el header coincida con 'Bearer undefined'", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req({ authorization: "Bearer undefined" }) as never);
    expect(res.status).toBe(403);
    expect(ops.calls).toEqual([]);
  });

  it("sin el interruptor → dry-run: la RPC recibe p_dry_run true y tope 200", async () => {
    const res = await GET(req(AUTH) as never);
    expect(res.status).toBe(200);
    expect(ops.calls).toEqual([
      { fn: "erase_revoked_portal_access_data", args: { p_limit: 200, p_dry_run: true } },
    ]);
    expect(await res.json()).toEqual({
      ok: true,
      mode: "dry-run",
      retentionDays: 30,
      cutoff: "2026-08-19T05:00:00+00:00",
      limit: 200,
      eligible: 3,
      held: 1,
      erased: 0,
      remaining: 3,
    });
  });

  it.each(["1", "TRUE", "yes", " true", ""])("el interruptor con %j no activa el borrado", async (value) => {
    process.env.PORTAL_REVOKED_RETENTION_ENABLED = value;
    const res = await GET(req(AUTH) as never);
    expect(res.status).toBe(200);
    expect(ops.calls[0].args.p_dry_run).toBe(true);
    expect((await res.json()).mode).toBe("dry-run");
  });

  it('con el interruptor en "true" → borra de verdad y reporta los conteos', async () => {
    process.env.PORTAL_REVOKED_RETENTION_ENABLED = "true";
    const res = await GET(req(AUTH) as never);
    expect(res.status).toBe(200);
    expect(ops.calls).toEqual([
      { fn: "erase_revoked_portal_access_data", args: { p_limit: 200, p_dry_run: false } },
    ]);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, mode: "live", erased: 3, remaining: 0, held: 1 });
  });

  it("?dryRun=1 fuerza dry-run aunque el interruptor esté activo", async () => {
    process.env.PORTAL_REVOKED_RETENTION_ENABLED = "true";
    const res = await GET(req(AUTH, "?dryRun=1") as never);
    expect(ops.calls[0].args.p_dry_run).toBe(true);
    expect((await res.json()).mode).toBe("dry-run");
  });

  it("error de la RPC (p. ej. 0460 sin aplicar) → 500 genérico sin filtrar el detalle", async () => {
    process.env.PORTAL_REVOKED_RETENTION_ENABLED = "true";
    ops.error = { message: "Could not find the function public.erase_revoked_portal_access_data" };
    const prevEnv = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(req(AUTH) as never);
    vi.stubEnv("NODE_ENV", prevEnv ?? "test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("No se pudo aplicar la retención de vínculos revocados.");
    expect(JSON.stringify(body)).not.toContain("erase_revoked_portal_access_data");
  });

  it("respuesta con otra forma → 500, sin inventar conteos", async () => {
    ops.data = { dry_run: true, erased: "3" };
    const res = await GET(req(AUTH) as never);
    expect(res.status).toBe(500);
  });

  it("respuesta cuyo modo no coincide con lo pedido → 500", async () => {
    process.env.PORTAL_REVOKED_RETENTION_ENABLED = "true";
    ops.data = resultFor(true); // pidió borrar y la RPC dice dry-run
    const res = await GET(req(AUTH) as never);
    expect(res.status).toBe(500);
  });

  it("la respuesta sólo lleva conteos: ni correos ni ids", async () => {
    process.env.PORTAL_REVOKED_RETENTION_ENABLED = "true";
    ops.data = { ...resultFor(false), email: "persona@example.invalid", ids: ["x"] };
    const res = await GET(req(AUTH) as never);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      ["cutoff", "eligible", "erased", "held", "limit", "mode", "ok", "remaining", "retentionDays"].sort(),
    );
    expect(JSON.stringify(body)).not.toContain("@");
  });

  it("POST se comporta igual que GET", async () => {
    const res = await POST(req(AUTH) as never);
    expect(res.status).toBe(200);
    expect(ops.calls).toHaveLength(1);
  });
});

describe("vercel.json", () => {
  it("programa el cron una vez al día", () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const entry = vercel.crons.filter((c) => c.path === "/api/cron/portal-revoked-retention");
    expect(entry).toHaveLength(1);
    expect(entry[0].schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });
});
