/**
 * Tests del guard de capacidad ADVISORY (SDD-0047, Slice B).
 *
 * Cubre el criterio de aceptación §5 Slice B:
 *  "Guard de capacidad avisa al superar el CBM del tipo (sin bloquear)".
 *
 * evaluateCapacity es PURO (vive en types.ts) y se reusa en la server action
 * assignLooseCargo. Acá probamos su contrato: devuelve `over=true` + `message`
 * cuando la suma supera el CBM o el kg del tipo, y `over=false` cuando entra.
 */

import { describe, it, expect } from "vitest";
import { CONTAINER_TYPES, evaluateCapacity, type StatItem } from "../types";

describe("evaluateCapacity — guard advisory (§4.4)", () => {
  it("no avisa cuando la pieza entra dentro de la capacidad (40HC)", () => {
    const existing: StatItem[] = [{ cbm: 20, weight_kg: 5000, pieces: 10 }];
    const incoming: StatItem = { cbm: 10, weight_kg: 2000, pieces: 4 };
    const g = evaluateCapacity(existing, incoming, "40HC");
    // 30 / 76 cbm = ~39% → sano.
    expect(g.over).toBe(false);
    expect(g.message).toBeNull();
    expect(g.cbmPct).toBeCloseTo((30 / CONTAINER_TYPES["40HC"].cbm) * 100, 6);
  });

  it("AVISA (no bloquea) al superar el CBM del tipo (20GP)", () => {
    // 20GP cap = 33 CBM. existentes 30 + incoming 10 = 40 → sobre-capacidad.
    const existing: StatItem[] = [{ cbm: 30, weight_kg: 1000, pieces: 5 }];
    const incoming: StatItem = { cbm: 10, weight_kg: 500, pieces: 2 };
    const g = evaluateCapacity(existing, incoming, "20GP");
    expect(g.over).toBe(true);
    expect(g.cbmPct).toBeGreaterThan(100);
    expect(g.message).toBeTruthy();
    expect(g.message).toMatch(/CBM/);
    // Es advisory: el contrato NO impide la operación (la action asigna igual).
  });

  it("avisa al superar el PESO del tipo aunque el CBM entre (40GP)", () => {
    // 40GP cap = 67 CBM / 26500 kg. CBM chico, peso enorme.
    const existing: StatItem[] = [{ cbm: 5, weight_kg: 25000, pieces: 2 }];
    const incoming: StatItem = { cbm: 2, weight_kg: 3000, pieces: 1 };
    const g = evaluateCapacity(existing, incoming, "40GP");
    expect(g.over).toBe(true);
    expect(g.kgPct).toBeGreaterThan(100);
    expect(g.message).toMatch(/peso/);
  });

  it("incluye CBM y peso en el aviso cuando ambos superan", () => {
    const existing: StatItem[] = [{ cbm: 70, weight_kg: 28000, pieces: 30 }];
    const incoming: StatItem = { cbm: 10, weight_kg: 2000, pieces: 5 };
    const g = evaluateCapacity(existing, incoming, "40HC");
    expect(g.over).toBe(true);
    expect(g.message).toMatch(/CBM/);
    expect(g.message).toMatch(/peso/);
  });

  it("tipo desconocido → no hay capacidad de referencia → no avisa", () => {
    const existing: StatItem[] = [{ cbm: 200, weight_kg: 99999, pieces: 50 }];
    const incoming: StatItem = { cbm: 100, weight_kg: 99999, pieces: 50 };
    const g = evaluateCapacity(existing, incoming, "45HC");
    expect(g.over).toBe(false);
    expect(g.message).toBeNull();
  });

  it("contenedor vacío + pieza chica → sin aviso", () => {
    const g = evaluateCapacity([], { cbm: 3, weight_kg: 800, pieces: 4 }, "40HC");
    expect(g.over).toBe(false);
    expect(g.cbmPct).toBeGreaterThan(0);
  });
});
