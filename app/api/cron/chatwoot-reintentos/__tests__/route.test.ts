// @vitest-environment node
/**
 * SDD-0585 (2.3, v3) · GET /api/cron/chatwoot-reintentos: el reproceso de
 * eventos de Chatwoot fallidos o colgados. Sin CRON_SECRET o con otro, 403 y no
 * toca la base.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  admins: 0,
  reprocesar: vi.fn(),
  purgarBandeja: vi.fn(),
  purgarBajas: vi.fn(),
  purgar: vi.fn(),
  enviarPortal: vi.fn(),
  avisarPortal: vi.fn(),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.admins += 1;
    return { fake: true };
  },
}));
vi.mock("@/lib/studio/chatwoot/webhook-procesar", () => ({ reprocesarEventosChatwoot: m.reprocesar }));
vi.mock("@/lib/studio/chatwoot/purga", () => ({ purgarBandejaChatwoot: m.purgarBandeja, purgarBajasVencidas: m.purgarBajas }));
vi.mock("@/lib/studio/chatwoot/config", () => ({ chatwootConfig: () => ({ cfg: true }), chatwootServicioUserId: () => 1 }));
vi.mock("@/lib/studio/chatwoot/enrutar", () => ({ purgarEnrutamientoChatwoot: m.purgar }));
vi.mock("@/lib/studio/chatwoot/portal", () => ({ enviarPortalPendientes: m.enviarPortal, avisarRezagoPortal: m.avisarPortal }));

import { GET, POST } from "../route";

const pedir = (auth?: string) =>
  new NextRequest("https://dtdcargo.test/api/cron/chatwoot-reintentos", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  m.admins = 0;
  m.reprocesar.mockReset().mockResolvedValue({ tomados: 2, procesados: 1, fallidos: 1 });
  m.purgarBandeja.mockReset().mockResolvedValue({ eventos: 4, conversaciones: 1 });
  m.purgarBajas.mockReset().mockResolvedValue({ borrados: 1, conservados: 0, ajenos: 0, fallidos: 0 });
  m.purgar.mockReset().mockResolvedValue({ bsuid: 1, respuestas: 3 });
  m.enviarPortal.mockReset().mockResolvedValue({ tomados: 2, enviados: 2, fallidos: 0 });
  m.avisarPortal.mockReset().mockResolvedValue({ avisados: 0, sinLlegar: 0, atascados: 0 });
  vi.stubEnv("CRON_SECRET", "cron-sintetico");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/chatwoot-reintentos (SDD-0585)", () => {
  it("sin secreto o con otro: 403 y no toca la base", async () => {
    expect((await GET(pedir())).status).toBe(403);
    expect((await GET(pedir("Bearer otro"))).status).toBe(403);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(pedir("Bearer "))).status).toBe(403);
    expect(m.admins).toBe(0);
    expect(m.purgarBandeja).not.toHaveBeenCalled();
    expect(m.purgarBajas).not.toHaveBeenCalled();
    expect(m.purgar).not.toHaveBeenCalled();
    expect(m.enviarPortal).not.toHaveBeenCalled();
    expect(m.avisarPortal).not.toHaveBeenCalled();
  });

  it("con el secreto: reprocesa y devuelve el resumen", async () => {
    const r = await GET(pedir("Bearer cron-sintetico"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      ok: true,
      tomados: 2,
      procesados: 1,
      fallidos: 1,
      purgaBandeja: { eventos: 4, conversaciones: 1 },
      purgaBajas: { borrados: 1, conservados: 0, ajenos: 0, fallidos: 0 },
      purgaEnrutamiento: { bsuid: 1, respuestas: 3 },
      portal: { tomados: 2, enviados: 2, fallidos: 0 },
      avisoPortal: { avisados: 0, sinLlegar: 0, atascados: 0 },
    });
    expect(m.reprocesar).toHaveBeenCalledWith({ fake: true });
    // SDD-0585 2.7: las purgas usan el mismo cliente admin y la config de Chatwoot.
    expect(m.purgarBandeja).toHaveBeenCalledWith({ fake: true });
    expect(m.purgarBajas).toHaveBeenCalledWith({ fake: true }, { cfg: true }, 1);
    // SDD-0586: purga por plazo con el mismo cliente admin.
    expect(m.purgar).toHaveBeenCalledWith({ fake: true });
    expect(m.admins).toBe(1);
  });

  it("SDD-0586 (10.5): manda la cola del portal y después avisa lo que no llegó", async () => {
    await GET(pedir("Bearer cron-sintetico"));
    expect(m.enviarPortal).toHaveBeenCalledWith({ fake: true });
    expect(m.avisarPortal).toHaveBeenCalledWith({ fake: true });
    expect(m.enviarPortal.mock.invocationCallOrder[0]).toBeLessThan(m.avisarPortal.mock.invocationCallOrder[0]);
  });

  it("SDD-0586 (10.5): si la ida del portal lanza, el cron sigue y lo informa con un código", async () => {
    m.enviarPortal.mockRejectedValueOnce(new Error("caída"));
    m.avisarPortal.mockRejectedValueOnce(new Error("caída"));
    const r = await GET(pedir("Bearer cron-sintetico"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, portal: { omitido: "error" }, avisoPortal: { omitido: "error" } });
  });

  it("POST hace lo mismo que GET", async () => {
    expect((await POST(pedir("Bearer cron-sintetico"))).status).toBe(200);
  });
});
