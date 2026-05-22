import { describe, it, expect } from "vitest";
import { calcularFleteTerrestre } from "@/lib/calc/fleteTerrestre";

describe("calcularFleteTerrestre", () => {
  it("100 kg Valencia → Caracas: zona 3, tarifa 0.83, multiplicador 1.15", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Caracas",
      pesoRealKg: 100,
    });
    expect(r.zona).toBe(3);
    expect(r.pesoFacturableKg).toBe(100);
    expect(r.esSobre).toBe(false);
    expect(r.tramoAplicado).toBe("60.01 a 100");
    expect(r.tarifaBaseUsdKg).toBeCloseTo(1.0, 2);
    expect(r.tarifaDtdUsdKg).toBeCloseTo(1.0 * 1.15, 2);
    expect(r.fleteBaseUsd).toBeCloseTo(100 * 1.0 * 1.15, 2);
    expect(r.error).toBeUndefined();
  });

  it("peso volumétrico > peso real: usa el volumétrico", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Maturin",
      pesoRealKg: 50,
      volumenM3: 1.5,
    });
    expect(r.pesoVolumetricoKg).toBe(300); // 1.5 × 200
    expect(r.pesoFacturableKg).toBe(300);
    expect(r.zona).toBe(6); // Maturin → zona 6 desde Valencia
    expect(r.tramoAplicado).toBe("200.01 a 300");
  });

  it("peso real > peso volumétrico: usa el real", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Caracas",
      pesoRealKg: 500,
      volumenM3: 0.5, // = 100 kg volumétrico
    });
    expect(r.pesoFacturableKg).toBe(500);
  });

  it("sobre ≤ 1 kg → flete fijo USD 6.00", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Coro",
      pesoRealKg: 0.5,
    });
    expect(r.esSobre).toBe(true);
    expect(r.fleteBaseUsd).toBe(6.0);
    expect(r.tramoAplicado).toBe("Sobre/paquete hasta 1 kg");
    // Total con FPO 6% + IVA 16% sobre $6 base
    const expectedSubtotal = 6 + 6 * 0.06; // 6.36
    const expectedTotal = expectedSubtotal * 1.16;
    expect(r.totalUsd).toBeCloseTo(expectedTotal, 2);
  });

  it("destino inexistente → error", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Marte",
      pesoRealKg: 100,
    });
    expect(r.zona).toBeNull();
    expect(r.error).toContain("Marte");
    expect(r.totalUsd).toBe(0);
  });

  it("peso 0 sin volumen → error", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Caracas",
      pesoRealKg: 0,
    });
    expect(r.error).toContain("peso o volumen");
  });

  it("peso negativo → error", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Caracas",
      pesoRealKg: -10,
    });
    expect(r.error).toContain("negativ");
  });

  it("Valencia → Maracay: zona 1 (corredor inmediato)", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Maracay",
      pesoRealKg: 10,
    });
    expect(r.zona).toBe(1);
    expect(r.tramoAplicado).toBe("9.01 a 10");
    // zona 1 tramo 9.01-10 = $1.31/kg base
    expect(r.tarifaBaseUsdKg).toBeCloseTo(1.31, 2);
  });

  it("Valencia → Porlamar: zona 11 (isla)", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Porlamar",
      pesoRealKg: 50,
    });
    expect(r.zona).toBe(11);
  });

  it("seguro 3% sobre valor declarado", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Caracas",
      pesoRealKg: 100,
      valorDeclaradoUsd: 1000,
    });
    expect(r.seguroUsd).toBeCloseTo(30, 2); // 1000 × 0.03
  });

  it("IVA 16% sobre subtotal", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Caracas",
      pesoRealKg: 100,
    });
    expect(r.ivaUsd).toBeCloseTo(r.subtotalUsd * 0.16, 2);
    expect(r.totalUsd).toBeCloseTo(r.subtotalUsd + r.ivaUsd, 2);
  });

  it("multiplicador DTD custom funciona", () => {
    const base = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Caracas",
      pesoRealKg: 100,
      multiplicadorDtd: 1.0, // sin margen
    });
    const con15 = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Caracas",
      pesoRealKg: 100,
      multiplicadorDtd: 1.15,
    });
    expect(base.tarifaDtdUsdKg).toBeLessThan(con15.tarifaDtdUsdKg);
    expect(con15.tarifaDtdUsdKg / base.tarifaDtdUsdKg).toBeCloseTo(1.15, 2);
  });

  it("origen Maracay funciona también (no solo Valencia)", () => {
    const r = calcularFleteTerrestre({
      origen: "Maracay",
      destino: "Caracas",
      pesoRealKg: 100,
    });
    expect(r.zona).toBe(2); // Maracay → Caracas = zona 2 según Fletes GAG
  });
});
