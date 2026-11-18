// @vitest-environment node
/**
 * SDD-0585 · paso 2.5 · la baja inmediata que llama Usuarios: nunca lanza, solo
 * revisa a ese usuario en el tenant de Chatwoot y, sin configuración, no hace nada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ sincronizar: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ fake: true }) }));
vi.mock("../agentes-ciclo", () => ({ sincronizarAgentes: m.sincronizar }));

import { quedoAlDia, sincronizarAgenteDeUsuario } from "../agentes-usuario";

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
    // SDD-0675: devuelve false (Chatwoot quedó pendiente) para que Usuarios avise.
    await expect(sincronizarAgenteDeUsuario(ANA)).resolves.toBe(false);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(ANA);
    warn.mockRestore();
  });
});

// ── SDD-0675: `quedoAlDia` decide el aviso «Chatwoot quedó pendiente» ─────────
describe("quedoAlDia (SDD-0675)", () => {
  type R = Parameters<typeof quedoAlDia>[0];
  const MATRIZ = { roles: 0, bloqueadas: 0, bandejas: 1, equipos: 1, fallidas: 0 };
  const limpio = (over: Partial<R> = {}): R => ({
    revisados: 1,
    bajas: 0,
    bloqueadas: 0,
    fallidas: 0,
    cierresPendientes: 0,
    matriz: { ...MATRIZ },
    salud: { alertas: [], adminsHumanos: 1, vinculosFueraDeCuenta: [] },
    ...over,
  });

  it("una corrida limpia, con matriz aplicada, queda al día", () => {
    expect(quedoAlDia(limpio())).toBe(true);
  });

  it.each([
    ["omitido", { omitido: true as const }],
    // Con la matriz presente: si se quitara `|| r.sinEstado`, este caso daría true y caería.
    ["sin el estado de Studio", { sinEstado: true as const }],
    ["una baja fallida", { fallidas: 1 }],
    ["una baja bloqueada", { bloqueadas: 1 }],
    ["un cierre de sesiones pendiente", { cierresPendientes: 1 }],
    ["bajas sin_bandeja en espera", { sinBandejaEnEspera: 1 }],
    ["sin matriz (Chatwoot no respondió o no se leyeron los accesos)", { matriz: undefined }],
    ["la matriz con fallidas", { matriz: { ...MATRIZ, fallidas: 1 } }],
    ["la matriz con bloqueadas", { matriz: { ...MATRIZ, bloqueadas: 1 } }],
  ])("con %s queda pendiente", (_nombre, over) => {
    expect(quedoAlDia(limpio(over as Partial<R>))).toBe(false);
  });

  it("sinBandejaEnEspera en 0 no cuenta como pendiente", () => {
    expect(quedoAlDia(limpio({ sinBandejaEnEspera: 0 }))).toBe(true);
  });

  it("sincronizarAgenteDeUsuario devuelve lo que dice quedoAlDia", async () => {
    m.sincronizar.mockResolvedValueOnce(limpio());
    await expect(sincronizarAgenteDeUsuario(ANA)).resolves.toBe(true);
    m.sincronizar.mockResolvedValueOnce(limpio({ fallidas: 1 }));
    await expect(sincronizarAgenteDeUsuario(ANA)).resolves.toBe(false);
  });

  it("sin configuración de Chatwoot no hay nada pendiente: true", async () => {
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "");
    await expect(sincronizarAgenteDeUsuario(ANA)).resolves.toBe(true);
    expect(m.sincronizar).not.toHaveBeenCalled();
  });
});
