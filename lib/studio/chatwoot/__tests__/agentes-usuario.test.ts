// @vitest-environment node
/**
 * SDD-0585 · paso 2.5 · la baja inmediata que llama Usuarios: nunca lanza, solo
 * revisa a ese usuario en el tenant de Chatwoot y, sin configuración, no hace nada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ sincronizar: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ fake: true }) }));
vi.mock("../agentes-ciclo", () => ({ sincronizarAgentes: m.sincronizar }));

import { sincronizarAgenteDeUsuario } from "../agentes-usuario";

const T1 = "10000000-0000-4000-8000-000000000001";
const ANA = "20000000-0000-4000-8000-000000000003";

beforeEach(() => {
  m.sincronizar.mockReset().mockResolvedValue({ revisados: 1, bajas: 1, bloqueadas: 0, fallidas: 0, salud: { alertas: [] } });
  vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "tok");
  vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
  vi.stubEnv("CHATWOOT_TENANT_ID", T1);
  vi.stubEnv("CHATWOOT_SERVICE_USER_ID", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("sincronizarAgenteDeUsuario (2.5)", () => {
  it("revisa solo a ese usuario, en el tenant de Chatwoot", async () => {
    await sincronizarAgenteDeUsuario(ANA);
    const [ctx, opciones] = m.sincronizar.mock.calls[0];
    expect(ctx).toMatchObject({ tenantId: T1, servicioId: 1 });
    expect(opciones).toEqual({ soloUsuario: ANA });
  });

  it("sin configuración de Chatwoot o sin tenant: no hace nada", async () => {
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "");
    await sincronizarAgenteDeUsuario(ANA);
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "tok");
    vi.stubEnv("CHATWOOT_TENANT_ID", "");
    await sincronizarAgenteDeUsuario(ANA);
    expect(m.sincronizar).not.toHaveBeenCalled();
  });

  it("si la sincronización lanza, no lanza y deja solo un aviso sin datos", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.sincronizar.mockRejectedValueOnce(new Error(`fallo con ${ANA}`));
    await expect(sincronizarAgenteDeUsuario(ANA)).resolves.toBeUndefined();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(ANA);
    warn.mockRestore();
  });
});
