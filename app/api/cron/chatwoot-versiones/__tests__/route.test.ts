// @vitest-environment node
/**
 * SDD-0588 (3.2) · GET /api/cron/chatwoot-versiones: revisa las versiones del
 * tenant de Chatwoot y devuelve solo estado, versiones y conteos. Sin CRON_SECRET
 * o con otro, 403 y no toca la base; sin tenant o sin la 0507, 200 `omitido`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const T1 = "10000000-0000-4000-8000-000000000001";
const m = vi.hoisted(() => ({ admins: 0, vigilar: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.admins += 1;
    return { fake: true };
  },
}));
vi.mock("@/lib/studio/chatwoot/versiones-vigilante", () => ({ vigilarVersiones: m.vigilar }));

import { GET, POST } from "../route";

const pedir = (auth?: string) =>
  new NextRequest("https://dtdcargo.test/api/cron/chatwoot-versiones", { headers: auth ? { authorization: auth } : {} });

const REVISION = {
  id: 1,
  revisada: "2026-10-30T12:00:00Z",
  estado: "hay_nueva",
  instalada: "4.19.1",
  disponible: "4.20.0",
  pendientes: [{ version: "4.20.0", nombre: "v4.20.0", publicada: "", url: null, notas: "texto largo", seguridad: false }],
  recortado: false,
  error: null,
};

beforeEach(() => {
  m.admins = 0;
  m.vigilar.mockReset().mockResolvedValue({ omitido: false, revision: REVISION, avisados: 1 });
  vi.stubEnv("CRON_SECRET", "cron-sintetico");
  vi.stubEnv("CHATWOOT_URL", "https://chat.ejemplo.test");
  vi.stubEnv("CHATWOOT_TENANT_ID", T1);
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/chatwoot-versiones (SDD-0588, 3.2)", () => {
  it("sin secreto o con otro: 403 y no toca la base", async () => {
    expect((await GET(pedir())).status).toBe(403);
    expect((await GET(pedir("Bearer otro"))).status).toBe(403);
    expect(m.admins).toBe(0);
    expect(m.vigilar).not.toHaveBeenCalled();
  });

  it("con el secreto: revisa el tenant y el origen del entorno y no devuelve las notas", async () => {
    const r = await GET(pedir("Bearer cron-sintetico"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, estado: "hay_nueva", instalada: "4.19.1", disponible: "4.20.0", pendientes: 1, error: null, avisados: 1 });
    expect(m.vigilar.mock.calls[0][0]).toMatchObject({ tenantId: T1, origen: "https://chat.ejemplo.test" });
  });

  it("no necesita el token de la Platform App", async () => {
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "");
    expect((await (await GET(pedir("Bearer cron-sintetico"))).json()).estado).toBe("hay_nueva");
  });

  it("sin tenant: 200 omitido, sin tocar nada", async () => {
    vi.stubEnv("CHATWOOT_TENANT_ID", "no-es-uuid");
    expect(await (await GET(pedir("Bearer cron-sintetico"))).json()).toEqual({ ok: true, omitido: true });
    expect(m.vigilar).not.toHaveBeenCalled();
  });

  it("sin la 0507: omitido", async () => {
    m.vigilar.mockResolvedValueOnce({ omitido: true, revision: null, avisados: 0 });
    expect(await (await GET(pedir("Bearer cron-sintetico"))).json()).toEqual({ ok: true, omitido: true });
  });

  it("POST hace lo mismo que GET", async () => {
    expect((await POST(pedir("Bearer cron-sintetico"))).status).toBe(200);
  });
});
