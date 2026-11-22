// @vitest-environment node
/** SDD-0626 Paso 3b · /api/cron/oficina-envio: auth del cron, apagado por defecto, sin configuración y sin la 0549. */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ admins: 0, rpc: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.admins += 1;
    return { rpc: m.rpc, from: vi.fn() };
  },
}));

import { GET } from "../route";

const req = (auth?: string) =>
  new NextRequest("https://dtdcargo.test/api/cron/oficina-envio", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  m.admins = 0;
  m.rpc.mockReset();
  m.fetch.mockReset();
  vi.stubGlobal("fetch", m.fetch);
  vi.stubEnv("CRON_SECRET", "cron-sintetico");
  vi.stubEnv("OFICINA_ENVIO_ACTIVO", "1");
  vi.stubEnv("OFICINA_CHATWOOT_TOKEN_ENVIO", "escritura");
  vi.stubEnv("OFICINA_CHATWOOT_API_URL", "http://chatwoot.prueba:3000");
  vi.stubEnv("OFICINA_CHATWOOT_ACCOUNT_ID", "2");
  vi.stubEnv("OFICINA_CHATWOOT_INBOX_PRUEBA", "11");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/cron/oficina-envio", () => {
  it("sin la llave del cron (o con una mala): 403 y sin tocar la base", async () => {
    expect((await GET(req())).status).toBe(403);
    expect((await GET(req("Bearer otra"))).status).toBe(403);
    expect(m.admins).toBe(0);
  });

  it("apagado (el defecto): 200 «apagado», no crea el cliente de la base ni llama a Chatwoot", async () => {
    vi.stubEnv("OFICINA_ENVIO_ACTIVO", "");
    expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "apagado" });
    expect(m.admins).toBe(0);
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("los otros interruptores del cable NO encienden el envío", async () => {
    vi.stubEnv("OFICINA_ENVIO_ACTIVO", "");
    vi.stubEnv("OFICINA_DESPACHADOR_ACTIVO", "1");
    vi.stubEnv("OFICINA_WEBHOOK_ACTIVO", "1");
    expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "apagado" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("encendido sin el token de escritura: «sin_config», sin tocar la base", async () => {
    vi.stubEnv("OFICINA_CHATWOOT_TOKEN_ENVIO", "");
    expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "sin_config" });
    expect(m.admins).toBe(0);
  });

  it("encendido sin la 0549: 200 «sin_migracion», no llama a Chatwoot", async () => {
    m.rpc.mockImplementation(async (fn: string) =>
      fn === "office_esta_pausada" ? { data: false, error: null } : { data: null, error: { code: "PGRST202" } },
    );
    const r = await GET(req("Bearer cron-sintetico"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, estado: "sin_migracion" });
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("con la oficina pausada no pide nada por enviar", async () => {
    m.rpc.mockResolvedValue({ data: true, error: null });
    expect(await (await GET(req("Bearer cron-sintetico"))).json()).toMatchObject({ ok: true, estado: "pausada" });
    expect(m.rpc).toHaveBeenCalledTimes(1);
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   ", "0", "dos"])(
    "sin la cuenta propia del cable (OFICINA_CHATWOOT_ACCOUNT_ID=%j) y con la del ERP puesta: «sin_config», ninguna llamada",
    async (valor) => {
      vi.stubEnv("OFICINA_CHATWOOT_ACCOUNT_ID", valor);
      vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
      expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "sin_config" });
      expect(m.admins).toBe(0);
      expect(m.rpc).not.toHaveBeenCalled();
      expect(m.fetch).not.toHaveBeenCalled();
    },
  );
});
