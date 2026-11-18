// @vitest-environment node
/** SDD-0611 §11.4.1 · /api/cron/noticias-purga-actor: auth del cron, apagado por defecto y la llamada a la purga. */
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
  new NextRequest("https://dtdcargo.test/api/cron/noticias-purga-actor", { headers: auth ? { authorization: auth } : {} });

const CONTEOS = { news_post_exits: 1, news_publication_audit: 2, news_autopublish_settings_log: 0, news_autopublish_settings: 0 };

beforeEach(() => {
  m.admins = 0;
  m.rpc.mockReset().mockResolvedValue({ data: CONTEOS, error: null });
  vi.stubEnv("CRON_SECRET", "cron-sintetico");
  vi.stubEnv("NOTICIAS_PURGA_ACTOR_ACTIVO", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/noticias-purga-actor", () => {
  it("sin la llave del cron (o con una mala): 403 y sin tocar la base", async () => {
    expect((await GET(req())).status).toBe(403);
    expect((await GET(req("Bearer otra"))).status).toBe(403);
    expect(m.admins).toBe(0);
  });

  it("sin CRON_SECRET configurado: 403", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(403);
    expect(m.admins).toBe(0);
  });

  it.each(["", "0", "false", "si", "on"])("apagado (%j): 200 «apagado», no crea el cliente", async (valor) => {
    vi.stubEnv("NOTICIAS_PURGA_ACTOR_ACTIVO", valor);
    const r = await GET(req("Bearer cron-sintetico"));
    expect(await r.json()).toEqual({ ok: true, estado: "apagado" });
    expect(m.admins).toBe(0);
  });

  it("el interruptor de la oficina NO enciende la purga: es otro", async () => {
    vi.stubEnv("NOTICIAS_PURGA_ACTOR_ACTIVO", "");
    vi.stubEnv("OFICINA_VACIADO_ACTIVO", "1");
    expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "apagado" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("encendido: llama a news_purgar_actor_id y devuelve solo conteos", async () => {
    const r = await GET(req("Bearer cron-sintetico"));
    expect(await r.json()).toEqual({ ok: true, estado: "ok", vaciadas: CONTEOS });
    expect(m.rpc).toHaveBeenCalledTimes(1);
    expect(m.rpc).toHaveBeenCalledWith("news_purgar_actor_id");
  });

  it.each(["42883", "PGRST202"])("sin la 0546 (%s): 200 «sin_migracion», no rompe", async (code) => {
    m.rpc.mockResolvedValue({ data: null, error: { code } });
    const r = await GET(req("Bearer cron-sintetico"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, estado: "sin_migracion" });
  });

  it("otro error de la base: 500 sin detalle", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "55P03", message: "texto interno" } });
    const r = await GET(req("Bearer cron-sintetico"));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, error: "purga" });
  });
});
