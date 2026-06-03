/**
 * Tests del helper PURO containerStats (SDD-0047, Slice A).
 *
 * Cubre el criterio de aceptación §5 Slice A:
 *  "containerStats calcula CBM%/kg%/libre igual que el helper del Norte".
 *
 * Los números de referencia salen de naviera-data.jsx (CONTAINERS):
 *  - cont-502 (40HC) → items con cbm 8.2+4.6+6.8+5.4 = 25.0, kg 9900, pieces 51.
 *  - 40HC cap = cbm 76 / kg 26500.
 */

import { describe, it, expect } from "vitest";
import {
  containerStats,
  CONTAINER_TYPES,
  type StatItem,
} from "../types";

// Items del cont-502 del Norte (DTD-CONSOL-0502, 40HC).
const CONT_502_ITEMS: StatItem[] = [
  { cbm: 8.2, weight_kg: 3400, pieces: 14 },
  { cbm: 4.6, weight_kg: 1800, pieces: 6 },
  { cbm: 6.8, weight_kg: 2100, pieces: 22 },
  { cbm: 5.4, weight_kg: 2600, pieces: 9 },
];

describe("containerStats — calca el helper del Norte", () => {
  it("suma cbm/kg/pieces igual que el reduce del Norte", () => {
    const s = containerStats(CONT_502_ITEMS, "40HC");
    expect(s.usedCbm).toBeCloseTo(25.0, 6);
    expect(s.usedKg).toBe(9900);
    expect(s.pieces).toBe(51);
    expect(s.clients).toBe(4); // = items.length
  });

  it("calcula cbmPct / kgPct contra la capacidad del tipo (40HC)", () => {
    const cap = CONTAINER_TYPES["40HC"];
    const s = containerStats(CONT_502_ITEMS, "40HC");
    // Mismo cálculo que el Norte: (usedCbm / cap.cbm) * 100.
    expect(s.cbmPct).toBeCloseTo((25.0 / cap.cbm) * 100, 6);
    expect(s.kgPct).toBeCloseTo((9900 / cap.kg) * 100, 6);
  });

  it("calcula freeCbm / freeKg = max(0, cap - usado)", () => {
    const cap = CONTAINER_TYPES["40HC"];
    const s = containerStats(CONT_502_ITEMS, "40HC");
    expect(s.freeCbm).toBeCloseTo(cap.cbm - 25.0, 6);
    expect(s.freeKg).toBe(cap.kg - 9900);
    expect(s.cap).toEqual(cap);
  });

  it("sobre-capacidad: cbmPct > 100 y freeCbm = 0 (advisory, §4.4)", () => {
    // 20GP cap = 33 cbm; metemos 40 cbm.
    const over: StatItem[] = [{ cbm: 40, weight_kg: 1000, pieces: 1 }];
    const s = containerStats(over, "20GP");
    expect(s.cbmPct).toBeGreaterThan(100);
    expect(s.freeCbm).toBe(0); // clamp en 0, no negativo
  });

  it("tipo desconocido → cap null, % en 0, sin dividir por cero", () => {
    const s = containerStats(CONT_502_ITEMS, "45HC");
    expect(s.cap).toBeNull();
    expect(s.cbmPct).toBe(0);
    expect(s.kgPct).toBe(0);
    expect(s.freeCbm).toBe(0);
    // los usados se siguen sumando aunque no haya cap
    expect(s.usedCbm).toBeCloseTo(25.0, 6);
  });

  it("contenedor vacío → todo 0, clients 0", () => {
    const s = containerStats([], "40HC");
    expect(s.usedCbm).toBe(0);
    expect(s.usedKg).toBe(0);
    expect(s.pieces).toBe(0);
    expect(s.cbmPct).toBe(0);
    expect(s.clients).toBe(0);
    expect(s.freeCbm).toBe(CONTAINER_TYPES["40HC"].cbm);
  });

  it("tolera valores no numéricos (NaN → 0)", () => {
    const dirty = [
      { cbm: Number("x"), weight_kg: 100, pieces: 2 },
      { cbm: 10, weight_kg: Number(undefined), pieces: 3 },
    ] as StatItem[];
    const s = containerStats(dirty, "40HC");
    expect(s.usedCbm).toBe(10);
    expect(s.usedKg).toBe(100);
    expect(s.pieces).toBe(5);
  });
});

describe("CONTAINER_TYPES — espejo del catálogo del Norte", () => {
  it("20GP / 40GP / 40HC con cbm/kg correctos", () => {
    expect(CONTAINER_TYPES["20GP"]).toEqual({ label: "20' GP", cbm: 33, kg: 28000 });
    expect(CONTAINER_TYPES["40GP"]).toEqual({ label: "40' GP", cbm: 67, kg: 26500 });
    expect(CONTAINER_TYPES["40HC"]).toEqual({ label: "40' HC", cbm: 76, kg: 26500 });
  });
});
