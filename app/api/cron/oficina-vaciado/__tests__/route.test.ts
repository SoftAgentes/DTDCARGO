// @vitest-environment node
/** SDD-0626 §3.1 · /api/cron/oficina-vaciado: auth del cron, apagado por defecto y la llamada al vaciado. */
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
  new NextRequest("https://dtdcargo.test/api/cron/oficina-vaciado", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  m.admins = 0;
  m.rpc.mockReset().mockResolvedValue({ data: 2, error: null });
  vi.stubEnv("CRON_SECRET", "cron-sintetico");
  vi.stubEnv("OFICINA_VACIADO_ACTIVO", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/oficina-vaciado", () => {
  it("sin la llave del cron (o con una mala): 403 y sin tocar la base", async () => {
    expect((await GET(req())).status).toBe(403);
    expect((await GET(req("Bearer otra"))).status).toBe(403);
    expect(m.admins).toBe(0);
  });

  it("apagado (el defecto): 200 «apagado», no crea el cliente de la base", async () => {
    vi.stubEnv("OFICINA_VACIADO_ACTIVO", "");
    const r = await GET(req("Bearer cron-sintetico"));
    expect(await r.json()).toEqual({ ok: true, estado: "apagado" });
    expect(m.admins).toBe(0);
  });

  it("el interruptor del webhook NO enciende el vaciado: es otro interruptor", async () => {
    vi.stubEnv("OFICINA_VACIADO_ACTIVO", "");
    vi.stubEnv("OFICINA_WEBHOOK_ACTIVO", "1");
    expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "apagado" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("encendido: vacía los resúmenes y purga los borradores viejos (no consulta la pausa: corre pausada o no)", async () => {
    const r = await GET(req("Bearer cron-sintetico"));
    expect(await r.json()).toEqual({ ok: true, estado: "ok", cantidad: 2, borradores: { estado: "ok", cantidad: 2 } });
    expect(m.rpc).toHaveBeenCalledTimes(2);
    expect(m.rpc).toHaveBeenNthCalledWith(1, "office_vaciar_resumenes_viejos");
    expect(m.rpc).toHaveBeenNthCalledWith(2, "office_purgar_borradores_viejos");
  });

  it("sin la 0541: 200 «sin_migracion», no rompe", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "42883" } });
    const r = await GET(req("Bearer cron-sintetico"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, estado: "sin_migracion", borradores: { estado: "sin_migracion" } });
  });

  it("con la 0541 pero sin la 0547: vacía igual y la purga dice «sin_migracion»", async () => {
    m.rpc.mockResolvedValueOnce({ data: 1, error: null }).mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    const r = await GET(req("Bearer cron-sintetico"));
    expect(await r.json()).toEqual({ ok: true, estado: "ok", cantidad: 1, borradores: { estado: "sin_migracion" } });
  });
});
