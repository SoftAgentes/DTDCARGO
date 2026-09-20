// @vitest-environment node
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

  // ─── Modos de cotización CBM ────────────────────────────────────────

  it("modo cbm-casco + destino casco (Maracay) → total $0", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Maracay",
      pesoRealKg: 100,
      modoCotizacion: "cbm-casco",
    });
    expect(r.modoAplicado).toBe("cbm-casco");
    expect(r.totalUsd).toBe(0);
    expect(r.fleteBaseUsd).toBe(0);
    expect(r.notaCasco).toContain("Maracay");
    expect(r.notaCasco).toContain("incluido");
  });

  it("modo cbm-casco + destino casco (Caracas) → total $0 (pedido DTD)", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Caracas",
      pesoRealKg: 100,
      modoCotizacion: "cbm-casco",
    });
    expect(r.totalUsd).toBe(0);
    expect(r.modoAplicado).toBe("cbm-casco");
  });

  it("modo cbm-casco + destino FUERA del casco (Barquisimeto) → fallback a cbm-lejos con warning", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Barquisimeto",
      pesoRealKg: 100,
      modoCotizacion: "cbm-casco",
    });
    expect(r.modoAplicado).toBe("cbm-lejos");
    expect(r.warning).toContain("Barquisimeto");
    // SDD-0237: "casco central" murió de cara al cliente. Se afirma lo que
    // el aviso tiene que seguir diciendo — de qué zona habla — sin pinear
    // la frase completa, que es copy y puede afinarse.
    expect(r.warning).toMatch(/zona que tu CBM ya cubre/i);
    expect(r.warning).not.toMatch(/casco central/i);
    expect(r.totalUsd).toBeGreaterThan(0); // Cobra (con descuento)
  });

  it("modo cbm-lejos + destino fuera del casco → descuento aplicado", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Maracaibo",
      pesoRealKg: 100,
      modoCotizacion: "cbm-lejos",
    });
    expect(r.modoAplicado).toBe("cbm-lejos");
    expect(r.descuentoCascoUsd).toBeGreaterThan(0);
    expect(r.notaCasco).toMatch(/Valencia → Pto Cabello/);
    expect(r.notaCasco).not.toMatch(/casco central/i);

    // Comparar con solo-terrestre: el descuento debe hacerlo más barato
    const sinCbm = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Maracaibo",
      pesoRealKg: 100,
      modoCotizacion: "solo-terrestre",
    });
    expect(r.totalUsd).toBeLessThan(sinCbm.totalUsd);
  });

  it("modo cbm-lejos + destino EN el casco → fallback a cbm-casco con warning", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Maracay",
      pesoRealKg: 100,
      modoCotizacion: "cbm-lejos",
    });
    expect(r.modoAplicado).toBe("cbm-casco");
    expect(r.totalUsd).toBe(0);
    // SDD-0237: "casco central" murió de cara al cliente. Se afirma lo que
    // el aviso tiene que seguir diciendo — de qué zona habla — sin pinear
    // la frase completa, que es copy y puede afinarse.
    expect(r.warning).toMatch(/zona que tu CBM ya cubre/i);
    expect(r.warning).not.toMatch(/casco central/i);
  });

  it("modo solo-terrestre (default) ignora la lógica de casco", () => {
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Maracay", // está en casco
      pesoRealKg: 100,
      modoCotizacion: "solo-terrestre",
    });
    expect(r.modoAplicado).toBe("solo-terrestre");
    expect(r.totalUsd).toBeGreaterThan(0); // cobra completo aunque sea casco
    expect(r.descuentoCascoUsd).toBe(0);
  });

  it("descuento casco no hace el total negativo", () => {
    // Edge case: tramo donde zona 1 tarifa > zona destino tarifa
    // (rare pero posible en tarifa Fletes GAG por la columna zona 1 inversa en 2.01-3 kg)
    const r = calcularFleteTerrestre({
      origen: "Valencia",
      destino: "Barquisimeto",
      pesoRealKg: 2.5, // tramo "2.01 a 3" tiene zona 1 más cara que zona 3
      modoCotizacion: "cbm-lejos",
    });
    expect(r.fleteBaseUsd).toBeGreaterThanOrEqual(0);
    expect(r.totalUsd).toBeGreaterThanOrEqual(0);
  });
});
