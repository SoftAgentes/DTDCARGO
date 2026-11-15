// @vitest-environment node
/** SDD-0626 §3.3 · /api/cron/oficina-filtro: auth del cron, apagado por defecto y la llamada al filtro. */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ admins: 0, rpc: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.admins += 1;
    return { rpc: m.rpc };
  },
}));

import { GET } from "../route";

const req = (auth?: string) =>
  new NextRequest("https://dtdcargo.test/api/cron/oficina-filtro", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  m.admins = 0;
  m.rpc.mockReset().mockResolvedValue({ data: 4, error: null });
  vi.stubEnv("CRON_SECRET", "cron-sintetico");
  vi.stubEnv("OFICINA_WEBHOOK_ACTIVO", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/oficina-filtro", () => {
  it("sin la llave del cron (o con una mala): 403 y sin tocar la base", async () => {
    expect((await GET(req())).status).toBe(403);
    expect((await GET(req("Bearer otra"))).status).toBe(403);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(403);
    expect(m.admins).toBe(0);
  });

  it("apagado (el defecto): 200 «apagado» y no crea el cliente de la base", async () => {
    vi.stubEnv("OFICINA_WEBHOOK_ACTIVO", "");
    const r = await GET(req("Bearer cron-sintetico"));
    expect(await r.json()).toEqual({ ok: true, estado: "apagado" });
    expect(m.admins).toBe(0);
  });

  it("encendido: llama a office_filtrar_bandeja con la cuota de 20 por hora", async () => {
    const r = await GET(req("Bearer cron-sintetico"));
    expect(await r.json()).toEqual({ ok: true, estado: "ok", cantidad: 4 });
    expect(m.rpc).toHaveBeenCalledWith("office_filtrar_bandeja", { p_cuota: 20 });
  });

  it("sin la 0541/0544: 200 «sin_migracion», no rompe", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    const r = await GET(req("Bearer cron-sintetico"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, estado: "sin_migracion" });
  });

  it("otro error de la base: 500 sin el mensaje", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "dato secreto" } });
    const r = await GET(req("Bearer cron-sintetico"));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("secreto");
  });
});
