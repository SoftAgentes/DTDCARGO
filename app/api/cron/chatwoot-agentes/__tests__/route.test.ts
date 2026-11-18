// @vitest-environment node
/**
 * SDD-0585 (2.5) · GET /api/cron/chatwoot-agentes: bajas de los agentes que
 * sobran, salud de la cuenta y aviso a los admins. Sin CRON_SECRET o con otro,
 * 403 y no toca la base; sin configuración de Chatwoot, 200 `omitido`.
 * SDD-0586 (10.5, PR 1b): la salud suma el webhook de cuenta (`revisarWebhookCuenta`, doble).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const T1 = "10000000-0000-4000-8000-000000000001";
const SALUD_OK = { alertas: [], adminsHumanos: 1, vinculosFueraDeCuenta: [] };
const m = vi.hoisted(() => ({ admins: 0, sincronizar: vi.fn(), avisar: vi.fn(), webhook: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.admins += 1;
    return { fake: true };
  },
}));
vi.mock("@/lib/studio/chatwoot/agentes-ciclo", () => ({ sincronizarAgentes: m.sincronizar, avisarSaludAAdmins: m.avisar }));
// Solo la red es doble; `sumarAlertasWebhook` (pura) es la real.
vi.mock("@/lib/studio/chatwoot/webhook-salud", async (original) => ({
  ...(await original<typeof import("@/lib/studio/chatwoot/webhook-salud")>()),
  revisarWebhookCuenta: m.webhook,
}));

import { GET, POST } from "../route";

const pedir = (auth?: string) =>
  new NextRequest("https://dtdcargo.test/api/cron/chatwoot-agentes", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  m.admins = 0;
  m.sincronizar.mockReset().mockResolvedValue({ revisados: 3, bajas: 1, bloqueadas: 0, fallidas: 0, salud: SALUD_OK });
  m.avisar.mockReset().mockResolvedValue(0);
  m.webhook.mockReset().mockResolvedValue([]);
  vi.stubEnv("CRON_SECRET", "cron-sintetico");
  vi.stubEnv("CHATWOOT_URL", "https://chat.ejemplo.test");
  vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "tok");
  vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
  vi.stubEnv("CHATWOOT_TENANT_ID", T1);
  vi.stubEnv("CHATWOOT_SERVICE_USER_ID", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/chatwoot-agentes (SDD-0585, 2.5)", () => {
  it("sin secreto o con otro: 403 y no toca la base", async () => {
    expect((await GET(pedir())).status).toBe(403);
    expect((await GET(pedir("Bearer otro"))).status).toBe(403);
    expect(m.admins).toBe(0);
  });

  it("con el secreto: sincroniza el tenant de Chatwoot, avisa la salud y devuelve solo conteos", async () => {
    m.avisar.mockResolvedValueOnce(0);
    const r = await GET(pedir("Bearer cron-sintetico"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, revisados: 3, bajas: 1, bloqueadas: 0, fallidas: 0, alertas: [], avisados: 0 });
    const [ctx] = m.sincronizar.mock.calls[0];
    expect(ctx).toMatchObject({ tenantId: T1, servicioId: 1, cfg: { origin: "https://chat.ejemplo.test", accountId: 1 } });
    expect(m.avisar).toHaveBeenCalledWith(ctx, SALUD_OK);
  });

  it("con alertas: las devuelve por código y cuenta los avisos", async () => {
    m.sincronizar.mockResolvedValueOnce({ revisados: 1, bajas: 0, bloqueadas: 0, fallidas: 0, salud: { alertas: ["sin_admin_humano"], adminsHumanos: 0, vinculosFueraDeCuenta: [] } });
    m.avisar.mockResolvedValueOnce(2);
    const body = await (await GET(pedir("Bearer cron-sintetico"))).json();
    expect(body).toMatchObject({ alertas: ["sin_admin_humano"], avisados: 2 });
  });

  it("el webhook de cuenta suma sus alertas y avisa a los admins con ellas", async () => {
    const salud = { alertas: ["sin_admin_humano"], adminsHumanos: 0, vinculosFueraDeCuenta: [] };
    m.sincronizar.mockResolvedValueOnce({ revisados: 1, bajas: 0, bloqueadas: 0, fallidas: 0, salud });
    m.webhook.mockResolvedValueOnce(["webhook_sin_ip_publica"]);
    m.avisar.mockResolvedValueOnce(2);
    const body = await (await GET(pedir("Bearer cron-sintetico"))).json();
    expect(body).toMatchObject({ alertas: ["sin_admin_humano", "webhook_sin_ip_publica"], avisados: 2 });
    const [ctx] = m.sincronizar.mock.calls[0];
    expect(m.webhook).toHaveBeenCalledWith(ctx.cfg, 1);
    expect(m.avisar).toHaveBeenCalledWith(ctx, expect.objectContaining({ alertas: ["sin_admin_humano", "webhook_sin_ip_publica"] }));
  });

  it("sin la 0503 no mira el webhook", async () => {
    m.sincronizar.mockResolvedValueOnce({ revisados: 0, bajas: 0, bloqueadas: 0, fallidas: 0, salud: { ...SALUD_OK, alertas: [] }, omitido: true });
    await GET(pedir("Bearer cron-sintetico"));
    expect(m.webhook).not.toHaveBeenCalled();
  });

  it("sin la configuración de Chatwoot o sin tenant: 200 omitido, sin tocar nada", async () => {
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "");
    expect(await (await GET(pedir("Bearer cron-sintetico"))).json()).toEqual({ ok: true, omitido: true });
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "tok");
    vi.stubEnv("CHATWOOT_TENANT_ID", "no-es-uuid");
    expect(await (await GET(pedir("Bearer cron-sintetico"))).json()).toEqual({ ok: true, omitido: true });
    expect(m.sincronizar).not.toHaveBeenCalled();
  });

  it("sin la 0503: omitido y sin avisar", async () => {
    m.sincronizar.mockResolvedValueOnce({ revisados: 0, bajas: 0, bloqueadas: 0, fallidas: 0, salud: SALUD_OK, omitido: true });
    expect(await (await GET(pedir("Bearer cron-sintetico"))).json()).toEqual({ ok: true, omitido: true });
    expect(m.avisar).not.toHaveBeenCalled();
  });

  it("POST hace lo mismo que GET", async () => {
    expect((await POST(pedir("Bearer cron-sintetico"))).status).toBe(200);
  });
});
