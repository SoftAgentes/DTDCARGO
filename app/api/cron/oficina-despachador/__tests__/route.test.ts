// @vitest-environment node
/** SDD-0626 Paso 3a · /api/cron/oficina-despachador: auth del cron, apagado por defecto y sin configuración. */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ admins: 0, rpc: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.admins += 1;
    return { rpc: m.rpc, from: vi.fn() };
  },
}));

import { GET } from "../route";

const req = (auth?: string) =>
  new NextRequest("https://dtdcargo.test/api/cron/oficina-despachador", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  m.admins = 0;
  m.rpc.mockReset();
  vi.stubEnv("CRON_SECRET", "cron-sintetico");
  vi.stubEnv("OFICINA_DESPACHADOR_ACTIVO", "1");
  vi.stubEnv("OFICINA_VACIADO_ACTIVO", "1");
  vi.stubEnv("OFICINA_RUNTIME_URL", "http://runtime.prueba:18642");
  vi.stubEnv("OFICINA_RUNTIME_TOKEN", "llave");
  vi.stubEnv("OFICINA_CHATWOOT_TOKEN_LECTURA", "lectura");
  vi.stubEnv("OFICINA_CHATWOOT_ACCOUNT_ID", "2");
  vi.stubEnv("OFICINA_CHATWOOT_INBOX_PRUEBA", "11");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/cron/oficina-despachador", () => {
  it("sin la llave del cron (o con una mala): 403 y sin tocar la base", async () => {
    expect((await GET(req())).status).toBe(403);
    expect((await GET(req("Bearer otra"))).status).toBe(403);
    expect(m.admins).toBe(0);
  });

  it("apagado (el defecto): 200 «apagado», no crea el cliente de la base", async () => {
    vi.stubEnv("OFICINA_DESPACHADOR_ACTIVO", "");
    expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "apagado" });
    expect(m.admins).toBe(0);
  });

  it("los otros interruptores del cable NO encienden el despachador", async () => {
    vi.stubEnv("OFICINA_DESPACHADOR_ACTIVO", "");
    vi.stubEnv("OFICINA_WEBHOOK_ACTIVO", "1");
    vi.stubEnv("OFICINA_VACIADO_ACTIVO", "1");
    expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "apagado" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("encendido con el vaciado apagado: «sin_vaciado», sin tocar la base (D3: los borradores no se purgarían)", async () => {
    vi.stubEnv("OFICINA_VACIADO_ACTIVO", "");
    expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "sin_vaciado" });
    expect(m.admins).toBe(0);
  });

  it("encendido sin el token de lectura de Chatwoot: «sin_config», sin tocar la base", async () => {
    vi.stubEnv("OFICINA_CHATWOOT_TOKEN_LECTURA", "");
    expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "sin_config" });
    expect(m.admins).toBe(0);
  });

  it("encendido y con otra tanda en curso: «ocupado» (el turno lo da la base)", async () => {
    m.rpc.mockResolvedValue({ data: false, error: null });
    const r = await (await GET(req("Bearer cron-sintetico"))).json();
    expect(r).toMatchObject({ ok: true, estado: "ocupado" });
    expect(m.rpc).toHaveBeenCalledWith("office_despachador_turno", expect.objectContaining({ p_segundos: 260 }));
  });

  it("encendido sin la 0548: 200 «sin_migracion», no rompe", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    const r = await GET(req("Bearer cron-sintetico"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, estado: "sin_migracion" });
  });

  it.each([undefined, "", "   ", "0", "dos"])(
    "sin la cuenta propia del cable (OFICINA_CHATWOOT_ACCOUNT_ID=%j) y con la del ERP puesta: «sin_config», ninguna llamada",
    async (valor) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      vi.stubEnv("OFICINA_CHATWOOT_ACCOUNT_ID", valor);
      vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
      expect(await (await GET(req("Bearer cron-sintetico"))).json()).toEqual({ ok: true, estado: "sin_config" });
      expect(m.admins).toBe(0);
      expect(m.rpc).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
