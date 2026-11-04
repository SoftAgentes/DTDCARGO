// @vitest-environment node
/**
 * SDD-0585 · paso 2.7 · `aplicarMatriz`: roles por la Platform API y miembros
 * de bandejas y equipos con el token de servicio. Las reglas puras están en
 * `matriz.test.ts`; aquí, qué se llama, con qué y en qué orden.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  agregar: vi.fn(),
  token: vi.fn(),
  leerB: vi.fn(),
  fijarB: vi.fn(),
  leerE: vi.fn(),
  fijarE: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../platform-api", () => ({ agregarACuenta: m.agregar, obtenerTokenAgente: m.token }));
vi.mock("../miembros-api", () => ({
  leerMiembrosBandeja: m.leerB,
  fijarMiembrosBandeja: m.fijarB,
  leerMiembrosEquipo: m.leerE,
  fijarMiembrosEquipo: m.fijarE,
}));

import { aplicarMatriz } from "../agentes-matriz";
import type { ConfigMatriz } from "../matriz";

const CFG = { origin: "https://chat.ejemplo.test", token: "tok", accountId: 1 };
const SERVICIO = 1;
const ctx = (servicioId: number | null = SERVICIO) => ({ admin: {} as never, tenantId: "t", cfg: CFG, servicioId });
const MATRIZ: ConfigMatriz = { bandejaClientes: 10, bandejaLeads: null, equipoClientes: 30, equipoLeads: null };
const NADA: ConfigMatriz = { bandejaClientes: null, bandejaLeads: null, equipoClientes: null, equipoLeads: null };
const CUENTA = [
  { userId: SERVICIO, rol: "administrator" as const },
  { userId: 3, rol: "administrator" as const },
  { userId: 8, rol: "agent" as const },
];
const AGENTES = [
  { chatwootUserId: 3, rol: "admin" as const },
  { chatwootUserId: 8, rol: "support" as const },
  { chatwootUserId: 9, rol: "support" as const },
];

beforeEach(() => {
  vi.clearAllMocks();
  m.agregar.mockResolvedValue({ ok: true, data: null });
  m.token.mockResolvedValue({ ok: true, data: "tok-servicio" });
  m.leerB.mockResolvedValue({ ok: true, data: [3, 55] });
  m.fijarB.mockResolvedValue({ ok: true, data: null });
  m.leerE.mockResolvedValue({ ok: true, data: [3, 8, 9] });
  m.fijarE.mockResolvedValue({ ok: true, data: null });
});

describe("aplicarMatriz (2.7)", () => {
  it("alta del que falta, con el rol de la matriz, y la cuenta corregida para la salud", async () => {
    const r = await aplicarMatriz(ctx(), AGENTES, CUENTA, MATRIZ);
    expect(m.agregar).toHaveBeenCalledTimes(1);
    expect(m.agregar).toHaveBeenCalledWith(9, CFG, "agent");
    expect(r.roles).toBe(1);
    expect(r.miembrosCuenta.map((x) => x.userId).sort()).toEqual([1, 3, 8, 9]);
  });

  it("bandejas y equipos: lee con el token de servicio y fija solo lo que cambió", async () => {
    const r = await aplicarMatriz(ctx(), AGENTES, CUENTA, MATRIZ);
    expect(m.token).toHaveBeenCalledWith(SERVICIO, CFG);
    expect(m.leerB).toHaveBeenCalledWith(CFG, "tok-servicio", 10);
    expect(m.fijarB).toHaveBeenCalledWith(CFG, "tok-servicio", 10, [3, 8, 9]);
    expect(m.leerE).toHaveBeenCalledWith(CFG, "tok-servicio", 30);
    expect(m.fijarE).not.toHaveBeenCalled();
    expect(r).toMatchObject({ bandejas: 1, equipos: 0, fallidas: 0 });
  });

  it("si el alta falla, ese agente no entra en las listas (Chatwoot rechazaría el PATCH)", async () => {
    m.agregar.mockResolvedValueOnce({ ok: false, error: "http_422" });
    const r = await aplicarMatriz(ctx(), AGENTES, CUENTA, MATRIZ);
    expect(m.fijarB).toHaveBeenCalledWith(CFG, "tok-servicio", 10, [3, 8]);
    expect(r.fallidas).toBe(1);
  });

  it("sin bandejas ni equipos configurados: solo roles, sin pedir el token de servicio", async () => {
    await aplicarMatriz(ctx(), AGENTES, CUENTA, NADA);
    expect(m.token).not.toHaveBeenCalled();
    expect(m.leerB).not.toHaveBeenCalled();
  });

  it("sin el id de servicio: solo roles", async () => {
    await aplicarMatriz(ctx(null), AGENTES, CUENTA, MATRIZ);
    expect(m.token).not.toHaveBeenCalled();
  });

  it("sin token de servicio: fallida, sin tocar miembros", async () => {
    m.token.mockResolvedValueOnce({ ok: false, error: "no_autorizado" });
    const r = await aplicarMatriz(ctx(), AGENTES, CUENTA, MATRIZ);
    expect(r.fallidas).toBe(1);
    expect(m.leerB).not.toHaveBeenCalled();
  });

  it("una bandeja que no se pudo leer no se pisa", async () => {
    m.leerB.mockResolvedValueOnce({ ok: false, error: "red" });
    const r = await aplicarMatriz(ctx(), AGENTES, CUENTA, MATRIZ);
    expect(m.fijarB).not.toHaveBeenCalled();
    expect(r.fallidas).toBe(1);
  });

  it("si fijar falla: fallida", async () => {
    m.fijarB.mockResolvedValueOnce({ ok: false, error: "http_500" });
    expect((await aplicarMatriz(ctx(), AGENTES, CUENTA, MATRIZ)).fallidas).toBe(1);
  });

  it("la degradación bloqueada se cuenta y no se llama a Chatwoot", async () => {
    const r = await aplicarMatriz(ctx(), [{ chatwootUserId: 3, rol: "support" }], CUENTA, NADA);
    expect(r.bloqueadas).toBe(1);
    expect(m.agregar).not.toHaveBeenCalled();
  });

  it("los logs llevan códigos, no ids ni tokens", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.token.mockResolvedValueOnce({ ok: false, error: "no_autorizado" });
    await aplicarMatriz(ctx(), AGENTES, CUENTA, MATRIZ);
    const texto = JSON.stringify(warn.mock.calls);
    expect(texto).toContain("no_autorizado");
    expect(texto).not.toContain("tok-");
    warn.mockRestore();
  });
});
