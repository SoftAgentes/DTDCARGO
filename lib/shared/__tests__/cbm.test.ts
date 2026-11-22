import { describe, expect, it } from "vitest";
import { CBM_MAX_DECIMALS, cbmPlano, formatCbm, roundCbm } from "../cbm";

describe("formatCbm — solo los decimales que el valor tiene (máx. 4), es-VE", () => {
  it.each([
    [0.0012, "0,0012"],
    [1.5, "1,5"],
    [2, "2"],
    [0.12, "0,12"],
    [0, "0"],
    [10, "10"],
    [12.3456, "12,3456"],
    [0.00004, "0"],
    [0.00005, "0,0001"],
    [1.23456, "1,2346"],
    [100.1, "100,1"],
    [-0, "0"],
  ])("%s → %s", (n, esperado) => {
    expect(formatCbm(n)).toBe(esperado);
  });

  it("acepta strings numéricos (columnas numeric de PostgREST)", () => {
    expect(formatCbm("0.0120")).toBe("0,012");
    expect(formatCbm("3.400")).toBe("3,4");
  });

  it("vacío o inválido → fallback", () => {
    expect(formatCbm(null)).toBe("—");
    expect(formatCbm(undefined)).toBe("—");
    expect(formatCbm("")).toBe("—");
    expect(formatCbm(Number.NaN)).toBe("—");
    expect(formatCbm(null, { fallback: "" })).toBe("");
  });

  it("unidad opcional y locale elegible", () => {
    expect(formatCbm(0.0012, { unit: true })).toBe("0,0012 m³");
    expect(formatCbm(2, { unit: "CBM" })).toBe("2 CBM");
    expect(formatCbm(null, { unit: true })).toBe("—");
    expect(formatCbm(0.0012, { locale: "en-US" })).toBe("0.0012");
  });

  it("nunca usa notación científica", () => {
    expect(formatCbm(1e-7)).toBe("0");
  });
});

describe("roundCbm", () => {
  it("conserva 4 decimales y no recorta a 2 ni a 3", () => {
    expect(CBM_MAX_DECIMALS).toBe(4);
    expect(roundCbm(0.0012)).toBe(0.0012);
    expect(roundCbm(0.12345)).toBe(0.1235);
    expect(roundCbm(1.00005)).toBe(1.0001);
  });

  it("sumar muchas cargas pequeñas no pierde volumen", () => {
    const suma = Array.from({ length: 1000 }, () => 0.0012).reduce((a, b) => a + b, 0);
    expect(roundCbm(suma)).toBe(1.2);
    expect(formatCbm(suma)).toBe("1,2");
  });
});

describe("cbmPlano (CSV)", () => {
  it("punto decimal, sin miles ni ceros de relleno", () => {
    expect(cbmPlano(0.0012)).toBe("0.0012");
    expect(cbmPlano("3.400")).toBe("3.4");
    expect(cbmPlano(1234.5)).toBe("1234.5");
    expect(cbmPlano(null)).toBe("");
  });
});
