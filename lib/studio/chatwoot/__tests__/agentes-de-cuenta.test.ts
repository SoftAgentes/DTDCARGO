// @vitest-environment node
/**
 * SDD-0680 · los agentes de la cuenta con nombre y correo, para elegirlos por
 * nombre en Usuarios › Bandeja. La lista de la cuenta solo trae id y rol; cada
 * nombre y correo sale de leer el agente (solo lectura, Platform API). Con
 * dobles de `platform-api`: nunca toca un Chatwoot real.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const obtenerAgente = vi.fn();
vi.mock("../platform-api", () => ({
  listarMiembrosCuenta: vi.fn(),
  obtenerAgente: (id: number) => obtenerAgente(id),
}));

const { agentesDeCuenta, MAX_AGENTES_LEIDOS } = await import("../agentes-bandeja-admin");

const CFG = { origin: "https://chat.ejemplo.test", token: "tok", accountId: 1 };
const agente = (id: number, name: string, email: string) => ({ ok: true, data: { id, name, email, accountIds: [1] } });

beforeEach(() => obtenerAgente.mockReset());

describe("agentesDeCuenta (SDD-0680)", () => {
  it("lee nombre y correo de cada miembro, con su rol, y deja fuera al usuario de servicio", async () => {
    obtenerAgente.mockImplementation(async (id: number) =>
      id === 2 ? agente(2, "Ana Sintética", "ana@ejemplo.test") : agente(8, "Luis Sintético", "luis@ejemplo.test"),
    );
    const r = await agentesDeCuenta(
      { ok: true, data: [{ userId: 1, rol: "administrator" }, { userId: 2, rol: "administrator" }, { userId: 8, rol: "agent" }] },
      1,
      CFG,
    );
    expect(r).toEqual([
      { id: 2, nombre: "Ana Sintética", correo: "ana@ejemplo.test", rol: "administrator" },
      { id: 8, nombre: "Luis Sintético", correo: "luis@ejemplo.test", rol: "agent" },
    ]);
    expect(obtenerAgente).not.toHaveBeenCalledWith(1);
  });

  it("si la cuenta no respondió devuelve null (la pantalla pide el número a mano)", async () => {
    expect(await agentesDeCuenta({ ok: false, error: "red" } as never, null, CFG)).toBeNull();
    expect(obtenerAgente).not.toHaveBeenCalled();
  });

  it("un agente que no se pudo leer queda fuera; si no se pudo leer ninguno, null", async () => {
    obtenerAgente.mockImplementation(async (id: number) => (id === 2 ? agente(2, "Ana", "ana@ejemplo.test") : { ok: false, error: "red" }));
    const cuenta = { ok: true as const, data: [{ userId: 2, rol: "agent" as const }, { userId: 3, rol: "agent" as const }] };
    expect((await agentesDeCuenta(cuenta, null, CFG))?.map((a) => a.id)).toEqual([2]);
    obtenerAgente.mockResolvedValue({ ok: false, error: "red" });
    expect(await agentesDeCuenta(cuenta, null, CFG)).toBeNull();
  });

  it("sin miembros, lista vacía; con más del tope, null sin leer uno por uno", async () => {
    expect(await agentesDeCuenta({ ok: true, data: [] }, null, CFG)).toEqual([]);
    const muchos = Array.from({ length: MAX_AGENTES_LEIDOS + 1 }, (_, i) => ({ userId: i + 10, rol: "agent" as const }));
    expect(await agentesDeCuenta({ ok: true, data: muchos }, null, CFG)).toBeNull();
    expect(obtenerAgente).not.toHaveBeenCalled();
  });
});
