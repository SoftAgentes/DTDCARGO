// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  slugify,
  validateCityInput,
} from "@/lib/studio/calculator-cities-types";

/**
 * Validadores de las ciudades del calculador (Fase 3 Slice B, SDD-0055).
 * Espejan los CHECK de la migración 0104 (km ≥ 0, slug no vacío).
 */
describe("slugify", () => {
  it("normaliza acentos, mayúsculas y espacios a kebab-case", () => {
    expect(slugify("San Cristóbal")).toBe("san-cristobal");
    expect(slugify("Isla Margarita")).toBe("isla-margarita");
    expect(slugify("  Puerto   Ordaz  ")).toBe("puerto-ordaz");
    expect(slugify("Mérida")).toBe("merida");
  });

  it("quita guiones de los bordes y colapsa no-alfanuméricos", () => {
    expect(slugify("--Valera!!--")).toBe("valera");
    expect(slugify("Ciudad / Bolívar")).toBe("ciudad-bolivar");
  });
});

describe("validateCityInput", () => {
  it("acepta una ciudad válida y deriva el slug del label si falta", () => {
    const { input, fieldErrors } = validateCityInput({
      label: "Barquisimeto",
      km: 220,
      casco: false,
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).toBeTruthy();
    expect(input!.slug).toBe("barquisimeto");
    expect(input!.km).toBe(220);
    expect(input!.casco).toBe(false);
    expect(input!.sort_order).toBe(0);
  });

  it("respeta un slug explícito válido", () => {
    const { input } = validateCityInput({
      label: "Puerto La Cruz",
      slug: "pto-la-cruz",
      km: 430,
    });
    expect(input!.slug).toBe("pto-la-cruz");
  });

  it("rechaza label vacío", () => {
    const { input, fieldErrors } = validateCityInput({ label: "  ", km: 0 });
    expect(input).toBeUndefined();
    expect(fieldErrors?.label).toBeTruthy();
  });

  it("rechaza km negativo", () => {
    const { fieldErrors } = validateCityInput({ label: "X", km: -5 });
    expect(fieldErrors?.km).toBeTruthy();
  });

  it("rechaza km ausente / no numérico", () => {
    const { fieldErrors } = validateCityInput({ label: "X" });
    expect(fieldErrors?.km).toBeTruthy();
  });

  it("acepta km = 0 (casco central)", () => {
    const { input, fieldErrors } = validateCityInput({
      label: "Valencia",
      km: 0,
      casco: true,
    });
    expect(fieldErrors).toBeUndefined();
    expect(input!.km).toBe(0);
    expect(input!.casco).toBe(true);
  });

  it("rechaza slug con caracteres inválidos", () => {
    const { fieldErrors } = validateCityInput({
      label: "X",
      slug: "Con Espacios",
      km: 10,
    });
    expect(fieldErrors?.slug).toBeTruthy();
  });

  it("rechaza sort_order negativo y redondea el válido", () => {
    expect(
      validateCityInput({ label: "X", km: 1, sort_order: -2 }).fieldErrors
        ?.sort_order,
    ).toBeTruthy();
    expect(
      validateCityInput({ label: "X", km: 1, sort_order: 3.7 }).input!.sort_order,
    ).toBe(4);
  });
});
