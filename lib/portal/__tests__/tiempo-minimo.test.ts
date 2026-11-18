import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTRAR_TIEMPO_MINIMO_MS, esperarTiempoMinimo } from "../tiempo-minimo";

describe("piso de tiempo de /entrar (SDD-0672)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-11-18T15:00:00Z") });
  });
  afterEach(() => vi.useRealTimers());

  it("una respuesta rápida espera hasta el piso, ni un milisegundo menos", async () => {
    const inicio = Date.now();
    vi.advanceTimersByTime(100); // el camino rápido tardó 100 ms
    let listo = false;
    const espera = esperarTiempoMinimo(inicio).then(() => {
      listo = true;
    });

    await vi.advanceTimersByTimeAsync(ENTRAR_TIEMPO_MINIMO_MS - 100 - 1);
    expect(listo).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await espera;
    expect(listo).toBe(true);
  });

  it("una respuesta que ya tardó más que el piso no espera nada", async () => {
    const inicio = Date.now();
    vi.advanceTimersByTime(ENTRAR_TIEMPO_MINIMO_MS + 500);
    const timeout = vi.spyOn(globalThis, "setTimeout");
    await esperarTiempoMinimo(inicio);
    expect(timeout).not.toHaveBeenCalled();
  });

  it("el piso es de varios cientos de ms: más que una consulta, menos que una espera molesta", () => {
    expect(ENTRAR_TIEMPO_MINIMO_MS).toBeGreaterThanOrEqual(500);
    expect(ENTRAR_TIEMPO_MINIMO_MS).toBeLessThanOrEqual(1500);
  });
});
